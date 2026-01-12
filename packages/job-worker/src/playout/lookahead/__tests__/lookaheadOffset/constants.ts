import { IBlueprintPieceType, TSR, LookaheadMode } from '@sofie-automation/blueprints-integration'
import { Piece, PieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PlayoutModel } from '../../../model/PlayoutModel.js'
import { JobContext } from '../../../../jobs/index.js'

export function makePiece({
	partId,
	layer,
	start = 0,
	duration,
	nameSuffix = '',
	objsBeforeOffset = 0,
	objsAfterOffset = 0,
	objsWhile = false,
}: {
	partId: string
	layer: string
	start?: number
	duration?: number
	nameSuffix?: string
	objsBeforeOffset?: number
	objsAfterOffset?: number
	objsWhile?: boolean
}): Piece {
	return literal<Partial<Piece>>({
		_id: protectString(`piece_${partId}_${nameSuffix}_${layer}`),
		startRundownId: protectString('r1'),
		startPartId: protectString(partId),
		enable: { start, duration },
		outputLayerId: layer,
		pieceType: IBlueprintPieceType.Normal,
		timelineObjectsString: generateFakeObectsString(
			`piece_${partId}_${nameSuffix}_${layer}`,
			layer,
			objsBeforeOffset,
			objsAfterOffset,
			objsWhile
		),
	}) as Piece
}
export function generateFakeObectsString(
	pieceId: string,
	layer: string,
	beforeStart: number,
	afterStart: number,
	enableWhile: boolean = false
): PieceTimelineObjectsBlob {
	return protectString<PieceTimelineObjectsBlob>(
		JSON.stringify([
			// At piece start
			{
				id: `${pieceId}_objPieceStart_${layer}`,
				layer,
				enable: !enableWhile ? { start: 0 } : { while: 1 },
				content: {
					deviceType: TSR.DeviceType.CASPARCG,
					type: TSR.TimelineContentTypeCasparCg.MEDIA,
					file: 'AMB',
				},
			},
			//beforeOffsetObj except if it's piece starts later than the offset.
			{
				id: `${pieceId}_obj_beforeOffset_${layer}`,
				layer,
				enable: !enableWhile ? { start: beforeStart } : { while: beforeStart },
				content: {
					deviceType: TSR.DeviceType.CASPARCG,
					type: TSR.TimelineContentTypeCasparCg.MEDIA,
					file: 'AMB',
				},
			},
			//afterOffsetObj except if it's piece starts later than the offset.
			{
				id: `${pieceId}_obj_afterOffset_${layer}`,
				layer,
				enable: !enableWhile ? { start: afterStart } : { while: afterStart },
				content: {
					deviceType: TSR.DeviceType.CASPARCG,
					type: TSR.TimelineContentTypeCasparCg.MEDIA,
					file: 'AMB',
				},
			},
		])
	)
}

