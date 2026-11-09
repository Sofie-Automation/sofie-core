import type { RundownPlaylistTiming } from '@sofie-automation/blueprints-integration'
import type { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import type { TimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { type MongoFieldSpecifier, mongoProjectDocument } from '@sofie-automation/corelib/dist/mongo'
import type { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import {
	clock,
	formatClock,
	length,
	type PartKey,
	REFERENCE_PLAYLIST_ID,
	type ReferenceRundown,
	TIMING_MODES,
	type TimingModeName,
} from '@sofie-automation/corelib/dist/testing/referenceRundown'
import { isDeepStrictEqual } from 'util'
// The job worker's real playout jobs, driven through its MockJobContext. They are imported from the job worker's
// source, which the jest config maps the job worker's package to as well, so that there is one copy of each module
import type { MockJobContext } from '../../../../../../../job-worker/src/__mocks__/context'
import {
	type ReferenceShow,
	type ReferenceShowGateway,
	startReferenceShow,
} from '../../../../../../../job-worker/src/__mocks__/referenceShow'
import { useRealCurrentTime } from '../../../../../../../job-worker/src/__mocks__/time'
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
import { renderTimingText, type TimingCalculation, type TimingText, type TimingTextView } from './renderTimingText'

/**
 * A playout script for the timing tests. A script lists what the operator does and what the playout gateway reports,
 * each at a clock time. It is played by the job worker's real playout jobs, through the job worker's MockJobContext
 * and the show driver its own timing inputs test plays with (job-worker/src/__mocks__/referenceShow.ts). A read gives
 * the playlist timing publication's documents, rendered as text, as a client holding them sees them at an instant.
 *
 *   const show = playoutScript({ rundown: referenceRundown(), timing })
 *     .activate('11:59:00')
 *     .take('12:00:05')
 *   await show.readAt('12:00:10')    // the published documents, as text
 *
 * A script is immutable: each step returns a new script, so a base script can be shared. A script is played once, to
 * its last step, the first time it is read; after each job, it keeps what the publication would hold then. A read at
 * an instant uses what the publication held after the last job at or before the instant.
 *
 * Blueprints do nothing and the parts have no pieces. The rundown is usually the reference rundown, but can be any
 * rundown of the same form: one rundown in the reference playlist, with the plain keys as ids.
 *
 * What the publication holds is the playlist and segments through its field projections, and the parts and
 * PartInstances as the UI publications give them: only the PartInstances of the current activation that are not
 * reset, and none while the playlist is inactive. Without a loop, the UI publications change no value the timing
 * publication reads. The documents are calculated at the last job at or before the instant that changed anything the
 * publication reads, which is when the publication last calculated them, and read at the instant. A calculation at
 * the instant is made as well, and the text shows any value that reads differently.
 */

// The script

/** The playout gateway, which reports to core when parts start and stop playing */
export type Gateway = ReferenceShowGateway

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
	 * When the publication last calculated the documents, if later than the last job that changed anything it reads,
	 * and not after the instant. Before any job has, any time up to the instant
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
	#played: Promise<PlayedShow> | undefined

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

	/** The show played by the real jobs, to its last step; played the first time it is asked for */
	async played(): Promise<PlayedShow> {
		this.#played ??= oneAtATime(async () => play(this.#options, this.#steps))
		return this.#played
	}

	/** The publication's documents as a client holding them reads them at the instant */
	async readAt(instant: string, options?: ReadOptions): Promise<TimingText> {
		return (await this.played()).readAt(instant, options)
	}

	/** What the publication holds at the instant */
	async inputsAt(instant: string): Promise<PublicationInputs> {
		return (await this.played()).inputsAt(instant)
	}

	/** The labels of the PartInstances the publication holds at the instant, in its order: 'A1#1', 'A1#2' */
	async partInstanceLabelsAt(instant: string): Promise<string[]> {
		return (await this.played()).partInstanceLabelsAt(instant)
	}

	/**
	 * When the publication last calculated its documents, as of the instant: at the last job at or before the instant
	 * that changed what it reads; undefined while no job has
	 */
	async lastCalculationAt(instant: string): Promise<number | undefined> {
		return (await this.played()).lastChangeAt(clock(instant))
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

// Playing a script

/** What the publication holds after a job */
interface Moment {
	/** When the job ran; minus infinity for the state after setup, before any job */
	at: number
	inputs: PublicationInputs
	/** Whether the job changed anything the publication reads */
	changed: boolean
}

/** A show played to the last step of its script */
export class PlayedShow {
	readonly #rundown: ReferenceRundown
	readonly #moments: readonly Moment[]
	readonly #labels: ReadonlyMap<PartInstanceId, string>

	constructor(rundown: ReferenceRundown, moments: readonly Moment[], labels: ReadonlyMap<PartInstanceId, string>) {
		this.#rundown = rundown
		this.#moments = moments
		this.#labels = labels
	}

	/** What the publication holds after the last job at or before the instant */
	#momentAt(instant: number): Moment {
		let found = this.#moments[0]
		for (const moment of this.#moments) {
			if (moment.at > instant) break
			found = moment
		}
		return found
	}

	inputsAt(instant: string): PublicationInputs {
		return structuredClone(this.#momentAt(clock(instant)).inputs)
	}

	partInstanceLabelsAt(instant: string): string[] {
		return this.#momentAt(clock(instant)).inputs.partInstances.map((partInstance) => this.label(partInstance._id))
	}

	/** The label of a PartInstance: its part's key, and a count of the PartInstances of that part: 'A1#2' */
	label(partInstanceId: PartInstanceId): string {
		const label = this.#labels.get(partInstanceId)
		if (!label) throw new Error(`PartInstance "${partInstanceId}" was never written by the show`)
		return label
	}

	/** The time of the last job at or before the instant that changed what the publication reads */
	lastChangeAt(instant: number): number | undefined {
		let lastChange: number | undefined
		for (const moment of this.#moments) {
			if (moment.at > instant) break
			if (moment.changed) lastChange = moment.at
		}
		return lastChange
	}

	readAt(instant: string, options?: ReadOptions): TimingText {
		const instantTime = clock(instant)

		// Until a job changes what the publication reads, it can have calculated at any time up to the instant
		const lastChange = this.lastChangeAt(instantTime)
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

		const inputs = this.#momentAt(instantTime).inputs
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
				parts: this.#rundown.parts,
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
}

/**
 * The job worker's clock is one for every show, so shows are played one at a time, even when a test reads two at
 * once
 */
let playing: Promise<unknown> = Promise.resolve()
async function oneAtATime<T>(fn: () => Promise<T>): Promise<T> {
	const run = playing.then(fn)
	playing = run.catch(() => undefined)
	return run
}

async function play(options: PlayoutScriptOptions, steps: readonly ScriptStep[]): Promise<PlayedShow> {
	const moments: Moment[] = []
	const labels = new Map<PartInstanceId, string>()
	const instancesPerPart = new Map<string, number>()
	/** Whether the step being played allows a part to end at the time it started */
	let allowZeroLength = false

	const record = async (at: number, context: MockJobContext) => {
		const allPartInstances = await context.mockCollections.PartInstances.findFetch({})
		for (const partInstance of allPartInstances) {
			if (labels.has(partInstance._id)) continue
			const partKey = String(partInstance.part._id)
			const count = (instancesPerPart.get(partKey) ?? 0) + 1
			instancesPerPart.set(partKey, count)
			labels.set(partInstance._id, `${partKey}#${count}`)
		}

		const inputs = structuredClone(await readPublicationInputs(context, allPartInstances))
		const previous = moments.at(-1)
		if (previous && !allowZeroLength) refuseNewZeroLengths(previous.inputs, inputs, at, labels)
		// The publication calculates again only when something it reads changes: a job that writes only what it does
		// not read, such as the hold state, leaves the documents as they were calculated
		const changed = previous !== undefined && !isDeepStrictEqual(previous.inputs, inputs)
		moments.push({ at, inputs, changed })
	}

	try {
		const show = await startReferenceShow({
			rundown: options.rundown,
			timing: options.timing,
			gateway: options.gateway ?? GATEWAY_CONFIRMING_AT_ONCE,
			studio: options.studio,
			// Set up no later than the first step, which can be at any time
			setupAt: Math.min(clock('11:50:00'), steps[0]?.at ?? Infinity),
			onJob: async (at, _job, context) => record(at, context),
		})
		await record(-Infinity, show.context)

		for (const step of steps) {
			allowZeroLength = 'allowZeroLength' in step.action && step.action.allowZeroLength
			await playStep(show, step)
		}
	} finally {
		useRealCurrentTime()
	}

	return new PlayedShow(options.rundown, moments, labels)
}

async function playStep(show: ReferenceShow, { at, action }: ScriptStep): Promise<void> {
	switch (action.kind) {
		case 'activate':
			return show.activate(at, { rehearsal: action.rehearsal })
		case 'deactivate':
			return show.deactivate(at)
		case 'reset':
			return show.reset(at, { thenActivate: action.thenActivate })
		case 'set next':
			return show.setNext(at, action.part, { from: action.from })
		case 'take':
			return show.take(at)
		case 'confirm start':
			return show.confirmStart(at)
		case 'auto-next':
			return show.autoNext(at)
		case 'start a hold':
			return show.startHold(at)
		case 'cancel the hold':
			return show.cancelHold(at)
		default:
			throw new Error(`Unknown step ${JSON.stringify(action)}`)
	}
}

// What the publication holds

/**
 * What the publication holds: the playlist and segments through its field projections, and the parts and
 * PartInstances through those of the UI publications, which change none of their values without a loop
 */
async function readPublicationInputs(
	context: MockJobContext,
	allPartInstances: DBPartInstance[]
): Promise<PublicationInputs> {
	const playlist = await context.mockCollections.RundownPlaylists.findOne(REFERENCE_PLAYLIST_ID)
	if (!playlist) throw new Error('The reference playlist is missing')

	const segments = orderedSegments(playlist, await context.mockCollections.Segments.findFetch({}))
	const parts = orderedParts(segments, await context.mockCollections.Parts.findFetch({}))

	// Only the PartInstances of the current activation that are not reset, and none while the playlist is inactive
	const activationId = playlist.activationId
	const partInstances = activationId
		? allPartInstances.filter(
				(partInstance) => partInstance.playlistActivationId === activationId && !partInstance.reset
			)
		: []

	return {
		studioSettings: { _id: playlist.studioId, settings: context.studio.settings as IStudioSettings },
		playlist: project(playlist, rundownPlaylistFieldSpecifier),
		segments: segments.map((segment) => project(segment, segmentFieldSpecifier)),
		parts: parts.map((part) => project(part, partsUIPartFields)),
		partInstances: partInstances.map((partInstance) => project(partInstance, partInstancesUIPartInstanceFields)),
	}
}

function orderedSegments(playlist: DBRundownPlaylist, segments: DBSegment[]): DBSegment[] {
	return playlist.rundownIdsInOrder.flatMap((rundownId) =>
		segments.filter((segment) => segment.rundownId === rundownId).sort((a, b) => a._rank - b._rank)
	)
}

function orderedParts(segments: DBSegment[], parts: DBPart[]): DBPart[] {
	return segments.flatMap((segment) =>
		parts.filter((part) => part.segmentId === segment._id).sort((a, b) => a._rank - b._rank)
	)
}

/** A copy of a document with only the fields of a projection, as a Mongo query with that projection returns it */
function project<T extends { _id: ProtectedString<any> }>(doc: T, projection: object): T {
	return mongoProjectDocument(doc, projection as MongoFieldSpecifier<T>)
}

/** A played length of zero reads as a part that has not finished, so a step that makes one has to say so */
function refuseNewZeroLengths(
	before: PublicationInputs,
	after: PublicationInputs,
	at: number,
	labels: ReadonlyMap<PartInstanceId, string>
): void {
	const playedForNoTime = (inputs: PublicationInputs) =>
		inputs.partInstances.filter((partInstance) => partInstance.timings?.duration === 0).map((p) => p._id)

	const playedForNoTimeBefore = new Set(playedForNoTime(before))
	for (const partInstanceId of playedForNoTime(after)) {
		if (playedForNoTimeBefore.has(partInstanceId)) continue
		throw new Error(
			`At ${formatClock(at)}, PartInstance ${labels.get(partInstanceId) ?? partInstanceId} has played for no ` +
				'time at all; allow it on the step if this is intended'
		)
	}
}

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
