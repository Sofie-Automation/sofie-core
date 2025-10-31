import {
	TimelineObjGeneric,
	TimelineObjRundown,
	TimelineObjType,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	IBlueprintActionManifest,
	IBlueprintAdLibPiece,
	IBlueprintPiece,
	TimelineObjectCoreExt,
	TSR,
	PieceLifespan,
	IBlueprintPieceType,
	ITranslatableMessage,
	IBlueprintRundownPiece,
} from '@sofie-automation/blueprints-integration'
import {
	BlueprintId,
	BucketAdLibActionId,
	BucketAdLibId,
	BucketId,
	PartId,
	PieceId,
	RundownId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { JobContext, ProcessedShowStyleCompound } from '../jobs/index.js'
import {
	EmptyPieceTimelineObjectsBlob,
	Piece,
	serializePieceTimelineObjectsBlob,
} from '@sofie-automation/corelib/dist/dataModel/Piece'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { ArrayElement, getHash, literal, omit } from '@sofie-automation/corelib/dist/lib'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { RundownImportVersions } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { BucketAdLib, BucketAdLibIngestInfo } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import {
	interpollateTranslation,
	wrapTranslatableMessageFromBlueprints,
} from '@sofie-automation/corelib/dist/TranslatableMessage'
import { setDefaultIdOnExpectedPackages } from '../ingest/expectedPackages.js'
import { logger } from '../logging.js'
import { validateTimeline } from 'superfly-timeline'
import { ReadonlyDeep } from 'type-fest'
import { translateUserEditPropertiesFromBlueprint, translateUserEditsFromBlueprint } from './context/lib.js'

function getIdHash(docType: string, usedIds: Map<string, number>, uniqueId: string): string {
	const count = usedIds.get(uniqueId)
	if (count === undefined) {
		usedIds.set(uniqueId, 0)

		return getHash(uniqueId)
	} else {
		logger.debug(`Duplicate ${docType} uniqueId "${uniqueId}"`)
		usedIds.set(uniqueId, count + 1)
		return getHash(`${uniqueId}_${count}`)
	}
}

/**
 * Process and validate some IBlueprintPiece into Piece
 * @param context Context from the job queue
 * @param pieces IBlueprintPiece to process
 * @param blueprintId Id of the Blueprint the Pieces are from
 * @param rundownId Id of the Rundown the Pieces belong to
 * @param segmentId Id of the Segment the Pieces belong to
 * @param partId Id of the Part the Pieces belong to
 * @param allowNowForPiece Allows the pieces to use a start of 'now'. should be true for pieces being inserted into the currently playing part
 * @param setInvalid If true all Pieces will be marked as `invalid`, this should be set to match the owning Part
 */
export function postProcessPieces(
	context: JobContext,
	pieces: Array<IBlueprintPiece>,
	blueprintId: BlueprintId,
	rundownId: RundownId,
	segmentId: SegmentId,
	partId: PartId,
	allowNowForPiece: boolean,
	setInvalid?: boolean
): Piece[] {
	const span = context.startSpan('blueprints.postProcess.postProcessPieces')

	const uniqueIds = new Map<string, number>()
	const timelineUniqueIds = new Set<string>()

	const processedPieces = pieces.map((orgPiece: IBlueprintPiece) => {
		if (!orgPiece.externalId)
			throw new Error(
				`Error in blueprint "${blueprintId}" externalId not set for adlib piece in ${partId}! ("${orgPiece.name}")`
			)

		const docId = getIdHash(
			'Piece',
			uniqueIds,
			`${rundownId}_${blueprintId}_${partId}_piece_${orgPiece.sourceLayerId}_${orgPiece.externalId}`
		)

		const piece: Piece = {
			pieceType: IBlueprintPieceType.Normal,

			...orgPiece,
			content: omit(orgPiece.content, 'timelineObjects'),

			_id: protectString(docId),
			startRundownId: rundownId,
			startSegmentId: segmentId,
			startPartId: partId,
			invalid: setInvalid ?? false,
			timelineObjectsString: EmptyPieceTimelineObjectsBlob,
			userEditOperations: translateUserEditsFromBlueprint(orgPiece.userEditOperations, [blueprintId]),
			userEditProperties: translateUserEditPropertiesFromBlueprint(orgPiece.userEditProperties, [blueprintId]),
		}

		if (piece.pieceType !== IBlueprintPieceType.Normal) {
			// transition pieces must not be infinite, lets enforce that
			piece.lifespan = PieceLifespan.WithinPart
		}
		if (piece.extendOnHold) {
			// HOLD pieces must not be infinite, as they become that when being held
			piece.lifespan = PieceLifespan.WithinPart
		}

		if (!allowNowForPiece && piece.enable.start === 'now')
			throw new Error(
				`Error in blueprint "${blueprintId}" piece cannot have a start of 'now' in ${partId}! ("${piece.name}")`
			)

		const timelineObjects = postProcessTimelineObjects(
			piece._id,
			blueprintId,
			orgPiece.content.timelineObjects,
			timelineUniqueIds
		)
		piece.timelineObjectsString = serializePieceTimelineObjectsBlob(timelineObjects)

		// Fill in ids of unnamed expectedPackages
		setDefaultIdOnExpectedPackages(piece.expectedPackages)

		return piece
	})

	span?.end()
	return processedPieces
}

function isNow(enable: TimelineObjectCoreExt<any>['enable']): boolean {
	if (Array.isArray(enable)) {
		return !!enable.find((e) => e.start === 'now')
	} else {
		return enable.start === 'now'
	}
}

/**
 * Process and validate some TSRTimelineObj into TimelineObjRundown
 * @param pieceId Id of the Piece the Objects are from
 * @param blueprintId Id of the Blueprint the Objects are from
 * @param timelineObjects Array of TSRTimelineObj to process
 * @param timelineUniqueIds Optional Set of ids that are not allowed. Ids of processed objects will be added to ths set
 */
export function postProcessTimelineObjects(
	pieceId: PieceId | BucketAdLibId,
	blueprintId: BlueprintId,
	timelineObjects: TimelineObjectCoreExt<TSR.TSRTimelineContent>[],
	timelineUniqueIds: Set<string> = new Set<string>()
): TimelineObjRundown[] {
	const postProcessedTimeline = (timelineObjects as TimelineObjectCoreExt<any>[]).map((o, i) => {
		const obj: TimelineObjRundown = {
			...o,
			id: o.id,
			objectType: TimelineObjType.RUNDOWN,
		}

		if (!obj.id) obj.id = getHash(pieceId + '_' + i++)
		if (isNow(obj.enable))
			throw new Error(
				`Error in blueprint "${blueprintId}" timelineObjs cannot have a start of 'now'! ("${obj.id}")`
			)

		if (typeof obj.priority !== 'number')
			throw new Error(
				`Error in blueprint "${blueprintId}" timelineObjs must have a numeric priority! ("${obj.id}")`
			)

		if (timelineUniqueIds.has(obj.id))
			throw new Error(`Error in blueprint "${blueprintId}": ids of timelineObjs must be unique! ("${obj.id}")`)
		timelineUniqueIds.add(obj.id)

		if (obj.keyframes) {
			obj.keyframes = obj.keyframes.map((kf, i) => {
				return {
					...kf,
					id: `${obj.id}_keyframe_${kf.id || i}`,
				}
			})
		}

		return obj
	})

	try {
		// Do a validation of the timeline, to ensure that it doesn't contain any nastiness that can crash the Timeline-resolving later.
		// We're using the "strict" mode here, to ensure blueprints are forward compatible with future versions of Timeline.
		validateTimeline(postProcessedTimeline, true)
	} catch (err) {
		throw new Error(`Error in blueprint "${blueprintId}": Validation of timelineObjs failed: ${err}`)
	}

	return postProcessedTimeline
}

/**
 * Process and validate some IBlueprintAdLibPiece into AdLibPiece
 * @param context Context from the job queue
 * @param blueprintId Id of the Blueprint the Pieces are from
 * @param rundownId Id of the Rundown the Pieces belong to
 * @param partId Id of the Part the Pieces belong to (if any)
 * @param adLibPieces IBlueprintPiece to process
 */
export function postProcessAdLibPieces(
	context: JobContext,
	blueprintId: BlueprintId,
	rundownId: RundownId,
	partId: PartId | undefined,
	adLibPieces: Array<IBlueprintAdLibPiece>
): AdLibPiece[] {
	const span = context.startSpan('blueprints.postProcess.postProcessAdLibPieces')

	const uniqueIds = new Map<string, number>()
	const timelineUniqueIds = new Set<string>()

	const processedPieces = adLibPieces.map((orgAdlib) => {
		if (!orgAdlib.externalId)
			throw new Error(
				`Error in blueprint "${blueprintId}" externalId not set for adlib piece in ${partId}! ("${orgAdlib.name}")`
			)

		const docId = getIdHash(
			'AdlibPiece',
			uniqueIds,
			`${rundownId}_${blueprintId}_${partId}_adlib_piece_${orgAdlib.sourceLayerId}_${orgAdlib.externalId}`
		)

		const piece: AdLibPiece = {
			...orgAdlib,
			content: omit(orgAdlib.content, 'timelineObjects'),
			_id: protectString(docId),
			rundownId: rundownId,
			partId: partId,
			timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		}

		if (!piece.externalId)
			throw new Error(
				`Error in blueprint "${blueprintId}" externalId not set for piece in ${partId}! ("${piece.name}")`
			)

		const timelineObjects = postProcessTimelineObjects(
			piece._id,
			blueprintId,
			orgAdlib.content.timelineObjects,
			timelineUniqueIds
		)
		piece.timelineObjectsString = serializePieceTimelineObjectsBlob(timelineObjects)

		// Fill in ids of unnamed expectedPackages
		setDefaultIdOnExpectedPackages(piece.expectedPackages)

		return piece
	})

	span?.end()
	return processedPieces
}

/**
 * Process and validate some Rundown owned IBlueprintActionManifest into RundownBaselineAdLibAction
 * @param blueprintId Id of the Blueprint the AdlibActions are from
 * @param rundownId Id of the Rundown the AdlibActions belong to
 * @param adlibActions IBlueprintActionManifest to process
 */
export function postProcessGlobalAdLibActions(
	blueprintId: BlueprintId,
	rundownId: RundownId,
	adlibActions: IBlueprintActionManifest[]
): RundownBaselineAdLibAction[] {
	const uniqueIds = new Map<string, number>()

	return adlibActions.map((action) => {
		if (!action.externalId)
			throw new Error(
				`Error in blueprint "${blueprintId}" externalId not set for baseline adlib action! ("${
					action.actionId
				}": "${interpollateTranslation(action.display.label.key, action.display.label.args)}")`
			)

		const docId = getIdHash(
			'RundownAdlibAction',
			uniqueIds,
			`${rundownId}_${blueprintId}_global_adlib_action_${action.externalId}`
		)

		// Fill in ids of unnamed expectedPackages
		setDefaultIdOnExpectedPackages(action.expectedPackages)

		return literal<RundownBaselineAdLibAction>({
			...action,
			actionId: action.actionId,
			_id: protectString(docId),
			rundownId: rundownId,
			partId: undefined,
			...processAdLibActionITranslatableMessages(action, blueprintId),
		})
	})
}

/**
 * Process and validate some Part owned IBlueprintActionManifest into AdLibAction
 * @param blueprintId Id of the Blueprint the AdlibActions are from
 * @param rundownId Id of the Rundown the AdlibActions belong to
 * @param partId Id of the Part the AdlibActions belong to
 * @param adlibActions IBlueprintActionManifest to process
 */
export function postProcessAdLibActions(
	blueprintId: BlueprintId,
	rundownId: RundownId,
	partId: PartId,
	adlibActions: IBlueprintActionManifest[]
): AdLibAction[] {
	const uniqueIds = new Map<string, number>()

	return adlibActions.map((action) => {
		if (!action.externalId)
			throw new Error(
				`Error in blueprint "${blueprintId}" externalId not set for adlib action in ${partId}! ("${typeof action.display.label === 'string' ? action.display.label : action.display.label.key}")`
			)

		const docId = getIdHash(
			'AdlibAction',
			uniqueIds,
			`${rundownId}_${blueprintId}_${partId}_adlib_action_${action.externalId}`
		)

		// Fill in ids of unnamed expectedPackages
		setDefaultIdOnExpectedPackages(action.expectedPackages)

		return literal<AdLibAction>({
			...action,
			actionId: action.actionId,
			_id: protectString(docId),
			rundownId: rundownId,
			partId: partId,
			...processAdLibActionITranslatableMessages(action, blueprintId),
		})
	})
}

/**
 * Process and validate some IBlueprintRundownPiece into Piece
 * @param context Context from the job queue
 * @param pieces IBlueprintPiece to process
 * @param blueprintId Id of the Blueprint the Pieces are from
 * @param rundownId Id of the Rundown the Pieces belong to
 * @param setInvalid If true all Pieces will be marked as `invalid`, this should be set to match the owning Part
 */
export function postProcessGlobalPieces(
	context: JobContext,
	pieces: Array<IBlueprintRundownPiece>,
	blueprintId: BlueprintId,
	rundownId: RundownId,
	setInvalid?: boolean
): Piece[] {
	const span = context.startSpan('blueprints.postProcess.postProcessPieces')

	const uniqueIds = new Map<string, number>()
	const timelineUniqueIds = new Set<string>()

	const processedPieces = pieces.map((orgPiece: IBlueprintRundownPiece) => {
		if (!orgPiece.externalId)
			throw new Error(
				`Error in blueprint "${blueprintId}" externalId not set for rundown piece ("${orgPiece.name}")`
			)

		const docId = getIdHash(
			'Piece',
			uniqueIds,
			`${rundownId}_${blueprintId}_rundown_piece_${orgPiece.sourceLayerId}_${orgPiece.externalId}`
		)

		const piece: Piece = {
			...orgPiece,
			content: omit(orgPiece.content, 'timelineObjects'),

			pieceType: IBlueprintPieceType.Normal,
			lifespan: PieceLifespan.OutOnRundownChange,

			_id: protectString(docId),
			startRundownId: rundownId,
			startSegmentId: null,
			startPartId: null,
			invalid: setInvalid ?? false,
			timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		}

		if (piece.pieceType !== IBlueprintPieceType.Normal) {
			// transition pieces must not be infinite, lets enforce that
			piece.lifespan = PieceLifespan.WithinPart
		}
		if (piece.extendOnHold) {
			// HOLD pieces must not be infinite, as they become that when being held
			piece.lifespan = PieceLifespan.WithinPart
		}

		if (piece.enable.start === 'now')
			throw new Error(
				`Error in blueprint "${blueprintId}" rundown piece cannot have a start of 'now'! ("${piece.name}")`
			)

		const timelineObjects = postProcessTimelineObjects(
			piece._id,
			blueprintId,
			orgPiece.content.timelineObjects,
			timelineUniqueIds
		)
		piece.timelineObjectsString = serializePieceTimelineObjectsBlob(timelineObjects)

		// Fill in ids of unnamed expectedPackages
		setDefaultIdOnExpectedPackages(piece.expectedPackages)

		return piece
	})

	span?.end()
	return processedPieces
}

/**
 * Process and validate TSRTimelineObj for the StudioBaseline into TimelineObjRundown
 * @param blueprintId Id of the Blueprint the TSRTimelineObj are from
 * @param objs Array of TSRTimelineObj to process
 */
export function postProcessStudioBaselineObjects(
	blueprintId: BlueprintId | undefined,
	objs: TimelineObjectCoreExt<TSR.TSRTimelineContent>[]
): TimelineObjRundown[] {
	return postProcessTimelineObjects(protectString('studio'), blueprintId ?? protectString(''), objs)
}

/**
 * Process and validate TSRTimelineObj for the Rundown Baseline into TimelineObjRundown
 * @param blueprintId Id of the Blueprint the TSRTimelineObj are from
 * @param objs Array of TSRTimelineObj to process
 */
export function postProcessRundownBaselineItems(
	blueprintId: BlueprintId,
	baselineItems: TimelineObjectCoreExt<TSR.TSRTimelineContent>[]
): TimelineObjGeneric[] {
	return postProcessTimelineObjects(protectString('baseline'), blueprintId, baselineItems)
}

/**
 * Process and validate a bucket owned IBlueprintAdLibPiece into BucketAdLib
 * @param context Context from the job queue
 * @param showStyleCompound ShowStyle the adlib was generated for
 * @param itemOrig IBlueprintAdLibPiece to process
 * @param externalId External id of the Adlib being processed
 * @param blueprintId Id of the Blueprint the IBlueprintAdLibPiece is from
 * @param bucketId Id of the Bucket the IBlueprintAdLibPiece belong to
 * @param rank Rank to assign for the adlib
 * @param importVersions Versions of documents the IBlueprintAdLibPiece was processed against
 */
export function postProcessBucketAdLib(
	context: JobContext,
	showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
	itemOrig: IBlueprintAdLibPiece,
	ingestInfo: BucketAdLibIngestInfo,
	blueprintId: BlueprintId,
	bucketId: BucketId,
	rank: number | undefined,
	name: string | undefined,
	importVersions: RundownImportVersions
): BucketAdLib {
	const id: BucketAdLibId = protectString(
		getHash(
			`${showStyleCompound.showStyleVariantId}_${context.studioId}_${bucketId}_bucket_adlib_${ingestInfo.payload.externalId}`
		)
	)
	const piece: BucketAdLib = {
		...itemOrig,
		content: omit(itemOrig.content, 'timelineObjects'),
		_id: id,
		externalId: ingestInfo.payload.externalId,
		studioId: context.studioId,
		showStyleBaseId: showStyleCompound._id,
		showStyleVariantId: showStyleCompound.showStyleVariantId,
		bucketId,
		importVersions,
		ingestInfo,
		_rank: rank || itemOrig._rank,
		name: name || itemOrig.name,
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	// Fill in ids of unnamed expectedPackages
	setDefaultIdOnExpectedPackages(piece.expectedPackages)

	const timelineObjects = postProcessTimelineObjects(piece._id, blueprintId, itemOrig.content.timelineObjects)
	piece.timelineObjectsString = serializePieceTimelineObjectsBlob(timelineObjects)

	return piece
}

/**
 * Process and validate a bucket owned IBlueprintActionManifest into BucketAdLibAction
 * @param context Context from the job queue
 * @param showStyleCompound ShowStyle the adlib was generated for
 * @param itemOrig IBlueprintActionManifest to process
 * @param externalId External id of the Adlib being processed
 * @param blueprintId Id of the Blueprint the IBlueprintAdLibPiece is from
 * @param bucketId Id of the Bucket the IBlueprintAdLibPiece belong to
 * @param rank Rank to assign for the adlib
 * @param importVersions Versions of documents the IBlueprintAdLibPiece was processed against
 */
export function postProcessBucketAction(
	context: JobContext,
	showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
	itemOrig: IBlueprintActionManifest,
	ingestInfo: BucketAdLibIngestInfo,
	blueprintId: BlueprintId,
	bucketId: BucketId,
	rank: number | undefined,
	label: string | undefined,
	importVersions: RundownImportVersions
): BucketAdLibAction {
	const id: BucketAdLibActionId = protectString(
		getHash(
			`${showStyleCompound.showStyleVariantId}_${context.studioId}_${bucketId}_bucket_adlib_${ingestInfo.payload.externalId}`
		)
	)
	const action: BucketAdLibAction = {
		...omit(itemOrig, 'partId'),
		_id: id,
		externalId: ingestInfo.payload.externalId,
		studioId: context.studioId,
		showStyleBaseId: showStyleCompound._id,
		showStyleVariantId: itemOrig.allVariants ? null : showStyleCompound.showStyleVariantId,
		bucketId,
		importVersions,
		ingestInfo,
		...processAdLibActionITranslatableMessages(itemOrig, blueprintId, rank, label),
	}

	// Fill in ids of unnamed expectedPackages
	setDefaultIdOnExpectedPackages(action.expectedPackages)

	return action
}

/**
 * A utility function to add namespaces to ITranslatableMessages found in AdLib Actions
 *
 * @export
 * @template K
 * @template T
 * @param {T} itemOrig
 * @param {BlueprintId} blueprintId
 * @param {number} [rank]
 * @return {*}  {(Pick<K, 'display' | 'triggerModes'>)}
 */
function processAdLibActionITranslatableMessages<
	K extends {
		display: IBlueprintActionManifest['display'] & {
			label: ITranslatableMessage
			triggerLabel?: ITranslatableMessage
			description?: ITranslatableMessage
		}
		triggerModes?: (ArrayElement<IBlueprintActionManifest['triggerModes']> & {
			display: ArrayElement<IBlueprintActionManifest['triggerModes']>['display'] & {
				label: ITranslatableMessage
				description?: ITranslatableMessage
			}
		})[]
	},
	T extends IBlueprintActionManifest,
>(itemOrig: T, blueprintId: BlueprintId, rank?: number, label?: string): Pick<K, 'display' | 'triggerModes'> {
	return {
		display: {
			...itemOrig.display,
			_rank: rank ?? itemOrig.display._rank,
			label: (label as any) ?? wrapTranslatableMessageFromBlueprints(itemOrig.display.label, [blueprintId]),
			triggerLabel:
				itemOrig.display.triggerLabel &&
				wrapTranslatableMessageFromBlueprints(itemOrig.display.triggerLabel, [blueprintId]),
			description:
				itemOrig.display.description &&
				wrapTranslatableMessageFromBlueprints(itemOrig.display.description, [blueprintId]),
		},
		triggerModes:
			itemOrig.triggerModes &&
			itemOrig.triggerModes.map(
				(triggerMode): ArrayElement<BucketAdLibAction['triggerModes']> => ({
					...triggerMode,
					display: {
						...triggerMode.display,
						label: wrapTranslatableMessageFromBlueprints(triggerMode.display.label, [blueprintId]),
						description:
							triggerMode.display.description &&
							wrapTranslatableMessageFromBlueprints(triggerMode.display.description, [blueprintId]),
					},
				})
			),
	}
}
