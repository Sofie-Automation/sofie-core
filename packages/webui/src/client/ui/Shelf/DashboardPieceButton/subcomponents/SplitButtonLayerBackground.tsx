import classNames from 'classnames'
import './SplitButtonLayerBackground.scss'
import type { SplitsContent } from '@sofie-automation/blueprints-integration'
import type { PieceGeneric } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { getSplitPreview, SplitRole } from '../../../../lib/ui/splitPreview.js'
import { RundownUtils } from '../../../../lib/rundown.js'
import type { ReadonlyDeep } from 'type-fest'

/** Layer class for the top DVE box (upper stripe), used as the large-button outer tag-container background. */
export function getSplitsTopBoxLayerClassName(
	piece: ReadonlyDeep<Omit<PieceGeneric, 'timelineObjectsString'>>
): string | undefined {
	const boxSourceConfiguration = (piece.content as SplitsContent | undefined)?.boxSourceConfiguration
	if (!boxSourceConfiguration?.length) return undefined

	const topBox = getSplitPreview(boxSourceConfiguration).find((i) => i.role !== SplitRole.ART)
	if (!topBox) return undefined

	return RundownUtils.getSourceLayerClassName(topBox.type)
}

/**
 * Stacked layer-color stripes on the label strip (same pattern as timeline DVE preview).
 */
export function SplitButtonLayerBackground({
	piece,
}: {
	piece: ReadonlyDeep<Omit<PieceGeneric, 'timelineObjectsString'>>
}): JSX.Element | null {
	const boxSourceConfiguration = (piece.content as SplitsContent | undefined)?.boxSourceConfiguration
	if (!boxSourceConfiguration?.length) return null

	const items = getSplitPreview(boxSourceConfiguration)
		.filter((i) => i.role !== SplitRole.ART)
		.slice()
		.reverse()

	if (items.length === 0) return null

	return (
		<div className="dashboard-panel__panel__button__layer-background" aria-hidden>
			<div className="dashboard-panel__panel__button__layer-background__preview">
				{items.map((item, index, array) => (
					<div
						key={'layer-bg-' + item._id}
						className={classNames(
							'dashboard-panel__panel__button__layer-background__preview__item',
							RundownUtils.getSourceLayerClassName(item.type),
							{
								second: array.length > 1 && index > 0 && item.type === array[index - 1].type,
							},
							{ upper: index >= array.length / 2 },
							{ lower: index < array.length / 2 }
						)}
					/>
				))}
			</div>
		</div>
	)
}
