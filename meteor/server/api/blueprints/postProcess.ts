import { Piece, PieceId } from '../../../lib/collections/Pieces'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { protectString, unprotectString, literal, getHash } from '../../../lib/lib'
import { TimelineObjGeneric, TimelineObjRundown, TimelineObjType } from '../../../lib/collections/Timeline'
import { Studio } from '../../../lib/collections/Studios'
import { Meteor } from 'meteor/meteor'
import {
	TimelineObjectCoreExt,
	IBlueprintPiece,
	IBlueprintAdLibPiece,
	TSR,
	IBlueprintActionManifest,
	PieceLifespan,
	IBlueprintPieceType,
} from '@sofie-automation/blueprints-integration'
import { RundownAPI } from '../../../lib/api/rundown'
import { BucketAdLib } from '../../../lib/collections/BucketAdlibs'
import { RundownImportVersions } from '../../../lib/collections/Rundowns'
import { BlueprintId } from '../../../lib/collections/Blueprints'
import { PartId } from '../../../lib/collections/Parts'
import { BucketId } from '../../../lib/collections/Buckets'
import { AdLibAction } from '../../../lib/collections/AdLibActions'
import { RundownBaselineAdLibAction } from '../../../lib/collections/RundownBaselineAdLibActions'
import { RundownId } from '../../../lib/collections/Rundowns'
import { prefixAllObjectIds } from '../playout/lib'
import { SegmentId } from '../../../lib/collections/Segments'
import { profiler } from '../profiler'
import { BucketAdLibAction } from '../../../lib/collections/BucketAdlibActions'
import { ShowStyleContext } from './context'
import { ReadonlyDeep } from 'type-fest'
import { processAdLibActionITranslatableMessages } from '../../../lib/api/TranslatableMessage'
import { setDefaultIdOnExpectedPackages } from '../ingest/expectedPackages'

/**
 *
 * allowNowForPiece: allows the pieces to use a start of 'now', should be true for adlibs and false for ingest
 * prefixAllTimelineObjects: Add a prefix to the timeline object ids, to ensure duplicate ids don't occur when inserting a copy of a piece
 */
export function postProcessPieces(
	pieces: IBlueprintPiece[],
	blueprintId: BlueprintId,
	rundownId: RundownId,
	segmentId: SegmentId,
	partId: PartId,
	allowNowForPiece?: boolean,
	prefixAllTimelineObjects?: boolean,
	setInvalid?: boolean
): Piece[] {
	const span = profiler.startSpan('blueprints.postProcess.postProcessPieces')

	const externalIds = new Map<string, number>()
	const timelineUniqueIds = new Set<string>()

	const processedPieces = pieces.map((orgPiece: IBlueprintPiece) => {
		const i = externalIds.get(orgPiece.externalId) ?? 0
		externalIds.set(orgPiece.externalId, i + 1)

		const piece: Piece = {
			pieceType: IBlueprintPieceType.Normal,

			...(orgPiece as Omit<IBlueprintPiece, 'continuesRefId'>),
			_id: protectString(
				getHash(
					`${rundownId}_${blueprintId}_${partId}_piece_${orgPiece.sourceLayerId}_${orgPiece.externalId}_${i}`
				)
			),
			continuesRefId: protectString(orgPiece.continuesRefId),
			startRundownId: rundownId,
			startSegmentId: segmentId,
			startPartId: partId,
			status: RundownAPI.PieceStatusCode.UNKNOWN,
			invalid: setInvalid ?? false,
		}

		if (piece.pieceType !== IBlueprintPieceType.Normal) {
			// transition pieces must not be infinite, lets enforce that
			piece.lifespan = PieceLifespan.WithinPart
		}
		if (piece.extendOnHold) {
			// HOLD pieces must not be infinite, as they become that when being held
			piece.lifespan = PieceLifespan.WithinPart
		}

		if (!piece.externalId && piece.pieceType === IBlueprintPieceType.Normal)
			throw new Meteor.Error(
				400,
				`Error in blueprint "${blueprintId}" externalId not set for piece in ${partId}! ("${piece.name}")`
			)
		if (!allowNowForPiece && piece.enable.start === 'now')
			throw new Meteor.Error(
				400,
				`Error in blueprint "${blueprintId}" piece cannot have a start of 'now' in ${partId}! ("${piece.name}")`
			)

		if (piece.content?.timelineObjects) {
			piece.content.timelineObjects = postProcessTimelineObjects(
				piece._id,
				blueprintId,
				piece.content.timelineObjects,
				prefixAllTimelineObjects || false,
				timelineUniqueIds
			)
		}
		// Fill in ids of unnamed expectedPackages
		setDefaultIdOnExpectedPackages(piece.expectedPackages)

		return piece
	})

	span?.end()
	return processedPieces
}

