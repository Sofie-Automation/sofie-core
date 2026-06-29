import { PeripheralDeviceId, RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import {
	CustomPublish,
	CustomPublishCollection,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
	SetupObserversResult,
	TriggerUpdate,
} from '../../lib/customPublication'
import { logger } from '../../logging'
import { ContentCache, createReactiveContentCache } from './reactiveContentCache'
import { RundownsObserver } from '../lib/rundownsObserver'
import { RundownContentObserver } from './rundownContentObserver'
import {
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { checkAccessAndGetPeripheralDevice } from '../../security/check'
import { check } from '../../lib/check'
import { IngestRundownStatus } from '@sofie-automation/shared-lib/dist/ingest/rundownStatus'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { createIngestRundownStatus } from './createIngestRundownStatus'
import { assertConnectionHasOneOfPermissions } from '../../security/auth'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'

interface IngestRundownStatusArgs {
	readonly deviceId: PeripheralDeviceId
}

export interface IngestRundownStatusState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface IngestRundownStatusUpdateProps {
	newCache: ContentCache

	invalidateRundownIds: RundownId[]
	invalidatePlaylistIds: RundownPlaylistId[]
}

async function setupIngestRundownStatusPublicationObservers(
	args: ReadonlyDeep<IngestRundownStatusArgs>,
	triggerUpdate: TriggerUpdate<IngestRundownStatusUpdateProps>
): Promise<SetupObserversResult> {
	const rundownsObserver = await RundownsObserver.createForPeripheralDevice(args.deviceId, async (rundownIds) => {
		logger.silly(`Creating new RundownContentObserver`, rundownIds)

		// TODO - can this be done cheaper?
		const cache = createReactiveContentCache(rundownIds)

		// Push update
		triggerUpdate({ newCache: cache })

		const contentObserver = await RundownContentObserver.create(rundownIds, cache)

		const innerQueries = [
			cache.Playlists.observeChanges(
				{
					added: (docId) => triggerUpdate({ invalidatePlaylistIds: [docId] }),
					changed: (docId) => triggerUpdate({ invalidatePlaylistIds: [docId] }),
					removed: (docId) => triggerUpdate({ invalidatePlaylistIds: [docId] }),
				},
				{ nonMutatingCallbacks: true }
			),
			cache.Rundowns.observeChanges(
				{
					added: (docId) => {
						triggerUpdate({ invalidateRundownIds: [docId] })
						contentObserver.checkPlaylistIds()
					},
					changed: (docId) => {
						triggerUpdate({ invalidateRundownIds: [docId] })
						contentObserver.checkPlaylistIds()
					},
					removed: (docId) => {
						triggerUpdate({ invalidateRundownIds: [docId] })
						contentObserver.checkPlaylistIds()
					},
				},
				{ nonMutatingCallbacks: true }
			),
			cache.Parts.observe({
				added: (doc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId] }),
				changed: (doc, oldDoc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId, oldDoc.rundownId] }),
				removed: (doc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId] }),
			}),
			cache.PartInstances.observe({
				added: (doc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId] }),
				changed: (doc, oldDoc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId, oldDoc.rundownId] }),
				removed: (doc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId] }),
			}),
			cache.NrcsIngestData.observe({
				added: (doc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId] }),
				changed: (doc, oldDoc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId, oldDoc.rundownId] }),
				removed: (doc) => triggerUpdate({ invalidateRundownIds: [doc.rundownId] }),
			}),
		]

		return () => {
			contentObserver.dispose()

			for (const query of innerQueries) {
				query.stop()
			}
		}
	})

	// Set up observers:
	return [rundownsObserver]
}

async function manipulateIngestRundownStatusPublicationData(
	_args: IngestRundownStatusArgs,
	state: Partial<IngestRundownStatusState>,
	collection: CustomPublishCollection<IngestRundownStatus>,
	updateProps: Partial<ReadonlyDeep<IngestRundownStatusUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache ?? undefined
	}

	if (!state.contentCache) {
		// Remove all the notes
		collection.remove(null)

		return
	}

	const updateAll = !updateProps || !!updateProps?.newCache
	if (updateAll) {
		// Remove all the notes
		collection.remove(null)

		const knownRundownIds = new Set(state.contentCache.RundownIds)

		for (const rundownId of knownRundownIds) {
			const newDoc = createIngestRundownStatus(state.contentCache, rundownId)
			if (newDoc) collection.replace(newDoc)
		}
	} else {
		const regenerateForRundownIds = new Set(updateProps.invalidateRundownIds)

		// Include anything where the playlist has changed
		if (updateProps.invalidatePlaylistIds && updateProps.invalidatePlaylistIds.length > 0) {
			const rundownsToUpdate = state.contentCache.Rundowns.findFetch(
				{
					playlistId: { $in: updateProps.invalidatePlaylistIds },
				},
				{
					projection: {
						_id: 1,
					},
				}
			) as Pick<DBRundown, '_id'>[]

			for (const rundown of rundownsToUpdate) {
				regenerateForRundownIds.add(rundown._id)
			}
		}

		for (const rundownId of regenerateForRundownIds) {
			const newDoc = createIngestRundownStatus(state.contentCache, rundownId)
			if (newDoc) {
				collection.replace(newDoc)
			} else {
				collection.remove(rundownId)
			}
		}
	}
}

async function startOrJoinIngestStatusPublication(
	pub: CustomPublish<IngestRundownStatus>,
	deviceId: PeripheralDeviceId
) {
	await setUpCollectionOptimizedObserver<
		IngestRundownStatus,
		IngestRundownStatusArgs,
		IngestRundownStatusState,
		IngestRundownStatusUpdateProps
	>(
		`pub_${PeripheralDevicePubSub.ingestDeviceRundownStatus}_${deviceId}`,
		{ deviceId },
		setupIngestRundownStatusPublicationObservers,
		manipulateIngestRundownStatusPublicationData,
		pub,
		100
	)
}

meteorCustomPublish(
	PeripheralDevicePubSub.ingestDeviceRundownStatus,
	PeripheralDevicePubSubCollectionsNames.ingestRundownStatus,
	async function (pub, deviceId: PeripheralDeviceId, token: string | undefined) {
		check(deviceId, String)

		await checkAccessAndGetPeripheralDevice(deviceId, token, this)

		await startOrJoinIngestStatusPublication(pub, deviceId)
	}
)

meteorCustomPublish(
	MeteorPubSub.ingestDeviceRundownStatusTestTool,
	PeripheralDevicePubSubCollectionsNames.ingestRundownStatus,
	async function (pub, deviceId: PeripheralDeviceId) {
		check(deviceId, String)

		assertConnectionHasOneOfPermissions(this.connection, 'testing')

		await startOrJoinIngestStatusPublication(pub, deviceId)
	}
)
