import type {
	IPlaylistTTimer,
	IPlaylistTTimerState,
	TimerState,
} from '@sofie-automation/blueprints-integration/dist/context/tTimersContext'
import type { RundownTTimer, RundownTTimerIndex } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import type { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { assertNever, literal } from '@sofie-automation/corelib/dist/lib'
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
	get state(): IPlaylistTTimerState | null {
		const rawMode = this.#timer.mode
		const rawState = this.#timer.state

		if (!rawMode || !rawState) return null

		const currentTime = rawState.paused ? rawState.duration : rawState.zeroTime - getCurrentTime()

		switch (rawMode.type) {
			case 'countdown':
				return {
					mode: 'countdown',
					currentTime,
					duration: rawMode.duration,
					paused: rawState.paused,
					stopAtZero: rawMode.stopAtZero,
				}
			case 'freeRun':
				return {
					mode: 'freeRun',
					currentTime,
					paused: rawState.paused,
				}
			case 'timeOfDay':
				return {
					mode: 'timeOfDay',
					currentTime,
					targetTime: rawState.paused ? 0 : rawState.zeroTime,
					targetRaw: rawMode.targetRaw,
					stopAtZero: rawMode.stopAtZero,
				}
			default:
				assertNever(rawMode)
				return null
		}
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
}
