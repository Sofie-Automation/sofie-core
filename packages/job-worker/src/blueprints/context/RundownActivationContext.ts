import {
	DatastorePersistenceMode,
	IBlueprintPlayoutDevice,
	IRundownActivationContext,
	TSR,
} from '@sofie-automation/blueprints-integration'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { ReadonlyDeep } from 'type-fest'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs/index.js'
import { executePeripheralDeviceAction, listPlayoutDevices } from '../../peripheralDevice.js'
import { PlayoutModel } from '../../playout/model/PlayoutModel.js'
import { RundownEventContext } from './RundownEventContext.js'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { setTimelineDatastoreValue, removeTimelineDatastoreValue } from '../../playout/datastore.js'

export class RundownActivationContext extends RundownEventContext implements IRundownActivationContext {
	private readonly _playoutModel: PlayoutModel
	private readonly _context: JobContext

	constructor(
		context: JobContext,
		playoutModel: PlayoutModel,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		rundown: ReadonlyDeep<DBRundown>
	) {
		super(
			context.studio,
			context.getStudioBlueprintConfig(),
			showStyleCompound,
			context.getShowStyleBlueprintConfig(showStyleCompound),
			rundown
		)

		this._context = context
		this._playoutModel = playoutModel
	}

	async listPlayoutDevices(): Promise<IBlueprintPlayoutDevice[]> {
		return listPlayoutDevices(this._context, this._playoutModel)
	}

	async executeTSRAction(
		deviceId: PeripheralDeviceId,
		actionId: string,
		payload: Record<string, any>
	): Promise<TSR.ActionExecutionResult> {
		return executePeripheralDeviceAction(this._context, deviceId, null, actionId, payload)
	}

	async setTimelineDatastoreValue(key: string, value: unknown, mode: DatastorePersistenceMode): Promise<void> {
		this._playoutModel.deferAfterSave(async () => {
			await setTimelineDatastoreValue(this._context, key, value, mode)
		})
	}
	async removeTimelineDatastoreValue(key: string): Promise<void> {
		this._playoutModel.deferAfterSave(async () => {
			await removeTimelineDatastoreValue(this._context, key)
		})
	}
}
