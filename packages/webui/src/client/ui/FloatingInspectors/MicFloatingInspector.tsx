import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Moment from 'react-moment'

import { FloatingInspector } from '../FloatingInspector'
import { ScriptContent } from '@sofie-automation/blueprints-integration'
import { getScriptPreview } from '../../lib/ui/scriptPreview'
import { IFloatingInspectorPosition, useInspectorPosition } from './IFloatingInspectorPosition'

interface IProps {
	typeClass?: string
	showMiniInspector: boolean
	itemElement: HTMLDivElement | null
	position: IFloatingInspectorPosition
	content: ScriptContent
	displayOn?: 'document' | 'viewport'
}

export function MicFloatingInspector(props: Readonly<IProps>): JSX.Element {
	const { t } = useTranslation()

	const ref = useRef<HTMLDivElement>(null)

	const { startOfScript, endOfScript, breakScript } = getScriptPreview(props.content.fullScript ?? '')

	const shown = props.showMiniInspector && props.itemElement !== undefined

	const { style: floatingInspectorStyle } = useInspectorPosition(props.position, ref, shown)

	return (
		<FloatingInspector shown={shown} displayOn="viewport">
			<div
				className={
					'segment-timeline__mini-inspector ' + props.typeClass + ' segment-timeline__mini-inspector--pop-down'
				}
				style={floatingInspectorStyle}
				ref={ref}
			>
				<div>
					{props.content?.fullScript ? (
						breakScript ? (
							<React.Fragment>
								<span className="mini-inspector__full-text text-broken">{startOfScript + '\u2026'}</span>
								<span className="mini-inspector__full-text text-broken text-end">{'\u2026' + endOfScript}</span>
							</React.Fragment>
						) : (
							<span className="mini-inspector__full-text">{props.content.fullScript}</span>
						)
					) : props.content.lastWords ? (
						<span className="mini-inspector__full-text">{props.content.lastWords}</span>
					) : !props.content?.comment ? (
						<span className="mini-inspector__system">{t('Script is empty')}</span>
					) : null}
					{props.content?.comment ? (
						<span className="mini-inspector__full-text text-comment text-end">{props.content.comment}</span>
					) : null}
				</div>
				{props.content?.lastModified ? (
					<div className="mini-inspector__footer">
						<span className="mini-inspector__changed">
							<Moment date={props.content.lastModified} calendar={true} />
						</span>
					</div>
				) : null}
			</div>
		</FloatingInspector>
	)
}
