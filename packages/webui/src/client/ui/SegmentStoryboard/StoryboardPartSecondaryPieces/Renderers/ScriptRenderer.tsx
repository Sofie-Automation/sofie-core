import type { IDefaultRendererProps } from './DefaultRenderer.js'
import { getPieceInOutWords } from '../../../../lib/pieceInOutWords.js'

export function ScriptRenderer(props: Readonly<IDefaultRendererProps>): JSX.Element | string {
	const { begin: beginRaw, end: endRaw } = getPieceInOutWords(props.piece.instance.piece)
	const begin = beginRaw.trim()
	const end = endRaw.trim()

	if (end) {
		return (
			<>
				<div className="part__piece__right-align-label-container">
					<span className="part__piece__right-align-label-inside">{end}</span>
				</div>
			</>
		)
	} else {
		return begin
	}
}
