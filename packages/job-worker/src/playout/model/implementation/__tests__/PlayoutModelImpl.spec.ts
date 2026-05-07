import {
	ForceQuickLoopAutoNext,
	JSONBlobStringify,
	PieceLifespan,
	StatusCode,
} from '@sofie-automation/blueprints-integration'
import { mock } from 'jest-mock-extended'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import {
	PartInstanceId,
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	PeripheralDevice,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { EmptyPieceTimelineObjectsBlob, Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	QuickLoopMarkerType,
	SelectedPartInstance,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PartCalculatedTimings } from '@sofie-automation/corelib/dist/playout/timings'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { MockJobContext, setupDefaultJobEnvironment } from '../../../../__mocks__/context.js'
import {
	defaultAdLibPiece,
	defaultPart,
	defaultPiece,
	defaultRundown,
	defaultRundownPlaylist,
	defaultSegment,
} from '../../../../__mocks__/defaultCollectionObjects.js'
import { setupMockShowStyleCompound } from '../../../../__mocks__/presetCollections.js'
import { ProcessedShowStyleCompound } from '../../../../jobs/index.js'
import { PlaylistLock } from '../../../../jobs/lock.js'
import { runWithPlaylistLock } from '../../../lock.js'
import { PlayoutModelImpl } from '../PlayoutModelImpl.js'
import { PlayoutRundownModelImpl } from '../PlayoutRundownModelImpl.js'
import { PlayoutSegmentModelImpl } from '../PlayoutSegmentModelImpl.js'
import _ from 'underscore'

const TIME_FAR_PAST = 1000
const TIME_CONNECTED = 2000
const TIME_PING = 3000

describe('PlayoutModelImpl', () => {
	// --- Shared setup for nowInPlayout tests ---
	let context: MockJobContext
	let showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>

	beforeAll(async () => {
		context = setupDefaultJobEnvironment()
		showStyleCompound = await setupMockShowStyleCompound(context)
	})

	// --- Helpers for cycleSelectedPartInstances / prunePreviousPartInstances tests ---
	const playlistId = protectString<RundownPlaylistId>('playlist0')
	const studioId = protectString('studio0')

	const DEFAULT_PART_TIMINGS: PartCalculatedTimings = {
		inTransitionStart: null,
		toPartDelay: 0,
		toPartPostroll: 0,
		fromPartRemaining: 500,
		fromPartPostroll: 0,
		fromPartKeepalive: 0,
	}

	function makePartInstance(
		id: string,
		opts?: {
			plannedStartedPlayback?: number
			partPlayoutTimings?: PartCalculatedTimings
		}
	): DBPartInstance {
		const { plannedStartedPlayback, partPlayoutTimings } = opts ?? {}
		return {
			_id: protectString<PartInstanceId>(id),
			rundownId: protectString('rd0'),
			segmentId: protectString('seg0'),
			playlistActivationId: protectString('act0'),
			segmentPlayoutId: protectString('segpayout0'),
			rehearsal: false,
			takeCount: 0,
			part: {
				_id: protectString(id + '_part'),
				_rank: 0,
				rundownId: protectString('rd0'),
				segmentId: protectString('seg0'),
				externalId: id,
				title: id,
				expectedDurationWithTransition: undefined,
			},
			...(plannedStartedPlayback !== undefined || partPlayoutTimings !== undefined
				? { timings: { setAsNext: 0, plannedStartedPlayback }, partPlayoutTimings }
				: {}),
		}
	}

	function makeSelectedPartInfo(partInstanceId: string): SelectedPartInstance {
		return {
			partInstanceId: protectString<PartInstanceId>(partInstanceId),
			rundownId: protectString('rd0'),
			manuallySelected: false,
			consumesQueuedSegmentId: false,
		}
	}

	function createModel(
		partInstances: DBPartInstance[],
		playlistOverrides?: {
			currentPartInfo?: SelectedPartInstance | null
			nextPartInfo?: SelectedPartInstance | null
			previousPartsInfo?: SelectedPartInstance[]
		}
	): PlayoutModelImpl {
		const modelContext = setupDefaultJobEnvironment()
		const playlist = {
			...defaultRundownPlaylist(playlistId, studioId),
			...(playlistOverrides ?? {}),
		}
		return new PlayoutModelImpl(
			modelContext,
			mock<PlaylistLock>(),
			playlistId,
			[],
			playlist,
			partInstances,
			new Map(),
			[],
			undefined
		)
	}

	// --- nowInPlayout ---

	describe('nowInPlayout', () => {
		beforeEach(async () => {
			jest.useFakeTimers()
		})

		afterEach(async () =>
			Promise.all([
				context.mockCollections.RundownBaselineAdLibPieces.remove({}),
				context.mockCollections.RundownBaselineAdLibActions.remove({}),
				context.mockCollections.RundownBaselineObjects.remove({}),
				context.mockCollections.AdLibActions.remove({}),
				context.mockCollections.AdLibPieces.remove({}),
				context.mockCollections.Pieces.remove({}),
				context.mockCollections.Parts.remove({}),
				context.mockCollections.Segments.remove({}),
				context.mockCollections.Rundowns.remove({}),
				context.mockCollections.RundownPlaylists.remove({}),
			])
		)

		it('returns the current time', async () => {
			const { playlistId: playlistId0, rundownId: rundownId0 } = await setupRundownWithAutoplayPart0(
				context,
				protectString('rundown00'),
				showStyleCompound
			)

			const playlist = await context.mockCollections.RundownPlaylists.findOne(playlistId0)

			const TIME_NOW = 5000

			const peripheralDevices = [setupMockPlayoutGateway(protectString('playoutGateway0'))]

			const { partInstances, groupedPieceInstances, rundowns } = await getPlayoutModelImplArugments(
				context,
				playlistId0,
				rundownId0
			)

			if (!playlist) throw new Error('Playlist not found!')

			jest.setSystemTime(TIME_NOW)

			await runWithPlaylistLock(context, playlistId0, async (lock) => {
				const model = new PlayoutModelImpl(
					context,
					lock,
					playlistId0,
					peripheralDevices,
					playlist,
					partInstances,
					groupedPieceInstances,
					rundowns,
					undefined
				)

				const now = model.getNowInPlayout()
				expect(now).toBeGreaterThanOrEqual(TIME_NOW)
				expect(now - TIME_NOW).toBeLessThan(100)
			})
		})

		it('never returns a smaller value', async () => {
			const { playlistId: playlistId0, rundownId: rundownId0 } = await setupRundownWithAutoplayPart0(
				context,
				protectString('rundown00'),
				showStyleCompound
			)

			const playlist = await context.mockCollections.RundownPlaylists.findOne(playlistId0)
			const TIME_NOW = 5000

			const peripheralDevices = [
				setupMockPlayoutGateway(protectString('playoutGateway0')),
				setupMockPlayoutGateway(protectString('playoutGateway1')),
			]

			const { partInstances, groupedPieceInstances, rundowns } = await getPlayoutModelImplArugments(
				context,
				playlistId0,
				rundownId0
			)

			if (!playlist) throw new Error('Playlist not found!')

			jest.setSystemTime(TIME_NOW)

			await runWithPlaylistLock(context, playlistId0, async (lock) => {
				const model = new PlayoutModelImpl(
					context,
					lock,
					playlistId0,
					peripheralDevices,
					playlist,
					partInstances,
					groupedPieceInstances,
					rundowns,
					undefined
				)

				const TIME_DELTA = 1000

				peripheralDevices[0].latencies = [20, 30, 50, 10]
				peripheralDevices[1].latencies = [20, 30, 50, 10]

				jest.advanceTimersByTime(TIME_DELTA)

				const now0 = model.getNowInPlayout()
				expect(now0).toBeGreaterThanOrEqual(TIME_NOW)

				peripheralDevices[0].latencies = [0]
				peripheralDevices[1].latencies = [0]

				const now1 = model.getNowInPlayout()
				expect(now1).toBeGreaterThanOrEqual(now0)

				jest.advanceTimersByTime(TIME_DELTA)

				const now2 = model.getNowInPlayout()
				expect(now2).toBeGreaterThanOrEqual(now1)

				peripheralDevices[0].latencies = [100, 200, 100, 50]
				peripheralDevices[1].latencies = [100, 200, 100, 50]

				const now3 = model.getNowInPlayout()
				expect(now3).toBeGreaterThanOrEqual(now2)
			})
		})
	})

	describe('quickLoop for locked playlist loops', () => {
		it('keeps the quickLoop locked state on activation/reset/deactivation', async () => {
			const rundownId = protectString('rundown01')
			const playlistId = await context.mockCollections.RundownPlaylists.insertOne({
				...defaultRundownPlaylist(protectString(`playlist_${rundownId}`), context.studioId),
				quickLoop: {
					start: { type: QuickLoopMarkerType.PLAYLIST },
					end: { type: QuickLoopMarkerType.PLAYLIST },
					locked: true,
					running: false,
					forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
				},
			})

			const playlist = await context.mockCollections.RundownPlaylists.findOne(playlistId)

			const rundown: DBRundown = defaultRundown(
				unprotectString(rundownId),
				context.studioId,
				null,
				playlistId,
				showStyleCompound._id,
				showStyleCompound.showStyleVariantId
			)
			rundown._id = rundownId
			await context.mockCollections.Rundowns.insertOne(rundown)

			const peripheralDevices = [setupMockPlayoutGateway(protectString('playoutGateway0'))]

			const { partInstances, groupedPieceInstances, rundowns } = await getPlayoutModelImplArugments(
				context,
				playlistId,
				rundownId
			)

			if (!playlist) throw new Error('Playlist not found!')

			await runWithPlaylistLock(context, playlistId, async (lock) => {
				const model = new PlayoutModelImpl(
					context,
					lock,
					playlistId,
					peripheralDevices,
					playlist,
					partInstances,
					groupedPieceInstances,
					rundowns,
					undefined
				)

				const activationId = model.activatePlaylist(false)
				expect(model.playlist.quickLoop?.locked).toBe(true)
				expect(model.playlist.quickLoop?.start?.type).toBe(QuickLoopMarkerType.PLAYLIST)
				expect(model.playlist.quickLoop?.end?.type).toBe(QuickLoopMarkerType.PLAYLIST)

				model.resetPlaylist(true)
				expect(model.playlist.quickLoop?.locked).toBe(true)
				expect(model.playlist.quickLoop?.start?.type).toBe(QuickLoopMarkerType.PLAYLIST)
				expect(model.playlist.quickLoop?.end?.type).toBe(QuickLoopMarkerType.PLAYLIST)

				model.deactivatePlaylist()
				expect(model.playlist.quickLoop?.locked).toBe(true)
				expect(model.playlist.quickLoop?.start?.type).toBe(QuickLoopMarkerType.PLAYLIST)
				expect(model.playlist.quickLoop?.end?.type).toBe(QuickLoopMarkerType.PLAYLIST)
				expect(model.playlist.activationId).not.toBe(activationId)
				expect(model.playlist.currentPartInfo).toBeNull()
			})
		})
	})

	// --- cycleSelectedPartInstances ---

	describe('cycleSelectedPartInstances', () => {
		it('moves currentPartInfo to front of previousPartsInfo and advances current/next', () => {
			const pi0Info = makeSelectedPartInfo('pi0')
			const pi1Info = makeSelectedPartInfo('pi1')
			const model = createModel([], {
				currentPartInfo: pi0Info,
				nextPartInfo: pi1Info,
				previousPartsInfo: [],
			})

			model.cycleSelectedPartInstances()

			expect(model.playlist.previousPartsInfo).toEqual([pi0Info])
			expect(model.playlist.currentPartInfo).toEqual(pi1Info)
			expect(model.playlist.nextPartInfo).toBeNull()
		})

		it('accumulates multiple previous parts in most-recent-first order', () => {
			// Start with one entry already in previousPartsInfo and cycle in another
			const pi0Info = makeSelectedPartInfo('pi0')
			const pi1Info = makeSelectedPartInfo('pi1')
			const pi2Info = makeSelectedPartInfo('pi2')

			// pi0 is already previous, pi1 is current, pi2 is next
			const model = createModel([], {
				currentPartInfo: pi1Info,
				nextPartInfo: pi2Info,
				previousPartsInfo: [pi0Info],
			})

			model.cycleSelectedPartInstances()

			// pi1 is now most-recent previous, pi0 is older
			expect(model.playlist.previousPartsInfo).toEqual([pi1Info, pi0Info])
			expect(model.playlist.currentPartInfo).toEqual(pi2Info)
			expect(model.playlist.nextPartInfo).toBeNull()
		})

		it('does nothing to previousPartsInfo when there is no currentPartInfo', () => {
			const pi1Info = makeSelectedPartInfo('pi1')
			const model = createModel([], {
				currentPartInfo: null,
				nextPartInfo: pi1Info,
				previousPartsInfo: [],
			})

			model.cycleSelectedPartInstances()

			expect(model.playlist.previousPartsInfo).toEqual([])
		})

		it('caps previousPartsInfo at 10 entries', () => {
			// Seed with 9 existing previous entries; cycle in a 10th via current
			const existing = Array.from({ length: 9 }, (_, i) => makeSelectedPartInfo(`pi_old_${i}`))
			const current = makeSelectedPartInfo('pi_current')
			const next = makeSelectedPartInfo('pi_next')

			const model = createModel([], {
				currentPartInfo: current,
				nextPartInfo: next,
				previousPartsInfo: existing,
			})

			model.cycleSelectedPartInstances()

			expect(model.playlist.previousPartsInfo).toHaveLength(10)
			// Most recent is first
			expect(model.playlist.previousPartsInfo[0]).toEqual(current)

			// Now cycle one more in — should still be capped at 10, oldest dropped
			;(model as any).playlistImpl.currentPartInfo = next
			;(model as any).playlistImpl.nextPartInfo = makeSelectedPartInfo('pi_newer')
			model.cycleSelectedPartInstances()

			expect(model.playlist.previousPartsInfo).toHaveLength(10)
			expect(model.playlist.previousPartsInfo[0]).toEqual(next)
		})
	})

	// --- prunePreviousPartInstances ---

	describe('prunePreviousPartInstances', () => {
		// Pruning logic overview:
		//
		// previous[i] is dropped once its own timeline group has stopped being needed.
		// That window is defined by the *reference* part — the part that started after previous[i] did:
		//   - reference for previous[0] = current part
		//   - reference for previous[i>0] = previous[i-1]
		//
		// previous[i]'s group lingers for `fromPartRemaining` ms after the reference started.
		// Drop condition: now > reference.plannedStartedPlayback + reference.partPlayoutTimings.fromPartRemaining
		//
		// If the reference has no timing data, the entry is kept (safe default).
		// The list is also capped at MAX_PREVIOUS_PARTS regardless.
		// At least one entry is always retained.

		const NOW = 100_000
		const OVERLAP = 500 // fromPartRemaining used in tests

		it('keeps previous[0] while its lingering window (reference: current) has not yet elapsed', () => {
			// prev0's group lingers until current.plannedStartedPlayback + fromPartRemaining = NOW-100+500 = NOW+400 (future) → kept
			// prev1's reference is prev0 which has no timing data → safe default keeps it too
			const current = makePartInstance('current', {
				plannedStartedPlayback: NOW - 100,
				partPlayoutTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: OVERLAP },
			})
			const prev0 = makePartInstance('prev0')
			const prev1 = makePartInstance('prev1')
			const model = createModel([current, prev0, prev1], {
				currentPartInfo: makeSelectedPartInfo('current'),
				previousPartsInfo: [makeSelectedPartInfo('prev0'), makeSelectedPartInfo('prev1')],
			})

			model.prunePreviousPartInstances(NOW)

			expect(model.playlist.previousPartsInfo.map((p) => p.partInstanceId)).toEqual([
				protectString('prev0'),
				protectString('prev1'),
			])
		})

		it('retains previous[0] as the mandatory minimum even when its lingering window has elapsed', () => {
			// prev0 lingers until NOW-1000+500 = NOW-500 (past) → would be pruned,
			// but the minimum-1 rule keeps it
			const current = makePartInstance('current', {
				plannedStartedPlayback: NOW - 1000,
				partPlayoutTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: OVERLAP },
			})
			const prev0 = makePartInstance('prev0')
			const model = createModel([current, prev0], {
				currentPartInfo: makeSelectedPartInfo('current'),
				previousPartsInfo: [makeSelectedPartInfo('prev0')],
			})

			model.prunePreviousPartInstances(NOW)

			expect(model.playlist.previousPartsInfo).toHaveLength(1)
			expect(model.playlist.previousPartsInfo[0].partInstanceId).toEqual(protectString('prev0'))
		})

		it('drops previous[1] once its lingering window (reference: previous[0]) has elapsed', () => {
			// prev0 lingers until NOW-100+500 = NOW+400 (future) → previous[0] kept
			// prev1 lingers until NOW-2000+500 = NOW-1500 (past) → previous[1] dropped
			const current = makePartInstance('current', {
				plannedStartedPlayback: NOW - 100,
				partPlayoutTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: OVERLAP },
			})
			const prev0 = makePartInstance('prev0', {
				plannedStartedPlayback: NOW - 2000,
				partPlayoutTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: OVERLAP },
			})
			const prev1 = makePartInstance('prev1')
			const model = createModel([current, prev0, prev1], {
				currentPartInfo: makeSelectedPartInfo('current'),
				previousPartsInfo: [makeSelectedPartInfo('prev0'), makeSelectedPartInfo('prev1')],
			})

			model.prunePreviousPartInstances(NOW)

			expect(model.playlist.previousPartsInfo).toHaveLength(1)
			expect(model.playlist.previousPartsInfo[0].partInstanceId).toEqual(protectString('prev0'))
		})

		it('always retains previous[0] even when all lingering windows have elapsed', () => {
			// prev0 lingers until NOW-1000+500 = NOW-500 (past) → would be pruned
			// prev1 lingers until NOW-2000+500 = NOW-1500 (past) → would be pruned
			// minimum-1 rule saves previous[0]
			const current = makePartInstance('current', {
				plannedStartedPlayback: NOW - 1000,
				partPlayoutTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: OVERLAP },
			})
			const prev0 = makePartInstance('prev0', {
				plannedStartedPlayback: NOW - 2000,
				partPlayoutTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: OVERLAP },
			})
			const prev1 = makePartInstance('prev1')
			const model = createModel([current, prev0, prev1], {
				currentPartInfo: makeSelectedPartInfo('current'),
				previousPartsInfo: [makeSelectedPartInfo('prev0'), makeSelectedPartInfo('prev1')],
			})

			model.prunePreviousPartInstances(NOW)

			expect(model.playlist.previousPartsInfo).toHaveLength(1)
			expect(model.playlist.previousPartsInfo[0].partInstanceId).toEqual(protectString('prev0'))
		})

		it('keeps all entries when the reference part has no timing data (safe default)', () => {
			// current has no partPlayoutTimings → group end unknown → keep previous[0]
			const current = makePartInstance('current')
			const prev0 = makePartInstance('prev0')
			const model = createModel([current, prev0], {
				currentPartInfo: makeSelectedPartInfo('current'),
				previousPartsInfo: [makeSelectedPartInfo('prev0')],
			})

			model.prunePreviousPartInstances(NOW)

			expect(model.playlist.previousPartsInfo).toHaveLength(1)
		})

		it('keeps all entries when there is no current part (safe default)', () => {
			// Without a current part, previous[0] has no reference → keep it
			const prev0 = makePartInstance('prev0')
			const model = createModel([prev0], {
				previousPartsInfo: [makeSelectedPartInfo('prev0')],
			})

			model.prunePreviousPartInstances(NOW)

			expect(model.playlist.previousPartsInfo).toHaveLength(1)
		})

		it('does not mutate previousPartsInfo when nothing is pruned', () => {
			const current = makePartInstance('current', {
				plannedStartedPlayback: NOW - 100,
				partPlayoutTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: OVERLAP },
			})
			const prev0 = makePartInstance('prev0')
			const prev1 = makePartInstance('prev1')
			const model = createModel([current, prev0, prev1], {
				currentPartInfo: makeSelectedPartInfo('current'),
				previousPartsInfo: [makeSelectedPartInfo('prev0'), makeSelectedPartInfo('prev1')],
			})

			const before = model.playlist.previousPartsInfo

			model.prunePreviousPartInstances(NOW)

			expect(model.playlist.previousPartsInfo).toEqual(before)
			expect(model.playlist.previousPartsInfo).toHaveLength(2)
		})

		it('handles an empty previousPartsInfo without crashing', () => {
			const model = createModel([], { previousPartsInfo: [] })

			expect(() => model.prunePreviousPartInstances(NOW)).not.toThrow()
			expect(model.playlist.previousPartsInfo).toHaveLength(0)
		})

		it('caps the list at MAX_PREVIOUS_PARTS even when no group ends are in the past', () => {
			// 11 previous entries, all with no timing data (safe default keeps them all),
			// but the cap should trim to 10
			const current = makePartInstance('current')
			const prevInstances = Array.from({ length: 11 }, (_, i) => makePartInstance(`prev${i}`))
			const model = createModel([current, ...prevInstances], {
				currentPartInfo: makeSelectedPartInfo('current'),
				previousPartsInfo: prevInstances.map((p) => makeSelectedPartInfo(unprotectString(p._id))),
			})

			model.prunePreviousPartInstances(NOW)

			expect(model.playlist.previousPartsInfo).toHaveLength(10)
			expect(model.playlist.previousPartsInfo[0].partInstanceId).toEqual(protectString('prev0'))
		})

		it('keeps previous[0] when its own window has elapsed but previous[1] is still active', () => {
			// prev0's window (via current): NOW-10+100 = NOW+90  → expires at NOW+200
			// prev1's window (via prev0):   NOW-5000+6000 = NOW+1000 → still active at NOW+200
			// prev0 must be kept to preserve the reference chain for prev1
			const tNow = NOW + 200

			const current = makePartInstance('current', {
				plannedStartedPlayback: NOW - 10,
				partPlayoutTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: 100 },
			})
			const prev0 = makePartInstance('prev0', {
				plannedStartedPlayback: NOW - 5000,
				partPlayoutTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: 6000 },
			})
			const prev1 = makePartInstance('prev1')

			const model = createModel([current, prev0, prev1], {
				currentPartInfo: makeSelectedPartInfo('current'),
				previousPartsInfo: [makeSelectedPartInfo('prev0'), makeSelectedPartInfo('prev1')],
			})

			model.prunePreviousPartInstances(tNow)

			expect(model.playlist.previousPartsInfo.map((p) => p.partInstanceId)).toEqual([
				protectString('prev0'),
				protectString('prev1'),
			])
		})

		it('keeps the full chain when prev[0] and prev[1] have both elapsed but prev[2] is still active', () => {
			// prev0's window (via current): NOW-10+50   = NOW+40   < NOW+200 → stale
			// prev1's window (via prev0):   NOW-500+100 = NOW-400  < NOW+200 → stale
			// prev2's window (via prev1):   NOW-2000+5000=NOW+3000 > NOW+200 → active
			// All three must be retained to preserve the chain
			const tNow = NOW + 200

			const current = makePartInstance('current', {
				plannedStartedPlayback: NOW - 10,
				partPlayoutTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: 50 },
			})
			const prev0 = makePartInstance('prev0', {
				plannedStartedPlayback: NOW - 500,
				partPlayoutTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: 100 },
			})
			const prev1 = makePartInstance('prev1', {
				plannedStartedPlayback: NOW - 2000,
				partPlayoutTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: 5000 },
			})
			const prev2 = makePartInstance('prev2')

			const model = createModel([current, prev0, prev1, prev2], {
				currentPartInfo: makeSelectedPartInfo('current'),
				previousPartsInfo: [
					makeSelectedPartInfo('prev0'),
					makeSelectedPartInfo('prev1'),
					makeSelectedPartInfo('prev2'),
				],
			})

			model.prunePreviousPartInstances(tNow)

			expect(model.playlist.previousPartsInfo.map((p) => p.partInstanceId)).toEqual([
				protectString('prev0'),
				protectString('prev1'),
				protectString('prev2'),
			])
		})

		it('prunes stale tail entries when every window in the chain has elapsed', () => {
			// prev0's window: NOW-2000+500 = NOW-1500 → stale
			// prev1's window: NOW-5000+500 = NOW-4500 → stale
			// No active entry anywhere; minimum-1 rule keeps prev0
			const current = makePartInstance('current', {
				plannedStartedPlayback: NOW - 2000,
				partPlayoutTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: OVERLAP },
			})
			const prev0 = makePartInstance('prev0', {
				plannedStartedPlayback: NOW - 5000,
				partPlayoutTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: OVERLAP },
			})
			const prev1 = makePartInstance('prev1')

			const model = createModel([current, prev0, prev1], {
				currentPartInfo: makeSelectedPartInfo('current'),
				previousPartsInfo: [makeSelectedPartInfo('prev0'), makeSelectedPartInfo('prev1')],
			})

			model.prunePreviousPartInstances(NOW)

			expect(model.playlist.previousPartsInfo).toHaveLength(1)
			expect(model.playlist.previousPartsInfo[0].partInstanceId).toEqual(protectString('prev0'))
		})
	})
})

