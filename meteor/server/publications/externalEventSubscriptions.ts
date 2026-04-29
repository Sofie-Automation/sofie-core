import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { assertNever, getHash, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { ReadonlyDeep } from 'type-fest'
import {
	CustomPublish,
	CustomPublishCollection,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
	SetupObserversResult,
	TriggerUpdate,
} from '../lib/customPublication'
import { logger } from '../logging'
import { RundownPlaylists, Rundowns } from '../collections'
import {
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
	ExternalEventSubscriptionDocument,
	ExternalEventSubscriptionId,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import type { PeripheralDeviceExternalEvent } from '@sofie-automation/shared-lib/dist/peripheralDevice/externalEvents'
import { checkAccessAndGetPeripheralDevice } from '../security/check'
import { check } from '../lib/check'

type RundownPlaylistFields = '_id' | 'activationId'
const rundownPlaylistFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBRundownPlaylist, RundownPlaylistFields>>
>({
	_id: 1,
	activationId: 1,
})

type RundownFields = '_id' | 'playlistId' | 'externalEventSubscriptions'
const rundownFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBRundown, RundownFields>>>({
	_id: 1,
	playlistId: 1,
	externalEventSubscriptions: 1,
})

interface ExternalEventSubscriptionsArgs {
	readonly studioId: StudioId
	readonly type: PeripheralDeviceExternalEvent['type']
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ExternalEventSubscriptionsState {}

interface ExternalEventSubscriptionsUpdateProps {
	invalidateAll: true
}

async function setupExternalEventSubscriptionsObservers(
	args: ReadonlyDeep<ExternalEventSubscriptionsArgs>,
	triggerUpdate: TriggerUpdate<ExternalEventSubscriptionsUpdateProps>
): Promise<SetupObserversResult> {
	const trigger = () => triggerUpdate({ invalidateAll: true })

	return [
		// Observe active playlists in the studio — activation/deactivation changes which rundowns are in scope
		RundownPlaylists.observeChanges(
			{ studioId: args.studioId },
			{ added: trigger, changed: trigger, removed: trigger },
			{ projection: rundownPlaylistFieldSpecifier }
		),
		// Observe rundowns in the studio — react only when externalEventSubscriptions or playlistId changes
		Rundowns.observeChanges(
			{ studioId: args.studioId },
			{ added: trigger, changed: trigger, removed: trigger },
			{ projection: rundownFieldSpecifier }
		),
	]
}

async function manipulateExternalEventSubscriptionsData(
	args: ReadonlyDeep<ExternalEventSubscriptionsArgs>,
	_state: Partial<ExternalEventSubscriptionsState>,
	collection: CustomPublishCollection<ExternalEventSubscriptionDocument>,
	_updateProps: Partial<ReadonlyDeep<ExternalEventSubscriptionsUpdateProps>> | undefined
): Promise<void> {
	// Find all active playlists in the studio
	const activePlaylists = (await RundownPlaylists.findFetchAsync(
		{ studioId: args.studioId, activationId: { $exists: true } },
		{ projection: rundownPlaylistFieldSpecifier }
	)) as Pick<DBRundownPlaylist, RundownPlaylistFields>[]
	const activePlaylistIds = activePlaylists.map((p) => p._id)

	// Find rundowns belonging to active playlists
	const activeRundowns = (await Rundowns.findFetchAsync(
		{ studioId: args.studioId, playlistId: { $in: activePlaylistIds } },
		{ projection: rundownFieldSpecifier }
	)) as Pick<DBRundown, RundownFields>[]

	// Build the set of valid IDs and the docs to upsert (filtered by type)
	const validIds = new Set<ExternalEventSubscriptionId>()
	const subsToUpsert: ExternalEventSubscriptionDocument[] = []

	for (const rundown of activeRundowns) {
		for (const sub of rundown.externalEventSubscriptions ?? []) {
			if (sub.type !== args.type) continue

			switch (sub.type) {
				case 'tsr': {
					const id = protectString<ExternalEventSubscriptionId>(
						getHash(`tsr_${sub.deviceId}_${sub.deviceType}_${String(sub.event)}`)
					)
					validIds.add(id)
					subsToUpsert.push({
						_id: id,
						type: 'tsr',
						deviceId: sub.deviceId,
						deviceType: sub.deviceType,
						event: sub.event as string,
					})
					break
				}
				default:
					assertNever(sub.type)
					break
			}
		}
	}

	// Remove docs for subscriptions that are no longer active
	collection.remove((doc) => !validIds.has(doc._id))

	// Upsert each individual subscription doc
	for (const sub of subsToUpsert) {
		collection.replace(sub)
	}
}

async function startOrJoinExternalEventSubscriptionsPublication(
	pub: CustomPublish<ExternalEventSubscriptionDocument>,
	studioId: StudioId,
	type: PeripheralDeviceExternalEvent['type']
) {
	await setUpCollectionOptimizedObserver<
		ExternalEventSubscriptionDocument,
		ExternalEventSubscriptionsArgs,
		ExternalEventSubscriptionsState,
		ExternalEventSubscriptionsUpdateProps
	>(
		`pub_${PeripheralDevicePubSub.externalEventSubscriptionsForDevice}_${studioId}_${type}`,
		{ studioId, type },
		setupExternalEventSubscriptionsObservers,
		manipulateExternalEventSubscriptionsData,
		pub,
		100
	)
}

meteorCustomPublish(
	PeripheralDevicePubSub.externalEventSubscriptionsForDevice,
	PeripheralDevicePubSubCollectionsNames.externalEventSubscriptions,
	async function (
		pub: CustomPublish<ExternalEventSubscriptionDocument>,
		type: PeripheralDeviceExternalEvent['type'],
		deviceId: PeripheralDeviceId,
		token: string | undefined
	) {
		check(deviceId, String)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, this)

		const studioId = peripheralDevice.studioAndConfigId?.studioId
		if (!studioId) {
			logger.warn(
				`Publication ${PeripheralDevicePubSub.externalEventSubscriptionsForDevice}: device ${deviceId} has no studio`
			)
			return
		}

		await startOrJoinExternalEventSubscriptionsPublication(pub, studioId, type)
	}
)
