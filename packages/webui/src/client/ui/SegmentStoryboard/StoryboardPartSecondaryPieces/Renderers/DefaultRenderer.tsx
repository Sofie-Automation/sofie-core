import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { PieceUi } from '../../../SegmentContainer/withResolvedSegment.js'

export interface IDefaultRendererProps {
	layer: ISourceLayer
	piece: PieceUi
	partId: PartId
	isLiveLine: boolean
	studio: UIStudio | undefined
	typeClass: string
	hovering: { pageX: number; pageY: number } | null
	elementOffset:
		| {
				left: number
				top: number
				width: number
		  }
		| undefined
}

export function DefaultRenderer({ piece }: Readonly<IDefaultRendererProps>): JSX.Element {
	return <>{piece.instance.piece.name}</>
}
