import { IProps } from './ThumbnailRendererFactory.js'

export function DefaultThumbnailRenderer({ pieceInstance }: Readonly<IProps>): JSX.Element {
	return <>{pieceInstance.instance.piece.name}</>
}