function isNow(enable: TSR.TSRTimelineObjBase['enable']): boolean {
	if (Array.isArray(enable)) {
		return !!enable.find((e) => e.start === 'now')
	} else {
		return enable.start === 'now'
	}
}

export function postProcessTimelineObjects(
	pieceId: PieceId,
	blueprintId: BlueprintId,
	timelineObjects: TSR.TSRTimelineObjBase[],
	prefixAllTimelineObjects: boolean, // TODO: remove, default to true?
	timelineUniqueIds: Set<string> = new Set<string>()
) {
	let newObjs = timelineObjects.map((o: TimelineObjectCoreExt, i) => {
		const obj: TimelineObjRundown = {
			...o,
			id: o.id,
			objectType: TimelineObjType.RUNDOWN,
		}

		if (!obj.id) obj.id = getHash(pieceId + '_' + i++)
		if (isNow(obj.enable))
			throw new Meteor.Error(
				400,
				`Error in blueprint "${blueprintId}" timelineObjs cannot have a start of 'now'! ("${obj.id}")`
			)

		if (timelineUniqueIds.has(obj.id))
			throw new Meteor.Error(
				400,
				`Error in blueprint "${blueprintId}": ids of timelineObjs must be unique! ("${obj.id}")`
			)
		timelineUniqueIds.add(obj.id)

		return obj
	})

	if (prefixAllTimelineObjects) {
		newObjs = prefixAllObjectIds(newObjs, unprotectString(pieceId) + '_')
	}

	return newObjs
}

export function postProcessAdLibPieces(
	blueprintId: BlueprintId,
	rundownId: RundownId,
	partId: PartId | undefined,
	adLibPieces: IBlueprintAdLibPiece[]
): AdLibPiece[] {
	const span = profiler.startSpan('blueprints.postProcess.postProcessAdLibPieces')

	const externalIds = new Map<string, number>()
	const timelineUniqueIds = new Set<string>()

	const processedPieces = adLibPieces.map((orgAdlib) => {
		const i = externalIds.get(orgAdlib.externalId) ?? 0
		externalIds.set(orgAdlib.externalId, i + 1)

		const piece: AdLibPiece = {
			...orgAdlib,
			_id: protectString(
				getHash(
					`${rundownId}_${blueprintId}_${partId}_adlib_piece_${orgAdlib.sourceLayerId}_${orgAdlib.externalId}_${i}`
				)
			),
			rundownId: rundownId,
			partId: partId,
			status: RundownAPI.PieceStatusCode.UNKNOWN,
		}

		if (!piece.externalId)
			throw new Meteor.Error(
				400,
				`Error in blueprint "${blueprintId}" externalId not set for piece in ${partId}! ("${piece.name}")`
			)

		if (piece.content && piece.content.timelineObjects) {
			piece.content.timelineObjects = postProcessTimelineObjects(
				piece._id,
				blueprintId,
				piece.content.timelineObjects,
				false,
				timelineUniqueIds
			)
		}
		// Fill in ids of unnamed expectedPackages
		setDefaultIdOnExpectedPackages(piece.expectedPackages)

		return piece
	})

	span?.end()
	return processedPieces
}

