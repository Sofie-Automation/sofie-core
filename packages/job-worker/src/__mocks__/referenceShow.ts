import type { RundownPlaylistTiming } from '@sofie-automation/blueprints-integration'
import type { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import type {
	DBRundownPlaylist,
	SelectedPartInstance,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { assertNever, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	clock,
	formatClock,
	type PartKey,
	REFERENCE_PLAYLIST_ID,
	type ReferenceRundown,
	type RundownVariant,
} from '@sofie-automation/corelib/dist/testing/referenceRundown'
import type { IStudioSettings } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'
import {
	type PlayoutChangedResult,
	PlayoutChangedType,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import {
	handleActivateRundownPlaylist,
	handleDeactivateRundownPlaylist,
	handleResetRundownPlaylist,
} from '../playout/activePlaylistJobs.js'
import { handleActivateHold, handleDeactivateHold } from '../playout/holdJobs.js'
import { handleSetNextPart } from '../playout/setNextJobs.js'
import { handleTakeNextPart } from '../playout/take.js'
import { handleOnPlayoutPlaybackChanged } from '../playout/timings/index.js'
import { type MockJobContext, setupDefaultJobEnvironment } from './context.js'
import { setupMockPeripheralDevice } from './presetCollections.js'
import { setupReferenceRundown } from './referenceRundown.js'
import { getCurrentTime, useFakeCurrentTime } from './time.js'

/**
 * The reference rundown, played by the real playout jobs, each at the clock time it is given, with a playout gateway
 * that reports what each take changed as its mode says. A test drives it step by step, and is told after every job:
 *
 *   const show = await startReferenceShow({ timing, gateway: { kind: 'no gateway' }, onJob })
 *   await show.activate('11:59:00')
 *   await show.take('12:00:05')
 *
 * The driver prints nothing: what a test records after each job, and how it names the job, is the test's own.
 *
 * Blueprints do nothing and the parts have no pieces. The clock is the job worker's mocked one: a test that drives a
 * show sets the real clock back with `useRealCurrentTime` when it is done.
 */

/** The playout gateway, which reports to core when parts start and stop playing */
export type ReferenceShowGateway =
	/** No gateway: core reports each taken part as started, and the previous one as stopped, itself at the take */
	| { kind: 'no gateway' }
	/** One playout gateway, which reports a taken part as started after a delay, or never */
	| { kind: 'single gateway'; confirmsAfterMs: number | 'never' }
	/**
	 * Multi-gateway mode, set by the studio setting: core schedules each start this far ahead when it builds the
	 * timeline, and the gateway reports the start then; it reports the previous part stopped at the take, when it gets
	 * the new timeline
	 */
	| { kind: 'multi gateway'; latencyMs: number }

/** A job the driver has run */
export type ReferenceShowJob =
	| { kind: 'activate'; rehearsal: boolean }
	| { kind: 'deactivate' }
	| { kind: 'reset'; thenActivate: 'on air' | 'in rehearsal' | undefined }
	| { kind: 'set next'; part: PartKey; from: number | undefined }
	| { kind: 'take' }
	| {
			kind: 'gateway report'
			/** What the gateway reports on: a take, or a part that started on its own */
			cause: 'take' | 'auto-next'
			started: PartInstanceId | undefined
			stopped: PartInstanceId | undefined
	  }
	| { kind: 'start a hold' }
	| { kind: 'cancel the hold' }

export interface ReferenceShowOptions {
	timing: RundownPlaylistTiming
	gateway: ReferenceShowGateway
	/** The rundown to play: one of the reference form. The reference rundown with the variant's changes, unless set */
	rundown?: ReferenceRundown
	/** The changes to the reference rundown, when no rundown is given */
	variant?: RundownVariant
	/** Studio settings on top of the mock studio's, and of the minimum time between takes at 0 */
	studio?: Partial<IStudioSettings>
	/** When the rundown is set up, before any job; 11:50:00 unless set */
	setupAt?: number
	/** Called after each job, with the time it ran at, and the context the jobs ran in */
	onJob?: (at: number, job: ReferenceShowJob, context: MockJobContext) => void | Promise<void>
}

/** Set up the rundown, with nothing played yet and the playlist inactive */
export async function startReferenceShow(options: ReferenceShowOptions): Promise<ReferenceShow> {
	const context = setupDefaultJobEnvironment(undefined, studioSettingsFor(options))

	// Ignore event jobs
	jest.spyOn(context, 'queueEventJob').mockImplementation(async () => Promise.resolve())

	if (options.gateway.kind !== 'no gateway') {
		await setupMockPeripheralDevice(
			context,
			PeripheralDeviceCategory.PLAYOUT,
			PeripheralDeviceType.PLAYOUT,
			PERIPHERAL_SUBTYPE_PROCESS
		)
	}

	useFakeCurrentTime(options.setupAt ?? clock('11:50:00'))
	await setupReferenceRundown(context, { timing: options.timing, variant: options.variant, rundown: options.rundown })

	return new ReferenceShow(context, options)
}

function studioSettingsFor(options: ReferenceShowOptions): Partial<IStudioSettings> {
	const settings: Partial<IStudioSettings> = { minimumTakeSpan: 0, ...options.studio }
	if (options.gateway.kind === 'multi gateway') {
		settings.forceMultiGatewayMode = true
		settings.multiGatewayNowSafeLatency = options.gateway.latencyMs
	}
	return settings
}

export class ReferenceShow {
	readonly context: MockJobContext
	readonly #gateway: ReferenceShowGateway
	readonly #onJob: ReferenceShowOptions['onJob']

	constructor(context: MockJobContext, options: ReferenceShowOptions) {
		this.context = context
		this.#gateway = options.gateway
		this.#onJob = options.onJob
	}

	async activate(at: string | number, options?: { rehearsal?: boolean }): Promise<void> {
		const rehearsal = options?.rehearsal ?? false
		this.#setClock(at)
		await handleActivateRundownPlaylist(this.context, { playlistId: REFERENCE_PLAYLIST_ID, rehearsal })
		await this.#ran({ kind: 'activate', rehearsal })
	}

	async deactivate(at: string | number): Promise<void> {
		this.#setClock(at)
		await handleDeactivateRundownPlaylist(this.context, { playlistId: REFERENCE_PLAYLIST_ID })
		await this.#ran({ kind: 'deactivate' })
	}

	/** Reset the playlist, and activate it again when asked */
	async reset(at: string | number, options?: { thenActivate?: 'on air' | 'in rehearsal' }): Promise<void> {
		this.#setClock(at)
		const thenActivate = options?.thenActivate
		await handleResetRundownPlaylist(this.context, {
			playlistId: REFERENCE_PLAYLIST_ID,
			activate: thenActivate === undefined ? undefined : thenActivate === 'on air' ? 'active' : 'rehearsal',
		})
		await this.#ran({ kind: 'reset', thenActivate })
	}

	/** Set the part as next, as a user does; optionally to play from this far into the part */
	async setNext(at: string | number, part: PartKey, options?: { from?: number }): Promise<void> {
		this.#setClock(at)
		const from = options?.from
		await handleSetNextPart(this.context, {
			playlistId: REFERENCE_PLAYLIST_ID,
			nextPartId: protectString(part),
			setManually: true,
			nextTimeOffset: from,
		})
		await this.#ran({ kind: 'set next', part, from })
	}

	/** Take, and then let the gateway report what the take changed, as the gateway mode says */
	async take(at: string | number): Promise<void> {
		const takeTime = this.#setClock(at)
		const before = await this.playlist()
		await handleTakeNextPart(this.context, {
			playlistId: REFERENCE_PLAYLIST_ID,
			fromPartInstanceId: before.currentPartInfo?.partInstanceId ?? null,
		})
		await this.#ran({ kind: 'take' })

		const after = await this.playlist()
		// The take that completes a hold changes no part, so there is nothing for the gateway to report
		if (after.currentPartInfo?.partInstanceId === before.currentPartInfo?.partInstanceId) return

		await this.#reportTake(takeTime)
	}

	/** A gateway that never confirms a start by itself reports the taken part as started, and the previous one stopped */
	async confirmStart(at: string | number): Promise<void> {
		const gateway = this.#gateway
		if (gateway.kind !== 'single gateway' || gateway.confirmsAfterMs !== 'never') {
			throw new Error('Only a gateway that never confirms a start by itself needs to be told to confirm it')
		}
		this.#setClock(at)
		const playlist = await this.playlist()
		if (!playlist.currentPartInfo) throw new Error('There is no taken part to report as started')
		await this.#reportPlayback(
			{ stopped: playlist.previousPartsInfo[0], started: playlist.currentPartInfo },
			'take'
		)
	}

	/** The gateway reports that the next part has started on its own, and the on-air one has stopped */
	async autoNext(at: string | number): Promise<void> {
		if (this.#gateway.kind === 'no gateway') {
			throw new Error('Without a gateway nothing reports that the next part started')
		}
		this.#setClock(at)
		const playlist = await this.playlist()
		if (!playlist.nextPartInfo) throw new Error('There is no next part to report as started')
		// The next part's callback object takes over the on-air part's layer when the next part's group starts, so
		// the on-air part is reported stopped in the same batch
		await this.#reportPlayback(
			{ stopped: playlist.currentPartInfo ?? undefined, started: playlist.nextPartInfo },
			'auto-next'
		)
	}

	async startHold(at: string | number): Promise<void> {
		this.#setClock(at)
		await handleActivateHold(this.context, { playlistId: REFERENCE_PLAYLIST_ID })
		await this.#ran({ kind: 'start a hold' })
	}

	async cancelHold(at: string | number): Promise<void> {
		this.#setClock(at)
		await handleDeactivateHold(this.context, { playlistId: REFERENCE_PLAYLIST_ID })
		await this.#ran({ kind: 'cancel the hold' })
	}

	async playlist(): Promise<DBRundownPlaylist> {
		const playlist = await this.context.mockCollections.RundownPlaylists.findOne(REFERENCE_PLAYLIST_ID)
		if (!playlist) throw new Error('The reference playlist is missing')
		return playlist
	}

	/**
	 * The gateway reports what a take changed, as the gateway mode says. A gateway reports a part as stopped when the
	 * part's callback object leaves the state it resolves from the timeline, and after a take the previous part's
	 * group is built without that object, so the stop is reported as soon as the gateway resolves the new timeline.
	 */
	async #reportTake(takeTime: number): Promise<void> {
		const gateway = this.#gateway
		switch (gateway.kind) {
			case 'no gateway':
				// The take has reported the start of the taken part and the stop of the previous one itself
				return
			case 'single gateway': {
				if (gateway.confirmsAfterMs === 'never') return
				// The new timeline starts the taken part when the gateway resolves it, so the stop of the previous part
				// and the start of the taken part come in one batch
				this.#setClock(takeTime + gateway.confirmsAfterMs)
				const playlist = await this.playlist()
				if (!playlist.currentPartInfo) throw new Error('There is no taken part to report as started')
				await this.#reportPlayback(
					{ stopped: playlist.previousPartsInfo[0], started: playlist.currentPartInfo },
					'take'
				)
				return
			}
			case 'multi gateway': {
				// The new timeline starts the taken part at a fixed time, latencyMs after the take. The gateway resolves
				// the timeline as soon as it gets it, right after the take, and reports the previous part stopped then;
				// it reports the taken part started when its part group starts
				const atTake = await this.playlist()
				if (!atTake.currentPartInfo) throw new Error('There is no taken part to report as started')
				const previous = atTake.previousPartsInfo[0]
				const taken = await this.context.mockCollections.PartInstances.findOne(
					atTake.currentPartInfo.partInstanceId
				)
				const takenStart = taken?.timings?.plannedStartedPlayback
				if (takenStart !== undefined && takenStart <= takeTime) {
					// Played from a point inside it: its part group started before the take, so the gateway reports its
					// start in the same batch as the stop of the previous part
					this.#setClock(takeTime)
					await this.#reportPlayback({ stopped: previous, started: atTake.currentPartInfo }, 'take')
					return
				}
				if (previous) {
					this.#setClock(takeTime)
					await this.#reportPlayback({ stopped: previous, started: undefined }, 'take')
				}
				this.#setClock(takeTime + gateway.latencyMs)
				await this.#reportPlayback({ stopped: undefined, started: atTake.currentPartInfo }, 'take')
				return
			}
			default:
				assertNever(gateway)
		}
	}

	/**
	 * The gateway reports, in one batch, a part as stopped and a part as started, each undefined when the batch has
	 * none: every stop before every start, as the playout gateway sends them. The stop is reported at the current
	 * time; the start at the part's planned start when core has set one (its part group starts there on the
	 * timeline, e.g. back-dated for a part played from a point inside it), otherwise at the current time.
	 */
	async #reportPlayback(
		batch: { stopped: SelectedPartInstance | undefined; started: SelectedPartInstance | undefined },
		cause: 'take' | 'auto-next'
	): Promise<void> {
		if (!batch.stopped && !batch.started) throw new Error('A gateway report has a stop, a start, or both')

		const time = getCurrentTime()
		const changes: PlayoutChangedResult[] = []
		if (batch.stopped) {
			changes.push(
				literal<PlayoutChangedResult>({
					type: PlayoutChangedType.PART_PLAYBACK_STOPPED,
					objId: 'partGroup',
					data: { partInstanceId: batch.stopped.partInstanceId, time },
				})
			)
		}
		if (batch.started) {
			const startedPartInstance = await this.context.mockCollections.PartInstances.findOne(
				batch.started.partInstanceId
			)
			changes.push(
				literal<PlayoutChangedResult>({
					type: PlayoutChangedType.PART_PLAYBACK_STARTED,
					objId: 'partGroup',
					data: {
						partInstanceId: batch.started.partInstanceId,
						time: startedPartInstance?.timings?.plannedStartedPlayback ?? time,
					},
				})
			)
		}

		await handleOnPlayoutPlaybackChanged(this.context, { playlistId: REFERENCE_PLAYLIST_ID, changes })
		await this.#ran({
			kind: 'gateway report',
			cause,
			started: batch.started?.partInstanceId,
			stopped: batch.stopped?.partInstanceId,
		})
	}

	#setClock(at: string | number): number {
		const time = typeof at === 'number' ? at : clock(at)
		if (time < getCurrentTime()) {
			throw new Error(
				`A job at ${formatClock(time)} would go back in time, after ${formatClock(getCurrentTime())}`
			)
		}
		useFakeCurrentTime(time)
		return time
	}

	async #ran(job: ReferenceShowJob): Promise<void> {
		await this.#onJob?.(getCurrentTime(), job, this.context)
	}
}
