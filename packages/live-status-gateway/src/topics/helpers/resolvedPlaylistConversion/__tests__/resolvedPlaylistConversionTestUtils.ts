import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { ShowStyleBaseExt } from '../../../../collections/showStyleBaseHandler.js'
import { QuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'

export function makeTestShowStyleBaseExt(): ShowStyleBaseExt {
	return {
		_id: protectString('showStyleBase0'),
		sourceLayerNamesById: new Map([
			['sl1', 'Source Layer 1'],
			['sl2', 'Source Layer 2'],
		]),
		outputLayerNamesById: new Map([
			['ol1', 'Output Layer 1'],
			['ol2', 'Output Layer 2'],
		]),
	} as unknown as ShowStyleBaseExt
}

export function makePlaylist(overrides: Partial<any> = {}): any {
	return {
		_id: protectString('playlist0'),
		externalId: 'ext_playlist_0',
		activationId: undefined,
		rehearsal: false,
		name: 'Playlist 0',
		rundownIdsInOrder: [protectString('rundown0'), protectString('rundown1')],
		quickLoop: null,
		currentPartInfo: null,
		nextPartInfo: null,
		publicData: { playlistPublic: true },
		publicPlayoutPersistentState: { playout: true },
		timing: { type: PlaylistTimingType.None, expectedDuration: 10000 },
		tTimers: [],
		...overrides,
	}
}

export function makeRundown(id: string, rank = 0): any {
	return {
		_id: protectString(id),
		externalId: `ext_${id}`,
		name: `Rundown ${id}`,
		description: `Description ${id}`,
		publicData: { rank },
	}
}

export function makeSegment(id: string, rundownId: string, rank: number): any {
	return {
		_id: protectString(id),
		externalId: `ext_${id}`,
		identifier: `ident_${id}`,
		name: `Segment ${id}`,
		_rank: rank,
		rundownId: protectString(rundownId),
		segmentTiming: { budgetDuration: 3000 },
	}
}

export function makePart(id: string, rundownId: string, segmentId: string, rank: number): any {
	return {
		_id: protectString(id),
		externalId: `ext_${id}`,
		title: `Part ${id}`,
		_rank: rank,
		rundownId: protectString(rundownId),
		segmentId: protectString(segmentId),
		autoNext: true,
	}
}

export function makePartInstance(id: string, partId: string, segmentId: string, rundownId: string): any {
	return {
		_id: protectString(id),
		rundownId: protectString(rundownId),
		segmentId: protectString(segmentId),
		part: {
			_id: protectString(partId),
			externalId: `ext_${partId}`,
			title: `Part ${partId}`,
			_rank: 1,
			autoNext: false,
			publicData: { fromPart: true },
		},
		timings: {
			plannedStartedPlayback: 10,
			reportedStartedPlayback: 11,
			playOffset: 12,
			setAsNext: 13,
			take: 14,
		},
	}
}

export function makePieceInstance(id: string): any {
	return {
		_id: protectString(id),
		priority: 9,
		dynamicallyInserted: true,
		resolvedEndCap: 1500,
		piece: {
			_id: protectString(`piece_${id}`),
			externalId: `ext_piece_${id}`,
			name: `Piece ${id}`,
			sourceLayerId: 'sl1',
			outputLayerId: 'ol1',
			publicData: { piecePublic: true },
			enable: {
				start: 100,
				duration: 200,
			},
			tags: ['tag1'],
			abSessions: [
				{
					poolName: 'poolA',
					sessionName: 'sessionA',
					playerId: 'playerA',
				},
			],
		},
	}
}

export function makeQuickLoop(): any {
	return {
		locked: false,
		running: true,
		start: { type: QuickLoopMarkerType.PLAYLIST },
		end: { type: QuickLoopMarkerType.RUNDOWN, id: protectString('rundown0') },
	}
}
