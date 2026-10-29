import { PlaylistTimingType } from '@sofie-automation/blueprints-integration/dist/documents/playlistTiming'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { mock, MockProxy } from 'jest-mock-extended'
import { ShowStyleBaseExt } from '../../collections/showStyleBaseHandler.js'
import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { CollectionHandlers } from '../../liveStatusServer.js'
import type {
	PartTimingStateDoc,
	PlaylistTimingStateDoc,
	SegmentTimingStateDoc,
	TimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import type { TimerState } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import type { PartId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { splitTimingStates, type PlaylistTimingStates } from '../../collections/playlistTimingStatesHandler.js'

const RUNDOWN_1_ID = 'RUNDOWN_1'
const RUNDOWN_2_ID = 'RUNDOWN_2'

export function makeMockLogger(): MockProxy<Logger> {
	return mock<Logger>()
}

// TODO: this should not have to mock a WebSocket, refactor topic to be unaware of underlying transport (WebSocketTopic -> RealtimeTopic)
export function makeMockSubscriber(): MockProxy<WebSocket> {
	return mock<WebSocket>()
}

const TEST_PLAYLIST_ID = 'PLAYLIST_1'

export function makeTestPlaylist(id?: string): DBRundownPlaylist {
	return {
		_id: protectString(id ?? TEST_PLAYLIST_ID),
		created: 1695799420147,
		externalId: 'NCS_PLAYLIST_1',
		defaultBrandingId: null,
		currentPartInfo: null,
		modified: 1695799420147,
		name: 'My Playlist',
		nextPartInfo: null,
		previousPartsInfo: [],
		rundownIdsInOrder: [protectString(RUNDOWN_1_ID), protectString(RUNDOWN_2_ID)],
		studioId: protectString('STUDIO_1'),
		timing: { type: PlaylistTimingType.None },
		publicData: { a: 'b' },
		tTimers: [] as any,
	}
}

export function makeTestShowStyleBase(): Pick<ShowStyleBaseExt, 'sourceLayerNamesById' | 'outputLayerNamesById'> {
	return {
		sourceLayerNamesById: new Map([['layer0', 'Layer 0']]),
		outputLayerNamesById: new Map([['pgm', 'PGM']]),
	}
}

export function makeTestParts(): DBPart[] {
	return [
		{
			_id: protectString('part0'),
			_rank: 0,
			rundownId: protectString(RUNDOWN_1_ID),
			segmentId: protectString('segment0'),
			notes: [],
			externalId: 'NCS_PART_0',
			expectedDurationWithTransition: 1000,
			title: 'Part 0',
		},
	]
}

export function makeMockHandlers(): CollectionHandlers {
	return {
		adLibActionsHandler: makeMockHandler(),
		adLibsHandler: makeMockHandler(),
		bucketAdLibActionsHandler: makeMockHandler(),
		bucketAdLibsHandler: makeMockHandler(),
		bucketsHandler: makeMockHandler(),
		globalAdLibActionsHandler: makeMockHandler(),
		globalAdLibsHandler: makeMockHandler(),
		notificationsHandler: makeMockHandler(),
		partHandler: makeMockHandler(),
		partInstancesHandler: makeMockHandler(),
		partInstancesInPlaylistHandler: makeMockHandler(),
		partsHandler: makeMockHandler(),
		pieceContentStatusesHandler: makeMockHandler(),
		pieceInstancesHandler: makeMockHandler(),
		pieceInstancesInPlaylistHandler: makeMockHandler(),
		piecesInPlaylistHandler: makeMockHandler(),
		playlistHandler: makeMockHandler(),
		playlistNotificationsHandler: makeMockHandler(),
		playlistTimingStatesHandler: makeMockHandler(),
		playlistsHandler: makeMockHandler(),
		rundownHandler: makeMockHandler(),
		rundownNotificationsHandler: makeMockHandler(),
		rundownsHandler: makeMockHandler(),
		segmentHandler: makeMockHandler(),
		segmentsHandler: makeMockHandler(),
		showStyleBaseHandler: makeMockHandler(),
		showStyleBasesHandler: makeMockHandler(),
		studioHandler: makeMockHandler(),
	} as unknown as CollectionHandlers
}

function makeMockHandler() {
	const subscribers: Array<(data: unknown) => void> = []
	return {
		subscribe: (callback: (data: unknown) => void) => {
			subscribers.push(callback)
		},
		notify: (data: unknown) => {
			subscribers.forEach((callback) => {
				callback(data)
			})
		},
	}
}

/**
 * A `playlistTimingState` snapshot, as the PlaylistTimingStatesHandler hands it to a topic.
 *
 * Timing is resolved by Sofie and published; a topic under test is fed the result rather than the
 * inputs it used to compute from. Parts are declared under their Segment so the grouping cannot be
 * declared inconsistently, and the docs are run through the real `splitTimingStates` so this cannot
 * drift from what the handler produces. Every document is of the playlist from makeTestPlaylist, unless
 * it says otherwise.
 */
export function makeTestTimingStates(states: {
	playlist?: Partial<PlaylistTimingStateDoc>
	segments?: Record<string, Partial<SegmentTimingStateDoc> & { parts?: Record<string, Partial<PartTimingStateDoc>> }>
}): PlaylistTimingStates {
	const docs: TimingStateDoc[] = []

	const playlistId = protectString<RundownPlaylistId>(TEST_PLAYLIST_ID)

	if (states.playlist) {
		docs.push({
			type: 'playlist',
			playlistId,
			currentPartWillAutoNext: false,
			partCountdownBase: { paused: true, duration: 0 },
			...states.playlist,
		} as PlaylistTimingStateDoc)
	}

	type SegmentFixture = Partial<SegmentTimingStateDoc> & { parts?: Record<string, Partial<PartTimingStateDoc>> }
	for (const [segmentIdStr, { parts, ...segment }] of Object.entries<SegmentFixture>(states.segments ?? {})) {
		const segmentId = protectString<SegmentId>(segmentIdStr)
		docs.push({ type: 'segment', playlistId, segmentId, ...segment } as SegmentTimingStateDoc)

		for (const [partIdStr, part] of Object.entries<Partial<PartTimingStateDoc>>(parts ?? {})) {
			docs.push({
				type: 'part',
				playlistId,
				segmentId,
				partId: protectString<PartId>(partIdStr),
				...part,
			} as PartTimingStateDoc)
		}
	}

	return splitTimingStates(docs)
}

/**
 * A constant timer, as the publication expresses a resolved duration.
 *
 * Typed from corelib rather than the generated API types: the generator cannot express `const: true`
 * as a literal, so the generated `TimerStatePaused` has `paused: boolean` and is not assignable to
 * the published shape.
 */
export function constantMs(durationMs: number): TimerState {
	return { paused: true, duration: durationMs }
}
