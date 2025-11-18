import { RundownId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { UISegmentPartNote } from '@sofie-automation/meteor-lib/dist/api/rundownNotifications'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Rundown, getRundownNrcsName } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { groupByToMap, literal, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	CustomPublishCollection,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
	SetupObserversResult,
	TriggerUpdate,
} from '../../lib/customPublication'
import { logger } from '../../logging'
import {
	ContentCache,
	createReactiveContentCache,
	PartFields,
	PartInstanceFields,
	RundownFields,
	SegmentFields,
} from './reactiveContentCache'
import { RundownsObserver } from '../lib/rundownsObserver'
import { RundownContentObserver } from './rundownContentObserver'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { generateNotesForSegment } from './generateNotesForSegment'
import { RundownPlaylists } from '../../collections'
import { check, Match } from 'meteor/check'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../../security/securityVerify'

interface UISegmentPartNotesArgs {
	readonly playlistId: RundownPlaylistId
}

export interface UISegmentPartNotesState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface UISegmentPartNotesUpdateProps {
	newCache: ContentCache

	invalidateRundownIds: RundownId[]
	invalidateSegmentIds: SegmentId[]
}

type RundownPlaylistFields = '_id' | 'studioId'
const rundownPlaylistFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBRundownPlaylist, RundownPlaylistFields>>
>({
	_id: 1,
	studioId: 1,
})

async function setupUISegmentPartNotesPublicationObservers(
	args: ReadonlyDeep<UISegmentPartNotesArgs>,
	triggerUpdate: TriggerUpdate<UISegmentPartNotesUpdateProps>
): Promise<SetupObserversResult> {
	const playlist = (await RundownPlaylists.findOneAsync(args.playlistId, {
		projection: rundownPlaylistFieldSpecifier,
	})) as Pick<DBRundownPlaylist, RundownPlaylistFields> | undefined
	if (!playlist) throw new Error(`RundownPlaylist "${args.playlistId}" not found!`)

	const rundownsObserver = await RundownsObserver.createForPlaylist(
		playlist.studioId,
		playlist._id,
		async (rundownIds) => {
			logger.silly(`Creating new RundownContentObserver`)

			// TODO - can this be done cheaper?
			const cache = createReactiveContentCache()

			// Push update
			triggerUpdate({ newCache: cache })

			const obs1 = await RundownContentObserver.create(rundownIds, cache)

			const innerQueries = [
				cache.Segments.find({}).observeChanges({
					added: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
					changed: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
					removed: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
				}),
				cache.Parts.find({}).observe({
					added: (doc) => triggerUpdate({ invalidateSegmentIds: [doc.segmentId] }),
					changed: (doc, oldDoc) =>
						triggerUpdate({ invalidateSegmentIds: [doc.segmentId, oldDoc.segmentId] }),
					removed: (doc) => triggerUpdate({ invalidateSegmentIds: [doc.segmentId] }),
				}),
				cache.DeletedPartInstances.find({}).observe({
					added: (doc) => triggerUpdate({ invalidateSegmentIds: [doc.segmentId] }),
					changed: (doc, oldDoc) =>
						triggerUpdate({ invalidateSegmentIds: [doc.segmentId, oldDoc.segmentId] }),
					removed: (doc) => triggerUpdate({ invalidateSegmentIds: [doc.segmentId] }),
				}),
				cache.Rundowns.find({}).observeChanges({
					added: (id) => triggerUpdate({ invalidateRundownIds: [protectString(id)] }),
					changed: (id) => triggerUpdate({ invalidateRundownIds: [protectString(id)] }),
					removed: (id) => triggerUpdate({ invalidateRundownIds: [protectString(id)] }),
				}),
			]

			return () => {
				obs1.dispose()

				for (const query of innerQueries) {
					query.stop()
				}
			}
		}
	)

	// Set up observers:
	return [rundownsObserver]
}

