import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { FloatingInspector } from '../FloatingInspector'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { CriticalIconSmall, WarningIconSmall } from '../../lib/ui/icons/notifications'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { IFloatingInspectorPosition, useInspectorPosition } from './IFloatingInspectorPosition'

interface IProps {
	itemElement: HTMLDivElement | null
	showMiniInspector: boolean
	position: IFloatingInspectorPosition
	part: DBPart

	displayOn?: 'document' | 'viewport'
}

function renderReason(noticeLevel: NoteSeverity, noticeMessage: string | null): JSX.Element {
	return (
		<>
			<div className="segment-timeline__mini-inspector__notice-header">
				{noticeLevel === NoteSeverity.ERROR ? (
					<CriticalIconSmall />
				) : noticeLevel === NoteSeverity.WARNING ? (
					<WarningIconSmall />
				) : null}
			</div>
			<div className="segment-timeline__mini-inspector__notice">{noticeMessage}</div>
		</>
	)
}

export const InvalidFloatingInspector: React.FunctionComponent<IProps> = (props: IProps) => {
	const { t } = useTranslation()
	const ref = useRef<HTMLDivElement>(null)

	const shown = props.showMiniInspector && props.itemElement !== undefined

	const { style: floatingInspectorStyle } = useInspectorPosition(props.position, ref, shown)

	if (!props.part.invalidReason) {
		return null
	}

	const noteSeverity = props.part.invalidReason.severity || NoteSeverity.INFO

	return (
		<FloatingInspector shown={shown} displayOn="viewport">
			<div
				className={
					'segment-timeline__mini-inspector ' +
					'unknown' +
					' ' +
					(noteSeverity === NoteSeverity.ERROR
						? 'segment-timeline__mini-inspector--notice notice-critical'
						: noteSeverity === NoteSeverity.WARNING
						? 'segment-timeline__mini-inspector--notice notice-warning'
						: '')
				}
				style={floatingInspectorStyle}
				ref={ref}
			>
				{renderReason(noteSeverity, translateMessage(props.part.invalidReason.message, t))}
			</div>
		</FloatingInspector>
	)
}