export const partDuration = 3000
export const lookaheadOffsetTestConstants = {
	multiLayerPart: {
		nowInPart: 0,
		partInstance: {
			_id: protectString('pLookahead_ml_instance'),
			part: {
				_id: protectString('pLookahead_ml'),
				_rank: 0,
			},
			playlistActivationId: 'pA1',
		},
		pieces: [
			// piece1 — At Part Start - lookaheadOffset should equal nextTimeOffset
			// We generate three objects, one at the piece's start, one 700 ms after the piece's start, one 1700 ms after the piece's start.
			// We need to check if all offsets are calculated correctly. (1000, 300 and no offset)
			makePiece({
				partId: 'pLookahead_ml',
				layer: 'layer1',
				duration: partDuration,
				nameSuffix: 'partStart',
				objsBeforeOffset: 700,
				objsAfterOffset: 1700,
			}),

			// piece2 — Before Offset — lookaheadOffset should equal nextTimeOffset - the piece's start - the timeline object's start.
			// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 1200 ms after the piece's start.
			// We need to check if all offsets are calculated correctly. (500, 300 and no offset)
			makePiece({
				partId: 'pLookahead_ml',
				layer: 'layer2',
				start: 500,
				duration: partDuration - 500,
				nameSuffix: 'partBeforeOffset',
				objsBeforeOffset: 200,
				objsAfterOffset: 1200,
			}),

			// piece3 — After Offset — no lookahead offset
			// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 400 ms after the piece's start.
			// We need to check if all offsets are calculated correctly.
			// for reference no offset should be calculated for all of it's objects.
			makePiece({
				partId: 'pLookahead_ml',
				layer: 'layer3',
				start: 1500,
				duration: partDuration - 1500,
				nameSuffix: 'partAfterOffset',
				objsBeforeOffset: 200,
				objsAfterOffset: 400,
			}),
		],
		calculatedTimings: undefined,
		regenerateTimelineAt: undefined,
	},
	multiLayerPartWhile: {
		nowInPart: 0,
		partInstance: {
			_id: protectString('pLookahead_ml_while_instance'),
			part: {
				_id: protectString('pLookahead_ml_while'),
				_rank: 0,
			},
			playlistActivationId: 'pA1',
		},
		pieces: [
			// piece1 — At Part Start - lookaheadOffset should equal nextTimeOffset
			// We generate three objects, one at the piece's start, one 700 ms after the piece's start, one 1700 ms after the piece's start.
			// We need to check if all offsets are calculated correctly. (1000, 300 and no offset)
			makePiece({
				partId: 'pLookahead_ml_while',
				layer: 'layer1',
				duration: partDuration,
				nameSuffix: 'partStart',
				objsBeforeOffset: 700,
				objsAfterOffset: 1700,
				objsWhile: true,
			}),

			// piece2 — Before Offset — lookaheadOffset should equal nextTimeOffset - the piece's start - the timeline object's start.
			// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 1200 ms after the piece's start.
			// We need to check if all offsets are calculated correctly. (500, 300 and no offset)
			makePiece({
				partId: 'pLookahead_ml_while',
				layer: 'layer2',
				start: 500,
				duration: partDuration - 500,
				nameSuffix: 'partBeforeOffset',
				objsBeforeOffset: 200,
				objsAfterOffset: 1200,
				objsWhile: true,
			}),

			// piece3 — After Offset — no lookahead offset
			// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 400 ms after the piece's start.
			// We need to check if all offsets are calculated correctly.
			// for reference no offset should be calculated for all of it's objects.
			makePiece({
				partId: 'pLookahead_ml_while',
				layer: 'layer3',
				start: 1500,
				duration: partDuration - 1500,
				nameSuffix: 'partAfterOffset',
				objsBeforeOffset: 200,
				objsAfterOffset: 400,
				objsWhile: true,
			}),
		],
		calculatedTimings: undefined,
		regenerateTimelineAt: undefined,
	},
	singleLayerPart: {
		nowInPart: 0,
		partInstance: {
			_id: protectString('pLookahead_sl_instance'),
			part: {
				_id: protectString('pLookahead_sl'),
				_rank: 0,
			},
			playlistActivationId: 'pA1',
		},
		pieces: [
			// piece1 — At Part Start - should be ignored
			// We generate three objects, one at the piece's start, one 700 ms after the piece's start, one 1700 ms after the piece's start.
			// If the piece is not ignored (which shouldn't happen, it would mean that the logic is wrong)
			// for reference the calculated offset values should be 1000, 300 and no offset
			makePiece({
				partId: 'pLookahead_sl',
				layer: 'layer1',
				duration: partDuration,
				nameSuffix: 'partStart',
				objsBeforeOffset: 700,
				objsAfterOffset: 1700,
			}),

			// piece2 — Before Offset — lookaheadOffset should equal nextTimeOffset - the piece's start - the timeline object's start.
			/// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 1200 ms after the piece's start.
			// We need to check if all offsets are calculated correctly. (500, 300 and no offset)
			makePiece({
				partId: 'pLookahead_sl',
				layer: 'layer1',
				start: 500,
				duration: partDuration - 500,
				nameSuffix: 'partBeforeOffset',
				objsBeforeOffset: 200,
				objsAfterOffset: 1200,
			}),

			// piece3 — After Offset — should be ignored
			// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 400 ms after the piece's start.
			// If the piece is not ignored (which shouldn't happen, it would mean that the logic is wrong)
			// for reference no offset should be calculated for all of it's objects.
			makePiece({
				partId: 'pLookahead_sl',
				layer: 'layer1',
				start: 1500,
				duration: partDuration - 1500,
				nameSuffix: 'partAfterOffset',
				objsBeforeOffset: 200,
				objsAfterOffset: 400,
			}),
		],
		calculatedTimings: undefined,
		regenerateTimelineAt: undefined,
	},
	singleLayerPartWhile: {
		nowInPart: 0,
		partInstance: {
			_id: protectString('pLookahead_sl_while_instance'),
			part: {
				_id: protectString('pLookahead_sl_while'),
				_rank: 0,
			},
			playlistActivationId: 'pA1',
		},
		pieces: [
			// piece1 — At Part Start - should be ignored
			// We generate three objects, one at the piece's start, one 700 ms after the piece's start, one 1700 ms after the piece's start.
			// If the piece is not ignored (which shouldn't happen, it would mean that the logic is wrong)
			// for reference the calculated offset values should be 1000, 300 and no offset
			makePiece({
				partId: 'pLookahead_sl_while',
				layer: 'layer1',
				duration: partDuration,
				nameSuffix: 'partStart',
				objsBeforeOffset: 700,
				objsAfterOffset: 1700,
				objsWhile: true,
			}),

			// piece2 — Before Offset — lookaheadOffset should equal nextTimeOffset - the piece's start - the timeline object's start.
			// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 1200 ms after the piece's start.
			// We need to check if all offsets are calculated correctly. (500, 300 and no offset)
			makePiece({
				partId: 'pLookahead_sl_while',
				layer: 'layer1',
				start: 500,
				duration: partDuration - 500,
				nameSuffix: 'partBeforeOffset',
				objsBeforeOffset: 200,
				objsAfterOffset: 1200,
				objsWhile: true,
			}),

			// piece3 — After Offset — should be ignored
			// We generate three objects, one at the piece's start, one 200 ms after the piece's start, one 400 ms after the piece's start.
			// If the piece is not ignored (which shouldn't happen, it would mean that the logic is wrong)
			// for reference no offset should be calculated for all of it's objects.
			makePiece({
				partId: 'pLookahead_sl_while',
				layer: 'layer1',
				start: 1500,
				duration: partDuration - 1500,
				nameSuffix: 'partAfterOffset',
				objsBeforeOffset: 200,
				objsAfterOffset: 400,
				objsWhile: true,
			}),
		],
		calculatedTimings: undefined,
		regenerateTimelineAt: undefined,
	},
	nextTimeOffset: 1000,
}
export const baseContext = {
	startSpan: jest.fn(() => ({ end: jest.fn() })),
	studio: {
		mappings: {
			layer1: {
				device: 'casparcg',
				layer: 10,
				lookahead: LookaheadMode.PRELOAD,
				lookaheadDepth: 2,
			},
			layer2: {
				device: 'casparcg',
				layer: 10,
				lookahead: LookaheadMode.PRELOAD,
				lookaheadDepth: 2,
			},
			layer3: {
				device: 'casparcg',
				layer: 10,
				lookahead: LookaheadMode.PRELOAD,
				lookaheadDepth: 2,
			},
		},
	},
	directCollections: {
		Pieces: {
			findFetch: jest.fn(),
		},
	},
} as unknown as JobContext

export const basePlayoutModel = {
	getRundownIds: () => [protectString('r1')],
	playlist: {
		nextTimeOffset: 0,
	},
} as unknown as PlayoutModel