async function getPlayoutModelImplArugments(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
) {
	const partInstances = await context.mockCollections.PartInstances.findFetch({
		rundownId,
	})
	const pieceInstances = await context.mockCollections.PieceInstances.findFetch({
		rundownId,
	})
	const groupedPieceInstances: Map<PartInstanceId, PieceInstance[]> = new Map(
		Object.entries<PieceInstance[]>(
			_.groupBy(pieceInstances, (pieceInstance) => unprotectString(pieceInstance.partInstanceId))
		)
	) as any
	const rundowns: PlayoutRundownModelImpl[] = await Promise.all(
		(
			await context.mockCollections.Rundowns.findFetch({
				playlistId,
			})
		).map(async (rundown) => {
			const segments = await context.mockCollections.Segments.findFetch({
				rundownId: rundown._id,
			})

			const allSegmentModelImpl = await Promise.all(
				segments.map(async (segment) => {
					const parts = await context.mockCollections.Parts.findFetch({
						rundownId: rundown._id,
					})
					return new PlayoutSegmentModelImpl(segment, parts)
				})
			)
			return new PlayoutRundownModelImpl(rundown, allSegmentModelImpl, [])
		})
	)

	return {
		partInstances,
		groupedPieceInstances,
		rundowns,
	}
}

function setupMockPlayoutGateway(id: PeripheralDeviceId): PeripheralDevice {
	return {
		_id: id,
		category: PeripheralDeviceCategory.PLAYOUT,
		type: PeripheralDeviceType.PLAYOUT,
		subType: '',
		connected: true,
		configManifest: {
			deviceConfigSchema: JSONBlobStringify({}),
			subdeviceManifest: {},
		},
		connectionId: '',
		created: TIME_FAR_PAST,
		deviceName: `Dummy ${id}`,
		lastConnected: TIME_CONNECTED,
		lastSeen: TIME_PING,
		name: `Dummy ${id}`,
		status: {
			statusCode: StatusCode.GOOD,
			messages: [],
		},
		token: '',
	}
}

