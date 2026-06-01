import { IBlueprintPlayoutDevice, ISystemSnapshotCreatedContext, TSR } from '@sofie-automation/blueprints-integration'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { ReadonlyDeep } from 'type-fest'
import { JobContext, JobStudio } from '../../jobs/index.js'
import { executePeripheralDeviceAction, listPlayoutDevicesForStudio } from '../../peripheralDevice.js'
import { ProcessedStudioConfig } from '../config.js'
import { ContextInfo } from './CommonContext.js'
import { StudioContext } from './StudioContext.js'

/**
 * Blueprint context for {@link StudioBlueprintManifest.onSystemSnapshotCreated}.
 *
 * Extends {@link StudioContext} with TSR playout device listing and actions scoped to the studio worker job.
 */
export class SystemSnapshotCreatedContext extends StudioContext implements ISystemSnapshotCreatedContext {
	private readonly _context: JobContext

	constructor(
		context: JobContext,
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<JobStudio>,
		studioBlueprintConfig: ProcessedStudioConfig
	) {
		super(contextInfo, studio, studioBlueprintConfig)
		this._context = context
	}

	/** @inheritdoc */
	async listPlayoutDevices(): Promise<IBlueprintPlayoutDevice[]> {
		return listPlayoutDevicesForStudio(this._context)
	}

	/** @inheritdoc */
	async executeTSRAction(
		deviceId: PeripheralDeviceId,
		actionId: string,
		payload: Record<string, any>,
		timeoutMs?: number
	): Promise<TSR.ActionExecutionResult> {
		return executePeripheralDeviceAction(this._context, deviceId, timeoutMs ?? null, actionId, payload)
	}
}
