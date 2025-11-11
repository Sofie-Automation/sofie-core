import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { DeviceTriggerArguments, UIDeviceTriggerPreview } from '@sofie-automation/meteor-lib/dist/api/MountedTriggers'
import { getCurrentTime } from '../lib/lib'
import { SetupObserversResult, setUpOptimizedObserverArray, TriggerUpdate } from '../lib/customPublication'
import { CustomPublish, meteorCustomPublish } from '../lib/customPublication/publish'
import { PeripheralDevices } from '../collections'
import { assertConnectionHasOneOfPermissions } from '../security/auth'

/** IDEA: This could potentially be a Capped Collection, thus enabling scaling Core horizontally:
 *  https://www.mongodb.com/docs/manual/core/capped-collections/ */
const lastTriggers: Record<string, { triggers: UIDeviceTriggerPreview[]; updated?: (() => void) | undefined }> = {}

meteorCustomPublish(
	MeteorPubSub.deviceTriggersPreview,
	CustomCollectionName.UIDeviceTriggerPreviews,
	async function (pub, studioId: StudioId, _token: string | undefined) {
		check(studioId, String)

		assertConnectionHasOneOfPermissions(this.connection, 'configure')

		await createObserverForDeviceTriggersPreviewsPublication(pub, MeteorPubSub.deviceTriggersPreview, studioId)
	}
)

export async function insertInputDeviceTriggerIntoPreview(
	deviceId: PeripheralDeviceId,
	triggerDeviceId: string,
	triggerId: string,
	values?: DeviceTriggerArguments
): Promise<void> {
	if (typeof deviceId !== 'string') return
	const pDevice = await PeripheralDevices.findOneAsync(deviceId)

	if (!pDevice) throw new Meteor.Error(404, `Could not find peripheralDevice "${deviceId}"`)

	const studioId = unprotectString(pDevice.studioAndConfigId?.studioId)
	if (!studioId) throw new Meteor.Error(501, `Device "${pDevice._id}" is not assigned to any studio`)

	const lastTriggersStudio = prepareTriggerBufferForStudio(studioId)
	lastTriggersStudio.triggers.push({
		_id: getRandomId(),
		peripheralDeviceId: deviceId,
		triggerDeviceId,
		triggerId,
		timestamp: getCurrentTime(),
		values,
	})
	while (lastTriggersStudio.triggers.length > 5) {
		lastTriggersStudio.triggers.shift()
	}
	lastTriggersStudio.updated?.()
}

function prepareTriggerBufferForStudio(studioId: string) {
	if (lastTriggers[studioId] === undefined) {
		lastTriggers[studioId] = {
			triggers: [],
			updated: undefined,
		}
	}

	return lastTriggers[studioId]
}

async function setupDeviceTriggersPreviewsObservers(
	args: ReadonlyDeep<DeviceTriggersPreviewArgs>,
	triggerUpdate: TriggerUpdate<DeviceTriggersUpdateProps>
): Promise<SetupObserversResult> {
	const studioId = unprotectString(args.studioId)
	const lastTriggersStudio = prepareTriggerBufferForStudio(studioId)

	lastTriggersStudio.updated = () => {
		triggerUpdate(lastTriggersStudio)
	}

	triggerUpdate(lastTriggersStudio)

	return [
		{
			stop: () => {
				lastTriggersStudio.updated = undefined
			},
		},
	]
}

async function createObserverForDeviceTriggersPreviewsPublication(
	pub: CustomPublish<UIDeviceTriggerPreview>,
	observerId: MeteorPubSub,
	studioId: StudioId
) {
	return setUpOptimizedObserverArray<
		UIDeviceTriggerPreview,
		DeviceTriggersPreviewArgs,
		Record<string, never>,
		DeviceTriggersUpdateProps
	>(
		`pub_${observerId}_${studioId}`,
		{ studioId },
		setupDeviceTriggersPreviewsObservers,
		manipulateMountedTriggersPublicationData,
		pub,
		0 // ms
	)
}

async function manipulateMountedTriggersPublicationData(
	_args: ReadonlyDeep<DeviceTriggersPreviewArgs>,
	_state: Partial<Record<string, never>>,
	newProps: ReadonlyDeep<Partial<DeviceTriggersUpdateProps> | undefined>
): Promise<UIDeviceTriggerPreview[]> {
	const triggers: UIDeviceTriggerPreview[] = Array.from(newProps?.triggers ?? [])
	return triggers
}

interface DeviceTriggersPreviewArgs {
	studioId: StudioId
}

interface DeviceTriggersUpdateProps {
	triggers: readonly UIDeviceTriggerPreview[]
}
