import { MicFloatingInspector } from '../../../FloatingInspectors/MicFloatingInspector'
import { ScriptContent } from '@sofie-automation/blueprints-integration'
import { IDefaultRendererProps } from './DefaultRenderer'

export function ScriptRenderer(props: Readonly<IDefaultRendererProps>): JSX.Element | string {
	const labelItems = (props.piece.instance.piece.name || '').split('||')
	const begin = (labelItems[0] || '').trim()
	const end = (labelItems[1] || '').trim()

	const content = props.piece.instance.piece.content as ScriptContent

	if (end) {
		return (
			<>
				<div className="part__piece__right-align-label-container">
					<span className="part__piece__right-align-label-inside">{end}</span>
				</div>
				{content && (
					<MicFloatingInspector
						content={content}
						position={{
							top: props.elementOffset?.top ?? 0,
							left: props.elementOffset?.left ?? 0,
							anchor: 'start',
							position: 'bottom-start',
						}}
						itemElement={null}
						showMiniInspector={!!props.hovering}
						typeClass={props.typeClass}
					/>
				)}
			</>
		)
	} else {
		return begin
	}
}
