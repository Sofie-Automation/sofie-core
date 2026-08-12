import { z } from 'zod'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { TFunction } from 'i18next'
import { check } from '../../lib/check'
import _ from 'underscore'
import { MethodContext } from '../methodContext'
import {
	DeviceTriggerArguments,
	DeviceTriggerMountedAction,
	PreviewWrappedAdLib,
} from '@sofie-automation/meteor-lib/dist/api/MountedTriggers'
import { logger } from '../../logging'
import { checkAccessAndGetPeripheralDevice } from '../../security/check'
import { StudioActionManagers } from './StudioActionManagers'
import { JobQueueWithClasses } from '@sofie-automation/shared-lib/dist/lib/JobQueueWithClasses'
import { StudioDeviceTriggerManager } from './StudioDeviceTriggerManager'
import { StudioObserver } from './StudioObserver'
import { Studios } from '../../collections'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { TriggersContext } from '@sofie-automation/meteor-lib/dist/triggers/triggersContext'
import { TagsService } from './TagsService'
import { SofieError } from '@sofie-automation/corelib/dist/error'

type ObserverAndManager = {
	observer: StudioObserver
	manager: StudioDeviceTriggerManager
}

/**
 * Start observing studios and maintaining a device-trigger manager per studio. `triggersContext` is
 * injected (rather than importing a global) so the compiled actions dispatch through the process's
 * `MethodRegistry`.
 */
export async function startDeviceTriggersObserver(
	triggersContext: TriggersContext,
	signal: AbortSignal
): Promise<void> {
	const studioObserversAndManagers = new Map<StudioId, ObserverAndManager>()
	const jobQueue = new JobQueueWithClasses({
		autoStart: true,
	})

	function workInQueue(fnc: () => Promise<any>) {
		jobQueue
			.add(async () => {
				const res = await fnc()
				return res
			})
			.catch((e) => {
				logger.error(`Error in DeviceTriggers Studio observer reaction: ${stringifyError(e)}`)
			})
	}

	function createObserverAndManager(studioId: StudioId) {
		logger.debug(`Creating observer for studio "${studioId}"`)
		const manager = new StudioDeviceTriggerManager(studioId, new TagsService(), triggersContext)
		const observer = new StudioObserver(
			studioId,
			(showStyleBaseId, cache) => {
				logger.silly(`Studio observer updating triggers for "${studioId}":"${showStyleBaseId}"`)
				workInQueue(async () => manager.updateTriggers(cache, showStyleBaseId))

				return () => {
					workInQueue(async () => manager.clearTriggers())
				}
			},
			(showStyleBaseId, cache) => {
				workInQueue(async () => manager.updatePieceInstances(cache, showStyleBaseId))

				return () => {
					return
				}
			}
		)

		studioObserversAndManagers.set(studioId, { manager, observer })
	}

	function destroyObserverAndManager(studioId: StudioId) {
		workInQueue(async () => {
			const toRemove = studioObserversAndManagers.get(studioId)
			if (toRemove) {
				toRemove.observer.stop()
				await toRemove.manager.stop()
				studioObserversAndManagers.delete(studioId)
			} else {
				logger.error(`Observer for studio "${studioId}" not found`)
			}
		})
	}

	await Studios.observeChanges(
		{},
		{
			added: (studioId) => {
				createObserverAndManager(studioId)
			},
			removed: (studioId) => {
				destroyObserverAndManager(studioId)
			},
		},
		{ projection: { _id: 1 }, signal }
	)
}

export const DeviceTriggerMountedActions = new InMemoryMongoCollection<DeviceTriggerMountedAction>(
	'deviceTriggerMountedActions'
)
export const DeviceTriggerMountedActionAdlibsPreview = new InMemoryMongoCollection<PreviewWrappedAdLib>(
	'deviceTriggerMountedActionAdlibsPreview'
)

export async function receiveInputDeviceTrigger(
	context: MethodContext,
	peripheralDeviceId: PeripheralDeviceId,
	deviceToken: string,
	deviceId: string,
	triggerId: string,
	values?: DeviceTriggerArguments
): Promise<void> {
	const peripheralDevice = await checkAccessAndGetPeripheralDevice(peripheralDeviceId, deviceToken, context)
	check(deviceId, z.string())
	check(triggerId, z.string())

	const studioId = peripheralDevice.studioAndConfigId?.studioId
	if (!studioId) throw new SofieError(400, `Peripheral Device "${peripheralDevice._id}" not assigned to a studio`)

	logger.debug(
		`Received trigger from "${peripheralDevice._id}": "${deviceId}" "${triggerId}" ${
			values !== undefined ? JSON.stringify(values) : '(empty)'
		}`
	)

	const actionManager = StudioActionManagers.get(studioId)

	if (!actionManager)
		throw new SofieError(500, `No Studio Action Manager available to handle trigger in Studio "${studioId}"`)

	const mountedActions = DeviceTriggerMountedActions.findFetch({
		deviceId,
		deviceTriggerId: triggerId,
	})

	for (const mountedAction of mountedActions) {
		if (values && !_.isMatch(values, mountedAction.values)) return
		const executableAction = actionManager.getAction(mountedAction.actionId)
		if (!executableAction)
			throw new SofieError(
				500,
				`Executable action not found when processing trigger "${deviceId}" "${triggerId}"`
			)

		const context = actionManager.getContext()
		if (!context) throw new SofieError(500, `Undefined Device Trigger context for studio "${studioId}"`)

		await executableAction.execute(
			((t: ITranslatableMessage) => t.key ?? t) as unknown as TFunction, // TFunction has some odd generic constraints on the return type now
			`${deviceId}: ${triggerId}`,
			context
		)
	}
}
