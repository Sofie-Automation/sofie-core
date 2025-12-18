import {
	SourceLayerType,
	SplitsContentBoxContent,
	SplitsContentBoxProperties,
} from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'

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
	// TODO: To be replaced with the structure used by the Core
	role: SplitRole
	content?: SplitsContentBoxProperties['geometry']
}

export function getSplitPreview(
	boxSourceConfiguration:
		| (SplitsContentBoxContent & SplitsContentBoxProperties)[]
		| ReadonlyDeep<(SplitsContentBoxContent & SplitsContentBoxProperties)[]>
): ReadonlyArray<Readonly<SplitSubItem>> {
	return boxSourceConfiguration.map((item, index) => {
		return literal<Readonly<SplitSubItem>>({
			_id: item.studioLabel + '_' + index,
			type: item.type,
			label: item.studioLabel,
			role: SplitRole.BOX,
			content: item.geometry || DEFAULT_POSITIONS[index],
		})
	})
}
