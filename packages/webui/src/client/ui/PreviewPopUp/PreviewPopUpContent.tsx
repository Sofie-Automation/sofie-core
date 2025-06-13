import React from 'react'
import { PreviewContent } from './PreviewPopUpContext.js'
import { WarningIconSmall } from '../../lib/ui/icons/notifications.js'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { TFunction, useTranslation } from 'react-i18next'
import { VTPreviewElement } from './Previews/VTPreview.js'
import { IFramePreview } from './Previews/IFramePreview.js'
import { BoxLayoutPreview } from './Previews/BoxLayoutPreview.js'
import { ScriptPreview } from './Previews/ScriptPreview.js'
import { RundownUtils } from '../../lib/rundown.js'
import { PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'

interface PreviewPopUpContentProps {
	content: PreviewContent
	time: number | null
}

export function PreviewPopUpContent({ content, time }: PreviewPopUpContentProps): React.ReactElement {
	const { t } = useTranslation()

	switch (content.type) {
		case 'iframe':
			return <IFramePreview time={time} content={content} />
		case 'image':
			return (
				<div className="preview-popUp__image">
					<img src={content.src} />
				</div>
			)
		case 'video':
			return <VTPreviewElement time={time} content={content} />
		case 'script':
			return <ScriptPreview content={content} />
		case 'title':
			return <div className="preview-popUp__title">{content.content}</div>
		case 'inOutWords':
			return (
				<div className="preview-popUp__in-out-words">
					<div className="in-words">{content.in}</div>
					<div className="out-words">{content.out}</div>
				</div>
			)

		case 'data':
			return (
				<div className="preview-popUp__table">
					<table>
						<tbody>
							{content.content.map(({ key, value }, i) => (
								<tr key={key + i}>
									<td className="preview-popup__label">{key}</td>
									<td className="preview-popup__value">{value}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)
		case 'boxLayout':
			return <BoxLayoutPreview content={content} />
		case 'warning':
			return (
				<div className="preview-popUp__warning">
					<div className="icon">
						<WarningIconSmall />
					</div>
					<div className="content">{translateMessage(content.content, t)}</div>
				</div>
			)
		case 'stepCount':
			return (
				<div className="preview-popUp__step-count">
					{content.current}
					{content.total && '/' + content.total}
				</div>
			)
		case 'timing':
			return (
				<div className="preview-popUp__timing">
					<span className="label">IN: </span> {RundownUtils.formatTimeToShortTime(content.timeAsRendered?.in || 0)}
					&nbsp; <span className="label">DURATION: </span>
					{getDurationText(t, content.lifespan, content.timeAsRendered, content.enable)}
				</div>
			)
		default:
			return <></>
	}
}

function getDurationText(
	t: TFunction,
	lifespan: PieceLifespan,
	timeAsRendered?: { in?: number | null; dur?: number | null },
	enable?: ReadonlyObjectDeep<PieceInstancePiece>['enable']
): string {
	if (!timeAsRendered?.dur && !enable?.duration) {
		return getLifeSpanText(t, lifespan)
	} else {
		return RundownUtils.formatTimeToShortTime(
			timeAsRendered?.dur ?? (typeof enable?.duration === 'number' ? enable?.duration : 0)
		)
	}
}

function getLifeSpanText(t: TFunction, lifespan: PieceLifespan): string {
	switch (lifespan) {
		case PieceLifespan.WithinPart:
			return t('Until next take')
		case PieceLifespan.OutOnSegmentChange:
			return t('Until next segment')
		case PieceLifespan.OutOnSegmentEnd:
			return t('Until end of segment')
		case PieceLifespan.OutOnRundownChange:
			return t('Until next rundown')
		case PieceLifespan.OutOnRundownEnd:
			return t('Until end of rundown')
		case PieceLifespan.OutOnShowStyleEnd:
			return t('Until end of showstyle')
		default:
			return ''
	}
}
