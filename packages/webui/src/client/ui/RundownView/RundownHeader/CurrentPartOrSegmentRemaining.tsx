import { useEffect, useRef } from 'react'
import ClassNames from 'classnames'
import { useRundownPlaylistId } from '../../RundownPlaylistContext.js'
import { TimerValueMode, usePlaylistTimingValue } from '../RundownTiming/usePlaylistTimingValue.js'
import { RundownUtils } from '../../../lib/rundown.js'
import { SpeechSynthesiser } from '../../../lib/speechSynthesis.js'
import type { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'

import { Countdown } from './Countdown.js'

const SPEAK_ADVANCE = 500

interface IPartRemainingProps {
	currentPartInstanceId: PartInstanceId | null
	label?: string
	hideOnZero?: boolean
	className?: string
	heavyClassName?: string
	speaking?: boolean
	vibrating?: boolean
	/** Use the segment budget instead of the part duration if available */
	preferSegmentTime?: boolean
}

function speak(displayTime: number) {
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

	if (text) {
		SpeechSynthesiser.speak(text, 'countdown')
	}
}

function vibrate(displayTime: number) {
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

function usePartRemaining(props: IPartRemainingProps) {
	const playlistId = useRundownPlaylistId()
	// The published state and this component's prop can disagree for a moment after a take. The
	// hook never returns a state that is about a different part: for that moment it returns what
	// the server publishes for the part just taken
	const forThisPart = { forPartInstanceId: props.currentPartInstanceId }
	const remainingOnPart = usePlaylistTimingValue(
		playlistId,
		'remainingOnCurrentPart',
		TimerValueMode.Duration,
		forThisPart
	)
	const remainingBudget = usePlaylistTimingValue(
		playlistId,
		'remainingBudgetOnCurrentSegment',
		TimerValueMode.Duration,
		forThisPart
	)

	const prevPartInstanceId = useRef<PartInstanceId | null>(null)
	const prevDisplayTime = useRef<number | undefined>(undefined)

	useEffect(() => {
		if (props.currentPartInstanceId !== prevPartInstanceId.current) {
			prevDisplayTime.current = undefined
			prevPartInstanceId.current = props.currentPartInstanceId
		}

		if (remainingOnPart === null) return

		let displayTime = remainingOnPart * -1

		if (displayTime !== 0) {
			displayTime += SPEAK_ADVANCE
			displayTime = Math.floor(displayTime / 1000)
		}

		if (prevDisplayTime.current !== displayTime) {
			if (props.speaking) {
				speak(displayTime)
			}

			if (props.vibrating) {
				vibrate(displayTime)
			}

			prevDisplayTime.current = displayTime
		}
	}, [props.currentPartInstanceId, remainingOnPart, props.speaking, props.vibrating])

	// The segment budget is only published for a segment that uses one, which is how the
	// "Seg. Budg." display hides itself
	const displayTimecode = props.preferSegmentTime ? remainingBudget : remainingOnPart
	if (displayTimecode === null) return null

	return { displayTimecode: displayTimecode * -1 }
}

/**
 * Original version used across the app — renders a plain <span> with role="timer".
 */
export const CurrentPartOrSegmentRemaining: React.FC<IPartRemainingProps> = (props) => {
	const result = usePartRemaining(props)
	if (!result) return null

	const { displayTimecode } = result

	return (
		<span
			className={ClassNames(props.className, Math.floor(displayTimecode / 1000) > 0 ? props.heavyClassName : undefined)}
			role="timer"
		>
			{RundownUtils.formatDiffToTimecodeCountdown(displayTimecode || 0)}
		</span>
	)
}

/**
 * RundownHeader variant — renders inside a <Countdown> component with label support.
 */
export const RundownHeaderPartRemaining: React.FC<IPartRemainingProps> = (props) => {
	const result = usePartRemaining(props)
	if (!result) return null

	const { displayTimecode } = result

	return (
		<Countdown
			label={props.label}
			className={ClassNames(props.className, Math.floor(displayTimecode / 1000) > 0 ? props.heavyClassName : undefined)}
		>
			{RundownUtils.formatDiffToTimecodeCountdown(displayTimecode || 0)}
		</Countdown>
	)
}

/**
 * RundownHeader Segment Budget variant — renders inside a wrapper with a label, and handles hiding when value is missing or 0.
 */
export const RundownHeaderSegmentBudget: React.FC<{
	currentPartInstanceId: PartInstanceId | null
	label?: string
}> = ({ currentPartInstanceId, label }) => {
	const result = usePartRemaining({ currentPartInstanceId, preferSegmentTime: true })
	if (!result) return null

	const { displayTimecode } = result

	return (
		<span className="rundown-header__timers-segment-remaining">
			<span className="rundown-header__timers-segment-remaining__label">{label}</span>
			<Countdown className={ClassNames(Math.floor(displayTimecode / 1000) > 0 ? 'overtime' : undefined)}>
				{RundownUtils.formatDiffToTimecodeCountdown(displayTimecode || 0)}
			</Countdown>
		</span>
	)
}
