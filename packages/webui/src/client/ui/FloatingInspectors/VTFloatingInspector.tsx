import React, { MutableRefObject, useRef } from 'react'
import { TFunction, useTranslation } from 'react-i18next'

import { CriticalIconSmall, WarningIconSmall } from '../../lib/ui/icons/notifications'
import { FloatingInspector } from '../FloatingInspector'
import { NoticeLevel } from '../../lib/notifications/notifications'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { VideoPreviewPlayer } from '../../lib/VideoPreviewPlayer'
import classNames from 'classnames'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { ITranslatableMessage, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { IFloatingInspectorPosition, useInspectorPosition } from './IFloatingInspectorPosition'
import { ReadonlyDeep } from 'type-fest'
import { getIgnorePieceContentStatus } from '../../lib/localStorage'

interface IProps {
	status: PieceStatusCode | undefined
	typeClass?: string
	showMiniInspector: boolean
	itemElement: HTMLDivElement | null
	position: IFloatingInspectorPosition
	timePosition: number
	content: VTContent | undefined
	noticeLevel: NoticeLevel | null
	noticeMessages: ReadonlyDeep<ITranslatableMessage[]> | null
	renderedDuration?: number | undefined

	studio: UIStudio | undefined
	displayOn?: 'document' | 'viewport'

	hideHoverscrubPreview?: boolean
	previewUrl: string | undefined
}

function renderNotice(
	t: TFunction,
	noticeLevel: NoticeLevel,
	noticeMessages: ReadonlyDeep<ITranslatableMessage[]> | null
): JSX.Element {
	return (
		<>
			<div className="segment-timeline__mini-inspector__notice-header">
				{noticeLevel === NoticeLevel.CRITICAL ? (
					<CriticalIconSmall />
				) : noticeLevel === NoticeLevel.WARNING ? (
					<WarningIconSmall />
				) : null}
			</div>
			<div className="segment-timeline__mini-inspector__notice">
				{noticeMessages?.map((msg, index) => (
					<React.Fragment key={index}>
						{translateMessage(msg, t)}
						<br />
					</React.Fragment>
				))}
			</div>
		</>
	)
}

function shouldShowFloatingInspectorContent(status: PieceStatusCode, content: VTContent | undefined): boolean {
	return status !== PieceStatusCode.SOURCE_NOT_SET && !!content?.fileName
}

const VideoPreviewPlayerInspector = React.forwardRef<
	HTMLDivElement,
	React.PropsWithChildren<{
		itemDuration: number
		loop: boolean
		seek: number
		previewUrl: string
		timePosition: number
		studioSettings: IStudioSettings | undefined
		floatingInspectorStyle: React.CSSProperties
	}>
>(function VideoPreviewPlayerInspector(
	{ itemDuration, loop, seek, previewUrl, timePosition, studioSettings, floatingInspectorStyle, children },
	ref
) {
	return (
		<div
			className="segment-timeline__mini-inspector segment-timeline__mini-inspector--video"
			style={floatingInspectorStyle}
			ref={ref as MutableRefObject<HTMLDivElement>}
		>
			<VideoPreviewPlayer
				itemDuration={itemDuration}
				loop={loop}
				seek={seek}
				previewUrl={previewUrl}
				timePosition={timePosition}
				studioSettings={studioSettings}
			/>
			{children}
		</div>
	)
})

export const VTFloatingInspector: React.FC<IProps> = ({
	timePosition,
	content,
	renderedDuration,
	studio,
	hideHoverscrubPreview,
	noticeLevel,
	noticeMessages,
	showMiniInspector,
	itemElement,
	position,
	typeClass,
	status,
	previewUrl,
}: IProps) => {
	const { t } = useTranslation()
	const inspectorRef = useRef<HTMLDivElement>(null)

	// Display a "blank" video canvas when setting ?ignore_piece_content_status=1
	const debugMode = getIgnorePieceContentStatus()
	const playPreviewUrl = debugMode ? 'http://dummy-video/no-video.mp4' : previewUrl || ''

	const itemDuration = content?.sourceDuration || renderedDuration || 0
	const seek = content?.seek ?? 0
	const loop = content?.loop ?? false

	const offsetTimePosition = timePosition + seek

	const showVideoPlayerInspector = !hideHoverscrubPreview && (previewUrl || debugMode)
	const showMiniInspectorClipData = shouldShowFloatingInspectorContent(status ?? PieceStatusCode.UNKNOWN, content)
	const showMiniInspectorNotice = noticeLevel !== null
	const showMiniInspectorData = showMiniInspectorNotice || showMiniInspectorClipData
	const showAnyFloatingInspector = Boolean(showVideoPlayerInspector) || showMiniInspectorData

	const shown = showMiniInspector && (itemElement !== undefined || debugMode) && showAnyFloatingInspector

	const { style: floatingInspectorStyle, isFlipped } = useInspectorPosition(position, inspectorRef, shown)

	if (!showAnyFloatingInspector || !floatingInspectorStyle) {
		return null
	}

	const miniDataInspector = showMiniInspectorData && (
		<div
			className={classNames('segment-timeline__mini-inspector', typeClass, {
				'segment-timeline__mini-inspector--sub-inspector': showVideoPlayerInspector,
				'segment-timeline__mini-inspector--sub-inspector-flipped': showVideoPlayerInspector && isFlipped,
				'segment-timeline__mini-inspector--notice notice-critical': noticeLevel === NoticeLevel.CRITICAL,
				'segment-timeline__mini-inspector--notice notice-warning': noticeLevel === NoticeLevel.WARNING,
			})}
			style={!showVideoPlayerInspector ? floatingInspectorStyle : undefined}
			ref={!showVideoPlayerInspector ? inspectorRef : undefined}
		>
			{showMiniInspectorNotice && noticeLevel && renderNotice(t, noticeLevel, noticeMessages)}
			{showMiniInspectorClipData && (
				<>
					<div className="segment-timeline__mini-inspector__properties">
						<span className="mini-inspector__value">{content?.fileName}</span>
					</div>
					<div className="segment-timeline__mini-inspector__properties">
						<span className="mini-inspector__firstwords">{content?.firstWords}</span>
						<span className="mini-inspector__lastwords">{content?.lastWords}</span>
					</div>
				</>
			)}
		</div>
	)

	return (
		<FloatingInspector shown={shown} displayOn="viewport">
			{showVideoPlayerInspector ? (
				<VideoPreviewPlayerInspector
					itemDuration={itemDuration}
					ref={inspectorRef}
					loop={loop}
					seek={seek}
					previewUrl={playPreviewUrl}
					timePosition={offsetTimePosition}
					studioSettings={studio?.settings}
					floatingInspectorStyle={floatingInspectorStyle}
				>
					{miniDataInspector}
				</VideoPreviewPlayerInspector>
			) : (
				miniDataInspector
			)}
		</FloatingInspector>
	)
}
