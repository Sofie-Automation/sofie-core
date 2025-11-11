import { PartId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { check, Match } from 'meteor/check'
import {
	CustomPublishCollection,
	SetupObserversResult,
	TriggerUpdate,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
} from '../../lib/customPublication'
import { logger } from '../../logging'
import { CustomCollectionName, MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { ContentCache, PartOmitedFields, createReactiveContentCache } from './reactiveContentCache'
import { ReadonlyDeep } from 'type-fest'
import { RundownPlaylists } from '../../collections'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { RundownsObserver } from '../lib/rundownsObserver'
import { RundownContentObserver } from './rundownContentObserver'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { extractRanks, findMarkerPosition, modifyPartForQuickLoop, stringsToIndexLookup } from '../lib/quickLoop'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../../security/securityVerify'

interface UIPartsArgs {
	readonly playlistId: RundownPlaylistId
}

export interface UIPartsState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface UIPartsUpdateProps {
	newCache: ContentCache

	invalidateSegmentIds: SegmentId[]
	invalidatePartIds: PartId[]

	invalidateQuickLoop: boolean
}

type RundownPlaylistFields = '_id' | 'studioId' | 'rundownIdsInOrder'
const rundownPlaylistFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBRundownPlaylist, RundownPlaylistFields>>
>({
	_id: 1,
	studioId: 1,
	rundownIdsInOrder: 1,
})

async function setupUIPartsPublicationObservers(
	args: ReadonlyDeep<UIPartsArgs>,
	triggerUpdate: TriggerUpdate<UIPartsUpdateProps>
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

			const cache = createReactiveContentCache()

			// Push update
			triggerUpdate({ newCache: cache })

			const obs1 = await RundownContentObserver.create(playlist.studioId, playlist._id, rundownIds, cache)

			const innerQueries = [
				cache.Segments.find({}).observeChanges({
					added: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
					changed: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
					removed: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
				}),
				cache.Parts.find({}).observe({
					added: (doc) => triggerUpdate({ invalidatePartIds: [doc._id] }),
					changed: (doc, oldDoc) => {
						if (doc._rank !== oldDoc._rank) {
							// with part rank change we need to invalidate the entire segment,
							// as the order may affect which unchanged parts are/aren't in quickLoop
							triggerUpdate({ invalidateSegmentIds: [doc.segmentId] })
						} else {
							triggerUpdate({ invalidatePartIds: [doc._id] })
						}
					},
					removed: (doc) => triggerUpdate({ invalidatePartIds: [doc._id] }),
				}),
				cache.RundownPlaylists.find({}).observeChanges({
					added: () => triggerUpdate({ invalidateQuickLoop: true }),
					changed: () => triggerUpdate({ invalidateQuickLoop: true }),
					removed: () => triggerUpdate({ invalidateQuickLoop: true }),
				}),
				cache.StudioSettings.find({}).observeChanges({
					added: () => triggerUpdate({ invalidateQuickLoop: true }),
					changed: () => triggerUpdate({ invalidateQuickLoop: true }),
					removed: () => triggerUpdate({ invalidateQuickLoop: true }),
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

export async function manipulateUIPartsPublicationData(
	_args: UIPartsArgs,
	state: Partial<UIPartsState>,
	collection: CustomPublishCollection<DBPart>,
	updateProps: Partial<ReadonlyDeep<UIPartsUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache ?? undefined
	}

	if (!state.contentCache) {
		// Remove all the parts
		collection.remove(null)

		return
	}

	const playlist = state.contentCache.RundownPlaylists.findOne({})
	if (!playlist) return

	const studioSettings = state.contentCache.StudioSettings.findOne({})
	if (!studioSettings) return

	const rundownRanks = stringsToIndexLookup(playlist.rundownIdsInOrder as unknown as string[])
	const segmentRanks = extractRanks(state.contentCache.Segments.find({}).fetch())

	const quickLoopStartPosition =
		playlist.quickLoop?.start &&
		findMarkerPosition(
			playlist.quickLoop.start,
			-Infinity,
			{ segments: state.contentCache.Segments, parts: state.contentCache.Parts },
			rundownRanks
		)
	const quickLoopEndPosition =
		playlist.quickLoop?.end &&
		findMarkerPosition(
			playlist.quickLoop.end,
			Infinity,
			{ segments: state.contentCache.Segments, parts: state.contentCache.Parts },
			rundownRanks
		)

	updateProps?.invalidatePartIds?.forEach((partId) => {
		collection.remove(partId) // if it still exists, it will be replaced in the next step
	})

	const invalidatedSegmentsSet = new Set(updateProps?.invalidateSegmentIds ?? [])
	const invalidatedPartsSet = new Set(updateProps?.invalidatePartIds ?? [])

	state.contentCache.Parts.find({}).forEach((part) => {
		if (
			updateProps?.invalidateQuickLoop ||
			invalidatedSegmentsSet.has(part.segmentId) ||
			invalidatedPartsSet.has(part._id)
		) {
			modifyPartForQuickLoop(
				part,
				segmentRanks,
				rundownRanks,
				playlist,
				studioSettings.settings,
				quickLoopStartPosition,
				quickLoopEndPosition
			)
			collection.replace(part)
		}
	})
}

meteorCustomPublish(
	MeteorPubSub.uiParts,
	CustomCollectionName.UIParts,
	async function (pub, playlistId: RundownPlaylistId | null) {
		check(playlistId, Match.Optional(String))

		triggerWriteAccessBecauseNoCheckNecessary()

		if (!playlistId) {
			logger.warn(`Pub.uiParts: Not allowed: "${playlistId}"`)
			return
		}

		await setUpCollectionOptimizedObserver<
			Omit<DBPart, PartOmitedFields>,
			UIPartsArgs,
			UIPartsState,
			UIPartsUpdateProps
		>(
			`pub_${MeteorPubSub.uiParts}_${playlistId}`,
			{ playlistId },
			setupUIPartsPublicationObservers,
			manipulateUIPartsPublicationData,
			pub
		)
	}
)
