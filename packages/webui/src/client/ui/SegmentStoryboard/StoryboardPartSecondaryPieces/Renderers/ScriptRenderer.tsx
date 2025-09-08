import { IDefaultRendererProps } from './DefaultRenderer.js'

export function ScriptRenderer(props: Readonly<IDefaultRendererProps>): JSX.Element | string {
	const labelItems = (props.piece.instance.piece.name || '').split('||')
	const begin = (labelItems[0] || '').trim()
	const end = (labelItems[1] || '').trim()

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
