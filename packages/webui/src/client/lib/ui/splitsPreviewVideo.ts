import { SourceLayerType, type SplitsContent } from '@sofie-automation/blueprints-integration'
import type { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import type { ReadonlyDeep } from 'type-fest'

export type PreviewVideoContentUI = {
	type: 'video'
	src: string
	itemDuration?: number
	seek?: number
	loop?: boolean
}

export interface SplitsBoxLayoutScrubSettings {
	itemDuration: number
	loop?: boolean
}

/** True when at least one VT/LIVE_SPEAK box has a preview URL to scrub in the box layout. */
export function getSplitsBoxLayoutScrubSettings(
	content: ReadonlyDeep<SplitsContent>,
	contentStatus: ReadonlyDeep<PieceContentStatusObj> | undefined
): SplitsBoxLayoutScrubSettings | undefined {
	const boxes = content.boxSourceConfiguration ?? []

	for (let i = 0; i < boxes.length; i++) {
		const box = boxes[i]
		if (box.type !== SourceLayerType.VT && box.type !== SourceLayerType.LIVE_SPEAK) {
			continue
		}

		if (contentStatus?.boxPreviews?.[i]?.previewUrl) {
			return {
				itemDuration: content.sourceDuration ?? contentStatus?.contentDuration ?? 0,
				loop: content.loop,
			}
		}
	}

	return undefined
}

export function getPieceScrubDurationMs(
	content: ReadonlyDeep<{ sourceDuration?: number }> | undefined,
	contentStatus: ReadonlyDeep<PieceContentStatusObj> | undefined
): number {
	return content?.sourceDuration ?? contentStatus?.contentDuration ?? 0
}
