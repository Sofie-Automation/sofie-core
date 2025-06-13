import {
	ExpectedMediaItemBase,
	ExpectedMediaItemBucketAction,
	ExpectedMediaItemBucketPiece,
	ExpectedMediaItemRundown,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import {
	BucketAdLibActionId,
	BucketAdLibId,
	ExpectedMediaItemId,
	RundownId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ProtectedString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import { getHash, Subtract } from '@sofie-automation/corelib/dist/lib'
import {
	IBlueprintActionManifestDisplayContent,
	SomeContent,
	VTContent,
} from '@sofie-automation/blueprints-integration'
import { getCurrentTime } from '../lib/index.js'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { IngestModel } from './model/IngestModel.js'
import { JobContext } from '../jobs/index.js'
import { logger } from '../logging.js'
import { saveIntoDb } from '../db/changes.js'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { interpollateTranslation, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { ReadonlyDeep } from 'type-fest'
import { IngestPartModel } from './model/IngestPartModel.js'

export enum PieceType {
	PIECE = 'piece',
	ADLIB = 'adlib',
	ACTION = 'action',
}

function generateExpectedMediaItems<T extends ExpectedMediaItemBase>(
	sourceId: ProtectedString<any>,
	commonProps: Subtract<T, ExpectedMediaItemBase>,
	studioId: StudioId,
	label: string,
	content: Partial<SomeContent | ReadonlyDeep<SomeContent>> | undefined,
	pieceType: string
): T[] {
	const result: T[] = []

	const pieceContent = content as Partial<VTContent> | undefined
	if (pieceContent && pieceContent.fileName && pieceContent.path && pieceContent.mediaFlowIds) {
		for (const flow of pieceContent.mediaFlowIds) {
			const id = protectString<ExpectedMediaItemId>(
				getHash(pieceType + '_' + sourceId + '_' + JSON.stringify(commonProps) + '_' + flow)
			)
			const baseObj: ExpectedMediaItemBase = {
				_id: id,
				studioId: studioId,
				label: label,
				disabled: false,
				lastSeen: getCurrentTime(),
				mediaFlowId: flow,
				path: pieceContent.fileName,
				url: pieceContent.path,
			}
			result.push({
				...commonProps,
				...baseObj,
			} as T)
		}
	}

	return result
}

function generateExpectedMediaItemsFull(
	studioId: StudioId,
	rundownId: RundownId,
	pieces: readonly ReadonlyDeep<Piece>[],
	adlibs: readonly ReadonlyDeep<AdLibPiece>[],
	actions: readonly (ReadonlyDeep<AdLibAction> | ReadonlyDeep<RundownBaselineAdLibAction>)[]
): ExpectedMediaItemRundown[] {
	const eMIs: ExpectedMediaItemRundown[] = []

	pieces.forEach((doc) =>
		eMIs.push(
			...generateExpectedMediaItems<ExpectedMediaItemRundown>(
				doc._id,
				{
					partId: doc.startPartId,
					rundownId: doc.startRundownId,
				},
				studioId,
				doc.name,
				doc.content,
				PieceType.PIECE
			)
		)
	)
	adlibs.forEach((doc) =>
		eMIs.push(
			...generateExpectedMediaItems<ExpectedMediaItemRundown>(
				doc._id,
				{
					partId: doc.partId,
					rundownId: rundownId,
				},
				studioId,
				doc.name,
				doc.content,
				PieceType.ADLIB
			)
		)
	)
	actions.forEach((doc) =>
		eMIs.push(
			...generateExpectedMediaItems<ExpectedMediaItemRundown>(
				doc._id,
				{
					partId: doc.partId,
					rundownId: rundownId,
				},
				studioId,
				translateMessage(doc.display.label, interpollateTranslation),
				(doc.display as IBlueprintActionManifestDisplayContent | undefined)?.content,
				PieceType.ACTION
			)
		)
	)

	return eMIs
}

/**
 * Remove any ExpectedMediaItems belonging to the provided Bucket adlib ids
 * @param context Context for the job
 * @param adLibIds Ids to remove documents matchig
 */
export async function cleanUpExpectedMediaItemForBucketAdLibPiece(
	context: JobContext,
	adLibIds: BucketAdLibId[]
): Promise<void> {
	if (adLibIds.length > 0) {
		const removedItems = await context.directCollections.ExpectedMediaItems.remove({
			bucketAdLibPieceId: {
				$in: adLibIds,
			},
		})

		logger.info(`Removed ${removedItems} expected media items for deleted bucket adLib items`)
	}
}

/**
 * Remove any ExpectedMediaItems belonging to the provided Bucket action ids
 * @param context Context for the job
 * @param actionIds Ids to remove documents matchig
 */
export async function cleanUpExpectedMediaItemForBucketAdLibActions(
	context: JobContext,
	actionIds: BucketAdLibActionId[]
): Promise<void> {
	if (actionIds.length > 0) {
		const removedItems = await context.directCollections.ExpectedMediaItems.remove({
			bucketAdLibActionId: {
				$in: actionIds,
			},
		})

		logger.info(`Removed ${removedItems} expected media items for deleted bucket adLib actions`)
	}
}

/**
 * Regenerate the ExpectedMediaItems belonging to a BucketAdLib
 * Writes result directly to database
 * @param context Context for the Job
 * @param piece BucketAdLib to regenerate for
 */
export async function updateExpectedMediaItemForBucketAdLibPiece(
	context: JobContext,
	piece: BucketAdLib
): Promise<void> {
	const result = generateExpectedMediaItems<ExpectedMediaItemBucketPiece>(
		piece._id,
		{
			bucketId: piece.bucketId,
			bucketAdLibPieceId: piece._id,
		},
		piece.studioId,
		piece.name,
		piece.content,
		PieceType.ADLIB
	)

	await saveIntoDb(
		context,
		context.directCollections.ExpectedMediaItems,
		{
			bucketAdLibPieceId: piece._id,
		},
		result
	)
}

/**
 * Regenerate the ExpectedMediaItems belonging to a BucketAdLibAction
 * Writes result directly to database
 * @param context Context for the Job
 * @param action BucketAdLibAction to regenerate for
 */
export async function updateExpectedMediaItemForBucketAdLibAction(
	context: JobContext,
	action: BucketAdLibAction
): Promise<void> {
	const result = generateExpectedMediaItems<ExpectedMediaItemBucketAction>(
		action._id,
		{
			bucketId: action.bucketId,
			bucketAdLibActionId: action._id,
		},
		action.studioId,
		translateMessage(action.display.label, interpollateTranslation),
		(action.display as IBlueprintActionManifestDisplayContent | undefined)?.content,
		PieceType.ADLIB
	)

	await saveIntoDb(
		context,
		context.directCollections.ExpectedMediaItems,
		{
			bucketAdLibActionId: action._id,
		},
		result
	)
}

/**
 * Regenerate the ExpectedMediaItems belonging to a Rundown
 * @param context Context for the Job
 * @param ingestModel Model containing the Rundown and resulting ExpectedMediaItems
 */
export async function updateExpectedMediaItemsForRundownBaseline(
	context: JobContext,
	ingestModel: IngestModel
): Promise<void> {
	const [baselineAdlibPieces, baselineAdlibActions] = await Promise.all([
		ingestModel.rundownBaselineAdLibPieces.get(),
		ingestModel.rundownBaselineAdLibActions.get(),
	])

	const expectedMediaItems = generateExpectedMediaItemsFull(
		context.studio._id,
		ingestModel.rundownId,
		[],
		baselineAdlibPieces,
		baselineAdlibActions
	)
	ingestModel.setExpectedMediaItemsForRundownBaseline(expectedMediaItems)
}

/**
 * Regenerate the ExpectedMediaItems belonging to a Part
 * @param context Context for the Job
 * @param part Model containing the Part and resulting ExpectedMediaItems
 */
export function updateExpectedMediaItemsForPartModel(context: JobContext, part: IngestPartModel): void {
	const expectedMediaItems = generateExpectedMediaItemsFull(
		context.studio._id,
		part.part.rundownId,
		part.pieces,
		part.adLibPieces,
		part.adLibActions
	)

	part.setExpectedMediaItems(expectedMediaItems)
}
