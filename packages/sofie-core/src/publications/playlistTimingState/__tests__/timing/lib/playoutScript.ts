import { PartHoldMode, type RundownPlaylistTiming } from '@sofie-automation/blueprints-integration'
import type {
	PartInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	SegmentId,
	SegmentPlayoutId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { type DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { DBPartInstance, PartInstanceTimings } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	type DBRundownPlaylist,
	RundownHoldState,
	type SelectedPartInstance,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import type { TimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { type MongoFieldSpecifier, mongoProjectDocument } from '@sofie-automation/corelib/dist/mongo'
import {
	calculatePartExpectedDurationWithTransition,
	calculatePartTimings,
	getPartTimingsOrDefaults,
	type PartCalculatedTimings,
} from '@sofie-automation/corelib/dist/playout/timings'
import { type ProtectedString, protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { selectNextPart } from '@sofie-automation/job-worker/dist/playout/selectNextPart'
import { isDeepStrictEqual } from 'util'
import { partInstanceFieldSpecifier as partInstancesUIPartInstanceFields } from '../../../../partInstancesUI/reactiveContentCache'
import type { UIPartInstance } from '../../../../partInstancesUI/publication'
import { partFieldSpecifier as partsUIPartFields } from '../../../../partsUI/reactiveContentCache'
import type { UIPart } from '../../../../partsUI/publication'
import { createTimingStateDocs } from '../../../publication'
import {
	type ContentCache,
	createReactiveContentCache,
	type RundownPlaylistFields,
	rundownPlaylistFieldSpecifier,
	type SegmentFields,
	segmentFieldSpecifier,
	type StudioSettingsDoc,
} from '../../../reactiveContentCache'
import {
	clock,
	formatClock,
	formatLength,
	length,
	type PartKey,
	REFERENCE_PLAYLIST_ID,
	REFERENCE_STUDIO_ID,
	type ReferenceRundown,
	TIMING_MODES,
	type TimingModeName,
} from './referenceRundown'
import { renderTimingText, type TimingCalculation, type TimingText, type TimingTextView } from './renderTimingText'

/**
 * A playout driver for the timing tests. A script lists what the operator does and what the playout gateway reports,
 * each at a clock time. Replaying it writes plain playlist and PartInstance objects the way the job worker's playout
 * jobs write them, and a read gives the playlist timing publication's documents, rendered as text, as a client
 * holding them sees them at an instant.
 *
 *   const show = playoutScript({ rundown: referenceRundown(), timing })
 *     .activate('11:59:00')
 *     .take('12:00:05')
 *   show.readAt('12:00:10')    // the published documents, as text
 *   show.traceAt('12:00:10')   // what playout wrote, job by job
 *
 * A script is immutable: each step returns a new script, so a base script can be shared.
 *
 * The steps are the ones the job worker's timing inputs test records from real playout jobs: activating on air or in
 * rehearsal, taking, setting the next part (also to play from a point inside it), auto-next, the gateway confirming a
 * start, holds, deactivation and reset, with no gateway, one gateway or in multi-gateway mode. Each job follows the job
 * worker's own code, step for step, and the next part is chosen by the job worker's own selectNextPart. The test of
 * this driver plays the same scripts as the job worker's test, and checks that the driver prints the same trace, line
 * for line, as the text file that test records.
 *
 * Blueprints are taken to do nothing and the parts have no pieces. No step sets a loop, queues a segment, adlibs a
 * part or edits the rundown, so the driver leaves that code of the job worker out, and refuses to print a trace if the
 * state ever needs it. The rundown is usually the reference rundown, but can be any rundown of the same form: one
 * rundown in the reference playlist, with the plain keys as ids. The trace names the segments and parts by those keys.
 *
 * A read builds what the publication holds: the playlist and segments through its field projections, and the parts
 * and PartInstances as the UI publications give them: only the PartInstances of the current activation that are not
 * reset, and none while the playlist is inactive. Without a loop, the UI publications change no value the timing
 * publication reads. The documents are calculated at the last step at or before the instant that changed anything
 * the publication reads, which is when the publication last calculated them, and read at the instant. A calculation
 * at the instant is made as well, and the text shows any value that reads differently.
 */

// The script

/** The playout gateway, which reports to core when parts start and stop playing */
export type Gateway =
	/** No gateway: core reports each taken part as started, and the previous one as stopped, itself at the take */
	| { kind: 'no gateway' }
	/** One playout gateway, which reports a taken part as started after a delay, or never */
	| { kind: 'single gateway'; confirmsAfterMs: number | 'never' }
	/**
	 * Multi-gateway mode: core schedules each start this far ahead when it builds the timeline, and the gateway
	 * reports the start then; it reports the previous part stopped at the take, when it gets the new timeline
	 */
	| { kind: 'multi gateway'; latencyMs: number }

export const GATEWAY_CONFIRMING_AT_ONCE: Gateway = { kind: 'single gateway', confirmsAfterMs: 0 }

/** The studio settings a script can set */
export type StudioOptions = Partial<Pick<IStudioSettings, 'defaultDisplayDuration' | 'allowHold'>>

export interface PlayoutScriptOptions {
	rundown: ReferenceRundown
	timing: RundownPlaylistTiming
	/** A gateway that confirms each start at once, unless set */
	gateway?: Gateway
	studio?: StudioOptions
}

export interface ReadOptions {
	/** Which lines to print; every line unless set */
	view?: TimingTextView
	/** Calculate the same show with each of these playlist timings, one row each */
	modes?: readonly TimingModeName[]
	/**
	 * When the publication last calculated the documents, if later than the last step that changed anything it reads,
	 * and not after the instant. Before any step has, any time up to the instant
	 */
	publishedAt?: string
}

/** What the publication holds at a read: the contents of its cache */
export interface PublicationInputs {
	studioSettings: StudioSettingsDoc
	playlist: Pick<DBRundownPlaylist, RundownPlaylistFields>
	segments: Array<Pick<DBSegment, SegmentFields>>
	parts: UIPart[]
	partInstances: UIPartInstance[]
}

type ScriptAction =
	| { kind: 'activate'; rehearsal: boolean }
	| { kind: 'deactivate' }
	| { kind: 'reset'; thenActivate: 'on air' | 'in rehearsal' | undefined }
	| { kind: 'set next'; part: PartKey; from: number | undefined }
	| { kind: 'take'; allowZeroLength: boolean }
	| { kind: 'confirm start'; allowZeroLength: boolean }
	| { kind: 'auto-next'; allowZeroLength: boolean }
	| { kind: 'start a hold' }
	| { kind: 'cancel the hold' }

interface ScriptStep {
	at: number
	action: ScriptAction
}

/** Options of a step that can end with a part played for no time at all */
interface ZeroLengthOption {
	/**
	 * Allow a part to end at the time it started. Without this the step is refused, because a played length of zero
	 * reads as a part that has not finished
	 */
	allowZeroLength?: boolean
}

/** Start a script on the rundown: nothing has happened yet, and the playlist is not active */
export function playoutScript(options: PlayoutScriptOptions): PlayoutScript {
	return PlayoutScript.start(options)
}

export class PlayoutScript {
	readonly #options: PlayoutScriptOptions
	readonly #steps: readonly ScriptStep[]

	private constructor(options: PlayoutScriptOptions, steps: readonly ScriptStep[]) {
		this.#options = options
		this.#steps = steps
	}

	static start(options: PlayoutScriptOptions): PlayoutScript {
		return new PlayoutScript(options, [])
	}

	#then(at: string, action: ScriptAction): PlayoutScript {
		return new PlayoutScript(this.#options, [...this.#steps, { at: clock(at), action }])
	}

	activate(at: string, options?: { rehearsal?: boolean }): PlayoutScript {
		return this.#then(at, { kind: 'activate', rehearsal: options?.rehearsal ?? false })
	}
	deactivate(at: string): PlayoutScript {
		return this.#then(at, { kind: 'deactivate' })
	}
	/** Reset the playlist, and activate it again when asked */
	reset(at: string, options?: { thenActivate?: 'on air' | 'in rehearsal' }): PlayoutScript {
		return this.#then(at, { kind: 'reset', thenActivate: options?.thenActivate })
	}

	/** Set a part as next, as a user does; optionally to play from a point inside it: { from: '0:05' } */
	setNext(at: string, part: PartKey, options?: { from?: string }): PlayoutScript {
		const from = options?.from === undefined ? undefined : length(options.from)
		return this.#then(at, { kind: 'set next', part, from })
	}

	/** Take the next part; the gateway then reports it as started, as the gateway mode says */
	take(at: string, options?: ZeroLengthOption): PlayoutScript {
		return this.#then(at, { kind: 'take', allowZeroLength: options?.allowZeroLength ?? false })
	}
	/** The gateway reports the taken part as started, for a gateway that does not confirm starts by itself */
	confirmStart(at: string, options?: ZeroLengthOption): PlayoutScript {
		return this.#then(at, { kind: 'confirm start', allowZeroLength: options?.allowZeroLength ?? false })
	}
	/** A gateway reports that the next part has started on its own, and the on-air part has stopped */
	autoNext(at: string, options?: ZeroLengthOption): PlayoutScript {
		return this.#then(at, { kind: 'auto-next', allowZeroLength: options?.allowZeroLength ?? false })
	}

	startHold(at: string): PlayoutScript {
		return this.#then(at, { kind: 'start a hold' })
	}
	cancelHold(at: string): PlayoutScript {
		return this.#then(at, { kind: 'cancel the hold' })
	}

	/** The publication's documents as a client holding them reads them at the instant */
	readAt(instant: string, options?: ReadOptions): TimingText {
		const instantTime = clock(instant)
		const show = replay(this.#options, this.#steps, instantTime)

		// Until a step changes what the publication reads, it can have calculated at any time up to the instant
		const lastChange = show.lastChangeAt
		const publishedAt =
			options?.publishedAt !== undefined ? clock(options.publishedAt) : (lastChange ?? instantTime)
		if (lastChange !== undefined && publishedAt < lastChange) {
			throw new Error(
				`The publication cannot have calculated at ${formatClock(publishedAt)}, before the last step that changed what it reads`
			)
		}
		if (publishedAt > instantTime) {
			throw new Error(
				`The publication cannot have calculated at ${formatClock(publishedAt)}, after the instant read`
			)
		}

		const inputs = show.publicationInputs()
		refuseInconsistentInputs(inputs)
		const modes =
			options?.modes?.map((name) => {
				const mode = TIMING_MODES.find((candidate) => candidate.name === name)
				if (!mode) throw new Error(`"${name}" is not a timing mode`)
				return mode
			}) ?? []
		const calculate = (timing: RundownPlaylistTiming, mode?: string): TimingCalculation => {
			const cache = buildContentCache(inputs, timing)
			return {
				mode,
				published: createTimingStateDocs(REFERENCE_PLAYLIST_ID, cache, publishedAt),
				fresh: createTimingStateDocs(REFERENCE_PLAYLIST_ID, cache, instantTime),
			}
		}

		return renderTimingText({
			instant: instantTime,
			publishedAt,
			view: options?.view ?? 'full',
			inputs: {
				parts: show.state.parts,
				partInstances: inputs.partInstances,
				nextPartInstanceId: inputs.playlist.activationId
					? inputs.playlist.nextPartInfo?.partInstanceId
					: undefined,
			},
			calculations:
				modes.length === 0
					? [calculate(inputs.playlist.timing)]
					: modes.map((mode) => calculate(mode.timing, mode.name)),
		})
	}

	/**
	 * What playout wrote, job by job, for the jobs at or before the instant, in the text of the job worker's timing
	 * inputs test
	 */
	traceAt(instant: string): string {
		return replay(this.#options, this.#steps, clock(instant)).trace.text
	}

	/** What the publication holds at the instant */
	inputsAt(instant: string): PublicationInputs {
		return replay(this.#options, this.#steps, clock(instant)).publicationInputs()
	}

	/**
	 * When the publication last calculated its documents, as of the instant: at the last step at or before the instant
	 * that changed what it reads; undefined while no step has
	 */
	lastCalculationAt(instant: string): number | undefined {
		return replay(this.#options, this.#steps, clock(instant)).lastChangeAt
	}
}

/** The publication's documents, as it calculates them at a time from what it holds, with the given playlist timing */
export function calculateTimingDocuments(
	inputs: PublicationInputs,
	timing: RundownPlaylistTiming,
	at: number
): TimingStateDoc[] {
	refuseInconsistentInputs(inputs)
	return createTimingStateDocs(REFERENCE_PLAYLIST_ID, buildContentCache(inputs, timing), at)
}

// The state playout keeps

/** Everything playout has written, and the rundown */
interface ShowState {
	segments: DBSegment[]
	parts: DBPart[]
	playlist: DBRundownPlaylist
	/** Every PartInstance that exists, of any activation, reset or not, in the order they were created */
	partInstances: DBPartInstance[]
	/** How many ids of each kind the show has made: 'activation_', 'A_playout_', 'A1_' */
	idCounts: Map<string, number>
}

/** How the jobs see the studio */
interface PlayoutSettings {
	studio: IStudioSettings
	gateway: Gateway
	multiGatewayMode: boolean
	/** How far ahead of a job's time multi-gateway mode schedules a start */
	nowSafeLatency: number
}

/** The context selectNextPart needs: the studio settings, and no tracing */
type SelectNextPartContext = Parameters<typeof selectNextPart>[0]
type SelectNextPartSegments = Parameters<typeof selectNextPart>[4]

/** The studio settings of the job worker's test studio, with the minimum time between takes at 0 */
function studioSettings(options: PlayoutScriptOptions): IStudioSettings {
	const settings: Partial<IStudioSettings> = {
		frameRate: 25,
		mediaPreviewsUrl: '',
		minimumTakeSpan: 0,
		allowHold: true,
		...options.studio,
	}
	if (options.gateway?.kind === 'multi gateway') {
		settings.forceMultiGatewayMode = true
		settings.multiGatewayNowSafeLatency = options.gateway.latencyMs
	}
	return settings as IStudioSettings
}

function initialState(options: PlayoutScriptOptions): ShowState {
	const rundown = structuredClone(options.rundown)
	return {
		segments: rundown.segments,
		parts: rundown.parts,
		playlist: {
			_id: REFERENCE_PLAYLIST_ID,
			externalId: unprotectString(REFERENCE_PLAYLIST_ID),
			studioId: REFERENCE_STUDIO_ID,
			name: 'Reference playlist',
			created: 0,
			modified: 0,
			rehearsal: false,
			defaultBrandingId: null,
			currentPartInfo: null,
			nextPartInfo: null,
			previousPartsInfo: [],
			timing: options.timing,
			rundownIdsInOrder: rundown.rundowns.map((rundownDoc) => rundownDoc._id),
			tTimers: [
				{ index: 1, label: '', mode: null, state: null },
				{ index: 2, label: '', mode: null, state: null },
				{ index: 3, label: '', mode: null, state: null },
			],
		},
		partInstances: [],
		idCounts: new Map(),
	}
}

function orderedSegments(state: ShowState): DBSegment[] {
	return state.playlist.rundownIdsInOrder.flatMap((rundownId) =>
		state.segments.filter((segment) => segment.rundownId === rundownId).sort((a, b) => a._rank - b._rank)
	)
}

function orderedParts(state: ShowState): DBPart[] {
	return orderedSegments(state).flatMap((segment) =>
		state.parts.filter((part) => part.segmentId === segment._id).sort((a, b) => a._rank - b._rank)
	)
}

/** A copy of a document with only the fields of a projection, as a Mongo query with that projection returns it */
function project<T extends { _id: ProtectedString<any> }>(doc: T, projection: object): T {
	return mongoProjectDocument(doc, projection as MongoFieldSpecifier<T>)
}

/** A value as text that does not depend on the order of object keys, for comparing documents */
function canonical(value: unknown): string {
	return JSON.stringify(value, (_key, inner: unknown) =>
		inner && typeof inner === 'object' && !Array.isArray(inner)
			? Object.fromEntries(
					Object.entries<unknown>(inner as Record<string, unknown>).sort(([a], [b]) =>
						a < b ? -1 : a > b ? 1 : 0
					)
				)
			: inner
	)
}

// One job

/**
 * A playout job, run at one clock time on the show's state. Like the job worker's playout model, it has loaded the
 * previous, current and next PartInstances, and the PartInstances that are not reset in their segments; resets that
 * work on that set reach only those
 */
class PlayoutJob {
	readonly state: ShowState
	readonly now: number
	readonly settings: PlayoutSettings
	readonly #loaded = new Set<PartInstanceId>()
	readonly #beforeSave: Array<() => void> = []
	#timelineNeedsUpdate = false

	constructor(state: ShowState, now: number, settings: PlayoutSettings) {
		this.state = state
		this.now = now
		this.settings = settings

		const selectedIds = selectedPartInstanceIds(state.playlist)
		const selectedSegmentIds = new Set(
			state.partInstances.filter((partInstance) => selectedIds.includes(partInstance._id)).map((p) => p.segmentId)
		)
		for (const partInstance of state.partInstances) {
			const isSelected = selectedIds.includes(partInstance._id)
			const isInASelectedSegment = selectedSegmentIds.has(partInstance.segmentId) && !partInstance.reset
			if (isSelected || isInASelectedSegment) this.#loaded.add(partInstance._id)
		}
	}

	get playlist(): DBRundownPlaylist {
		return this.state.playlist
	}

	get selectNextPartContext(): SelectNextPartContext {
		return {
			startSpan: () => undefined,
			studio: { settings: this.settings.studio },
		} as unknown as SelectNextPartContext
	}

	/** The loaded PartInstances, in the order they were created */
	get loadedPartInstances(): DBPartInstance[] {
		return this.state.partInstances.filter((partInstance) => this.#loaded.has(partInstance._id))
	}
	/** The loaded PartInstances that are not a previous, the current or the next one */
	get olderPartInstances(): DBPartInstance[] {
		const selectedIds = selectedPartInstanceIds(this.playlist)
		return this.loadedPartInstances.filter((partInstance) => !selectedIds.includes(partInstance._id))
	}

	getPartInstance(id: PartInstanceId | undefined): DBPartInstance | null {
		if (!id || !this.#loaded.has(id)) return null
		return this.state.partInstances.find((partInstance) => partInstance._id === id) ?? null
	}
	/** The previous part played: the most recent one */
	get previousPartInstance(): DBPartInstance | null {
		return this.getPartInstance(this.playlist.previousPartsInfo[0]?.partInstanceId)
	}
	/** Every previous part playout keeps, most recent first */
	get previousPartInstances(): DBPartInstance[] {
		return this.playlist.previousPartsInfo.flatMap((info) => this.getPartInstance(info.partInstanceId) ?? [])
	}
	get currentPartInstance(): DBPartInstance | null {
		return this.getPartInstance(this.playlist.currentPartInfo?.partInstanceId)
	}
	get nextPartInstance(): DBPartInstance | null {
		return this.getPartInstance(this.playlist.nextPartInfo?.partInstanceId)
	}

	addPartInstance(partInstance: DBPartInstance): void {
		this.state.partInstances.push(partInstance)
		this.#loaded.add(partInstance._id)
	}
	deletePartInstance(id: PartInstanceId): void {
		this.state.partInstances = this.state.partInstances.filter((partInstance) => partInstance._id !== id)
		this.#loaded.delete(id)
	}

	markTimelineNeedsUpdate(): void {
		this.#timelineNeedsUpdate = true
	}
	deferBeforeSave(fn: () => void): void {
		this.#beforeSave.push(fn)
	}

	/** What the job worker does when it saves a job: the functions deferred to before the save, then the timeline */
	save(): void {
		for (const fn of this.#beforeSave) fn()
		if (this.#timelineNeedsUpdate) regenerateTimeline(this)
	}
}

function selectedPartInstanceIds(playlist: DBRundownPlaylist): PartInstanceId[] {
	const ids = playlist.previousPartsInfo.map((info) => info.partInstanceId)
	for (const info of [playlist.currentPartInfo, playlist.nextPartInfo]) {
		if (info?.partInstanceId) ids.push(info.partInstanceId)
	}
	return ids
}

// The PartInstance setters, as the job worker's PartInstance model has them

function setPlannedStartedPlayback(partInstance: DBPartInstance, time: number | undefined): void {
	const timings: PartInstanceTimings = { ...partInstance.timings }
	timings.plannedStartedPlayback = time
	delete timings.plannedStoppedPlayback
	partInstance.timings = timings
}

function setPlannedStoppedPlayback(partInstance: DBPartInstance, time: number | undefined): void {
	const timings: PartInstanceTimings = { ...partInstance.timings }
	if (timings.plannedStartedPlayback && !timings.plannedStoppedPlayback) {
		if (time) {
			timings.plannedStoppedPlayback = time
			timings.duration = time - timings.plannedStartedPlayback
		} else {
			delete timings.plannedStoppedPlayback
			delete timings.duration
		}
		partInstance.timings = timings
	}
}

function setReportedStartedPlayback(partInstance: DBPartInstance, time: number): boolean {
	const timings: PartInstanceTimings = { ...partInstance.timings }
	if (timings.reportedStartedPlayback) return false

	timings.reportedStartedPlayback = time
	delete timings.plannedStoppedPlayback
	delete timings.duration
	partInstance.timings = timings
	return true
}

function setReportedStoppedPlayback(partInstance: DBPartInstance, time: number): boolean {
	const timings: PartInstanceTimings = { ...partInstance.timings }
	if (timings.reportedStoppedPlayback) return false

	timings.reportedStoppedPlayback = time
	timings.duration = time - (timings.reportedStartedPlayback || time)
	partInstance.timings = timings
	return true
}

function setTaken(job: PlayoutJob, partInstance: DBPartInstance, takeTime: number, playOffset: number | null): void {
	partInstance.isTaken = true

	const timings: PartInstanceTimings = { ...partInstance.timings }
	timings.take = takeTime
	timings.playOffset = playOffset ?? 0
	// Back-dated, so that playout starts a while into the part
	if (playOffset !== null) timings.plannedStartedPlayback = job.now - playOffset
	partInstance.timings = timings
}

// The playout model's own changes

/** A new id, in place of the job worker's random ones: the prefix and a count, 'activation_1', 'A1_2' */
function newId(state: ShowState, prefix: string): string {
	const count = (state.idCounts.get(prefix) ?? 0) + 1
	state.idCounts.set(prefix, count)
	return `${prefix}${count}`
}

function activatePlaylist(job: PlayoutJob, rehearsal: boolean): RundownPlaylistActivationId {
	const activationId = protectString<RundownPlaylistActivationId>(newId(job.state, 'activation_'))
	job.playlist.activationId = activationId
	job.playlist.rehearsal = rehearsal
	return activationId
}

function clearSelectedPartInstances(job: PlayoutJob): void {
	const playlist = job.playlist
	playlist.currentPartInfo = null
	playlist.nextPartInfo = null
	playlist.previousPartsInfo = []
	playlist.holdState = RundownHoldState.NONE
	delete playlist.lastTakeTime
}

/** Playout keeps no more previous parts than this */
const MAX_PREVIOUS_PARTS = 10

/**
 * Drop the previous parts that can no longer play on into the part after them. A previous part may still play on
 * until the part after it has started and its overlap has passed; while that part has no planned start or no playout
 * timings, playout cannot tell, and keeps it. Parts are dropped from the old end only, so that the list keeps its
 * order, and the most recent one is always kept
 */
function prunePreviousPartInstances(job: PlayoutJob, now: number): void {
	const previous = job.playlist.previousPartsInfo
	let lastKeptIndex = -1
	previous.forEach((_info, index) => {
		const partAfter =
			index === 0 ? job.currentPartInstance : job.getPartInstance(previous[index - 1].partInstanceId)
		const partAfterStart = partAfter?.timings?.plannedStartedPlayback
		const partAfterTimings = partAfter?.partPlayoutTimings
		const mayStillPlayOn =
			partAfterStart === undefined ||
			partAfterTimings === undefined ||
			now <= partAfterStart + partAfterTimings.fromPartRemaining
		if (mayStillPlayOn) lastKeptIndex = index
	})

	const kept = previous.slice(0, lastKeptIndex + 1)
	job.playlist.previousPartsInfo = kept.length > 0 ? kept.slice(0, MAX_PREVIOUS_PARTS) : previous.slice(0, 1)
}

/** The on-air part becomes the most recent previous part, and the next part goes on air */
function cycleSelectedPartInstances(job: PlayoutJob): void {
	const playlist = job.playlist
	if (playlist.currentPartInfo) playlist.previousPartsInfo = [playlist.currentPartInfo, ...playlist.previousPartsInfo]
	playlist.currentPartInfo = playlist.nextPartInfo
	playlist.nextPartInfo = null
	playlist.lastTakeTime = job.now

	prunePreviousPartInstances(job, job.now)
}

function setPartInstanceAsNext(
	job: PlayoutJob,
	partInstance: DBPartInstance | null,
	setManually: boolean,
	consumesQueuedSegmentId: boolean,
	nextTimeOffset?: number
): void {
	if (partInstance) {
		if (!job.getPartInstance(partInstance._id)) {
			throw new Error(`PartInstance being set as next was not constructed correctly`)
		}
		job.playlist.nextPartInfo = {
			partInstanceId: partInstance._id,
			rundownId: partInstance.rundownId,
			manuallySelected: !!(setManually || partInstance.orphaned),
			consumesQueuedSegmentId,
		}
		job.playlist.nextTimeOffset = nextTimeOffset || null
	} else {
		job.playlist.nextPartInfo = null
		job.playlist.nextTimeOffset = null
	}
}

function setRundownStartedPlayback(job: PlayoutJob, rundownId: RundownId, timestamp: number): void {
	const playlist = job.playlist
	if (!playlist.rundownsStartedPlayback) playlist.rundownsStartedPlayback = {}
	const rundownKey = unprotectString(rundownId)
	if (!playlist.rundownsStartedPlayback[rundownKey]) playlist.rundownsStartedPlayback[rundownKey] = timestamp
	if (!playlist.startedPlayback) playlist.startedPlayback = timestamp
}

/** Keyed by the segment playout, and keeping only those of the previous parts and the on-air part */
function setSegmentStartedPlayback(job: PlayoutJob, segmentPlayoutId: SegmentPlayoutId, timestamp: number): void {
	const keep: string[] = job.previousPartInstances.map((previous) => unprotectString(previous.segmentPlayoutId))
	const current = job.currentPartInstance
	if (current) keep.push(unprotectString(current.segmentPlayoutId))

	const starts: Record<string, number> = {}
	for (const [key, time] of Object.entries<number>(job.playlist.segmentsStartedPlayback ?? {})) {
		if (keep.includes(key)) starts[key] = time
	}
	starts[unprotectString(segmentPlayoutId)] = timestamp
	job.playlist.segmentsStartedPlayback = starts
}

/** As in playout: a new PartInstance takes the Branding of the current or next PartInstance, else the playlist default */
function brandingForNewPartInstance(job: PlayoutJob): string | null {
	const inheritFrom = job.currentPartInstance ?? job.nextPartInstance
	if (inheritFrom) return inheritFrom.brandingId
	return job.playlist.defaultBrandingId
}

/** A new PartInstance for a part of the rundown, made when the part is set as next */
function createInstanceForPart(job: PlayoutJob, part: DBPart): DBPartInstance {
	const activationId = job.playlist.activationId
	if (!activationId) throw new Error('Playlist is not active')

	const current = job.currentPartInstance
	const segmentPlayoutId =
		current && part.segmentId === current.segmentId
			? current.segmentPlayoutId
			: protectString<SegmentPlayoutId>(newId(job.state, `${unprotectString(part.segmentId)}_playout_`))

	const partCopy = structuredClone(part)
	partCopy.expectedDurationWithTransition = calculatePartExpectedDurationWithTransition(partCopy, [])

	const partInstance: DBPartInstance = {
		_id: protectString(newId(job.state, `${unprotectString(part._id)}_`)),
		rundownId: part.rundownId,
		segmentId: part.segmentId,
		playlistActivationId: activationId,
		segmentPlayoutId,
		takeCount: current ? current.takeCount + 1 : 0,
		rehearsal: !!job.playlist.rehearsal,
		part: partCopy,
		brandingId: brandingForNewPartInstance(job),
		timings: { setAsNext: job.now },
	}
	job.addPartInstance(partInstance)
	return partInstance
}

/**
 * Reset every PartInstance that matches, loaded or not. The job worker resets the loaded ones in the job and the others
 * in a separate write after its save; a read sees the state after both
 */
function resetPartInstances(job: PlayoutJob, matches: (partInstance: DBPartInstance) => boolean = () => true): void {
	for (const partInstance of job.state.partInstances) {
		if (!partInstance.reset && matches(partInstance)) partInstance.reset = true
	}
}

/** Delete the loaded PartInstances that were never taken, other than the selected ones */
function removeUntakenPartInstances(job: PlayoutJob): void {
	for (const partInstance of job.olderPartInstances) {
		if (!partInstance.isTaken) job.deletePartInstance(partInstance._id)
	}
}

function removeAllRehearsalPartInstances(job: PlayoutJob): void {
	for (const partInstance of [...job.state.partInstances]) {
		if (partInstance.rehearsal) job.deletePartInstance(partInstance._id)
	}
}

function resetPlaylist(job: PlayoutJob, regenerateActivationId: boolean): void {
	const playlist = job.playlist
	playlist.previousPartsInfo = []
	playlist.currentPartInfo = null
	playlist.nextPartInfo = null
	playlist.holdState = RundownHoldState.NONE
	playlist.resetTime = job.now
	delete playlist.lastTakeTime
	delete playlist.startedPlayback
	delete playlist.rundownsStartedPlayback
	delete playlist.segmentsStartedPlayback

	if (regenerateActivationId) {
		playlist.activationId = protectString(newId(job.state, 'activation_'))
	}
}

function deactivatePlaylist(job: PlayoutJob): void {
	delete job.playlist.activationId

	const current = job.currentPartInstance
	if (current?.timings?.reportedStartedPlayback) setReportedStoppedPlayback(current, job.now)

	clearSelectedPartInstances(job)
}

// Timings the job worker calculates for a pair of parts

function calculatePartTimingsFor(
	job: PlayoutJob,
	fromPartInstance: DBPartInstance | null,
	toPartInstance: DBPartInstance
): PartCalculatedTimings {
	return calculatePartTimings(job.playlist.holdState, fromPartInstance?.part, [], toPartInstance.part, [])
}

/** How close to the on-air part's auto-next a take is refused */
const AUTO_NEXT_TAKE_DEBOUNCE = 1000

/** Whether a take now would come too close to the on-air part's auto-next */
function isTakeTooCloseToAutonext(job: PlayoutJob, partInstance: DBPartInstance): boolean {
	const part = partInstance.part
	if (!part.autoNext) return false

	const start = partInstance.timings?.plannedStartedPlayback
	if (start !== undefined && part.expectedDuration) {
		return Math.abs(part.expectedDuration - (job.now - start)) < AUTO_NEXT_TAKE_DEBOUNCE
	}
	return false
}

// Setting the next part

/** The next part, as the job worker's own selectNextPart chooses it */
function chooseNextPart(job: PlayoutJob, previousPartInstance: DBPartInstance | null): NextPartChoice | null {
	const result = selectNextPart(
		job.selectNextPartContext,
		job.playlist,
		previousPartInstance,
		null,
		orderedSegments(job.state).map((segment) => ({ segment })) as unknown as SelectNextPartSegments,
		orderedParts(job.state),
		{ ignoreUnplayable: true, ignoreQuickLoop: false }
	)
	return result ? { part: result.part as DBPart, consumesQueuedSegmentId: result.consumesQueuedSegmentId } : null
}

interface NextPartChoice {
	part: DBPart
	consumesQueuedSegmentId: boolean
}

function setNextPart(
	job: PlayoutJob,
	choice: NextPartChoice | null,
	setManually: boolean,
	nextTimeOffset?: number
): void {
	if (choice) {
		if (!job.playlist.activationId) throw new Error('The playlist is not active')
		if (choice.part.invalid) throw new Error('Part is marked as invalid, cannot set as next.')

		const next = job.nextPartInstance
		const partInstance = next && next.part._id === choice.part._id ? next : createInstanceForPart(job, choice.part)

		// Reset any other instance of the same part
		const keepIds = [partInstance._id, ...selectedPartInstanceIds(job.playlist)]
		resetPartInstances(
			job,
			(other) =>
				!keepIds.includes(other._id) &&
				other.rundownId === partInstance.rundownId &&
				other.part._id === partInstance.part._id
		)

		setPartInstanceAsNext(job, partInstance, setManually, choice.consumesQueuedSegmentId, nextTimeOffset)
	} else {
		setPartInstanceAsNext(job, null, setManually, false, nextTimeOffset)
	}

	removeUntakenPartInstances(job)
	resetPartInstancesWhenChangingSegment(job)
}

/** Entering a segment, or moving back in one, resets the loaded PartInstances that would be played again */
function resetPartInstancesWhenChangingSegment(job: PlayoutJob): void {
	const current = job.currentPartInstance
	const next = job.nextPartInstance
	if (!next) return

	const resetIds = new Set<PartInstanceId>()
	if (current) {
		for (const partInstance of job.loadedPartInstances) {
			if (
				!partInstance.reset &&
				partInstance._id !== current._id &&
				partInstance._id !== next._id &&
				partInstance.segmentId === current.segmentId &&
				partInstance.part._rank > current.part._rank
			) {
				resetIds.add(partInstance._id)
			}
		}
	}

	if (
		!current ||
		next.segmentId !== current.segmentId ||
		(next.segmentId === current.segmentId && next.part._rank < current.part._rank)
	) {
		for (const partInstance of job.loadedPartInstances) {
			if (
				!partInstance.reset &&
				partInstance._id !== next._id &&
				partInstance._id !== current?._id &&
				partInstance.segmentId === next.segmentId
			) {
				resetIds.add(partInstance._id)
			}
		}
	}

	resetPartInstances(job, (partInstance) => resetIds.has(partInstance._id))
}

// The jobs

function activateRundownPlaylist(job: PlayoutJob, rehearsal: boolean, forceReset: boolean): void {
	if (!job.playlist.activationId || forceReset) resetRundownPlaylist(job)

	const newActivationId = activatePlaylist(job, rehearsal)

	const current = job.currentPartInstance
	if (!current || current.reset) {
		clearSelectedPartInstances(job)
		setNextPart(job, chooseNextPart(job, null), false)
	} else {
		// Keep what is playing: only the selected PartInstances move to the new activation
		for (const partInstance of [...job.previousPartInstances, job.currentPartInstance, job.nextPartInstance]) {
			if (partInstance) partInstance.playlistActivationId = newActivationId
		}
	}

	job.markTimelineNeedsUpdate()
}

function resetRundownPlaylist(job: PlayoutJob): void {
	resetPlaylist(job, !!job.playlist.activationId)
	removeAllRehearsalPartInstances(job)
	resetPartInstances(job)

	if (job.playlist.activationId) {
		setNextPart(job, chooseNextPart(job, null), false)
	} else {
		setNextPart(job, null, false)
	}
}

function deactivateRundownPlaylist(job: PlayoutJob): void {
	const current = job.currentPartInstance
	deactivatePlaylist(job)
	setNextPart(job, null, false)
	if (current) setPlannedStoppedPlayback(current, job.now)
}

function resetRundownPlaylistJob(job: PlayoutJob, thenActivate: 'on air' | 'in rehearsal' | undefined): void {
	const playlist = job.playlist
	if (playlist.activationId && !playlist.rehearsal && !job.settings.studio.allowRundownResetOnAir) {
		throw new Error('A playlist that is on air cannot be reset')
	}

	if (playlist.activationId || thenActivate !== undefined) {
		const goToRehearsal =
			thenActivate === undefined ? (playlist.rehearsal ?? false) : thenActivate === 'in rehearsal'
		activateRundownPlaylist(job, goToRehearsal, true)
	} else {
		resetRundownPlaylist(job)
	}
}

function refuseDuringHold(job: PlayoutJob): void {
	const holdState = job.playlist.holdState
	if (holdState && holdState !== RundownHoldState.COMPLETE) throw new Error('Not allowed during a hold')
}

function setNextPartJob(job: PlayoutJob, key: PartKey, nextTimeOffset: number | undefined): void {
	if (!job.playlist.activationId) throw new Error('The playlist is not active')
	refuseDuringHold(job)

	const part = job.state.parts.find((candidate) => candidate._id === protectString(key))
	if (!part) throw new Error(`Part "${key}" not found`)
	if (!isPartPlayable(part)) throw new Error(`Part "${key}" is not playable`)

	// No script queues a segment, so a part set as next never consumes one
	setNextPart(job, { part, consumesQueuedSegmentId: false }, true, nextTimeOffset)
	job.markTimelineNeedsUpdate()
}

/** The part taken: its playout timings, worked out from the part it follows, and taken */
function updatePartInstanceOnTake(
	job: PlayoutJob,
	takePartInstance: DBPartInstance,
	currentPartInstance: DBPartInstance | null
): void {
	takePartInstance.partPlayoutTimings = calculatePartTimingsFor(job, currentPartInstance, takePartInstance)
	takePartInstance.isTaken = true
}

function takeJob(job: PlayoutJob): void {
	const playlist = job.playlist
	if (!playlist.activationId) throw new Error('The playlist is not active')
	if (!playlist.nextPartInfo && playlist.holdState !== RundownHoldState.ACTIVE) {
		throw new Error('There is no next part to take')
	}

	const timeOffset = playlist.nextTimeOffset || null
	const current = job.currentPartInstance
	const next = job.nextPartInstance
	if (!(next ?? current)) throw new Error('No partInstance could be found!')

	if (current && isTakeTooCloseToAutonext(job, current)) {
		throw new Error('A take this close to an auto-next is refused')
	}

	if (playlist.holdState === RundownHoldState.COMPLETE) {
		playlist.holdState = RundownHoldState.NONE
	} else if (playlist.holdState === RundownHoldState.ACTIVE) {
		// This take completes the hold, and changes no part
		playlist.holdState = RundownHoldState.COMPLETE
		job.markTimelineNeedsUpdate()
		return
	}

	if (!next) throw new Error('takePartInstance not found!')
	if (next.invalidReason) throw new Error('The next part is invalid')

	// Auto-next may have scheduled a start; a new one is generated
	setPlannedStartedPlayback(next, undefined)
	setPlannedStoppedPlayback(next, undefined)

	updatePartInstanceOnTake(job, next, current)

	cycleSelectedPartInstances(job)

	setTaken(job, next, job.now, timeOffset)

	setNextPart(job, chooseNextPart(job, next), false)

	if (playlist.holdState === RundownHoldState.PENDING) playlist.holdState = RundownHoldState.ACTIVE

	job.markTimelineNeedsUpdate()

	// Without a gateway, the take reports the start and the stop itself
	const takeDoneTime = job.now
	job.deferBeforeSave(() => {
		if (job.settings.gateway.kind !== 'no gateway') return
		const taken = job.currentPartInstance
		if (!taken) return
		reportPartInstanceHasStarted(job, taken, takeDoneTime)
		const previous = job.previousPartInstance
		if (previous) reportPartInstanceHasStopped(job, previous, takeDoneTime)
	})
}

function reportPartInstanceHasStarted(job: PlayoutJob, partInstance: DBPartInstance, timestamp: number): void {
	const timestampUpdated = setReportedStartedPlayback(partInstance, timestamp)

	if (!job.settings.multiGatewayMode) {
		if (timestamp) setPlannedStartedPlayback(partInstance, timestamp)
		const previous = job.previousPartInstance
		if (timestampUpdated && previous) setPlannedStoppedPlayback(previous, timestamp)
	}

	if (!partInstance.part.untimed) setRundownStartedPlayback(job, partInstance.rundownId, timestamp)

	if (partInstance.segmentPlayoutId !== job.previousPartInstance?.segmentPlayoutId) {
		setSegmentStartedPlayback(job, partInstance.segmentPlayoutId, timestamp)
	}
}

function reportPartInstanceHasStopped(job: PlayoutJob, partInstance: DBPartInstance, timestamp: number): void {
	const timestampUpdated = setReportedStoppedPlayback(partInstance, timestamp)
	if (timestampUpdated && !job.settings.multiGatewayMode) setPlannedStoppedPlayback(partInstance, timestamp)
	// A part has stopped, so the previous parts that no longer play on are dropped
	if (timestampUpdated) prunePreviousPartInstances(job, timestamp)
}

interface PlaybackChange {
	type: 'started' | 'stopped'
	partInstanceId: PartInstanceId
	time: number
}

/** The gateway reports that parts started or stopped playing */
function playbackChangedJob(job: PlayoutJob, changes: PlaybackChange[]): void {
	for (const change of changes) {
		if (change.type === 'started') onPartPlaybackStarted(job, change.partInstanceId, change.time)
		else onPartPlaybackStopped(job, change.partInstanceId, change.time)
	}
}

function onPartPlaybackStarted(job: PlayoutJob, partInstanceId: PartInstanceId, startedPlayback: number): void {
	const playing = job.getPartInstance(partInstanceId)
	if (!playing) throw new Error(`PartInstance "${partInstanceId}" not found!`)
	if (playing.timings?.reportedStartedPlayback) return

	const playlist = job.playlist
	const current = job.currentPartInstance

	if (playlist.currentPartInfo?.partInstanceId === partInstanceId) {
		reportPartInstanceHasStarted(job, playing, startedPlayback)
		job.markTimelineNeedsUpdate()
	} else if (playlist.nextPartInfo?.partInstanceId === partInstanceId) {
		// An auto-next. It never takes the part, so the PartInstance gets no take time or play offset
		cycleSelectedPartInstances(job)
		playlist.holdState = RundownHoldState.NONE

		reportPartInstanceHasStarted(job, playing, startedPlayback)
		updatePartInstanceOnTake(job, playing, current)

		setNextPart(job, chooseNextPart(job, playing), false)
		job.markTimelineNeedsUpdate()
	}
}

function onPartPlaybackStopped(job: PlayoutJob, partInstanceId: PartInstanceId, stoppedPlayback: number): void {
	// A stop of a PartInstance playout has not loaded is only logged
	const partInstance = job.getPartInstance(partInstanceId)
	if (!partInstance) return

	const isPlaying = partInstance.timings?.reportedStartedPlayback && !partInstance.timings?.reportedStoppedPlayback
	if (isPlaying) reportPartInstanceHasStopped(job, partInstance, stoppedPlayback)
}

function startHoldJob(job: PlayoutJob): void {
	// A studio that does not allow a hold ignores the request
	if (!job.settings.studio.allowHold) return

	const playlist = job.playlist
	if (!playlist.activationId) throw new Error('The playlist is not active')
	if (!playlist.currentPartInfo) throw new Error('A hold needs a part on air')
	if (!playlist.nextPartInfo) throw new Error('A hold needs a next part')
	if (playlist.holdState) throw new Error('A hold is already active')

	const current = job.currentPartInstance
	const next = job.nextPartInstance
	if (!current || !next) throw new Error('The on-air or next PartInstance is missing')
	if (
		current.part.holdMode !== PartHoldMode.FROM ||
		next.part.holdMode !== PartHoldMode.TO ||
		current.part.segmentId !== next.part.segmentId
	) {
		throw new Error('The on-air and next parts cannot be held')
	}

	playlist.holdState = RundownHoldState.PENDING
	job.markTimelineNeedsUpdate()
}

function cancelHoldJob(job: PlayoutJob): void {
	const playlist = job.playlist
	if (!playlist.activationId) throw new Error('The playlist is not active')
	if (playlist.holdState !== RundownHoldState.PENDING) {
		throw new Error('Only a hold that has not started can be cancelled')
	}

	playlist.holdState = RundownHoldState.NONE
	job.markTimelineNeedsUpdate()
}

// The timeline: in multi-gateway mode, building it schedules the starts

function regenerateTimeline(job: PlayoutJob): void {
	if (!job.playlist.activationId || !job.settings.multiGatewayMode) return

	const current = job.currentPartInstance
	if (!current) return
	const previous = job.previousPartInstance
	const next = job.nextPartInstance

	const targetNowTime = job.now + job.settings.nowSafeLatency
	const currentPart = current.part
	const currentTimings = getPartTimingsOrDefaults(current, [])
	const nextTimings = next ? calculatePartTimingsFor(job, current, next) : undefined

	// The length of the on-air part, when it auto-nexts into the next part
	let currentPartDuration: number | undefined
	if (next && currentPart.autoNext && currentPart.expectedDuration !== undefined) {
		const requiredExtension = Math.max(
			0,
			nextTimings?.fromPartKeepalive ?? 0,
			currentPart.outTransition?.duration ?? 0
		)
		const extension = Math.max(0, Math.min(requiredExtension, currentPart.availablePostrollDuration ?? 0))
		currentPartDuration =
			currentPart.expectedDuration + extension + currentTimings.toPartDelay + currentTimings.toPartPostroll

		// An auto-next is never scheduled in the past
		const plannedStart = current.timings?.plannedStartedPlayback
		if (plannedStart && plannedStart + currentPartDuration < job.now) currentPartDuration = job.now - plannedStart
	}
	// Once one of the previous parts has started, they play on into the on-air part's group for its overlap
	const anyPreviousPartStarted = job.previousPartInstances.some((partInstance) => {
		return !!partInstance.timings?.plannedStartedPlayback
	})
	const previousPartOverlap = anyPreviousPartStarted ? currentTimings.fromPartRemaining : 0

	let currentStart: number
	if (!current.timings?.plannedStartedPlayback) {
		setPlannedStartedPlayback(current, targetNowTime)
		currentStart = targetNowTime
	} else {
		currentStart = current.timings.plannedStartedPlayback
	}

	if (previous) setPlannedStoppedPlayback(previous, currentStart + previousPartOverlap)

	const currentEnd = currentPartDuration ? currentStart + currentPartDuration : undefined
	if (next && currentPartDuration && currentEnd) {
		setPlannedStartedPlayback(next, currentEnd - (nextTimings?.fromPartRemaining ?? 0))
	} else if (next) {
		setPlannedStartedPlayback(next, undefined)
	}
}

// Replaying a script

/** A show replayed up to an instant */
class ReplayedShow {
	readonly state: ShowState
	readonly settings: PlayoutSettings
	readonly trace: TraceRecorder
	readonly #until: number
	/** The time of the last job run; undefined until the first job runs */
	#clock: number | undefined = undefined
	#stopped = false
	/**
	 * The time of the last job that changed what the publication reads, which is when it last calculated; undefined
	 * while no job has changed what the publication reads
	 */
	lastChangeAt: number | undefined = undefined

	constructor(options: PlayoutScriptOptions, until: number) {
		const gateway = options.gateway ?? GATEWAY_CONFIRMING_AT_ONCE
		const studio = studioSettings(options)
		this.settings = {
			studio,
			gateway,
			multiGatewayMode: !!studio.forceMultiGatewayMode,
			nowSafeLatency: studio.multiGatewayNowSafeLatency || 30,
		}
		this.state = initialState(options)
		this.#until = until
		this.trace = new TraceRecorder(new RundownKeys(options.rundown))

		this.trace.record('before any job', this.state)
	}

	get stopped(): boolean {
		return this.#stopped
	}

	/** Run a job at a clock time, unless it is after the instant the show is replayed to */
	runJob(at: number, action: string, body: (job: PlayoutJob) => void, allowZeroLength = false): boolean {
		if (this.#stopped || at > this.#until) {
			this.#stopped = true
			return false
		}
		if (this.#clock !== undefined && at < this.#clock) {
			throw new Error(
				`A job at ${formatClock(at)} would go back in time, after the job at ${formatClock(this.#clock)}`
			)
		}
		this.#clock = at

		const playedForNoTimeBefore = partInstancesPlayedForNoTime(this.state)
		const inputsBefore = structuredClone(this.publicationInputs())
		const job = new PlayoutJob(this.state, at, this.settings)
		body(job)
		job.save()

		if (!allowZeroLength) refuseNewZeroLengths(this.state, playedForNoTimeBefore, at)

		this.trace.record(`${formatClock(at)} ${action}`, this.state)
		// The publication calculates again only when something it reads changes: a job that writes only what it does
		// not read, such as the hold state, leaves the documents as they were calculated. Both sides are compared as
		// structured clones, since a strict comparison also compares prototypes, and in a test the documents are made
		// in another realm than the clones are
		if (!isDeepStrictEqual(structuredClone(this.publicationInputs()), inputsBefore)) this.lastChangeAt = at
		return true
	}

	/**
	 * What the publication holds: the playlist and segments through its field projections, and the parts and
	 * PartInstances through those of the UI publications, which change none of their values without a loop
	 */
	publicationInputs(): PublicationInputs {
		const state = this.state
		return {
			studioSettings: { _id: REFERENCE_STUDIO_ID, settings: this.settings.studio },
			playlist: project(state.playlist, rundownPlaylistFieldSpecifier),
			segments: orderedSegments(state).map((segment) => project(segment, segmentFieldSpecifier)),
			parts: orderedParts(state).map((part) => project(part, partsUIPartFields)),
			partInstances: visiblePartInstances(state).map((partInstance) =>
				project(partInstance, partInstancesUIPartInstanceFields)
			),
		}
	}
}

function partInstancesPlayedForNoTime(state: ShowState): Set<PartInstanceId> {
	return new Set(
		visiblePartInstances(state)
			.filter((partInstance) => partInstance.timings?.duration === 0)
			.map((partInstance) => partInstance._id)
	)
}

/** A played length of zero reads as a part that has not finished, so a step that makes one has to say so */
function refuseNewZeroLengths(state: ShowState, playedForNoTimeBefore: Set<PartInstanceId>, at: number): void {
	for (const partInstanceId of partInstancesPlayedForNoTime(state)) {
		if (playedForNoTimeBefore.has(partInstanceId)) continue
		throw new Error(
			`At ${formatClock(at)}, PartInstance "${partInstanceId}" has played for no time at all; ` +
				'allow it on the step if this is intended'
		)
	}
}

/** The PartInstances the publication reads: those of the current activation that are not reset */
function visiblePartInstances(state: ShowState): DBPartInstance[] {
	const activationId = state.playlist.activationId
	if (!activationId) return []
	return state.partInstances.filter(
		(partInstance) => partInstance.playlistActivationId === activationId && !partInstance.reset
	)
}

function replay(options: PlayoutScriptOptions, steps: readonly ScriptStep[], until: number): ReplayedShow {
	const show = new ReplayedShow(options, until)
	for (const step of steps) {
		runStep(show, step)
		if (show.stopped) break
	}
	return show
}

function runStep(show: ReplayedShow, { at, action }: ScriptStep): void {
	switch (action.kind) {
		case 'activate':
			show.runJob(at, `activate ${action.rehearsal ? 'in rehearsal' : 'on air'}`, (job) =>
				activateRundownPlaylist(job, action.rehearsal, false)
			)
			break
		case 'deactivate':
			show.runJob(at, 'deactivate', (job) => deactivateRundownPlaylist(job))
			break
		case 'reset':
			show.runJob(
				at,
				action.thenActivate === undefined ? 'reset' : `reset and activate ${action.thenActivate}`,
				(job) => resetRundownPlaylistJob(job, action.thenActivate)
			)
			break
		case 'set next':
			show.runJob(
				at,
				action.from === undefined
					? `set next ${action.part}`
					: `set next ${action.part} from ${formatLength(action.from)}`,
				(job) => setNextPartJob(job, action.part, action.from)
			)
			break
		case 'take': {
			const before = show.state.playlist.currentPartInfo?.partInstanceId
			const ran = show.runJob(at, 'take', (job) => takeJob(job), action.allowZeroLength)
			// The take that completes a hold changes no part, so there is nothing for the gateway to report
			if (!ran || show.state.playlist.currentPartInfo?.partInstanceId === before) break

			reportTake(show, at, action.allowZeroLength)
			break
		}
		case 'confirm start': {
			const gateway = show.settings.gateway
			if (gateway.kind !== 'single gateway' || gateway.confirmsAfterMs !== 'never') {
				throw new Error('Only a gateway that never confirms a start by itself needs the script to confirm it')
			}
			const playlist = show.state.playlist
			if (!playlist.currentPartInfo) throw new Error('There is no taken part to report as started')
			reportPlayback(
				show,
				at,
				{ stopped: playlist.previousPartsInfo[0], started: playlist.currentPartInfo },
				'take',
				action.allowZeroLength
			)
			break
		}
		case 'auto-next': {
			if (show.settings.gateway.kind === 'no gateway') {
				throw new Error('Without a gateway nothing reports that the next part started')
			}
			const playlist = show.state.playlist
			if (!playlist.nextPartInfo) throw new Error('There is no next part to report as started')
			// The next part's callback object takes over the on-air part's layer when the next part's group starts, so
			// the on-air part is reported stopped in the same batch
			reportPlayback(
				show,
				at,
				{ stopped: playlist.currentPartInfo ?? undefined, started: playlist.nextPartInfo },
				'auto-next',
				action.allowZeroLength
			)
			break
		}
		case 'start a hold':
			show.runJob(at, 'start a hold', (job) => startHoldJob(job))
			break
		case 'cancel the hold':
			show.runJob(at, 'cancel the hold', (job) => cancelHoldJob(job))
			break
		default:
			throw new Error(`Unknown step ${JSON.stringify(action)}`)
	}
}

/**
 * The gateway reports what a take changed, as the gateway mode says. A gateway reports a part as stopped when the
 * part's callback object leaves the state it resolves from the timeline, and after a take the previous part's group
 * is built without that object, so the stop is reported as soon as the gateway resolves the new timeline.
 */
function reportTake(show: ReplayedShow, takeTime: number, allowZeroLength: boolean): void {
	const gateway = show.settings.gateway
	switch (gateway.kind) {
		case 'no gateway':
			// The take has reported the start of the taken part and the stop of the previous one itself
			return
		case 'single gateway': {
			if (gateway.confirmsAfterMs === 'never') return
			// The new timeline starts the taken part when the gateway resolves it, so the stop of the previous part and
			// the start of the taken part come in one batch
			const playlist = show.state.playlist
			if (!playlist.currentPartInfo) throw new Error('There is no taken part to report as started')
			reportPlayback(
				show,
				takeTime + gateway.confirmsAfterMs,
				{ stopped: playlist.previousPartsInfo[0], started: playlist.currentPartInfo },
				'take',
				allowZeroLength
			)
			return
		}
		case 'multi gateway': {
			// The new timeline starts the taken part at a fixed time, latencyMs after the take. The gateway resolves the
			// timeline as soon as it gets it, right after the take, and reports the previous part stopped then; it
			// reports the taken part started when its part group starts
			const atTake = show.state.playlist
			const taken = atTake.currentPartInfo
			if (!taken) throw new Error('There is no taken part to report as started')
			const previous = atTake.previousPartsInfo[0]
			const takenStart = show.state.partInstances.find(
				(partInstance) => partInstance._id === taken.partInstanceId
			)?.timings?.plannedStartedPlayback
			if (takenStart !== undefined && takenStart <= takeTime) {
				// Played from a point inside it: its part group started before the take, so the gateway reports its
				// start in the same batch as the stop of the previous part
				reportPlayback(show, takeTime, { stopped: previous, started: taken }, 'take', allowZeroLength)
				return
			}
			if (previous) {
				reportPlayback(show, takeTime, { stopped: previous, started: undefined }, 'take', allowZeroLength)
			}
			reportPlayback(
				show,
				takeTime + gateway.latencyMs,
				{ stopped: undefined, started: taken },
				'take',
				allowZeroLength
			)
			return
		}
		default:
			throw new Error(`Unknown gateway ${JSON.stringify(gateway)}`)
	}
}

/**
 * The gateway reports, in one batch, a part as stopped and a part as started, each undefined when the batch has none:
 * every stop before every start, as the playout gateway sends them. The stop is reported at the report's time; the
 * start at the part's planned start when core has set one (its part group starts there on the timeline), otherwise
 * at the report's time.
 */
function reportPlayback(
	show: ReplayedShow,
	at: number,
	batch: { stopped: SelectedPartInstance | undefined; started: SelectedPartInstance | undefined },
	cause: 'take' | 'auto-next',
	allowZeroLength: boolean
): void {
	if (!batch.stopped && !batch.started) throw new Error('A gateway report has a stop, a start, or both')

	const labels = show.trace.labels
	const labelOf = (selected: SelectedPartInstance) => labels.partInstance(unprotectString(selected.partInstanceId))
	// The header names the started part first
	const reported: string[] = []
	if (batch.started) reported.push(`${labelOf(batch.started)} started`)
	if (batch.stopped) reported.push(`${labelOf(batch.stopped)} stopped`)
	const reportText = `gateway reports ${reported.join(' and ')}`

	const changes: PlaybackChange[] = []
	if (batch.stopped) changes.push({ type: 'stopped', partInstanceId: batch.stopped.partInstanceId, time: at })
	if (batch.started) {
		const startedId = batch.started.partInstanceId
		const startedPartInstance = show.state.partInstances.find((partInstance) => partInstance._id === startedId)
		const startTime = startedPartInstance?.timings?.plannedStartedPlayback ?? at
		changes.push({ type: 'started', partInstanceId: startedId, time: startTime })
	}

	show.runJob(
		at,
		cause === 'auto-next' ? `auto-next: ${reportText}` : reportText,
		(job) => playbackChangedJob(job, changes),
		allowZeroLength
	)
}

// The trace: what playout wrote, after each job, in the text of the job worker's timing inputs test. That test has its
// own printer of the same text; neither imports the other's

const KEY_WIDTH = 11

function formatLine(key: string, value: string): string {
	return `  ${key.padEnd(KEY_WIDTH)} ${value}`
}
function formatContinuationLine(value: string): string {
	return `  ${''.padEnd(KEY_WIDTH)} ${value}`
}

function clockOrNone(time: number | null | undefined): string {
	return time === undefined || time === null ? 'none' : formatClock(time)
}
function lengthOrNone(duration: number | null | undefined): string {
	return duration === undefined || duration === null ? 'none' : formatLength(duration)
}

/** The keys of the rundown a script plays: its id, and the ids of its segments and parts, which are their keys */
class RundownKeys {
	readonly rundownId: RundownId
	readonly #segmentKeys: readonly string[]
	readonly #partKeys: ReadonlySet<string>

	constructor(rundown: ReferenceRundown) {
		if (rundown.rundowns.length !== 1) throw new Error('The trace is of a playlist of one rundown')
		this.rundownId = rundown.rundowns[0]._id
		this.#segmentKeys = rundown.segments.map((segment) => unprotectString(segment._id))
		this.#partKeys = new Set(rundown.parts.map((part) => unprotectString(part._id)))
	}

	segmentIndex(segmentId: SegmentId): number {
		const index = this.#segmentKeys.indexOf(unprotectString(segmentId))
		if (index === -1) throw new Error(`Segment "${segmentId}" is not in the rundown`)
		return index
	}

	hasPart(partKey: string): boolean {
		return this.#partKeys.has(partKey)
	}

	/** Compare PartInstances by take count, then by where they are in the rundown */
	compareByTakeCount = (a: DBPartInstance, b: DBPartInstance): number => {
		return (
			a.takeCount - b.takeCount ||
			this.segmentIndex(a.segmentId) - this.segmentIndex(b.segmentId) ||
			a.part._rank - b.part._rank
		)
	}

	/** Compare PartInstances by where they are in the rundown, then by take count */
	compareInRundownOrder = (a: DBPartInstance, b: DBPartInstance): number => {
		return (
			this.segmentIndex(a.segmentId) - this.segmentIndex(b.segmentId) ||
			a.part._rank - b.part._rank ||
			a.takeCount - b.takeCount
		)
	}
}

/** Count one more for the key, and return the new count */
function countOneMore(counts: Map<string, number>, key: string): number {
	const count = (counts.get(key) ?? 0) + 1
	counts.set(key, count)
	return count
}

interface SegmentPlayoutLabel {
	label: string
	segmentIndex: number
	pass: number
}

/**
 * Generated ids get stable labels, numbered in order of appearance:
 * - activations: activation#1, activation#2, ...
 * - PartInstances: the part's key and a count per part: A1#1, A1#2
 * - segment playouts: the segment's key and a count per segment: A#1, A#2
 */
class TraceLabels {
	readonly keys: RundownKeys
	readonly #activations = new Map<string, string>()
	readonly #partInstances = new Map<string, string>()
	readonly #segmentPlayouts = new Map<string, SegmentPlayoutLabel>()
	readonly #instanceCountPerPart = new Map<string, number>()
	readonly #playoutCountPerSegment = new Map<string, number>()

	constructor(keys: RundownKeys) {
		this.keys = keys
	}

	/** Give labels to the ids that appear for the first time in this state */
	learn(state: ShowState): void {
		const activationId = state.playlist.activationId
		if (activationId && !this.#activations.has(unprotectString(activationId))) {
			this.#activations.set(unprotectString(activationId), `activation#${this.#activations.size + 1}`)
		}

		const newPartInstances = state.partInstances
			.filter((partInstance) => !this.#partInstances.has(unprotectString(partInstance._id)))
			.sort(this.keys.compareByTakeCount)
		for (let i = 1; i < newPartInstances.length; i++) {
			if (this.keys.compareByTakeCount(newPartInstances[i - 1], newPartInstances[i]) === 0) {
				throw new Error(
					'Two new PartInstances have the same take count and place, so their labels are ambiguous'
				)
			}
		}

		for (const partInstance of newPartInstances) {
			const partKey = unprotectString(partInstance.part._id)
			if (!this.keys.hasPart(partKey)) throw new Error(`Part "${partKey}" is not in the rundown`)
			const instanceNumber = countOneMore(this.#instanceCountPerPart, partKey)
			this.#partInstances.set(unprotectString(partInstance._id), `${partKey}#${instanceNumber}`)

			const segmentPlayoutId = unprotectString(partInstance.segmentPlayoutId)
			if (!this.#segmentPlayouts.has(segmentPlayoutId)) {
				const segmentKey = unprotectString(partInstance.segmentId)
				const pass = countOneMore(this.#playoutCountPerSegment, segmentKey)
				this.#segmentPlayouts.set(segmentPlayoutId, {
					label: `${segmentKey}#${pass}`,
					segmentIndex: this.keys.segmentIndex(partInstance.segmentId),
					pass,
				})
			}
		}
	}

	activation(id: RundownPlaylistActivationId): string {
		return this.#get(this.#activations, unprotectString(id))
	}
	partInstance(id: string): string {
		return this.#get(this.#partInstances, id)
	}
	segmentPlayout(id: string): SegmentPlayoutLabel {
		const segmentPlayout = this.#segmentPlayouts.get(id)
		if (!segmentPlayout) throw new Error(`Segment playout "${id}" has no label`)
		return segmentPlayout
	}

	#get(labels: Map<string, string>, id: string): string {
		const label = labels.get(id)
		if (!label) throw new Error(`"${id}" has no label`)
		return label
	}
}

/** One keyed item of the trace. The first line follows the key, the others are continuation lines */
interface TraceEntry {
	key: string
	lines: string[]
	/** Set for the entry of a PartInstance */
	partInstanceId?: string
}

function singleLineEntry(key: string, value: string): TraceEntry {
	return { key, lines: [value] }
}

/**
 * What the first block of a trace is compared with: a playlist with nothing set, and no PartInstances. So the first
 * block prints only the lines that differ from these
 */
const EMPTY_PLAYLIST_ENTRIES: readonly TraceEntry[] = [
	singleLineEntry('activation', 'none'),
	singleLineEntry('rehearsal', 'no'),
	singleLineEntry('started', 'none'),
	singleLineEntry('segments', 'none'),
	singleLineEntry('previous', 'none'),
	singleLineEntry('current', 'none'),
	singleLineEntry('next', 'none'),
	singleLineEntry('next offset', 'none'),
	singleLineEntry('hold', 'none'),
	singleLineEntry('timing', 'none'),
]

function describeSelectedPartInstance(selected: SelectedPartInstance | null | undefined, labels: TraceLabels): string {
	if (!selected) return 'none'
	if (selected.rundownId !== labels.keys.rundownId) throw new Error(`Unexpected rundown "${selected.rundownId}"`)

	const fields = [labels.partInstance(unprotectString(selected.partInstanceId))]
	if (selected.manuallySelected) fields.push('manual')
	if (selected.consumesQueuedSegmentId) fields.push('consumes queued segment')
	return fields.join('  ')
}

/** The previous parts, most recent first */
function describePreviousPartInstances(previous: readonly SelectedPartInstance[], labels: TraceLabels): string {
	if (previous.length === 0) return 'none'
	return previous.map((selected) => describeSelectedPartInstance(selected, labels)).join(', ')
}

function describeSegmentStarts(starts: Record<string, number> | undefined, labels: TraceLabels): string {
	const entries = Object.entries<number>(starts ?? {}).map(([segmentPlayoutId, time]) => ({
		segmentPlayout: labels.segmentPlayout(segmentPlayoutId),
		time,
	}))
	if (entries.length === 0) return 'none'

	entries.sort(
		(a, b) =>
			a.segmentPlayout.segmentIndex - b.segmentPlayout.segmentIndex ||
			a.segmentPlayout.pass - b.segmentPlayout.pass
	)
	return entries.map((entry) => `${entry.segmentPlayout.label} ${formatClock(entry.time)}`).join('  ')
}

function describeHold(holdState: RundownHoldState | undefined): string {
	switch (holdState) {
		case undefined:
		case RundownHoldState.NONE:
			return 'none'
		case RundownHoldState.PENDING:
			return 'pending'
		case RundownHoldState.ACTIVE:
			return 'active'
		case RundownHoldState.COMPLETE:
			return 'complete'
		default:
			throw new Error(`Unknown hold state ${holdState}`)
	}
}

function describeTiming(timing: RundownPlaylistTiming): string {
	const fields: string[] = [timing.type]
	if ('expectedStart' in timing && timing.expectedStart !== undefined) {
		fields.push(`start ${formatClock(timing.expectedStart)}`)
	}
	if (timing.expectedDuration !== undefined) fields.push(`duration ${formatLength(timing.expectedDuration)}`)
	if ('expectedEnd' in timing && timing.expectedEnd !== undefined) {
		fields.push(`end ${formatClock(timing.expectedEnd)}`)
	}
	return fields.join('  ')
}

function playlistEntries(playlist: DBRundownPlaylist, labels: TraceLabels): TraceEntry[] {
	// The publication reads the loop too; the trace has no line for it, as no step sets one
	if (playlist.quickLoop !== undefined) throw new Error('The trace has no line for a loop')

	return [
		singleLineEntry('activation', playlist.activationId ? labels.activation(playlist.activationId) : 'none'),
		singleLineEntry('rehearsal', playlist.rehearsal ? 'yes' : 'no'),
		singleLineEntry('started', clockOrNone(playlist.startedPlayback)),
		singleLineEntry('segments', describeSegmentStarts(playlist.segmentsStartedPlayback, labels)),
		singleLineEntry('previous', describePreviousPartInstances(playlist.previousPartsInfo, labels)),
		singleLineEntry('current', describeSelectedPartInstance(playlist.currentPartInfo, labels)),
		singleLineEntry('next', describeSelectedPartInstance(playlist.nextPartInfo, labels)),
		singleLineEntry('next offset', lengthOrNone(playlist.nextTimeOffset)),
		singleLineEntry('hold', describeHold(playlist.holdState)),
		singleLineEntry('timing', describeTiming(playlist.timing)),
	]
}

/** A PartInstance holds a copy of its part, so the trace prints only the part's key, and checks the copy */
function describePart(partInstance: DBPartInstance, state: ShowState): string {
	const rundownPart = state.parts.find((part) => part._id === partInstance.part._id)
	if (!rundownPart) throw new Error(`Part "${partInstance.part._id}" is not in the rundown`)
	if (canonical(partInstance.part) !== canonical(rundownPart)) {
		throw new Error(`PartInstance "${partInstance._id}" holds a part that differs from part "${rundownPart._id}"`)
	}
	return unprotectString(rundownPart._id)
}

function describeTimings(timings: PartInstanceTimings | undefined): string {
	const fields: string[] = []
	const addClock = (name: string, time: number | undefined) => {
		if (time !== undefined) fields.push(`${name} ${formatClock(time)}`)
	}
	const addLength = (name: string, duration: number | undefined) => {
		if (duration !== undefined) fields.push(`${name} ${formatLength(duration)}`)
	}

	addClock('setAsNext', timings?.setAsNext)
	addClock('take', timings?.take)
	addLength('playOffset', timings?.playOffset)
	addClock('plannedStart', timings?.plannedStartedPlayback)
	addClock('reportedStart', timings?.reportedStartedPlayback)
	addClock('plannedStop', timings?.plannedStoppedPlayback)
	addClock('reportedStop', timings?.reportedStoppedPlayback)
	addLength('duration', timings?.duration)

	return fields.length === 0 ? 'no timings' : fields.join('  ')
}

/** The playout timings of a part without pieces or transitions: they change no length the publication reads */
const INERT_PART_PLAYOUT_TIMINGS: PartCalculatedTimings = {
	inTransitionStart: null,
	toPartDelay: 0,
	toPartPostroll: 0,
	fromPartRemaining: 0,
	fromPartPostroll: 0,
	fromPartKeepalive: 0,
}

/** The trace leaves out a PartInstance's playout timings, so it refuses any that would change a length */
function refuseLivePartPlayoutTimings(partInstance: DBPartInstance): void {
	if (partInstance.partPlayoutTimings === undefined) return
	if (!isDeepStrictEqual(partInstance.partPlayoutTimings, INERT_PART_PLAYOUT_TIMINGS)) {
		throw new Error(
			`The trace has no line for the playout timings of PartInstance "${partInstance._id}": ` +
				JSON.stringify(partInstance.partPlayoutTimings)
		)
	}
}

/** The PartInstances the publication sees, in rundown order */
function partInstanceEntries(state: ShowState, labels: TraceLabels): TraceEntry[] {
	return visiblePartInstances(state)
		.sort(labels.keys.compareInRundownOrder)
		.map((partInstance) => {
			refuseLivePartPlayoutTimings(partInstance)
			const fields = [
				`part ${describePart(partInstance, state)}`,
				`playout ${labels.segmentPlayout(unprotectString(partInstance.segmentPlayoutId)).label}`,
				`takeCount ${partInstance.takeCount}`,
			]
			if (partInstance.isTaken) fields.push('taken')
			if (partInstance.orphaned) fields.push(`orphaned ${partInstance.orphaned}`)

			return {
				key: labels.partInstance(unprotectString(partInstance._id)),
				lines: [fields.join('  '), describeTimings(partInstance.timings)],
				partInstanceId: unprotectString(partInstance._id),
			}
		})
}

/** Why a PartInstance the publication saw after the previous job is no longer seen */
function whyGone(partInstanceId: string, state: ShowState): string {
	const partInstance = state.partInstances.find((candidate) => unprotectString(candidate._id) === partInstanceId)
	if (!partInstance) return 'deleted'
	if (partInstance.reset) return 'reset'
	if (!state.playlist.activationId) return 'inactive'
	return 'other activation'
}

/** The trace of one show: a block per job, listing what changed */
class TraceRecorder {
	readonly labels: TraceLabels
	readonly #blocks: string[] = []
	#previousEntries: readonly TraceEntry[] = EMPTY_PLAYLIST_ENTRIES

	constructor(keys: RundownKeys) {
		this.labels = new TraceLabels(keys)
	}

	get text(): string {
		return this.#blocks.join('\n')
	}

	record(header: string, state: ShowState): void {
		this.labels.learn(state)

		const entries = [...playlistEntries(state.playlist, this.labels), ...partInstanceEntries(state, this.labels)]
		const previousByKey = new Map(this.#previousEntries.map((entry) => [entry.key, entry]))
		const currentKeys = new Set(entries.map((entry) => entry.key))

		const lines = [header]
		for (const entry of entries) {
			const previous = previousByKey.get(entry.key)
			if (previous && previous.lines.join('\n') === entry.lines.join('\n')) continue

			const [firstLine, ...continuationLines] = entry.lines
			lines.push(formatLine(entry.key, firstLine), ...continuationLines.map(formatContinuationLine))
		}
		for (const previous of this.#previousEntries) {
			if (currentKeys.has(previous.key) || !previous.partInstanceId) continue
			lines.push(formatLine(previous.key, `gone (${whyGone(previous.partInstanceId, state)})`))
		}
		if (lines.length === 1) lines.push('  no change')

		this.#blocks.push(lines.join('\n'))
		this.#previousEntries = entries
	}
}

// What the publication holds

/**
 * While the playlist is active, the publication waits until it has the on-air and next PartInstances the playlist
 * names, and keeps its documents until then. A script that leaves the playlist naming one it cannot see is refused
 */
function refuseInconsistentInputs(inputs: PublicationInputs): void {
	const playlist = inputs.playlist
	if (!playlist.activationId) return
	for (const selected of [playlist.currentPartInfo, playlist.nextPartInfo]) {
		if (!selected) continue
		if (!inputs.partInstances.some((partInstance) => partInstance._id === selected.partInstanceId)) {
			throw new Error(
				`The playlist names PartInstance "${selected.partInstanceId}", which the publication cannot see`
			)
		}
	}
}

/** The publication's cache, with the given playlist timing */
function buildContentCache(inputs: PublicationInputs, timing: RundownPlaylistTiming): ContentCache {
	const cache = createReactiveContentCache()
	cache.StudioSettings.insert(inputs.studioSettings)
	cache.RundownPlaylists.insert({ ...inputs.playlist, timing })
	for (const segment of inputs.segments) cache.Segments.insert(segment)
	for (const part of inputs.parts) cache.Parts.insert(part)
	for (const partInstance of inputs.partInstances) cache.PartInstances.insert(partInstance)
	return cache
}
