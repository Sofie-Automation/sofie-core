import { JobContext, ProcessedShowStyleCompound } from '../../../jobs/index.js'
import { PlayoutModel } from '../../../playout/model/PlayoutModel.js'
import { PlayoutPartInstanceModel } from '../../../playout/model/PlayoutPartInstanceModel.js'
import {
	IBlueprintMutatablePart,
	IBlueprintPart,
	IBlueprintPartInstance,
	IBlueprintPiece,
	IBlueprintPieceDB,
	IBlueprintPieceInstance,
	IBlueprintResolvedPieceInstance,
	IBlueprintSegment,
	OmitId,
	SomeContent,
	Time,
	WithTimeline,
} from '@sofie-automation/blueprints-integration'
import {
	IBlueprintPieceObjectsSampleKeys,
	convertPartInstanceToBlueprints,
	convertPartToBlueprints,
	convertPartialBlueprintMutablePartToCore,
	convertPieceInstanceToBlueprints,
	convertPieceToBlueprints,
	convertResolvedPieceInstanceToBlueprints,
	convertSegmentToBlueprints,
	createBlueprintQuickLoopInfo,
	getMediaObjectDuration,
} from '../lib.js'
import { getResolvedPiecesForCurrentPartInstance } from '../../../playout/resolvedPieces.js'
import { ReadonlyDeep } from 'type-fest'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	innerFindLastPieceOnLayer,
	innerFindLastScriptedPieceOnLayer,
	innerStopPieces,
	insertQueuedPartWithPieces,
} from '../../../playout/adlibUtils.js'
import { assertNever, getRandomId, omit } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../../../logging.js'
import {
	Piece,
	PieceTimelineObjectsBlob,
	serializePieceTimelineObjectsBlob,
} from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PartInstanceId, PieceInstanceId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	protectString,
	unprotectString,
	protectStringArray,
	unprotectStringArray,
} from '@sofie-automation/corelib/dist/protectedString'
import { postProcessPieces, postProcessTimelineObjects } from '../../postProcess.js'
import { getCurrentTime } from '../../../lib/index.js'
import _ from 'underscore'
import { syncPlayheadInfinitesForNextPartInstance } from '../../../playout/infinites.js'
import { validateAdlibTestingPartInstanceProperties } from '../../../playout/adlibTesting.js'
import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PlayoutRundownModel } from '../../../playout/model/PlayoutRundownModel.js'
import { BlueprintQuickLookInfo } from '@sofie-automation/blueprints-integration/dist/context/quickLoopInfo'

export enum ActionPartChange {
	NONE = 0,
	SAFE_CHANGE = 1,
}

export interface IPartAndPieceInstanceActionContext {
	readonly currentPartState: ActionPartChange
	readonly nextPartState: ActionPartChange
}

export interface QueueablePartAndPieces {
	part: Omit<DBPart, 'segmentId' | 'rundownId' | '_rank'>
	pieces: Piece[]
}

export class PartAndPieceInstanceActionService {
	private readonly _context: JobContext
	private readonly _playoutModel: PlayoutModel
	readonly showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>

	public get quickLoopInfo(): BlueprintQuickLookInfo | null {
		return createBlueprintQuickLoopInfo(this._playoutModel.playlist)
	}

	/** To be set by any mutation methods on this context. Indicates to core how extensive the changes are to the current partInstance */
	public currentPartState: ActionPartChange = ActionPartChange.NONE
	/** To be set by any mutation methods on this context. Indicates to core how extensive the changes are to the next partInstance */
	public nextPartState: ActionPartChange = ActionPartChange.NONE

	public queuedPartInstanceId: PartInstanceId | undefined = undefined

	constructor(
		context: JobContext,
		playoutModel: PlayoutModel,
		showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
		private readonly _rundown: PlayoutRundownModel
	) {
		this._context = context
		this._playoutModel = playoutModel
		this.showStyleCompound = showStyle
	}

