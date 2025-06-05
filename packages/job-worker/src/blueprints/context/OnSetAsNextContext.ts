import { JobContext, ProcessedShowStyleCompound } from '../../jobs/index.js'
import { ContextInfo } from './CommonContext.js'
import { ShowStyleUserContext } from './ShowStyleUserContext.js'
import {
	IBlueprintMutatablePart,
	IBlueprintPart,
	IBlueprintPartInstance,
	IBlueprintPiece,
	IBlueprintPieceDB,
	IBlueprintPieceInstance,
	IBlueprintResolvedPieceInstance,
	IBlueprintSegment,
	IEventContext,
	IOnSetAsNextContext,
} from '@sofie-automation/blueprints-integration'
import {
	ActionPartChange,
	IPartAndPieceInstanceActionContext,
	PartAndPieceInstanceActionService,
} from './services/PartAndPieceInstanceActionService.js'
import { WatchedPackagesHelper } from './watchedPackages.js'
import { PlayoutModel } from '../../playout/model/PlayoutModel.js'
import { ReadonlyDeep } from 'type-fest'
import { getCurrentTime } from '../../lib/index.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { BlueprintQuickLookInfo } from '@sofie-automation/blueprints-integration/dist/context/quickLoopInfo'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { selectNewPartWithOffsets } from '../../playout/moveNextPart.js'

export class OnSetAsNextContext
	extends ShowStyleUserContext
	implements IOnSetAsNextContext, IEventContext, IPartAndPieceInstanceActionContext
{
	public pendingMoveNextPart: { selectedPart: ReadonlyDeep<DBPart> | null } | undefined = undefined

	constructor(
		contextInfo: ContextInfo,
		context: JobContext,
		private playoutModel: PlayoutModel,
		showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
		watchedPackages: WatchedPackagesHelper,
		private partAndPieceInstanceService: PartAndPieceInstanceActionService
	) {
		super(contextInfo, context, showStyle, watchedPackages)
	}

	public get quickLoopInfo(): BlueprintQuickLookInfo | null {
		return this.partAndPieceInstanceService.quickLoopInfo
	}

	public get nextPartState(): ActionPartChange {
		return this.partAndPieceInstanceService.nextPartState
	}

	public get currentPartState(): ActionPartChange {
		return this.partAndPieceInstanceService.nextPartState
	}

	async getPartInstance(part: 'current' | 'next'): Promise<IBlueprintPartInstance<unknown> | undefined> {
		return this.partAndPieceInstanceService.getPartInstance(part)
	}

	async getPieceInstances(part: 'current' | 'next'): Promise<IBlueprintPieceInstance<unknown>[]> {
		return this.partAndPieceInstanceService.getPieceInstances(part)
	}

	async getResolvedPieceInstances(part: 'current' | 'next'): Promise<IBlueprintResolvedPieceInstance<unknown>[]> {
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

	async insertPiece(_part: 'next', piece: IBlueprintPiece<unknown>): Promise<IBlueprintPieceInstance<unknown>> {
		return this.partAndPieceInstanceService.insertPiece('next', piece)
	}

	async updatePieceInstance(
		pieceInstanceId: string,
		piece: Partial<IBlueprintPiece<unknown>>
	): Promise<IBlueprintPieceInstance<unknown>> {
		if (protectString(pieceInstanceId) === this.playoutModel.playlist.currentPartInfo?.partInstanceId) {
			throw new Error('Cannot update a Piece Instance from the current Part Instance')
		}
		return this.partAndPieceInstanceService.updatePieceInstance(pieceInstanceId, piece)
	}

	async updatePartInstance(
		part: 'current' | 'next',
		props: Partial<IBlueprintMutatablePart<unknown>>
	): Promise<IBlueprintPartInstance<unknown>> {
		return this.partAndPieceInstanceService.updatePartInstance(part, props)
	}

	async removePieceInstances(part: 'current' | 'next', pieceInstanceIds: string[]): Promise<string[]> {
		return this.partAndPieceInstanceService.removePieceInstances(part, pieceInstanceIds)
	}

	async moveNextPart(partDelta: number, segmentDelta: number, ignoreQuickLoop?: boolean): Promise<boolean> {
		if (typeof partDelta !== 'number') throw new Error('partDelta must be a number')
		if (typeof segmentDelta !== 'number') throw new Error('segmentDelta must be a number')

		// Values of 0 mean discard the pending change
		if (partDelta === 0 && segmentDelta === 0) {
			this.pendingMoveNextPart = undefined
			return true
		}

		this.pendingMoveNextPart = {
			selectedPart: selectNewPartWithOffsets(
				this.jobContext,
				this.playoutModel,
				partDelta,
				segmentDelta,
				ignoreQuickLoop
			),
		}

		return !!this.pendingMoveNextPart.selectedPart
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}
}
