import classNames from 'classnames'
import { SplitsContent } from '@sofie-automation/blueprints-integration'
import { RundownUtils } from '../../lib/rundown.js'
import { getSplitPreview, SplitRole } from '../../lib/ui/splitPreview.js'
import { PieceUi } from './withResolvedSegment.js'

export function getSplitItems(pieceInstance: PieceUi, baseClassName: string): JSX.Element[] {
	const splitsContent = pieceInstance.instance.piece.content as SplitsContent

	if (!splitsContent?.boxSourceConfiguration) return []

	return getSplitPreview(splitsContent.boxSourceConfiguration)
		.filter((i) => i.role !== SplitRole.ART)
		.map((item, index, array) => {
			return (
				<div
					key={'item-' + item._id}
					className={classNames(baseClassName, RundownUtils.getSourceLayerClassName(item.type), {
						second: array.length > 1 && index > 0 && item.type === array[index - 1].type,
					})}
				></div>
			)
		})
}