export async function manipulateUISegmentPartNotesPublicationData(
	args: UISegmentPartNotesArgs,
	state: Partial<UISegmentPartNotesState>,
	collection: CustomPublishCollection<UISegmentPartNote>,
	updateProps: Partial<ReadonlyDeep<UISegmentPartNotesUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	// We know that `collection` does diffing when 'commiting' all of the changes we have made
	// meaning that for anything we will call `replace()` on, we can `remove()` it first for no extra cost

	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache ?? undefined
	}

	if (!state.contentCache) {
		// Remove all the notes
		collection.remove(null)

		return
	}

	const updateContext = compileUpdateNotesData(state.contentCache)

	const updateAll = !updateProps || !!updateProps?.newCache
	if (updateAll) {
		// Remove all the notes
		collection.remove(null)

		state.contentCache.Segments.find({}).forEach((segment) => {
			updateNotesForSegment(args, updateContext, collection, segment)
		})
	} else {
		const regenerateForSegmentIds = new Set(updateProps.invalidateSegmentIds)

		// Figure out the Rundowns which have changed, but may not have updated the segments/parts
		const changedRundownIdsSet = new Set(updateProps.invalidateRundownIds)
		if (changedRundownIdsSet.size > 0) {
			state.contentCache.Segments.find({}).forEach((segment) => {
				if (changedRundownIdsSet.has(segment.rundownId)) {
					regenerateForSegmentIds.add(segment._id)
				}
			})
		}

		// Remove ones from segments being regenerated
		if (regenerateForSegmentIds.size > 0) {
			collection.remove((doc) => regenerateForSegmentIds.has(doc.segmentId))

			// Generate notes for each segment
			for (const segmentId of regenerateForSegmentIds) {
				const segment = state.contentCache.Segments.findOne(segmentId)

				if (segment) {
					updateNotesForSegment(args, updateContext, collection, segment)
				} else {
					// Notes have already been removed
				}
			}
		}
	}
}

interface UpdateNotesData {
	rundownsCache: Map<RundownId, Pick<Rundown, RundownFields>>
	parts: Map<SegmentId, Pick<DBPart, PartFields>[]>
	deletedPartInstances: Map<SegmentId, Pick<DBPartInstance, PartInstanceFields>[]>
}
function compileUpdateNotesData(cache: ReadonlyDeep<ContentCache>): UpdateNotesData {
	return {
		rundownsCache: normalizeArrayToMap(cache.Rundowns.find({}).fetch(), '_id'),
		parts: groupByToMap(cache.Parts.find({}).fetch(), 'segmentId'),
		deletedPartInstances: groupByToMap(cache.DeletedPartInstances.find({}).fetch(), 'segmentId'),
	}
}

function updateNotesForSegment(
	args: UISegmentPartNotesArgs,
	state: UpdateNotesData,
	collection: CustomPublishCollection<UISegmentPartNote>,
	segment: Pick<DBSegment, SegmentFields>
) {
	const notesForSegment = generateNotesForSegment(
		args.playlistId,
		segment,
		getRundownNrcsName(state.rundownsCache.get(segment.rundownId)),
		state.parts.get(segment._id) ?? [],
		state.deletedPartInstances.get(segment._id) ?? []
	)

	// Insert generated notes
	for (const note of notesForSegment) {
		collection.replace(note)
	}
}

meteorCustomPublish(
	MeteorPubSub.uiSegmentPartNotes,
	CustomCollectionName.UISegmentPartNotes,
	async function (pub, playlistId: RundownPlaylistId | null) {
		check(playlistId, Match.Maybe(String))

		triggerWriteAccessBecauseNoCheckNecessary()

		if (!playlistId) {
			logger.info(`Pub.${CustomCollectionName.UISegmentPartNotes}: Not playlistId`)
			return
		}

		await setUpCollectionOptimizedObserver<
			UISegmentPartNote,
			UISegmentPartNotesArgs,
			UISegmentPartNotesState,
			UISegmentPartNotesUpdateProps
		>(
			`pub_${MeteorPubSub.uiSegmentPartNotes}_${playlistId}`,
			{ playlistId },
			setupUISegmentPartNotesPublicationObservers,
			manipulateUISegmentPartNotesPublicationData,
			pub,
			100
		)
	}
)
