import { type ISourceLayerItemProps, SourceLayerItem } from './SourceLayerItem.js'
import { useContentStatusForPieceInstance } from './withMediaObjectStatus.js'

type IPropsHeader = Omit<ISourceLayerItemProps, 'contentStatus'>

export function SourceLayerItemContainer(props: IPropsHeader): JSX.Element {
	const contentStatus = useContentStatusForPieceInstance(props.piece.instance)

	return <SourceLayerItem {...props} contentStatus={contentStatus} />
}
