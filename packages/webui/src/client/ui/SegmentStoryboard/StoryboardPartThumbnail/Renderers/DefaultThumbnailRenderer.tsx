import { IProps } from './ThumbnailRendererFactory'

export function DefaultThumbnailRenderer({ pieceInstance }: Readonly<IProps>): JSX.Element {
	return <>{pieceInstance.instance.piece.name}</>
}
