import { PlaylistTimingType } from '@sofie-automation/blueprints-integration/dist/documents/playlistTiming'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { mock, MockProxy } from 'jest-mock-extended'
import { ShowStyleBaseExt } from '../../collections/showStyleBaseHandler.js'
import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { CollectionHandlers } from '../../liveStatusServer.js'

const RUNDOWN_1_ID = 'RUNDOWN_1'
const RUNDOWN_2_ID = 'RUNDOWN_2'

export function makeMockLogger(): MockProxy<Logger> {
	return mock<Logger>()
}

// TODO: this should not have to mock a WebSocket, refactor topic to be unaware of underlying transport (WebSocketTopic -> RealtimeTopic)
export function makeMockSubscriber(): MockProxy<WebSocket> {
	return mock<WebSocket>()
}

export function makeTestPlaylist(id?: string): DBRundownPlaylist {
	return {
		_id: protectString(id ?? 'PLAYLIST_1'),
		created: 1695799420147,
		externalId: 'NCS_PLAYLIST_1',
		currentPartInfo: null,
		modified: 1695799420147,
		name: 'My Playlist',
		nextPartInfo: null,
		previousPartInfo: null,
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
		partHandler: makeMockHandler(),
		partInstancesHandler: makeMockHandler(),
		partsHandler: makeMockHandler(),
		pieceContentStatusesHandler: makeMockHandler(),
		pieceInstancesHandler: makeMockHandler(),
		playlistHandler: makeMockHandler(),
		playlistsHandler: makeMockHandler(),
		rundownHandler: makeMockHandler(),
		segmentHandler: makeMockHandler(),
		segmentsHandler: makeMockHandler(),
		showStyleBaseHandler: makeMockHandler(),
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
