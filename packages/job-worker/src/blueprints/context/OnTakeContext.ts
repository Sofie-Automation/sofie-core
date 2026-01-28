import {
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
	IOnTakeContext,
	IBlueprintSegment,
} from '@sofie-automation/blueprints-integration'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { PlayoutModel } from '../../playout/model/PlayoutModel.js'
import { ContextInfo } from './CommonContext.js'
import { ShowStyleUserContext } from './ShowStyleUserContext.js'
import { WatchedPackagesHelper } from './watchedPackages.js'
import { getCurrentTime } from '../../lib/index.js'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs/index.js'
import { executePeripheralDeviceAction, listPlayoutDevices } from '../../peripheralDevice.js'
import { ActionPartChange, PartAndPieceInstanceActionService } from './services/PartAndPieceInstanceActionService.js'
import { BlueprintQuickLookInfo } from '@sofie-automation/blueprints-integration/dist/context/quickLoopInfo'
import { getOrderedPartsAfterPlayhead } from '../../playout/lookahead/util.js'
import { convertPartToBlueprints } from './lib.js'

export class OnTakeContext extends ShowStyleUserContext implements IOnTakeContext, IEventContext {
	public isTakeAborted: boolean

	public get quickLoopInfo(): BlueprintQuickLookInfo | null {
		return this.partAndPieceInstanceService.quickLoopInfo
	}

	public get isRehearsal(): boolean {
		return this._playoutModel.playlist.rehearsal ?? false
	}

	public get currentPartState(): ActionPartChange {
		return this.partAndPieceInstanceService.currentPartState
	}
	public get nextPartState(): ActionPartChange {
		return this.partAndPieceInstanceService.nextPartState
	}

	constructor(
		contextInfo: ContextInfo,
		private readonly _context: JobContext,
		private readonly _playoutModel: PlayoutModel,
		showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
		watchedPackages: WatchedPackagesHelper,
		private partAndPieceInstanceService: PartAndPieceInstanceActionService
	) {
		super(contextInfo, _context, showStyle, watchedPackages)
		this.isTakeAborted = false
	}

	async getUpcomingParts(limit: number = 5): Promise<ReadonlyDeep<IBlueprintPart[]>> {
		return getOrderedPartsAfterPlayhead(this._context, this._playoutModel, limit).map(convertPartToBlueprints)
	}

	abortTake(): void {
		this.isTakeAborted = true
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
	async getSegment(segment: 'current' | 'next'): Promise<IBlueprintSegment | undefined> {
		return this.partAndPieceInstanceService.getSegment(segment)
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

	async updatePartInstance(
		part: 'current' | 'next',
		props: Partial<IBlueprintMutatablePart>
	): Promise<IBlueprintPartInstance> {
		return this.partAndPieceInstanceService.updatePartInstance(part, props)
	}

	async stopPiecesOnLayers(sourceLayerIds: string[], timeOffset?: number): Promise<string[]> {
		return this.partAndPieceInstanceService.stopPiecesOnLayers(sourceLayerIds, timeOffset)
	}
	async stopPieceInstances(pieceInstanceIds: string[], timeOffset?: number): Promise<string[]> {
		return this.partAndPieceInstanceService.stopPieceInstances(pieceInstanceIds, timeOffset)
	}
	async removePieceInstances(part: 'current' | 'next', pieceInstanceIds: string[]): Promise<string[]> {
		return this.partAndPieceInstanceService.removePieceInstances(part, pieceInstanceIds)
	}

	async blockTakeUntil(time: Time | null): Promise<void> {
		if (time !== null && (time < getCurrentTime() || typeof time !== 'number'))
			throw new Error('Cannot block taking out of the current part, to a time in the past')

		const partInstance = this._playoutModel.nextPartInstance
		if (!partInstance) {
			throw new Error('Cannot block take when there is no part playing')
		}

		partInstance.blockTakeUntil(time)
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

	getCurrentTime(): number {
		return getCurrentTime()
	}
}
