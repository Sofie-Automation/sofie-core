import {
	IActionExecutionContext,
	IDataStoreActionExecutionContext,
	IBlueprintMutatablePart,
	IBlueprintPart,
	IBlueprintPartInstance,
	IBlueprintPiece,
	IBlueprintPieceDB,
	IBlueprintPieceInstance,
	IBlueprintResolvedPieceInstance,
	IEventContext,
	OmitId,
	Time,
	TSR,
	IBlueprintPlayoutDevice,
	StudioRouteSet,
} from '@sofie-automation/blueprints-integration'
import { PartInstanceId, PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { PlayoutModel } from '../../playout/model/PlayoutModel'
import { ContextInfo } from './CommonContext'
import { ShowStyleUserContext } from './ShowStyleUserContext'
import { WatchedPackagesHelper } from './watchedPackages'
import { getCurrentTime } from '../../lib'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import { selectNewPartWithOffsets } from '../../playout/moveNextPart'
import { ProcessedShowStyleConfig } from '../config'
import { DatastorePersistenceMode } from '@sofie-automation/shared-lib/dist/core/model/TimelineDatastore'
import { removeTimelineDatastoreValue, setTimelineDatastoreValue } from '../../playout/datastore'
import { executePeripheralDeviceAction, listPlayoutDevices } from '../../peripheralDevice'
import { ActionPartChange, PartAndPieceInstanceActionService } from './services/PartAndPieceInstanceActionService'
import { BlueprintQuickLookInfo } from '@sofie-automation/blueprints-integration/dist/context/quickLoopInfo'
import { setNextPartFromPart } from '../../playout/setNext'

export class DatastoreActionExecutionContext
	extends ShowStyleUserContext
	implements IDataStoreActionExecutionContext, IEventContext
{
	protected readonly _context: JobContext

	constructor(
		contextInfo: ContextInfo,
		context: JobContext,
		showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
		watchedPackages: WatchedPackagesHelper
	) {
		super(contextInfo, context, showStyle, watchedPackages)
		this._context = context
	}

	async setTimelineDatastoreValue(key: string, value: unknown, mode: DatastorePersistenceMode): Promise<void> {
		await setTimelineDatastoreValue(this._context, key, value, mode)
	}

	async removeTimelineDatastoreValue(key: string): Promise<void> {
		await removeTimelineDatastoreValue(this._context, key)
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}
}

/** Actions */
export class ActionExecutionContext extends ShowStyleUserContext implements IActionExecutionContext, IEventContext {
	/**
	 * Whether the blueprints requested a take to be performed at the end of this action
	 * */
	public takeAfterExecute = false
	/**
	 * Whether the blueprints performed an action that explicitly requires the timeline to be regenerated
	 * This isn't the only indicator that it should be regenerated
	 */
	public forceRegenerateTimeline = false

	public get quickLoopInfo(): BlueprintQuickLookInfo | null {
		return this.partAndPieceInstanceService.quickLoopInfo
	}

	public get currentPartState(): ActionPartChange {
		return this.partAndPieceInstanceService.currentPartState
	}

	public get nextPartState(): ActionPartChange {
		return this.partAndPieceInstanceService.nextPartState
	}

	public get queuedPartInstanceId(): PartInstanceId | undefined {
		return this.partAndPieceInstanceService.queuedPartInstanceId
	}

	constructor(
		contextInfo: ContextInfo,
		private readonly _context: JobContext,
		private readonly _playoutModel: PlayoutModel,
		showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
		_showStyleBlueprintConfig: ProcessedShowStyleConfig,
		watchedPackages: WatchedPackagesHelper,
		private readonly partAndPieceInstanceService: PartAndPieceInstanceActionService
	) {
		super(contextInfo, _context, showStyle, watchedPackages)
	}

	async getPartInstance(part: 'current' | 'next'): Promise<IBlueprintPartInstance | undefined> {
		return this.partAndPieceInstanceService.getPartInstance(part)
	}

	async getPieceInstances(part: 'current' | 'next'): Promise<IBlueprintPieceInstance[]> {
		return this.partAndPieceInstanceService.getPieceInstances(part)
	}

	async getResolvedPieceInstances(part: 'current' | 'next'): Promise<IBlueprintResolvedPieceInstance[]> {
		return this.partAndPieceInstanceService.getResolvedPieceInstances(part)
	}

	async findLastPieceOnLayer(
		sourceLayerId0: string | string[],
		options?: {
			excludeCurrentPart?: boolean
			originalOnly?: boolean
			piecePrivateDataFilter?: any
		}
	): Promise<IBlueprintPieceInstance | undefined> {
		return this.partAndPieceInstanceService.findLastPieceOnLayer(sourceLayerId0, options)
	}

	async findLastScriptedPieceOnLayer(
		sourceLayerId0: string | string[],
		options?: {
			excludeCurrentPart?: boolean
			piecePrivateDataFilter?: any
		}
	): Promise<IBlueprintPieceDB | undefined> {
		return this.partAndPieceInstanceService.findLastScriptedPieceOnLayer(sourceLayerId0, options)
	}

	async getPartInstanceForPreviousPiece(piece: IBlueprintPieceInstance): Promise<IBlueprintPartInstance> {
		return this.partAndPieceInstanceService.getPartInstanceForPreviousPiece(piece)
	}

	async getPartForPreviousPiece(piece: Partial<Pick<IBlueprintPieceDB, '_id'>>): Promise<IBlueprintPart | undefined> {
		return this.partAndPieceInstanceService.getPartForPreviousPiece(piece)
	}

	async insertPiece(part: 'current' | 'next', rawPiece: IBlueprintPiece): Promise<IBlueprintPieceInstance> {
		return this.partAndPieceInstanceService.insertPiece(part, rawPiece)
	}

	async updatePieceInstance(
		pieceInstanceId: string,
		piece: Partial<OmitId<IBlueprintPiece>>
	): Promise<IBlueprintPieceInstance> {
		return this.partAndPieceInstanceService.updatePieceInstance(pieceInstanceId, piece)
	}

	async queuePart(rawPart: IBlueprintPart, rawPieces: IBlueprintPiece[]): Promise<IBlueprintPartInstance> {
		return this.partAndPieceInstanceService.queuePart(rawPart, rawPieces)
	}

	async moveNextPart(partDelta: number, segmentDelta: number, ignoreQuickloop?: boolean): Promise<void> {
		const selectedPart = selectNewPartWithOffsets(
			this._context,
			this._playoutModel,
			partDelta,
			segmentDelta,
			ignoreQuickloop
		)
		if (selectedPart) await setNextPartFromPart(this._context, this._playoutModel, selectedPart, true)
	}

	async updatePartInstance(
		part: 'current' | 'next',
		props: Partial<IBlueprintMutatablePart>
	): Promise<IBlueprintPartInstance> {
		return this.partAndPieceInstanceService.updatePartInstance(part, props)
	}

	async stopPiecesOnLayers(sourceLayerIds: string[], timeOffset?: number | undefined): Promise<string[]> {
		return this.partAndPieceInstanceService.stopPiecesOnLayers(sourceLayerIds, timeOffset)
	}

	async stopPieceInstances(pieceInstanceIds: string[], timeOffset?: number | undefined): Promise<string[]> {
		return this.partAndPieceInstanceService.stopPieceInstances(pieceInstanceIds, timeOffset)
	}

	async removePieceInstances(part: 'current' | 'next', pieceInstanceIds: string[]): Promise<string[]> {
		return this.partAndPieceInstanceService.removePieceInstances(part, pieceInstanceIds)
	}

	async takeAfterExecuteAction(take: boolean): Promise<boolean> {
		this.takeAfterExecute = take

		return this.takeAfterExecute
	}

	async blockTakeUntil(time: Time | null): Promise<void> {
		if (time !== null && (time < getCurrentTime() || typeof time !== 'number'))
			throw new Error('Cannot block taking out of the current part, to a time in the past')

		const partInstance = this._playoutModel.currentPartInstance
		if (!partInstance) {
			throw new Error('Cannot block take when there is no part playing')
		}

		partInstance.blockTakeUntil(time)
	}

	async listRouteSets(): Promise<Record<string, StudioRouteSet>> {
		// Discard ReadonlyDeep wrapper
		return this._context.studio.routeSets as Record<string, StudioRouteSet>
	}

	async switchRouteSet(routeSetId: string, state: boolean | 'toggle'): Promise<void> {
		const affectsTimeline = this._playoutModel.switchRouteSet(routeSetId, state)
		this.forceRegenerateTimeline = this.forceRegenerateTimeline || affectsTimeline
	}

	async hackGetMediaObjectDuration(mediaId: string): Promise<number | undefined> {
		return this.partAndPieceInstanceService.hackGetMediaObjectDuration(mediaId)
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

	getCurrentTime(): number {
		return getCurrentTime()
	}
}
