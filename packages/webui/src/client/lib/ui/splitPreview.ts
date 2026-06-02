import {
	SourceLayerType,
	type SplitsContentBoxContent,
	type SplitsContentBoxProperties,
	type VTContent,
} from '@sofie-automation/blueprints-integration'
import type { SplitBoxPreviewUrls } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { literal } from '@sofie-automation/corelib/dist/lib'
import type { ReadonlyDeep } from 'type-fest'

const DEFAULT_POSITIONS = [
	{
		x: 0.25,
		y: 0.5,
		scale: 0.5,
	},
	{
		x: 0.75,
		y: 0.5,
		scale: 0.5,
	},
]

export enum SplitRole {
	ART = 0,
	BOX = 1,
}

export interface SplitSubItem {
	_id: string
	type: SourceLayerType
	label: string
	role: SplitRole
	content?: SplitsContentBoxProperties['geometry']
	thumbnailUrl?: string
	previewUrl?: string
	/** VT/LIVE_SPEAK editorial seek (ms), used for in-box hover scrub */
	seek?: number
}

export function getSplitPreview(
	boxSourceConfiguration:
		| (SplitsContentBoxContent & SplitsContentBoxProperties)[]
		| ReadonlyDeep<(SplitsContentBoxContent & SplitsContentBoxProperties)[]>,
	boxPreviews?: ReadonlyDeep<SplitBoxPreviewUrls[]>
): ReadonlyArray<Readonly<SplitSubItem>> {
	return boxSourceConfiguration.map((item, index) => {
		const boxPreview = boxPreviews?.[index]
		const seek =
			item.type === SourceLayerType.VT || item.type === SourceLayerType.LIVE_SPEAK
				? (item as VTContent).seek
				: undefined

		return literal<Readonly<SplitSubItem>>({
			_id: item.studioLabel + '_' + index,
			type: item.type,
			label: item.studioLabel,
			role: SplitRole.BOX,
			content: item.geometry || DEFAULT_POSITIONS[index],
			thumbnailUrl: boxPreview?.thumbnailUrl,
			previewUrl: boxPreview?.previewUrl,
			seek,
		})
	})
}
