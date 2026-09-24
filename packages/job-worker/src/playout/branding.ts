import {
	isValidForBranding,
	resolvePartForBranding,
	resolvePieceForBranding,
} from '@sofie-automation/corelib/dist/playout/branding'
import type { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import type { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import type { ReadonlyDeep } from 'type-fest'
import type { PlayoutPartInstanceModel } from './model/PlayoutPartInstanceModel.js'

/**
 * The PieceInstances of a PartInstance, resolved for the Branding it is played with.
 * PieceInstances not used with that Branding are dropped, and the rest have its overrides applied.
 *
 * This is done at read time, so that a Piece hidden by the current Branding stays dormant and reappears
 * intact when the Branding is changed back.
 */
export function resolvePieceInstancesForBranding(
	partInstance: PlayoutPartInstanceModel
): ReadonlyDeep<PieceInstance>[] {
	const brandingId = partInstance.partInstance.brandingId

	const result: ReadonlyDeep<PieceInstance>[] = []
	for (const { pieceInstance } of partInstance.pieceInstances) {
		const resolvedPiece = resolvePieceForBranding(pieceInstance.piece, brandingId)

		if (!resolvedPiece) continue

		result.push(resolvedPiece === pieceInstance.piece ? pieceInstance : { ...pieceInstance, piece: resolvedPiece })
	}
	return result
}

/**
 * A PartInstance with the overrides of the Branding it is played with applied to its Part.
 * The PartInstance is returned unchanged when the Branding makes no changes to it.
 */
export function resolvePartInstanceForBranding(
	partInstance: ReadonlyDeep<DBPartInstance>
): ReadonlyDeep<DBPartInstance> {
	const resolvedPart = resolvePartForBranding(partInstance.part, partInstance.brandingId)

	return resolvedPart === partInstance.part ? partInstance : { ...partInstance, part: resolvedPart }
}

/**
 * The PieceInstances of a PartInstance which are used with the Branding it is played with, without the
 * Branding's overrides applied.
 *
 * This is what the blueprint contexts which can write PieceInstances back are given. Handing them the
 * flattened Piece would let them write the branded values into the base through `updatePieceInstance`,
 * where they would outlive the Branding being changed. They can read the selected `brandingId` and resolve
 * for themselves if they need the branded values.
 */
export function filterPieceInstancesForBranding(partInstance: PlayoutPartInstanceModel): ReadonlyDeep<PieceInstance>[] {
	const brandingId = partInstance.partInstance.brandingId

	const result: ReadonlyDeep<PieceInstance>[] = []
	for (const { pieceInstance } of partInstance.pieceInstances) {
		if (isValidForBranding(pieceInstance.piece, brandingId)) result.push(pieceInstance)
	}
	return result
}
