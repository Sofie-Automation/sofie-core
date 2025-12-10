import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TimelineObjType } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { getBestPieceInstanceId, LookaheadTimelineObject } from './findObjects.js'
import { PartAndPieces, PieceInstanceWithObjectMap } from './util.js'
import { TimelineEnable } from 'superfly-timeline'
import { TimelineObjectCoreExt } from '@sofie-automation/blueprints-integration'
import { PieceInstanceWithTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'

/**
 * Computes a full {@link LookaheadTimelineObject} for a given piece/object pair,
 * including the correct `lookaheadOffset` based on explicit numeric `start` or `while` expressions.
 *
 * This function:
 * - Ignores objects whose `enable` is an array (unsupported for lookahead)
 * - Extracts a usable numeric start reference from both the object and its parent piece
 * - Supports lookahead semantics where `enable.while >= 1` acts like an implicit start value
 * - Returns `undefined` when lookahead cannot be computed safely
 *
 * @param obj - The timeline object associated with the piece and layer. If `undefined`,
 *              no lookahead object is created.
 * @param rawPiece - The piece instance containing the object map and its own enable
 *                   expression, which determines the base start time for lookahead.
 * @param partInfo - Metadata about the part the piece belongs to, required for
 *                   associating the lookahead object with the correct `partInstanceId`.
 * @param partInstanceId - The currently active or next part instance ID. If `null`,
 *                         the function falls back to the part ID from `partInfo`.
 * @param nextTimeOffset - An optional offset of the in point of the next part
 *                         used to calculate the lookahead offset. If omitted, no
 *                         lookahead offset is generated.
 *
 * @returns A fully constructed {@link LookaheadTimelineObject} ready to be pushed
 *          into the lookahead timeline, or `undefined` when no valid lookahead
 *          calculation is possible.
 */
export function computeLookaheadObject(
	obj: TimelineObjectCoreExt<any, unknown, unknown> | undefined,
	rawPiece: PieceInstanceWithObjectMap,
	partInfo: PartAndPieces,
	partInstanceId: PartInstanceId | null,
	nextTimeOffset?: number
): LookaheadTimelineObject | undefined {
	if (!obj) return undefined

	const enable = obj.enable

	if (Array.isArray(enable)) return undefined

	const objStart = getStartValueFromEnable(enable)
	const pieceStart = getStartValueFromEnable(rawPiece.piece.enable)

	// We make sure to only consider objects for lookahead that have an explicit numeric start/while value. (while = 1 and 0 is considered boolean)
	if (pieceStart === undefined) return undefined

	let lookaheadOffset: number | undefined
	// Only calculate lookaheadOffset if needed
	if (nextTimeOffset) {
		lookaheadOffset = computeLookaheadOffset(nextTimeOffset, pieceStart, objStart)
	}

	return literal<LookaheadTimelineObject>({
		metaData: undefined,
		...obj,
		objectType: TimelineObjType.RUNDOWN,
		pieceInstanceId: getBestPieceInstanceId(rawPiece),
		infinitePieceInstanceId: rawPiece.infinite?.infiniteInstanceId,
		partInstanceId: partInstanceId ?? protectString(unprotectString(partInfo.part._id)),
		...(lookaheadOffset !== undefined ? { lookaheadOffset } : {}),
	})
}

/**
 * Computes a lookahead offset for an object based on the piece's start time
 * and the object's start time, relative to the next part's start time.
 *
 * @param nextTimeOffset - The upcoming part's start time (or similar time anchor).
 *                         If undefined, no lookahead offset is produced.
 * @param pieceStart - The start time of the piece this object belongs to.
 * @param objStart - The explicit start time of the object (relative to the piece's start time).
 *
 * @returns A positive lookahead offset, or `undefined` if lookahead cannot be
 *          determined or would be non-positive.
 */
function computeLookaheadOffset(
	nextTimeOffset: number | undefined,
	pieceStart: number,
	objStart?: number
): number | undefined {
	if (nextTimeOffset === undefined || objStart === undefined) return undefined

	const offset = nextTimeOffset - pieceStart - objStart
	return offset > 0 ? offset : undefined
}

/**
 * Extracts a numeric start reference from a {@link TimelineEnable} object
 *
 * The function handles two mutually exclusive cases:
 *
 * **1. `start` mode (`{ start: number }`)**
 *    - If `enable.start` is a numeric value, it is returned as `start`.
 *    - If `enable.start` is the string `"now"`, it is treated as `0`.
 *
 * **2. `while` mode (`{ while: number }`)**
 *    - If `enable.while` is numeric and greater than 1, it's value is returned as is.
 *    - If `enable.while` is numeric and equal to 1 it's treated as `0`.
 *
 * If no usable numeric `start` or `while` expression exists, the function returns `undefined`.
 *
 * @param enable - The timeline object's enable expression to extract start info from.
 * @returns the relative start value of the object or undefined if there is no explicit value.
 */
function getStartValueFromEnable(enable: TimelineEnable): number | undefined {
	// Case: start is a number
	if (typeof enable.start === 'number') {
		return enable.start
	}

	// Case: start is "now"
	if (enable.start === 'now') {
		return 0
	}

	// Case: while is numeric
	if (typeof enable.while === 'number') {
		// while > 1 we treat it as a start value
		if (enable.while > 1) {
			return enable.while
		}
		// while === 1 we treat it as a `0` start value
		else if (enable.while === 1) {
			return 0
		}
	}

	// No usable numeric expressions
	return undefined
}

/**
 * Filters piece instances for the "next" part when a `nextTimeOffset` is defined.
 *
 * This function ensures that we only take into account each layer's relevant piece before
 * or at the `nextTimeOffset`, while also preserving all pieces starting after the offset.
 *
 * This is needed to ignore pieces that start before the offset, but then are replaced by another piece at the offset.
 * Without ignoring them the lookahead logic would treat the next part as if it was queued from it's start.
 *
 * **Filtering rules:**
 * - If `nextTimeOffset` is not set (0, null, undefined), the original list is returned.
 * - Pieces are grouped based on their `outputLayerId`.
 * - For each layer:
 *   - We only keep pieces with the **latest start time** where `start/while <= nextTimeOffset`
 *   - All pieces *after* `nextTimeOffset` are kept for future lookaheads.
 *
 * The result is a flattened list of the selected pieces across all layers.
 *
 * @param {PieceInstanceWithTimings[]} pieces
 *        The list of piece instances to filter.
 *
 * @param {number | null | undefined} nextTimeOffset
 *        The time offset (in part time) that defines relevance.
 *        Pieces are compared based on their enable.start value.
 *
 * @returns {PieceInstanceWithTimings[]}
 *          A filtered list of pieces containing only the relevant pieces per layer.
 */
export function filterPieceInstancesForNextPartWithOffset(
	pieces: PieceInstanceWithTimings[],
	nextTimeOffset: number | null | undefined
): PieceInstanceWithTimings[] {
	if (!nextTimeOffset) return pieces

	// Group pieces by layer
	const layers = new Map<string, PieceInstanceWithTimings[]>()
	for (const p of pieces) {
		const layer = p.piece.outputLayerId || '__noLayer__'
		if (!layers.has(layer)) layers.set(layer, [])
		layers.get(layer)?.push(p)
	}

	const result: PieceInstanceWithTimings[] = []

	for (const layerPieces of layers.values()) {
		const beforeOrAt: PieceInstanceWithTimings[] = []
		const after: PieceInstanceWithTimings[] = []

		for (const piece of layerPieces) {
			const pieceStart = getStartValueFromEnable(piece.piece.enable)

			if (pieceStart !== undefined) {
				if (pieceStart <= nextTimeOffset) beforeOrAt.push(piece)
				else after.push(piece)
			}
		}

		// Pick the relevant piece before/at nextTimeOffset
		if (beforeOrAt.length > 0) {
			const best = beforeOrAt.reduce((a, b) => (a.piece.enable.start > b.piece.enable.start ? a : b))
			result.push(best)
		}

		// Keep all pieces after nextTimeOffset for future lookaheads.
		result.push(...after)
	}

	return result
}