	#trackStateChange(part: 'current' | 'next', change: ActionPartChange): void {
		if (part === 'current') {
			this.currentPartState = Math.max(this.currentPartState, change)
		} else {
			this.nextPartState = Math.max(this.nextPartState, change)
		}
	}

	#getPartInstance(part: 'current' | 'next'): PlayoutPartInstanceModel | null {
		switch (part) {
			case 'current':
				return this._playoutModel.currentPartInstance
			case 'next':
				return this._playoutModel.nextPartInstance
			default:
				assertNever(part)
				logger.warn(`Blueprint action requested unknown PartInstance "${part}"`)
				throw new Error(`Unknown part "${part}"`)
		}
	}

	async getPartInstance(part: 'current' | 'next'): Promise<IBlueprintPartInstance | undefined> {
		const partInstance = this.#getPartInstance(part)

		return partInstance ? convertPartInstanceToBlueprints(partInstance.partInstance) : undefined
	}
	async getPieceInstances(part: 'current' | 'next'): Promise<IBlueprintPieceInstance[]> {
		const partInstance = this.#getPartInstance(part)
		return partInstance?.pieceInstances?.map((p) => convertPieceInstanceToBlueprints(p.pieceInstance)) ?? []
	}
	async getResolvedPieceInstances(part: 'current' | 'next'): Promise<IBlueprintResolvedPieceInstance[]> {
		const partInstance = this.#getPartInstance(part)
		if (!partInstance) {
			return []
		}

		const resolvedInstances = getResolvedPiecesForCurrentPartInstance(
			this._context,
			this.showStyleCompound.sourceLayers,
			partInstance
		)
		return resolvedInstances.map(convertResolvedPieceInstanceToBlueprints)
	}
	getSegment(segment: 'current' | 'next'): IBlueprintSegment | undefined {
		const partInstance = this.#getPartInstance(segment)
		if (!partInstance) return undefined

		const segmentModel = this._playoutModel.findSegment(partInstance.partInstance.segmentId)

		return segmentModel?.segment ? convertSegmentToBlueprints(segmentModel?.segment) : undefined
	}

	async findLastPieceOnLayer(
		sourceLayerId0: string | string[],
		options:
			| {
					excludeCurrentPart?: boolean
					originalOnly?: boolean
					piecePrivateDataFilter?: any
			  }
			| undefined
	): Promise<IBlueprintPieceInstance | undefined> {
		const query: MongoQuery<PieceInstance> = {}
		if (options?.piecePrivateDataFilter) {
			for (const [key, value] of Object.entries<unknown>(options.piecePrivateDataFilter)) {
				// TODO do we need better validation here?
				// It should be pretty safe as we are working with the cache version (for now)
				query[`piece.privateData.${key}`] = value
			}
		}

		if (options?.excludeCurrentPart && this._playoutModel.playlist.currentPartInfo) {
			query['partInstanceId'] = { $ne: this._playoutModel.playlist.currentPartInfo.partInstanceId }
		}

		const sourceLayerId = Array.isArray(sourceLayerId0) ? sourceLayerId0 : [sourceLayerId0]

		const lastPieceInstance = await innerFindLastPieceOnLayer(
			this._context,
			this._playoutModel,
			sourceLayerId,
			options?.originalOnly ?? false,
			query
		)

		return lastPieceInstance && convertPieceInstanceToBlueprints(lastPieceInstance)
	}

	async findLastScriptedPieceOnLayer(
		sourceLayerId0: string | string[],
		options:
			| {
					excludeCurrentPart?: boolean
					piecePrivateDataFilter?: any
			  }
			| undefined
	): Promise<IBlueprintPieceDB | undefined> {
		const query: MongoQuery<Piece> = {}
		if (options?.piecePrivateDataFilter) {
			for (const [key, value] of Object.entries<unknown>(options.piecePrivateDataFilter)) {
				// TODO do we need better validation here?
				// It should be pretty safe as we are working with the cache version (for now)
				query[`privateData.${key}`] = value
			}
		}

		if (options?.excludeCurrentPart && this._playoutModel.currentPartInstance) {
			query['startPartId'] = { $ne: this._playoutModel.currentPartInstance.partInstance.part._id }
		}

		const sourceLayerId = Array.isArray(sourceLayerId0) ? sourceLayerId0 : [sourceLayerId0]

		const lastPiece = await innerFindLastScriptedPieceOnLayer(
			this._context,
			this._playoutModel,
			sourceLayerId,
			query
		)

		return lastPiece && convertPieceToBlueprints(lastPiece)
	}

	async getPartInstanceForPreviousPiece(piece: IBlueprintPieceInstance): Promise<IBlueprintPartInstance> {
		const pieceExt = piece as unknown as Partial<PieceInstance> | undefined
		const partInstanceId = pieceExt?.partInstanceId
		if (!partInstanceId) {
			throw new Error('Cannot find PartInstance from invalid PieceInstance')
		}

		const loadedPartInstanceModel = this._playoutModel.getPartInstance(partInstanceId)
		if (loadedPartInstanceModel) {
			return convertPartInstanceToBlueprints(loadedPartInstanceModel.partInstance)
		}

		// It might be reset and so not in the loaded model
		const rundownIds = this._playoutModel.getRundownIds()
		const oldInstance = await this._context.directCollections.PartInstances.findOne({
			_id: partInstanceId,
			rundownId: { $in: rundownIds },
		})
		if (oldInstance) {
			return convertPartInstanceToBlueprints(oldInstance)
		} else {
			throw new Error('Cannot find PartInstance for PieceInstance')
		}
	}

	async getPartForPreviousPiece(piece: Partial<Pick<IBlueprintPieceDB, '_id'>>): Promise<IBlueprintPart | undefined> {
		if (!piece?._id) {
			throw new Error('Cannot find Part from invalid Piece')
		}

		const pieceDB = await this._context.directCollections.Pieces.findOne({
			_id: protectString(piece._id),
			startRundownId: { $in: this._playoutModel.getRundownIds() },
		})
		if (!pieceDB) throw new Error(`Cannot find Piece ${piece._id}`)

		if (!pieceDB.startPartId || !pieceDB.startSegmentId)
			throw new Error(`Piece ${piece._id} does not belong to a part`)

		const rundown = this._playoutModel.getRundown(pieceDB.startRundownId)
		const segment = rundown?.getSegment(pieceDB.startSegmentId)
		const part = segment?.getPart(pieceDB.startPartId)
		return part ? convertPartToBlueprints(part) : undefined
	}

	async insertPiece(part: 'current' | 'next', rawPiece: IBlueprintPiece): Promise<IBlueprintPieceInstance> {
		const partInstance = this.#getPartInstance(part)
		if (!partInstance) {
			throw new Error('Cannot insert piece when no active part')
		}

		const rundown = this._playoutModel.getRundown(partInstance.partInstance.rundownId)
		if (!rundown) {
			throw new Error('Failed to find rundown of partInstance')
		}

		const trimmedPiece: IBlueprintPiece = _.pick(rawPiece, IBlueprintPieceObjectsSampleKeys)

		const piece = postProcessPieces(
			this._context,
			[trimmedPiece],
			this.showStyleCompound.blueprintId,
			partInstance.partInstance.rundownId,
			partInstance.partInstance.segmentId,
			partInstance.partInstance.part._id,
			part === 'current'
		)[0]
		piece._id = getRandomId() // Make id random, as postProcessPieces is too predictable (for ingest)

		// Do the work
		const newPieceInstance = partInstance.insertAdlibbedPiece(piece, undefined)

		this.#trackStateChange(part, ActionPartChange.SAFE_CHANGE)

		return convertPieceInstanceToBlueprints(newPieceInstance.pieceInstance)
	}

	async updatePieceInstance(
		pieceInstanceId: string,
		piece: Partial<OmitId<IBlueprintPiece>>
	): Promise<IBlueprintPieceInstance> {
		// filter the submission to the allowed ones
		const trimmedPiece: Partial<OmitId<IBlueprintPiece>> = _.pick(piece, IBlueprintPieceObjectsSampleKeys)
		if (Object.keys(trimmedPiece).length === 0) {
			throw new Error('Some valid properties must be defined')
		}

		const foundPieceInstance = this._playoutModel.findPieceInstance(protectString(pieceInstanceId))
		if (!foundPieceInstance) {
			throw new Error('PieceInstance could not be found')
		}

		const { pieceInstance } = foundPieceInstance

		if (
			pieceInstance.pieceInstance.infinite?.fromPreviousPart &&
			pieceInstance.pieceInstance.partInstanceId === this._playoutModel.playlist.nextPartInfo?.partInstanceId
		) {
			throw new Error('Cannot update an infinite piece that is continued from a previous part')
		}

		const updatesCurrentPart: ActionPartChange =
			pieceInstance.pieceInstance.partInstanceId === this._playoutModel.playlist.currentPartInfo?.partInstanceId
				? ActionPartChange.SAFE_CHANGE
				: ActionPartChange.NONE
		const updatesNextPart: ActionPartChange =
			pieceInstance.pieceInstance.partInstanceId === this._playoutModel.playlist.nextPartInfo?.partInstanceId
				? ActionPartChange.SAFE_CHANGE
				: ActionPartChange.NONE
		if (!updatesCurrentPart && !updatesNextPart) {
			throw new Error('Can only update piece instances in current or next part instance')
		}

		let timelineObjectsString: PieceTimelineObjectsBlob | undefined
		if (trimmedPiece.content?.timelineObjects) {
			timelineObjectsString = serializePieceTimelineObjectsBlob(
				postProcessTimelineObjects(
					pieceInstance.pieceInstance.piece._id,
					this.showStyleCompound.blueprintId,
					trimmedPiece.content.timelineObjects
				)
			)
			// This has been processed
			trimmedPiece.content = omit(trimmedPiece.content, 'timelineObjects') as WithTimeline<SomeContent>
		}

		pieceInstance.updatePieceProps(trimmedPiece as any) // TODO: this needs to be more type safe
		if (timelineObjectsString !== undefined) pieceInstance.updatePieceProps({ timelineObjectsString })

		// setupPieceInstanceInfiniteProperties(pieceInstance)

		this.#trackStateChange('next', updatesNextPart)
		this.#trackStateChange('current', updatesCurrentPart)

		return convertPieceInstanceToBlueprints(pieceInstance.pieceInstance)
	}

	async updatePartInstance(
		part: 'current' | 'next',
		props: Partial<IBlueprintMutatablePart>
	): Promise<IBlueprintPartInstance> {
		const partInstance = this.#getPartInstance(part)
		if (!partInstance) {
			throw new Error('PartInstance could not be found')
		}

		const playoutUpdatePart = convertPartialBlueprintMutablePartToCore(props, this.showStyleCompound.blueprintId)

		if (!partInstance.updatePartProps(playoutUpdatePart)) {
			throw new Error('Some valid properties must be defined')
		}

		this.#trackStateChange(part, ActionPartChange.SAFE_CHANGE)

		return convertPartInstanceToBlueprints(partInstance.partInstance)
	}

	async queuePart(rawPart: IBlueprintPart, rawPieces: IBlueprintPiece[]): Promise<IBlueprintPartInstance> {
		const currentPartInstance = this._playoutModel.currentPartInstance
		if (!currentPartInstance) {
			throw new Error('Cannot queue part when no current partInstance')
		}

		if (this.nextPartState !== ActionPartChange.NONE) {
			// Ensure we dont insert a piece into a part before replacing it with a queued part, as this will cause some data integrity issues
			// This could be changed if we have a way to abort the pending changes in the nextPart.
			// Future: perhaps this could be dropped as only the instance will have changed, and that will be trashed by the setAsNext?
			throw new Error('Cannot queue part when next part has already been modified')
		}

		if (currentPartInstance.isTooCloseToAutonext(true)) {
			throw new Error('Too close to an autonext to queue a part')
		}

		const { part, pieces } = this.processPartAndPiecesToQueueOrFail(
			rawPart,
			rawPieces,
			currentPartInstance.partInstance.rundownId,
			currentPartInstance.partInstance.segmentId
		)

		// Do the work
		const newPartInstance = await insertQueuedPartWithPieces(
			this._context,
			this._playoutModel,
			this._rundown,
			currentPartInstance,
			part,
			pieces,
			undefined
		)

		this.nextPartState = ActionPartChange.SAFE_CHANGE
		this.queuedPartInstanceId = newPartInstance.partInstance._id

		return convertPartInstanceToBlueprints(newPartInstance.partInstance)
	}

	public processPartAndPiecesToQueueOrFail(
		rawPart: IBlueprintPart<unknown, unknown>,
		rawPieces: IBlueprintPiece<unknown, unknown>[],
		rundownId: RundownId,
		segmentId: SegmentId
	): QueueablePartAndPieces {
		if (rawPieces.length === 0) {
			throw new Error('New part must contain at least one piece')
		}

		const part: Omit<DBPart, 'segmentId' | 'rundownId' | '_rank'> = {
			...rawPart,
			_id: getRandomId(),
			notes: [],
			invalid: false,
			invalidReason: undefined,
			floated: false,
			expectedDurationWithTransition: undefined, // Filled in later
			userEditOperations: [], // Adlibbed parts can't be edited by ingest
			userEditProperties: undefined,
		}

		const pieces = postProcessPieces(
			this._context,
			rawPieces,
			this.showStyleCompound.blueprintId,
			rundownId,
			segmentId,
			part._id,
			false
		)

		if (!isPartPlayable(part)) {
			throw new Error('Cannot queue a part which is not playable')
		}

		return { part, pieces }
	}

	async stopPiecesOnLayers(sourceLayerIds: string[], timeOffset: number | undefined): Promise<string[]> {
		if (sourceLayerIds.length == 0) {
			return []
		}

		return this._stopPiecesByRule(
			(pieceInstance) => sourceLayerIds.indexOf(pieceInstance.piece.sourceLayerId) !== -1,
			timeOffset
		)
	}

	async stopPieceInstances(pieceInstanceIds: string[], timeOffset: number | undefined): Promise<string[]> {
		if (pieceInstanceIds.length == 0) {
			return []
		}

		return this._stopPiecesByRule(
			(pieceInstance) => pieceInstanceIds.indexOf(unprotectString(pieceInstance._id)) !== -1,
			timeOffset
		)
	}

	async removePieceInstances(part: 'current' | 'next', pieceInstanceIds: string[]): Promise<string[]> {
		const partInstance = this.#getPartInstance(part)
		if (!partInstance) {
			throw new Error('Cannot remove pieceInstances when no selected partInstance')
		}

		const rawPieceInstanceIds = protectStringArray<PieceInstanceId>(pieceInstanceIds)

		const removedPieceInstanceIds: PieceInstanceId[] = []

		for (const id of rawPieceInstanceIds) {
			if (partInstance.removePieceInstance(id)) {
				removedPieceInstanceIds.push(id)
			}
		}

		this.#trackStateChange(part, ActionPartChange.SAFE_CHANGE)

		return unprotectStringArray(removedPieceInstanceIds)
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

	private _stopPiecesByRule(
		filter: (pieceInstance: ReadonlyDeep<PieceInstance>) => boolean,
		timeOffset: number | undefined
	) {
		if (!this._playoutModel.playlist.currentPartInfo) {
			return []
		}
		const partInstance = this._playoutModel.currentPartInstance
		if (!partInstance) {
			throw new Error('Cannot stop pieceInstances when no current partInstance')
		}

		const stoppedIds = innerStopPieces(
			this._context,
			this._playoutModel,
			this.showStyleCompound.sourceLayers,
			partInstance,
			filter,
			timeOffset
		)

		if (stoppedIds.length > 0) {
			this.#trackStateChange('current', ActionPartChange.SAFE_CHANGE)
		}

		return unprotectStringArray(stoppedIds)
	}

	async hackGetMediaObjectDuration(mediaId: string): Promise<number | undefined> {
		return getMediaObjectDuration(this._context, mediaId)
	}
}

export async function applyActionSideEffects(
	context: JobContext,
	playoutModel: PlayoutModel,
	actionContext: IPartAndPieceInstanceActionContext
): Promise<void> {
	if (
		actionContext.currentPartState !== ActionPartChange.NONE ||
		actionContext.nextPartState !== ActionPartChange.NONE
	) {
		await syncPlayheadInfinitesForNextPartInstance(
			context,
			playoutModel,
			undefined,
			playoutModel.currentPartInstance,
			playoutModel.nextPartInstance
		)
	}

	if (actionContext.nextPartState !== ActionPartChange.NONE) {
		const nextPartInstance = playoutModel.nextPartInstance
		if (nextPartInstance) {
			nextPartInstance.recalculateExpectedDurationWithTransition()

			validateAdlibTestingPartInstanceProperties(context, playoutModel, nextPartInstance)
		}
	}

	if (actionContext.currentPartState !== ActionPartChange.NONE) {
		const currentPartInstance = playoutModel.currentPartInstance
		if (currentPartInstance) {
			validateAdlibTestingPartInstanceProperties(context, playoutModel, currentPartInstance)
		}
	}
}