async function setupRundownWithAutoplayPart0(
	context: MockJobContext,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
): Promise<{ playlistId: RundownPlaylistId; rundownId: RundownId }> {
	const outputLayerIds = Object.keys(showStyle.outputLayers)
	const sourceLayerIds = Object.keys(showStyle.sourceLayers)

	const playlistId = await context.mockCollections.RundownPlaylists.insertOne(
		defaultRundownPlaylist(protectString(`playlist_${rundownId}`), context.studioId)
	)

	const rundown: DBRundown = defaultRundown(
		unprotectString(rundownId),
		context.studioId,
		null,
		playlistId,
		showStyle._id,
		showStyle.showStyleVariantId
	)
	rundown._id = rundownId
	await context.mockCollections.Rundowns.insertOne(rundown)

	const segment0: DBSegment = {
		...defaultSegment(protectString(rundownId + '_segment0'), rundown._id),
		_rank: 0,
		externalId: 'MOCK_SEGMENT_0',
		name: 'Segment 0',
	}
	await context.mockCollections.Segments.insertOne(segment0)

	const part00: DBPart = {
		...defaultPart(protectString(rundownId + '_part0_0'), rundown._id, segment0._id),
		externalId: 'MOCK_PART_0_0',
		title: 'Part 0 0',

		expectedDuration: 20000,
		autoNext: true,
	}
	await context.mockCollections.Parts.insertOne(part00)

	const piece000: Piece = {
		...defaultPiece(protectString(rundownId + '_piece000'), rundown._id, part00.segmentId, part00._id),
		externalId: 'MOCK_PIECE_000',
		name: 'Piece 000',
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
	}
	await context.mockCollections.Pieces.insertOne(piece000)

	const piece001: Piece = {
		...defaultPiece(protectString(rundownId + '_piece001'), rundown._id, part00.segmentId, part00._id),
		externalId: 'MOCK_PIECE_001',
		name: 'Piece 001',
		sourceLayerId: sourceLayerIds[1],
		outputLayerId: outputLayerIds[0],
	}
	await context.mockCollections.Pieces.insertOne(piece001)

	const adLibPiece000: AdLibPiece = {
		...defaultAdLibPiece(protectString(rundownId + '_adLib000'), segment0.rundownId, part00._id),
		expectedDuration: 1000,
		externalId: 'MOCK_ADLIB_000',
		name: 'AdLib 0',
		sourceLayerId: sourceLayerIds[1],
		outputLayerId: outputLayerIds[0],
	}

	await context.mockCollections.AdLibPieces.insertOne(adLibPiece000)

	const part01: DBPart = {
		...defaultPart(protectString(rundownId + '_part0_1'), rundown._id, segment0._id),
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',
	}
	await context.mockCollections.Parts.insertOne(part01)

	const piece010: Piece = {
		...defaultPiece(protectString(rundownId + '_piece010'), rundown._id, part01.segmentId, part01._id),
		externalId: 'MOCK_PIECE_010',
		name: 'Piece 010',
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
	}
	await context.mockCollections.Pieces.insertOne(piece010)

	const segment1: DBSegment = {
		...defaultSegment(protectString(rundownId + '_segment1'), rundown._id),
		_rank: 1,
		externalId: 'MOCK_SEGMENT_2',
		name: 'Segment 1',
	}
	await context.mockCollections.Segments.insertOne(segment1)

	const part10: DBPart = {
		...defaultPart(protectString(rundownId + '_part1_0'), rundown._id, segment1._id),
		_rank: 0,
		externalId: 'MOCK_PART_1_0',
		title: 'Part 1 0',
	}
	await context.mockCollections.Parts.insertOne(part10)

	const piece100: Piece = {
		...defaultPiece(protectString(rundownId + '_piece100'), rundown._id, part10.segmentId, part10._id),
	}
	await context.mockCollections.Pieces.insertOne(piece100)

	const part11: DBPart = {
		...defaultPart(protectString(rundownId + '_part1_1'), rundown._id, segment1._id),
		_rank: 1,
	}
	await context.mockCollections.Parts.insertOne(part11)

	const piece110: Piece = {
		...defaultPiece(protectString(rundownId + '_piece110'), rundown._id, part11.segmentId, part11._id),
	}
	await context.mockCollections.Pieces.insertOne(piece110)

	const part12: DBPart = {
		...defaultPart(protectString(rundownId + '_part1_2'), rundown._id, segment1._id),
		_rank: 2,
	}
	await context.mockCollections.Parts.insertOne(part12)

	const piece120: Piece = {
		...defaultPiece(protectString(rundownId + '_piece120'), rundown._id, part12.segmentId, part12._id),
	}
	await context.mockCollections.Pieces.insertOne(piece120)

	const segment2: DBSegment = {
		...defaultSegment(protectString(rundownId + '_segment2'), rundown._id),
		_rank: 2,
	}
	await context.mockCollections.Segments.insertOne(segment2)

	const part20: DBPart = {
		...defaultPart(protectString(rundownId + '_part2_0'), rundown._id, segment2._id),
		_rank: 0,
	}
	await context.mockCollections.Parts.insertOne(part20)

	const piece200: Piece = {
		...defaultPiece(protectString(rundownId + '_piece200'), rundown._id, part20.segmentId, part20._id),
	}
	await context.mockCollections.Pieces.insertOne(piece200)

	const part21: DBPart = {
		...defaultPart(protectString(rundownId + '_part2_1'), rundown._id, segment2._id),
		_rank: 1,
	}
	await context.mockCollections.Parts.insertOne(part21)

	const piece210: Piece = {
		...defaultPiece(protectString(rundownId + '_piece210'), rundown._id, part21.segmentId, part21._id),
	}
	await context.mockCollections.Pieces.insertOne(piece210)

	const part22: DBPart = {
		...defaultPart(protectString(rundownId + '_part2_2'), rundown._id, segment2._id),
		_rank: 2,
	}
	await context.mockCollections.Parts.insertOne(part22)

	const segment3: DBSegment = {
		...defaultSegment(protectString(rundownId + '_segment3'), rundown._id),
		_rank: 3,
	}
	await context.mockCollections.Segments.insertOne(segment3)

	const part30: DBPart = {
		...defaultPart(protectString(rundownId + '_part3_0'), rundown._id, segment2._id),
		_rank: 0,
	}
	await context.mockCollections.Parts.insertOne(part30)

	const globalAdLib0: RundownBaselineAdLibItem = {
		_id: protectString(rundownId + '_globalAdLib0'),
		_rank: 0,
		externalId: 'MOCK_GLOBAL_ADLIB_0',
		lifespan: PieceLifespan.OutOnRundownChange,
		rundownId: segment0.rundownId,
		name: 'Global AdLib 0',
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}

	const globalAdLib1: RundownBaselineAdLibItem = {
		_id: protectString(rundownId + '_globalAdLib1'),
		_rank: 0,
		externalId: 'MOCK_GLOBAL_ADLIB_1',
		lifespan: PieceLifespan.OutOnRundownChange,
		rundownId: segment0.rundownId,
		name: 'Global AdLib 1',
		sourceLayerId: sourceLayerIds[1],
		outputLayerId: outputLayerIds[0],
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}

	await context.mockCollections.RundownBaselineAdLibPieces.insertOne(globalAdLib0)
	await context.mockCollections.RundownBaselineAdLibPieces.insertOne(globalAdLib1)

	return { playlistId, rundownId }
}
