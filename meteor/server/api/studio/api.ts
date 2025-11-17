import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import { registerClassToMeteorMethods } from '../../methods'
import { NewStudiosAPI, StudiosAPIMethods } from '@sofie-automation/meteor-lib/dist/api/studios'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { literal, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { lazyIgnore } from '../../lib/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import {
	ExpectedPackages,
	ExpectedPackageWorkStatuses,
	ExternalMessageQueue,
	MediaObjects,
	Notifications,
	PackageContainerPackageStatuses,
	PackageInfos,
	PeripheralDevices,
	RundownPlaylists,
	Rundowns,
	Studios,
	Timeline,
} from '../../collections'
import { MethodContextAPI, MethodContext } from '../methodContext'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging'
import { DEFAULT_MINIMUM_TAKE_SPAN } from '@sofie-automation/shared-lib/dist/core/constants'
import { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { assertConnectionHasOneOfPermissions } from '../../security/auth'

const PERMISSIONS_FOR_MANAGE_STUDIOS: Array<keyof UserPermissions> = ['configure']

async function insertStudio(context: MethodContext, newId?: StudioId): Promise<StudioId> {
	if (newId) check(newId, String)

	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_MANAGE_STUDIOS)

	return insertStudioInner(newId)
}
export async function insertStudioInner(newId?: StudioId): Promise<StudioId> {
	const studioCount = await Studios.countDocuments()
	if (studioCount > 0) {
		throw new Meteor.Error(
			400,
			`Only one studio is supported per installation (there are currently ${studioCount})`
		)
	}

	return Studios.insertAsync(
		literal<DBStudio>({
			_id: newId || getRandomId(),
			name: 'New Studio',
			// blueprintId?: BlueprintId
			mappingsWithOverrides: wrapDefaultObject({}),
			supportedShowStyleBase: [],
			blueprintConfigWithOverrides: wrapDefaultObject({}),
			// testToolsConfig?: ITestToolsConfig
			settingsWithOverrides: wrapDefaultObject({
				frameRate: 25,
				mediaPreviewsUrl: '',
				minimumTakeSpan: DEFAULT_MINIMUM_TAKE_SPAN,
				allowHold: false,
				allowPieceDirectPlay: false,
				enableBuckets: true,
				enableEvaluationForm: true,
			}),
			_rundownVersionHash: '',
			routeSetsWithOverrides: wrapDefaultObject({}),
			routeSetExclusivityGroupsWithOverrides: wrapDefaultObject({}),
			packageContainersWithOverrides: wrapDefaultObject({}),
			thumbnailContainerIds: [],
			previewContainerIds: [],
			peripheralDeviceSettings: {
				deviceSettings: wrapDefaultObject({}),
				playoutDevices: wrapDefaultObject({}),
				ingestDevices: wrapDefaultObject({}),
				inputDevices: wrapDefaultObject({}),
			},
			lastBlueprintConfig: undefined,
			lastBlueprintFixUpHash: undefined,
		})
	)
}
async function removeStudio(context: MethodContext, studioId: StudioId): Promise<void> {
	check(studioId, String)

	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_MANAGE_STUDIOS)

	const studioCount = await Studios.countDocuments()
	if (studioCount === 1) {
		throw new Meteor.Error(
			400,
			`The last studio in the system cannot be deleted (there must be at least one studio)`
		)
	}

	const studio = await Studios.findOneAsync(studioId)
	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found`)

	// allowed to remove?
	const rundown = await Rundowns.findOneAsync({ studioId: studio._id }, { projection: { _id: 1 } })
	if (rundown)
		throw new Meteor.Error(404, `Can't remove studio "${studioId}", because the rundown "${rundown._id}" is in it.`)

	const playlist = await RundownPlaylists.findOneAsync({ studioId: studio._id }, { projection: { _id: 1 } })
	if (playlist)
		throw new Meteor.Error(
			404,
			`Can't remove studio "${studioId}", because the rundownPlaylist "${playlist._id}" is in it.`
		)

	const peripheralDevice = await PeripheralDevices.findOneAsync(
		{ 'studioAndConfigId.studioId': studio._id },
		{ projection: { _id: 1 } }
	)
	if (peripheralDevice)
		throw new Meteor.Error(
			404,
			`Can't remoce studio "${studioId}", because the peripheralDevice "${peripheralDevice._id}" is in it.`
		)

	// This is allowed to mutate the job-worker 'owned' collections, as at this point the thread for that studio is about to be destroyed
	await Promise.all([
		Studios.removeAsync(studio._id),
		// Studios.remove({ studioId: studio._id }) // TODO - what was this supposed to be?
		ExternalMessageQueue.removeAsync({ studioId: studio._id }),
		MediaObjects.removeAsync({ studioId: studio._id }),
		Timeline.mutableCollection.removeAsync({ studioId: studio._id }),
		ExpectedPackages.mutableCollection.removeAsync({ studioId: studio._id }),
		ExpectedPackageWorkStatuses.removeAsync({ studioId: studio._id }),
		PackageInfos.removeAsync({ studioId: studio._id }),
		PackageContainerPackageStatuses.removeAsync({ studioId: studio._id }),
		Notifications.removeAsync({ 'relatedTo.studioId': studio._id }),
	])
}

class ServerStudiosAPI extends MethodContextAPI implements NewStudiosAPI {
	async insertStudio() {
		return insertStudio(this)
	}
	async removeStudio(studioId: StudioId) {
		return removeStudio(this, studioId)
	}

	async assignConfigToPeripheralDevice(studioId: StudioId, configId: string, deviceId: PeripheralDeviceId | null) {
		assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_MANAGE_STUDIOS)

		// Unassign other uses
		await PeripheralDevices.updateAsync(
			{
				studioAndConfigId: {
					studioId,
					configId,
				},
				_id: { $ne: deviceId ?? protectString('') },
			},
			{
				$unset: {
					studioAndConfigId: 1,
				},
			},
			{
				multi: true,
			}
		)

		if (deviceId) {
			// Set for the new one
			await PeripheralDevices.updateAsync(deviceId, {
				$set: {
					studioAndConfigId: {
						studioId,
						configId,
					},
				},
			})
		}
	}
}
registerClassToMeteorMethods(StudiosAPIMethods, ServerStudiosAPI, false)

// Set up a watcher for updating the mappingsHash whenever a mapping or route is changed:
function triggerUpdateStudioMappingsHash(studioId: StudioId) {
	lazyIgnore(
		`triggerUpdateStudio_${studioId}`,
		() => {
			Studios.updateAsync(studioId, {
				$set: {
					mappingsHash: getRandomId(),
				},
			}).catch((e) => {
				logger.error(`triggerUpdateStudioMappingsHash: ${stringifyError(e)}`)
			})
		},
		10
	)
}

Meteor.startup(async () => {
	await Studios.observeChanges(
		{},
		{
			added: triggerUpdateStudioMappingsHash,
			changed: triggerUpdateStudioMappingsHash,
			removed: triggerUpdateStudioMappingsHash,
		},
		{
			projection: {
				mappingsWithOverrides: 1,
				routeSetsWithOverrides: 1,
			},
		}
	)
})
