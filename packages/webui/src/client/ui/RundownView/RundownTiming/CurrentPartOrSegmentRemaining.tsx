import * as React from 'react'
import ClassNames from 'classnames'
import { TimingDataResolution, TimingTickResolution, withTiming, WithTiming } from './withTiming.js'
import { RundownUtils } from '../../../lib/rundown.js'
import { SpeechSynthesiser } from '../../../lib/speechSynthesis.js'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'

const SPEAK_ADVANCE = 500

interface IPartRemainingProps {
	currentPartInstanceId: PartInstanceId | null
	hideOnZero?: boolean
	className?: string
	heavyClassName?: string
	speaking?: boolean
	vibrating?: boolean
	/** Use the segment budget instead of the part duration if available */
	preferSegmentTime?: boolean
}

// global variable for remembering last uttered displayTime
let prevDisplayTime: number | undefined = undefined

/**
 * A presentational component that will render a countdown to the end of the current part or segment,
 * depending on the value of segmentTiming.countdownType
 *
 * @class CurrentPartOrSegmentRemaining
 * @extends React.Component<WithTiming<{}>>
 */
export const CurrentPartOrSegmentRemaining = withTiming<IPartRemainingProps, {}>({
	tickResolution: TimingTickResolution.Synced,
	dataResolution: TimingDataResolution.Synced,
})(
	class CurrentPartOrSegmentRemaining extends React.Component<WithTiming<IPartRemainingProps>> {
		render(): JSX.Element | null {
			if (!this.props.timingDurations || !this.props.timingDurations.currentTime) return null
			if (this.props.timingDurations.currentPartInstanceId !== this.props.currentPartInstanceId) return null
			let displayTimecode = this.props.timingDurations.remainingTimeOnCurrentPart
			if (this.props.preferSegmentTime)
				displayTimecode = this.props.timingDurations.remainingBudgetOnCurrentSegment ?? displayTimecode
			if (displayTimecode === undefined) return null
			displayTimecode *= -1
			return (
				<span
					className={ClassNames(
						this.props.className,
						Math.floor(displayTimecode / 1000) > 0 ? this.props.heavyClassName : undefined
					)}
					role="timer"
				>
					{RundownUtils.formatDiffToTimecode(displayTimecode || 0, true, false, true, false, true, '', false, true)}
				</span>
			)
		}

		speak(displayTime: number) {
			let text = '' // Say nothing

			switch (displayTime) {
				case -1:
					text = 'One'
					break
				case -2:
					text = 'Two'
					break
				case -3:
					text = 'Three'
					break
				case -4:
					text = 'Four'
					break
				case -5:
					text = 'Five'
					break
				case -6:
					text = 'Six'
					break
				case -7:
					text = 'Seven'
					break
				case -8:
					text = 'Eight'
					break
				case -9:
					text = 'Nine'
					break
				case -10:
					text = 'Ten'
					break
			}
			// if (displayTime === 0 && prevDisplayTime !== undefined) {
			// 	text = 'Zero'
			// }

			if (text) {
				SpeechSynthesiser.speak(text, 'countdown')
			}
		}

		vibrate(displayTime: number) {
			if ('vibrate' in navigator) {
				switch (displayTime) {
					case 0:
						navigator.vibrate([500])
						break
					case -1:
					case -2:
					case -3:
						navigator.vibrate([250])
						break
				}
			}
		}

		act() {
			// Note that the displayTime is negative when counting down to 0.
			let displayTime = (this.props.timingDurations.remainingTimeOnCurrentPart || 0) * -1

			if (displayTime === 0) {
				// do nothing
			} else {
				displayTime += SPEAK_ADVANCE
				displayTime = Math.floor(displayTime / 1000)
			}

			if (prevDisplayTime !== displayTime) {
				if (this.props.speaking) {
					this.speak(displayTime)
				}

				if (this.props.vibrating) {
					this.vibrate(displayTime)
				}

				prevDisplayTime = displayTime
			}
		}

		componentDidUpdate(prevProps: WithTiming<IPartRemainingProps>) {
			if (this.props.currentPartInstanceId !== prevProps.currentPartInstanceId) {
				prevDisplayTime = undefined
			}
			this.act()
		}
	}
)
