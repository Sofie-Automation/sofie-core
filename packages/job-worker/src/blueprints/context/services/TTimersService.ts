import type {
	IPlaylistTTimer,
	RundownTTimerMode,
	TimerState,
} from '@sofie-automation/blueprints-integration/dist/context/tTimersContext'
import type {
	RundownTTimer,
	RundownTTimerIndex,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/TTimers'
import {
	timerStateToDuration,
	timerStateToZeroTime,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/TTimers'
import type { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import type { PlayoutModel } from '../../../playout/model/PlayoutModel.js'
import { ReadonlyDeep } from 'type-fest'
import {
	createCountdownTTimer,
	createFreeRunTTimer,
	createTimeOfDayTTimer,
	pauseTTimer,
	restartTTimer,
	resumeTTimer,
	validateTTimerIndex,
	recalculateTTimerProjections,
} from '../../../playout/tTimers.js'
import { getCurrentTime } from '../../../lib/index.js'
import type { JobContext } from '../../../jobs/index.js'

export class TTimersService {
	readonly timers: [PlaylistTTimerImpl, PlaylistTTimerImpl, PlaylistTTimerImpl]

	constructor(
		timers: ReadonlyDeep<RundownTTimer[]>,
		emitChange: (updatedTimer: ReadonlyDeep<RundownTTimer>) => void,
		playoutModel: PlayoutModel,
		jobContext: JobContext
	) {
		this.timers = [
			new PlaylistTTimerImpl(timers[0], emitChange, playoutModel, jobContext),
			new PlaylistTTimerImpl(timers[1], emitChange, playoutModel, jobContext),
			new PlaylistTTimerImpl(timers[2], emitChange, playoutModel, jobContext),
		]
	}

	static withPlayoutModel(playoutModel: PlayoutModel, jobContext: JobContext): TTimersService {
		return new TTimersService(
			playoutModel.playlist.tTimers,
			(updatedTimer) => {
				playoutModel.updateTTimer(updatedTimer)
			},
			playoutModel,
			jobContext
		)
	}

	getTimer(index: RundownTTimerIndex): IPlaylistTTimer {
		validateTTimerIndex(index)
		return this.timers[index - 1]
	}
	clearAllTimers(): void {
		for (const timer of this.timers) {
			timer.clearTimer()
		}
	}
}

export class PlaylistTTimerImpl implements IPlaylistTTimer {
	readonly #emitChange: (updatedTimer: ReadonlyDeep<RundownTTimer>) => void
	readonly #playoutModel: PlayoutModel
	readonly #jobContext: JobContext

	#timer: ReadonlyDeep<RundownTTimer>

	get index(): RundownTTimerIndex {
		return this.#timer.index
	}
	get label(): string {
		return this.#timer.label
	}
	get mode(): RundownTTimerMode | null {
		return this.#timer.mode
	}
	get state(): TimerState | null {
		return this.#timer.state
	}

	constructor(
		timer: ReadonlyDeep<RundownTTimer>,
		emitChange: (updatedTimer: ReadonlyDeep<RundownTTimer>) => void,
		playoutModel: PlayoutModel,
		jobContext: JobContext
	) {
		this.#timer = timer
		this.#emitChange = emitChange
		this.#playoutModel = playoutModel
		this.#jobContext = jobContext

		validateTTimerIndex(timer.index)
	}

	setLabel(label: string): void {
		this.#timer = {
			...this.#timer,
			label: label,
		}
		this.#emitChange(this.#timer)
	}
	clearTimer(): void {
		this.#timer = {
			...this.#timer,
			mode: null,
			state: null,
		}
		this.#emitChange(this.#timer)
	}
	startCountdown(duration: number, options?: { stopAtZero?: boolean; startPaused?: boolean }): void {
		this.#timer = {
			...this.#timer,
			...createCountdownTTimer(duration, {
				stopAtZero: options?.stopAtZero ?? true,
				startPaused: options?.startPaused ?? false,
			}),
		}
		this.#emitChange(this.#timer)
	}
	startTimeOfDay(targetTime: string | number, options?: { stopAtZero?: boolean }): void {
		this.#timer = {
			...this.#timer,
			...createTimeOfDayTTimer(targetTime, {
				stopAtZero: options?.stopAtZero ?? true,
			}),
		}
		this.#emitChange(this.#timer)
	}
	startFreeRun(options?: { startPaused?: boolean }): void {
		this.#timer = {
			...this.#timer,
			...createFreeRunTTimer({
				startPaused: options?.startPaused ?? false,
			}),
		}
		this.#emitChange(this.#timer)
	}
	pause(): boolean {
		const newTimer = pauseTTimer(this.#timer)
		if (!newTimer) return false

		this.#timer = newTimer
		this.#emitChange(newTimer)
		return true
	}
	resume(): boolean {
		const newTimer = resumeTTimer(this.#timer)
		if (!newTimer) return false

		this.#timer = newTimer
		this.#emitChange(newTimer)
		return true
	}
	restart(): boolean {
		const newTimer = restartTTimer(this.#timer)
		if (!newTimer) return false

		this.#timer = newTimer
		this.#emitChange(newTimer)
		return true
	}

	setDuration(durationOrOptions: number | { original?: number; current?: number }): void {
		// Handle overloaded signatures
		if (typeof durationOrOptions === 'number') {
			// Simple case: reset timer to this duration
			return this.setDuration({ original: durationOrOptions, current: durationOrOptions })
		}

		// Options case: independently update original and/or current
		const options = durationOrOptions

		if (options.original !== undefined && options.original <= 0) {
			throw new Error('Original duration must be greater than zero')
		}
		if (options.current !== undefined && options.current <= 0) {
			throw new Error('Current duration must be greater than zero')
		}

		if (!this.#timer.mode || this.#timer.mode.type !== 'countdown') {
			throw new Error('Timer must be in countdown mode to update duration')
		}

		if (!this.#timer.state) {
			throw new Error('Timer is not initialized')
		}

		if (!options.original && !options.current) {
			throw new Error('At least one of original or current duration must be provided')
		}

		const now = getCurrentTime()
		const state = this.#timer.state

		// Calculate current elapsed time using built-in function (handles pauseTime correctly)
		const remaining = timerStateToDuration(state, now)
		const elapsed = this.#timer.mode.duration - remaining

		let newOriginalDuration: number
		let newCurrentRemaining: number

		if (options.original !== undefined && options.current !== undefined) {
			// Both specified: use both values independently
			newOriginalDuration = options.original
			newCurrentRemaining = options.current
		} else if (options.original !== undefined) {
			// Only original specified: preserve elapsed time
			newOriginalDuration = options.original
			newCurrentRemaining = Math.max(0, newOriginalDuration - elapsed)
		} else if (options.current !== undefined) {
			// Only current specified: keep original unchanged
			newOriginalDuration = this.#timer.mode.duration
			newCurrentRemaining = options.current
		} else {
			// This should be unreachable due to earlier check
			throw new Error('Invalid duration update options')
		}

		// Update both mode and state
		this.#timer = {
			...this.#timer,
			mode: {
				...this.#timer.mode,
				duration: newOriginalDuration,
			},
			state: state.paused
				? { paused: true, duration: newCurrentRemaining }
				: { paused: false, zeroTime: now + newCurrentRemaining },
		}

		this.#emitChange(this.#timer)
	}

	clearProjected(): void {
		this.#timer = {
			...this.#timer,
			anchorPartId: undefined,
			projectedState: undefined,
		}
		this.#emitChange(this.#timer)
	}

	setProjectedAnchorPart(partId: string): void {
		this.#timer = {
			...this.#timer,
			anchorPartId: protectString<PartId>(partId),
			projectedState: undefined, // Clear manual projection
		}
		this.#emitChange(this.#timer)

		// Recalculate projections immediately since we already have the playout model
		recalculateTTimerProjections(this.#jobContext, this.#playoutModel)
	}

	setProjectedAnchorPartByExternalId(externalId: string): void {
		const part = this.#playoutModel.getAllOrderedParts().find((p) => p.externalId === externalId)
		if (!part) return

		this.setProjectedAnchorPart(unprotectString(part._id))
	}

	setProjectedTime(time: number, paused: boolean = false): void {
		const projectedState: TimerState = paused
			? literal<TimerState>({ paused: true, duration: time - getCurrentTime() })
			: literal<TimerState>({ paused: false, zeroTime: time })

		this.#timer = {
			...this.#timer,
			anchorPartId: undefined, // Clear automatic anchor
			projectedState,
		}
		this.#emitChange(this.#timer)
	}

	setProjectedDuration(duration: number, paused: boolean = false): void {
		const projectedState: TimerState = paused
			? literal<TimerState>({ paused: true, duration })
			: literal<TimerState>({ paused: false, zeroTime: getCurrentTime() + duration })

		this.#timer = {
			...this.#timer,
			anchorPartId: undefined, // Clear automatic anchor
			projectedState,
		}
		this.#emitChange(this.#timer)
	}

	getDuration(): number | null {
		if (!this.#timer.state) {
			return null
		}

		return timerStateToDuration(this.#timer.state, getCurrentTime())
	}

	getZeroTime(): number | null {
		if (!this.#timer.state) {
			return null
		}

		return timerStateToZeroTime(this.#timer.state, getCurrentTime())
	}

	getProjectedDuration(): number | null {
		if (!this.#timer.projectedState) {
			return null
		}

		return timerStateToDuration(this.#timer.projectedState, getCurrentTime())
	}

	getProjectedZeroTime(): number | null {
		if (!this.#timer.projectedState) {
			return null
		}

		return timerStateToZeroTime(this.#timer.projectedState, getCurrentTime())
	}
}
