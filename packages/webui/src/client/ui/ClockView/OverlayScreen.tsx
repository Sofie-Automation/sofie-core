import { useEffect } from 'react'
import Moment from 'react-moment'
import { useTranslation } from 'react-i18next'
import { WithTiming, withTiming } from '../RundownView/RundownTiming/withTiming'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { PieceIconContainer } from '../PieceIcons/PieceIcon'
import { PieceNameContainer } from '../PieceIcons/PieceName'
import { Timediff } from './Timediff'
import {
	getPresenterScreenReactive,
	PresenterScreenTrackedProps,
	usePresenterScreenSubscriptions,
} from './PresenterScreen'
import { RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface TimeMap {
	[key: string]: number
}

interface OverlayScreenProps {
	studioId: StudioId
	playlistId: RundownPlaylistId
	segmentLiveDurations?: TimeMap
}
interface OverlayScreenState {}

/**
 * This component renders a Countdown screen for a given playlist
 */
export const OverlayScreen = withTracker<OverlayScreenProps, OverlayScreenState, PresenterScreenTrackedProps>(
	getPresenterScreenReactive
)(
	withTiming<OverlayScreenProps & PresenterScreenTrackedProps, OverlayScreenState>()(function OverlayScreen(
		props: Readonly<WithTiming<OverlayScreenProps & PresenterScreenTrackedProps>>
	) {
		usePresenterScreenSubscriptions(props)

		useEffect(() => {
			const bodyClassList: string[] = ['transparent']

			document.body.classList.add(...bodyClassList)

			return () => {
				document.body.classList.remove(...bodyClassList)
			}
		}, [])

		return <OverlayScreenContent {...props} />
	})
)

function OverlayScreenContent({
	playlist,
	segments,
	nextShowStyleBaseId,
	playlistId,
	currentPartInstance,
	nextPartInstance,
	timingDurations,
	rundownIds,
}: Readonly<WithTiming<OverlayScreenProps & PresenterScreenTrackedProps>>) {
	const { t } = useTranslation()

	if (playlist && playlistId && segments) {
		const currentPart = currentPartInstance

		let currentPartCountdown: number | null = null
		if (currentPart) {
			currentPartCountdown = timingDurations.remainingTimeOnCurrentPart || 0
		}

		const nextPart = nextPartInstance

		// The over-under counter is something we may want to introduce into the screen at some point,
		// So I'm leaving these as a reference -- Jan Starzak, 2020/12/16
		// const overUnderClock = playlist.expectedDuration
		// 	? (this.props.timingDurations.asPlayedRundownDuration || 0) - playlist.expectedDuration
		// 	: (this.props.timingDurations.asPlayedRundownDuration || 0) -
		// 	  (this.props.timingDurations.totalRundownDuration || 0)

		const currentTime = timingDurations.currentTime || 0

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
						{nextPart && nextShowStyleBaseId ? (
							<PieceIconContainer
								partInstanceId={nextPart.instance._id}
								showStyleBaseId={nextShowStyleBaseId}
								rundownIds={rundownIds}
								playlistActivationId={playlist?.activationId}
							/>
						) : null}
					</div>
					<div className="clocks-part-title clocks-part-title">
						{nextPart && nextShowStyleBaseId && nextPart.instance.part.title ? (
							<PieceNameContainer
								partName={nextPart.instance.part.title}
								partInstanceId={nextPart.instance._id}
								showStyleBaseId={nextShowStyleBaseId}
								rundownIds={rundownIds}
								playlistActivationId={playlist?.activationId}
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
	return (
		<div className="clocks-overlay">
			<div className="clocks-lower-third bottom"></div>
		</div>
	)
}