export function postProcessGlobalAdLibActions(
	blueprintId: BlueprintId,
	rundownId: RundownId,
	adlibActions: IBlueprintActionManifest[]
): RundownBaselineAdLibAction[] {
	return adlibActions.map((action, i) => {
		// Fill in ids of unnamed expectedPackages
		setDefaultIdOnExpectedPackages(action.expectedPackages)

		return literal<RundownBaselineAdLibAction>({
			...action,
			actionId: action.actionId,
			_id: protectString(getHash(`${rundownId}_${blueprintId}_global_adlib_action_${i}`)),
			rundownId: rundownId,
			partId: undefined,
			...processAdLibActionITranslatableMessages(action, blueprintId),
		})
	})
}

export function postProcessAdLibActions(
	blueprintId: BlueprintId,
	rundownId: RundownId,
	partId: PartId,
	adlibActions: IBlueprintActionManifest[]
): AdLibAction[] {
	return adlibActions.map((action, i) => {
		// Fill in ids of unnamed expectedPackages
		setDefaultIdOnExpectedPackages(action.expectedPackages)

		return literal<AdLibAction>({
			...action,
			actionId: action.actionId,
			_id: protectString(getHash(`${rundownId}_${blueprintId}_${partId}_adlib_action_${i}`)),
			rundownId: rundownId,
			partId: partId,
			...processAdLibActionITranslatableMessages(action, blueprintId),
		})
	})
}

export function postProcessStudioBaselineObjects(
	studio: ReadonlyDeep<Studio>,
	objs: TSR.TSRTimelineObjBase[]
): TimelineObjRundown[] {
	return postProcessTimelineObjects(protectString('studio'), studio.blueprintId!, objs, false)
}

export function postProcessRundownBaselineItems(
	blueprintId: BlueprintId,
	baselineItems: TSR.TSRTimelineObjBase[]
): TimelineObjGeneric[] {
	return postProcessTimelineObjects(protectString('baseline'), blueprintId, baselineItems, false)
}

export function postProcessBucketAdLib(
	innerContext: ShowStyleContext,
	itemOrig: IBlueprintAdLibPiece,
	externalId: string,
	blueprintId: BlueprintId,
	bucketId: BucketId,
	rank: number | undefined,
	importVersions: RundownImportVersions
): BucketAdLib {
	const piece: BucketAdLib = {
		...itemOrig,
		_id: protectString(
			getHash(
				`${innerContext.showStyleCompound.showStyleVariantId}_${innerContext.studioIdProtected}_${bucketId}_bucket_adlib_${externalId}`
			)
		),
		externalId,
		studioId: innerContext.studioIdProtected,
		showStyleVariantId: innerContext.showStyleCompound.showStyleVariantId,
		bucketId,
		importVersions,
		_rank: rank || itemOrig._rank,
	}
	// Fill in ids of unnamed expectedPackages
	setDefaultIdOnExpectedPackages(piece.expectedPackages)

	if (piece.content && piece.content.timelineObjects) {
		piece.content.timelineObjects = postProcessTimelineObjects(
			piece._id,
			blueprintId,
			piece.content.timelineObjects,
			false
		)
	}

	return piece
}

export function postProcessBucketAction(
	innerContext: ShowStyleContext,
	itemOrig: IBlueprintActionManifest,
	externalId: string,
	blueprintId: BlueprintId,
	bucketId: BucketId,
	rank: number | undefined,
	importVersions: RundownImportVersions
): BucketAdLibAction {
	const action: BucketAdLibAction = {
		...itemOrig,
		_id: protectString(
			getHash(
				`${innerContext.showStyleCompound.showStyleVariantId}_${innerContext.studioIdProtected}_${bucketId}_bucket_adlib_${externalId}`
			)
		),
		externalId,
		studioId: innerContext.studioIdProtected,
		showStyleVariantId: innerContext.showStyleCompound.showStyleVariantId,
		bucketId,
		importVersions,
		...processAdLibActionITranslatableMessages(itemOrig, blueprintId, rank),
	}

	// Fill in ids of unnamed expectedPackages
	setDefaultIdOnExpectedPackages(action.expectedPackages)

	return action
}
