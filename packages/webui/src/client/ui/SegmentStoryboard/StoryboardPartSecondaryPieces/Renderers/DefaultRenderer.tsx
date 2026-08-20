import type { ISourceLayer } from '@sofie-automation/blueprints-integration'
import type { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { PieceUi } from '@sofie-automation/corelib/src/dataModel/Piece'
import type { UIStudio } from '@sofie-automation/corelib/src/dataModel/Studio.js'

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
