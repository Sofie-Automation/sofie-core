import { PieceInstanceInfiniteId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ResolvedPieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { JobContext } from '../jobs/index.js'
import { getCurrentTime } from '../lib/index.js'
import {
	createPartCurrentTimes,
	PieceInstanceWithTimings,
	processAndPrunePieceInstanceTimings,
	resolvePrunedPieceInstance,
} from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { isOutTransitionPieceType, PartCalculatedTimings } from '@sofie-automation/corelib/dist/playout/timings'
import { SelectedPartInstancesTimelineInfo, SelectedPartInstanceTimelineInfo } from './timeline/generate.js'
import { PlayoutPartInstanceModel } from './model/PlayoutPartInstanceModel.js'
import { filterPieceInstancesForBranding, resolvePieceInstancesForBranding } from './branding.js'
import { getAutoNextExpectedDurationExtension } from './timeline/lib.js'
import { getOutTransitionPiecePlacement } from './timeline/part.js'

function getAutoNextExpectedDurationExtensionForInfo(partInstancesInfo: SelectedPartInstancesTimelineInfo): number {
	if (!partInstancesInfo.current || !partInstancesInfo.next) return 0

	return getAutoNextExpectedDurationExtension(
		partInstancesInfo.current.partInstance.part,
		partInstancesInfo.next.calculatedTimings
	)
}

interface SplitPartPieces {
	/** The PieceInstances which are placed in the PartInstance itself */
	ownPieces: PieceInstanceWithTimings[]
	/**
	 * The out transition PieceInstances which are placed in the PartInstance being transitioned into.
	 * Their times are relative to the start of that PartInstance
	 */
	piecesInNextPart: ResolvedPieceInstance[]
}

/**
 * Split out the transition pieces of a PartInstance which are placed in the PartInstance being transitioned into,
 * matching where the timeline places them
 * @param partInfo The PartInstance
 * @param nextPartTimings The timings of the transition out of the PartInstance, if known
 */
function splitOutTransitionPieces(
	partInfo: SelectedPartInstanceTimelineInfo,
	nextPartTimings: PartCalculatedTimings | undefined
): SplitPartPieces {
	const result: SplitPartPieces = { ownPieces: [], piecesInNextPart: [] }

	for (const pieceInstance of partInfo.pieceInstances) {
		if (!isOutTransitionPieceType(pieceInstance.piece.pieceType)) {
			result.ownPieces.push(pieceInstance)
			continue
		}

		const placement = getOutTransitionPiecePlacement(
			partInfo.calculatedTimings,
			nextPartTimings,
			partInfo.partInstance.part.outTransition,
			pieceInstance.piece
		)
		if (!placement) {
			// The transition is not being used
			continue
		} else if (placement.inNextPart) {
			result.piecesInNextPart.push({
				instance: pieceInstance,
				resolvedStart: placement.startInNextPart,
				resolvedDuration: placement.duration,
				timelinePriority: pieceInstance.priority,
			})
		} else {
			result.ownPieces.push(pieceInstance)
		}
	}

	return result
}

/**
 * Resolve the PieceInstances for a PartInstance
 * Uses the getCurrentTime() as approximation for 'now'
 * @param context Context for current job
 * @param sourceLayers SourceLayers for the current ShowStyle
 * @param partInstance PartInstance to resolve
 * @param skipBrandingOverrides Omit the Branding's overrides, for the blueprint contexts which can write
 * the PieceInstances back. Pieces hidden by the Branding are dropped either way.
 * @returns ResolvedPieceInstances sorted by startTime
 */
export function getResolvedPiecesForCurrentPartInstance(
	_context: JobContext,
	sourceLayers: SourceLayers,
	partInstance: PlayoutPartInstanceModel,
	now?: number,
	skipBrandingOverrides?: boolean
): ResolvedPieceInstance[] {
	if (now === undefined) now = getCurrentTime()

	const partTimes = createPartCurrentTimes(now, partInstance.partInstance.timings?.plannedStartedPlayback)

	const preprocessedPieces = processAndPrunePieceInstanceTimings(
		sourceLayers,
		skipBrandingOverrides
			? filterPieceInstancesForBranding(partInstance)
			: resolvePieceInstancesForBranding(partInstance),
		partTimes
	)
	return preprocessedPieces.map((instance) => resolvePrunedPieceInstance(partTimes, instance))
}

export function getResolvedPiecesForPartInstancesOnTimeline(
	_context: JobContext,
	partInstancesInfo: SelectedPartInstancesTimelineInfo,
	now: number
): ResolvedPieceInstance[] {
	// With no current part, there are no timings to consider
	if (!partInstancesInfo.current) return []

	const currentPartStarted = partInstancesInfo.current.partTimes.partStartTime ?? now
	const currentPartDuration =
		partInstancesInfo.current.partInstance.part.expectedDuration !== undefined
			? partInstancesInfo.current.partInstance.part.expectedDuration +
				partInstancesInfo.current.calculatedTimings.toPartDelay +
				partInstancesInfo.current.calculatedTimings.toPartPostroll +
				getAutoNextExpectedDurationExtensionForInfo(partInstancesInfo)
			: null

	const nextPartStarted =
		partInstancesInfo.current.partInstance.part.autoNext &&
		partInstancesInfo.current.partInstance.part.expectedDuration !== 0 &&
		currentPartDuration !== null
			? currentPartStarted +
				currentPartDuration -
				(partInstancesInfo.next?.calculatedTimings.fromPartRemaining ?? 0)
			: null

	const currentPartEnd =
		partInstancesInfo.current.partInstance.part.autoNext &&
		partInstancesInfo.current.partInstance.part.expectedDuration !== 0 &&
		currentPartDuration !== null
			? currentPartStarted + currentPartDuration
			: null

	// Out transition pieces can be placed in the PartInstance being transitioned into, so are resolved as part of that
	const currentPieces = splitOutTransitionPieces(partInstancesInfo.current, partInstancesInfo.next?.calculatedTimings)
	const previousPieces = partInstancesInfo.previous.map((prevInfo, i) =>
		splitOutTransitionPieces(
			prevInfo,
			i === 0 ? partInstancesInfo.current?.calculatedTimings : partInstancesInfo.previous[i - 1].calculatedTimings
		)
	)

	// Calculate the next part if needed
	let nextResolvedPieces: ResolvedPieceInstance[] = []
	if (partInstancesInfo.next && nextPartStarted != null) {
		const partTimes = partInstancesInfo.next.partTimes
		nextResolvedPieces = [
			...partInstancesInfo.next.pieceInstances.map((instance) => resolvePrunedPieceInstance(partTimes, instance)),
			...currentPieces.piecesInNextPart,
		]

		// Translate start to absolute times
		offsetResolvedStartAndCapDuration(nextResolvedPieces, nextPartStarted, null)
	}

	// Calculate the current part
	const currentPartTimes = partInstancesInfo.current.partTimes
	const currentResolvedPieces = [
		...currentPieces.ownPieces.map((instance) => resolvePrunedPieceInstance(currentPartTimes, instance)),
		...(previousPieces[0]?.piecesInNextPart ?? []),
	]

	// Translate start to absolute times
	offsetResolvedStartAndCapDuration(currentResolvedPieces, currentPartStarted, currentPartEnd)

	// Calculate all previous parts still contributing to the timeline (keepalive/postroll).
	// Each entry is capped at the start of the part that followed it (most-recent previous is
	// capped at currentPartStarted; older entries are capped at the part after them).
	let allPreviousResolvedPieces: ResolvedPieceInstance[] = []
	for (let i = 0; i < partInstancesInfo.previous.length; i++) {
		const prevInfo = partInstancesInfo.previous[i]
		if (!prevInfo.partTimes.partStartTime) continue

		const capEnd =
			i === 0
				? currentPartStarted
				: (partInstancesInfo.previous[i - 1].partTimes.partStartTime ?? currentPartStarted)

		const resolved = [
			...previousPieces[i].ownPieces.map((instance) => resolvePrunedPieceInstance(prevInfo.partTimes, instance)),
			// The out transition pieces of the part before this one
			...(previousPieces[i + 1]?.piecesInNextPart ?? []),
		]
		offsetResolvedStartAndCapDuration(resolved, prevInfo.partTimes.partStartTime, capEnd)
		allPreviousResolvedPieces = allPreviousResolvedPieces.concat(resolved)
	}

	return mergeInfinitesIntoCurrentPart(allPreviousResolvedPieces, currentResolvedPieces, nextResolvedPieces)
}

function offsetResolvedStartAndCapDuration(
	pieces: ResolvedPieceInstance[],
	partStarted: number,
	endCap: number | null
) {
	for (const piece of pieces) {
		piece.resolvedStart += partStarted

		if (endCap !== null) {
			// Cap it to the end of the Part. If it is supposed to be longer, there will be a continuing infinite
			const partEndCap = endCap - piece.resolvedStart

			piece.resolvedDuration =
				piece.resolvedDuration !== undefined ? Math.min(piece.resolvedDuration, partEndCap) : partEndCap
		}
	}
}

function mergeInfinitesIntoCurrentPart(
	previousResolvedPieces: ResolvedPieceInstance[],
	currentResolvedPieces: ResolvedPieceInstance[],
	nextResolvedPieces: ResolvedPieceInstance[]
): ResolvedPieceInstance[] {
	// Build a map of the infinite pieces from the current Part
	const currentInfinitePieces = new Map<PieceInstanceInfiniteId, ResolvedPieceInstance>()
	for (const resolvedPiece of currentResolvedPieces) {
		if (resolvedPiece.instance.infinite) {
			currentInfinitePieces.set(resolvedPiece.instance.infinite.infiniteInstanceId, resolvedPiece)
		}
	}

	const resultingPieces: ResolvedPieceInstance[] = [...currentResolvedPieces]

	// Merge any infinite chains between the previous and current parts
	for (const resolvedPiece of previousResolvedPieces) {
		if (resolvedPiece.instance.infinite) {
			const continuingInfinite = currentInfinitePieces.get(resolvedPiece.instance.infinite.infiniteInstanceId)
			if (continuingInfinite) {
				// Extend the duration to compensate for the moved start
				if (continuingInfinite.resolvedDuration !== undefined) {
					continuingInfinite.resolvedDuration +=
						continuingInfinite.resolvedStart - resolvedPiece.resolvedStart
				}

				// Move the start time to be for the previous Piece
				continuingInfinite.resolvedStart = resolvedPiece.resolvedStart

				continue
			}
		}

		resultingPieces.push(resolvedPiece)
	}

	// Merge any infinite chains between the current and next parts
	for (const resolvedPiece of nextResolvedPieces) {
		if (resolvedPiece.instance.infinite) {
			const continuingInfinite = currentInfinitePieces.get(resolvedPiece.instance.infinite.infiniteInstanceId)
			if (continuingInfinite) {
				// Update the duration to be based upon the copy from the next part
				if (resolvedPiece.resolvedDuration !== undefined) {
					continuingInfinite.resolvedDuration =
						resolvedPiece.resolvedDuration + resolvedPiece.resolvedStart - continuingInfinite.resolvedStart
				} else {
					delete continuingInfinite.resolvedDuration
				}

				continue
			}
		}

		resultingPieces.push(resolvedPiece)
	}

	return resultingPieces
}
