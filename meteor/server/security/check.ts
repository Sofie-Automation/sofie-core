import { PeripheralDeviceId, RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Meteor } from 'meteor/meteor'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { assertConnectionHasOneOfPermissions, RequestCredentials } from './auth'
import { PeripheralDevices, RundownPlaylists, Rundowns } from '../collections'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { MethodContext } from '../api/methodContext'
import { profiler } from '../api/profiler'
import { SubscriptionContext } from '../publications/lib/lib'

/**
 * Check that the current user has write access to the specified playlist, and ensure that the playlist exists
 * @param context
 * @param playlistId Id of the playlist
 */
export async function checkAccessToPlaylist(
	cred: RequestCredentials | null,
	playlistId: RundownPlaylistId
): Promise<VerifiedRundownPlaylistForUserAction> {
	assertConnectionHasOneOfPermissions(cred, 'studio')

	const playlist = (await RundownPlaylists.findOneAsync(
		{ $or: [{ _id: playlistId }, { externalId: playlistId }] },
		{
			projection: {
				_id: 1,
				studioId: 1,
				organizationId: 1,
				name: 1,
			},
		}
	)) as Pick<DBRundownPlaylist, '_id' | 'studioId' | 'organizationId' | 'name'> | undefined
	if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${playlistId}" not found`)

	return playlist
}
export type VerifiedRundownPlaylistForUserAction = Pick<
	DBRundownPlaylist,
	'_id' | 'studioId' | 'organizationId' | 'name'
>

/**
 * Check that the current user has write access to the specified rundown, and ensure that the rundown exists
 * @param context
 * @param rundownId Id of the rundown
 */
export async function checkAccessToRundown(
	cred: RequestCredentials | null,
	rundownId: RundownId
): Promise<VerifiedRundownForUserAction> {
	assertConnectionHasOneOfPermissions(cred, 'studio')

	const rundown = (await Rundowns.findOneAsync(rundownId, {
		projection: {
			_id: 1,
			studioId: 1,
			externalId: 1,
			showStyleVariantId: 1,
			source: 1,
		},
	})) as Pick<DBRundown, '_id' | 'studioId' | 'externalId' | 'showStyleVariantId' | 'source'> | undefined
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found`)

	return rundown
}
export type VerifiedRundownForUserAction = Pick<
	DBRundown,
	'_id' | 'studioId' | 'externalId' | 'showStyleVariantId' | 'source'
>

/** Check Access and return PeripheralDevice, throws otherwise */
export async function checkAccessAndGetPeripheralDevice(
	deviceId: PeripheralDeviceId,
	token: string | undefined,
	context: MethodContext | SubscriptionContext
): Promise<PeripheralDevice> {
	const span = profiler.startSpan('lib.checkAccessAndGetPeripheralDevice')

	assertConnectionHasOneOfPermissions(context.connection, 'gateway')

	// If no token, we will never match
	if (!token) throw new Meteor.Error(401, `Not allowed access to peripheralDevice`)

	const device = await PeripheralDevices.findOneAsync({ _id: deviceId })
	if (!device) throw new Meteor.Error(404, `PeripheralDevice "${deviceId}" not found`)

	// Check if the device has a token, and if it matches:
	if (device.token && device.token === token) {
		span?.end()
		return device
	}

	// If the device has a parent, try that for access control:
	const parentDevice = device.parentDeviceId ? await PeripheralDevices.findOneAsync(device.parentDeviceId) : device
	if (!parentDevice) throw new Meteor.Error(404, `PeripheralDevice parentDevice "${device.parentDeviceId}" not found`)

	// Check if the parent device has a token, and if it matches:
	if (parentDevice.token && parentDevice.token === token) {
		span?.end()
		return device
	}

	// No match for token found
	span?.end()
	throw new Meteor.Error(401, `Not allowed access to peripheralDevice`)
}
