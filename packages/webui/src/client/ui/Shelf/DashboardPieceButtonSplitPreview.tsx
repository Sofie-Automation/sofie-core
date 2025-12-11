import { SplitsContent } from '@sofie-automation/blueprints-integration'
import { PieceGeneric } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { getSplitPreview } from '../../lib/ui/splitPreview.js'
import { RenderSplitPreview } from '../../lib/SplitPreviewBox.js'

interface IProps {
	piece: Omit<PieceGeneric, 'timelineObjectsString'>
}

export function DashboardPieceButtonSplitPreview({ piece }: Readonly<IProps>): JSX.Element {
	const subItems = getSplitPreview((piece.content as SplitsContent).boxSourceConfiguration)
	return <RenderSplitPreview subItems={subItems} showLabels={false} />
}
