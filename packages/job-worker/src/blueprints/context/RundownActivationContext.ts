import {
	DatastorePersistenceMode,
	IBlueprintPlayoutDevice,
	IRundownActivationContext,
	IRundownActivationContextState,
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

	private readonly _previousState: IRundownActivationContextState
	private readonly _currentState: IRundownActivationContextState

	constructor(
		context: JobContext,
		options: {
			playoutModel: PlayoutModel
			showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
			rundown: ReadonlyDeep<DBRundown>
			previousState: IRundownActivationContextState
			currentState: IRundownActivationContextState
		}
	) {
		super(
			context.studio,
			context.getStudioBlueprintConfig(),
			options.showStyle,
			context.getShowStyleBlueprintConfig(options.showStyle),
			options.rundown
		)

		this._context = context
		this._playoutModel = options.playoutModel
		this._previousState = options.previousState
		this._currentState = options.currentState
	}

	get previousState(): IRundownActivationContextState {
		return this._previousState
	}
	get currentState(): IRundownActivationContextState {
		return this._currentState
	}

	async listPlayoutDevices(): Promise<IBlueprintPlayoutDevice[]> {
		return listPlayoutDevices(this._context, this._playoutModel)
	}

	async executeTSRAction(
		deviceId: PeripheralDeviceId,
		actionId: string,
		payload: Record<string, any>,
		timeoutMs?: number
	): Promise<TSR.ActionExecutionResult> {
		return executePeripheralDeviceAction(this._context, deviceId, timeoutMs ?? null, actionId, payload)
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
