import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { PackageManagerPlayoutContext } from '@sofie-automation/shared-lib/dist/package-manager/publications'
import { check } from 'meteor/check'
import { ReadonlyDeep } from 'type-fest'
import { RundownPlaylists, Rundowns } from '../../collections'
import {
	meteorCustomPublish,
	SetupObserversResult,
	setUpOptimizedObserverArray,
	TriggerUpdate,
} from '../../lib/customPublication'
import { logger } from '../../logging'
import {
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { checkAccessAndGetPeripheralDevice } from '../../security/check'

export type RundownPlaylistCompact = Pick<DBRundownPlaylist, '_id' | 'activationId' | 'rehearsal' | 'rundownIdsInOrder'>
const rundownPlaylistFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<RundownPlaylistCompact>>({
	_id: 1,
	activationId: 1,
	rehearsal: 1,
	rundownIdsInOrder: 1,
})

interface PackageManagerPlayoutContextArgs {
	readonly studioId: StudioId
	readonly deviceId: PeripheralDeviceId
}

type PackageManagerPlayoutContextUpdateProps = Record<string, never>

type PackageManagerPlayoutContextState = Record<string, never>

async function setupExpectedPackagesPublicationObservers(
	args: ReadonlyDeep<PackageManagerPlayoutContextArgs>,
	triggerUpdate: TriggerUpdate<PackageManagerPlayoutContextUpdateProps>
): Promise<SetupObserversResult> {
	// Set up observers:
	return [
		RundownPlaylists.observeChanges(
			{
				studioId: args.studioId,
			},
			{
				added: () => triggerUpdate({}),
				changed: () => triggerUpdate({}),
				removed: () => triggerUpdate({}),
			},
			{
				projection: rundownPlaylistFieldSpecifier,
			}
		),
	]
}

async function manipulateExpectedPackagesPublicationData(
	args: ReadonlyDeep<PackageManagerPlayoutContextArgs>,
	_state: Partial<PackageManagerPlayoutContextState>,
	_updateProps: Partial<PackageManagerPlayoutContextUpdateProps> | undefined
): Promise<PackageManagerPlayoutContext[] | null> {
	// Prepare data for publication:

	// Future: this may want to cache on the state, but with only a single observer there feels little point

	const activePlaylist = (await RundownPlaylists.findOneAsync(
		{
			studioId: args.studioId,
			activationId: { $exists: true },
		},
		{ projection: rundownPlaylistFieldSpecifier }
	)) as RundownPlaylistCompact | undefined

	const activeRundowns = activePlaylist
		? ((await Rundowns.findFetchAsync(
				{
					playlistId: activePlaylist._id,
				},
				{
					projection: { _id: 1 },
				}
			)) as Pick<DBRundown, '_id'>[])
		: []

	return literal<PackageManagerPlayoutContext[]>([
		{
			_id: args.deviceId,
			activePlaylist: activePlaylist
				? {
						_id: activePlaylist._id,
						active: !!activePlaylist.activationId,
						rehearsal: !!activePlaylist.rehearsal,
					}
				: null,
			activeRundowns: activeRundowns.map((rundown) => {
				return {
					_id: rundown._id,
					_rank: activePlaylist?.rundownIdsInOrder?.indexOf(rundown._id) ?? 0,
				}
			}),
		},
	])
}

meteorCustomPublish(
	PeripheralDevicePubSub.packageManagerPlayoutContext,
	PeripheralDevicePubSubCollectionsNames.packageManagerPlayoutContext,
	async function (pub, deviceId: PeripheralDeviceId, token: string | undefined) {
		check(deviceId, String)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, this)

		const studioId = peripheralDevice.studioAndConfigId?.studioId
		if (!studioId) {
			logger.warn(`Pub.packageManagerPlayoutContext: device "${peripheralDevice._id}" has no studioId`)
			return this.ready()
		}

		await setUpOptimizedObserverArray<
			PackageManagerPlayoutContext,
			PackageManagerPlayoutContextArgs,
			PackageManagerPlayoutContextState,
			PackageManagerPlayoutContextUpdateProps
		>(
			`${PeripheralDevicePubSub.packageManagerPlayoutContext}_${studioId}_${deviceId}`,
			{ studioId, deviceId },
			setupExpectedPackagesPublicationObservers,
			manipulateExpectedPackagesPublicationData,
			pub,
			500 // ms, wait this time before sending an update
		)
	}
)
