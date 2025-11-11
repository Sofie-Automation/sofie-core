import React, { useEffect } from 'react'
import Moment from 'react-moment'
import { useTranslation } from 'react-i18next'
import { useTiming } from '../RundownView/RundownTiming/withTiming.js'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { PieceIconContainer } from '../PieceIcons/PieceIcon.js'
import { PieceNameContainer } from '../PieceIcons/PieceName.js'
import { Timediff } from './Timediff.js'
import { getPresenterScreenReactive, usePresenterScreenSubscriptions } from './PresenterScreen.js'
import { RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface TimeMap {
	[key: string]: number
}

interface OverlayScreenProps {
	studioId: StudioId
	playlistId: RundownPlaylistId
	segmentLiveDurations?: TimeMap
}

/**
 * This component renders a Countdown screen for a given playlist
 */
export function OverlayScreen({ playlistId, studioId }: OverlayScreenProps): React.JSX.Element {
	const { t } = useTranslation()

	usePresenterScreenSubscriptions({ playlistId, studioId })

	const presenterScreenProps = useTracker(
		() => getPresenterScreenReactive(studioId, playlistId),
		[studioId, playlistId]
	)

	const timing = useTiming()

	useEffect(() => {
		const bodyClassList: string[] = ['transparent']

		document.body.classList.add(...bodyClassList)

		return () => {
			document.body.classList.remove(...bodyClassList)
		}
	}, [])

	if (!presenterScreenProps?.playlist || !playlistId || !presenterScreenProps?.segments) {
		return (
			<div className="clocks-overlay">
				<div className="clocks-lower-third bottom"></div>
			</div>
		)
	}

	const currentPart = presenterScreenProps?.currentPartInstance

	let currentPartCountdown: number | null = null
	if (currentPart) {
		currentPartCountdown = timing.remainingTimeOnCurrentPart || 0
	}

	const nextPart = presenterScreenProps?.nextPartInstance

	const currentTime = timing.currentTime || 0

	return (
		<div className="clocks-overlay">
			<div className="clocks-lower-third bottom">
				<div className="clocks-current-segment-countdown clocks-segment-countdown">
					{currentPartCountdown !== null ? (
						<Timediff time={currentPartCountdown} />
					) : (
						<span className="clock-segment-countdown-next">{t('Next')}</span>
					)}
				</div>
				{/*
					// An Auto-Next is something we may want to introduce in this view after we have
					// some feedback from the users and they say it may be useful.
					// -- Jan Starzak, 2020/12/16

					{currentPart && currentPart.instance.part.autoNext ? (
						<div style={{ display: 'inline-block', height: '0.5em' }}>
							<img style={{ height: '0.5em', verticalAlign: 'top' }} src="/icons/auto-presenter-screen.svg" />
						</div>
					) : null} */}
				<div className="clocks-part-icon">
					{nextPart && presenterScreenProps?.nextShowStyleBaseId ? (
						<PieceIconContainer
							partInstanceId={nextPart.instance._id}
							showStyleBaseId={presenterScreenProps?.nextShowStyleBaseId}
							rundownIds={presenterScreenProps?.rundownIds}
							playlistActivationId={presenterScreenProps?.playlist?.activationId}
						/>
					) : null}
				</div>
				<div className="clocks-part-title clocks-part-title">
					{nextPart && presenterScreenProps?.nextShowStyleBaseId && nextPart.instance.part.title ? (
						<PieceNameContainer
							partName={nextPart.instance.part.title}
							partInstanceId={nextPart.instance._id}
							showStyleBaseId={presenterScreenProps?.nextShowStyleBaseId}
							rundownIds={presenterScreenProps?.rundownIds}
							playlistActivationId={presenterScreenProps?.playlist?.activationId}
						/>
					) : (
						'_'
					)}
				</div>
				<span className="clocks-time-now">
					<Moment interval={0} format="HH:mm:ss" date={currentTime} />
				</span>
			</div>
		</div>
	)
}
