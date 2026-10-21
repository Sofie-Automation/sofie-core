import { WarningIconSmall } from '../../lib/ui/icons/notifications.js'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { VTPreviewElement } from './Previews/VTPreview.js'
import { IFramePreview } from './Previews/IFramePreview.js'
import { BoxLayoutPreview } from './Previews/BoxLayoutPreview.js'
import { ScriptPreview } from './Previews/ScriptPreview.js'
import { RundownUtils } from '../../lib/rundown.js'
import type { PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import type { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import type { PieceLifespanInfo } from '@sofie-automation/blueprints-integration'
import { PieceLifespan } from '@sofie-automation/corelib/dist/playout/pieceLifespan'
import { LayerInfoPreview } from './Previews/LayerInfoPreview.js'
import type { PreviewContentUI } from './PreviewPopUpContext.js'

interface PreviewPopUpContentProps {
	content: PreviewContentUI
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
		case 'layerInfo':
			return <LayerInfoPreview {...content} />
		case 'separationLine':
			return <hr className="preview-popup__separation-line" />
		case 'boxLayout':
			return <BoxLayoutPreview content={content} time={time} />
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
	lifespan: PieceLifespanInfo,
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

function getLifeSpanText(t: TFunction, lifespanInfo: PieceLifespanInfo): string {
	const lifespan = PieceLifespan.from(lifespanInfo)

	if (lifespan.tracksPlayhead) {
		switch (lifespan.scope) {
			case 'part':
				return t('Until Next Take')
			case 'segment':
				return t('Until Next Segment')
			case 'rundown':
				return t('Until Next Rundown')
			case 'showstyle':
				return t('Until Next Showstyle')
			case 'playlist':
				return t('Until End of Playlist')
		}
	} else {
		switch (lifespan.scope) {
			case 'part':
				return t('Until Next Take')
			case 'segment':
				return t('Until End of Segment')
			case 'rundown':
				return t('Until End of Rundown')
			case 'showstyle':
				return t('Until End of Showstyle')
			case 'playlist':
				return t('Until End of Playlist')
		}
	}
}
