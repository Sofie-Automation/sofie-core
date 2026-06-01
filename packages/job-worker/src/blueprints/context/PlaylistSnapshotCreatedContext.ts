import { IBlueprintPlayoutDevice, IPlaylistSnapshotCreatedContext, TSR } from '@sofie-automation/blueprints-integration'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { ReadonlyDeep } from 'type-fest'
import { JobContext, JobStudio, ProcessedShowStyleCompound } from '../../jobs/index.js'
import { executePeripheralDeviceAction, listPlayoutDevicesForStudio } from '../../peripheralDevice.js'
import { ProcessedShowStyleConfig, ProcessedStudioConfig } from '../config.js'
import { ContextInfo } from './CommonContext.js'
import { ShowStyleContext } from './ShowStyleContext.js'

/**
 * Blueprint context for {@link ShowStyleBlueprintManifest.onPlaylistSnapshotCreated}.
 *
 * Extends {@link ShowStyleContext} with TSR playout device listing and actions scoped to the studio worker job.
 */
export class PlaylistSnapshotCreatedContext extends ShowStyleContext implements IPlaylistSnapshotCreatedContext {
	private readonly _context: JobContext

	constructor(
		context: JobContext,
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<JobStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
		showStyleBlueprintConfig: ProcessedShowStyleConfig
	) {
		super(contextInfo, studio, studioBlueprintConfig, showStyle, showStyleBlueprintConfig)
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
