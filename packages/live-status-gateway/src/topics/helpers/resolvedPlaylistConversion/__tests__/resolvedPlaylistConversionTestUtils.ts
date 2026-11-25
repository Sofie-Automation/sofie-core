import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PieceLifespan, PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { ShowStyleBaseExt } from '../../../../collections/showStyleBaseHandler.js'
import { QuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { ToResolvedPlaylistStatusProps } from '../context/conversionContext.js'

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
		defaultBrandingId: null,
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
		showStyleBaseId: protectString('showStyleBase0'),
		showStyleVariantId: protectString('showStyleVariant0'),
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

function pieceLifespan(segmentIndex: number, partIndex: number, pieceIndex: number): PieceLifespan {
	if (pieceIndex === 0) return PieceLifespan.OutOnSegmentEnd
	if (pieceIndex === 1 && partIndex === 0) return PieceLifespan.OutOnRundownEnd
	if (pieceIndex === 2 && partIndex === 0 && segmentIndex % 10 === 0) return PieceLifespan.OutOnShowStyleEnd
	return PieceLifespan.WithinPart
}

export interface LargeActivePlaylistOptions {
	rundowns: number
	segmentsPerRundown: number
	partsPerSegment: number
	piecesPerPart: number
	/** How many parts (in playout order, from the start of the first rundown) have been played */
	playedParts: number
	/** The time the playlist is generated relative to */
	now: number
}

/**
 * Build an active playlist where the first `playedParts` parts have been played, with a mix of infinite pieces and
 * PartInstances / PieceInstances left over from a previous activation.
 */
export function makeLargeActivePlaylist({
	rundowns: RUNDOWNS,
	segmentsPerRundown: SEGMENTS_PER_RUNDOWN,
	partsPerSegment: PARTS_PER_SEGMENT,
	piecesPerPart: PIECES_PER_PART,
	playedParts: PLAYED_PARTS,
	now: FIXED_NOW,
}: LargeActivePlaylistOptions): ToResolvedPlaylistStatusProps {
	const activationId = protectString('activation0')
	const rundownIds = Array.from({ length: RUNDOWNS }, (_, i) => `rundown${i}`)

	const showStyleBaseExt = {
		...makeTestShowStyleBaseExt(),
		sourceLayers: {
			sl1: { _id: 'sl1', _rank: 0, name: 'Source Layer 1', type: 0 },
			sl2: { _id: 'sl2', _rank: 1, name: 'Source Layer 2', type: 0 },
		},
		outputLayers: {
			ol1: { _id: 'ol1', _rank: 0, name: 'Output Layer 1', isPGM: true },
			ol2: { _id: 'ol2', _rank: 1, name: 'Output Layer 2', isPGM: false },
		},
	} as any

	const rundowns: any[] = []
	const segments: any[] = []
	const parts: any[] = []
	const pieces: any[] = []
	const partInstances: any[] = []
	const pieceInstances: any[] = []

	let playoutIndex = 0
	for (const [rundownIndex, rundownId] of rundownIds.entries()) {
		rundowns.push(makeRundown(rundownId, rundownIndex))

		for (let segmentIndex = 0; segmentIndex < SEGMENTS_PER_RUNDOWN; segmentIndex++) {
			const segmentId = `${rundownId}_segment${segmentIndex}`
			segments.push(makeSegment(segmentId, rundownId, segmentIndex))

			for (let partIndex = 0; partIndex < PARTS_PER_SEGMENT; partIndex++) {
				const partId = `${segmentId}_part${partIndex}`
				const part = { ...makePart(partId, rundownId, segmentId, partIndex), autoNext: false }
				parts.push(part)

				const partPieces: any[] = []
				for (let pieceIndex = 0; pieceIndex < PIECES_PER_PART; pieceIndex++) {
					const lifespan = pieceLifespan(segmentIndex, partIndex, pieceIndex)
					const piece = {
						_id: protectString(`${partId}_piece${pieceIndex}`),
						externalId: `ext_${partId}_piece${pieceIndex}`,
						name: `Piece ${pieceIndex} of ${partId}`,
						startRundownId: protectString(rundownId),
						startSegmentId: protectString(segmentId),
						startPartId: protectString(partId),
						lifespan,
						sourceLayerId: pieceIndex % 2 === 0 ? 'sl1' : 'sl2',
						outputLayerId: pieceIndex % 2 === 0 ? 'ol1' : 'ol2',
						enable:
							lifespan === PieceLifespan.WithinPart
								? { start: pieceIndex * 100, duration: 500 }
								: { start: 0 },
						invalid: false,
						pieceType: 'normal',
						content: {},
						timelineObjectsString: '[]',
					}
					pieces.push(piece)
					partPieces.push(piece)
				}

				if (playoutIndex <= PLAYED_PARTS) {
					// An instance left over from a previous activation, which must be ignored
					partInstances.push({
						_id: protectString(`old_pi_${partId}`),
						rundownId: protectString(rundownId),
						segmentId: protectString(segmentId),
						playlistActivationId: protectString('activationOld'),
						takeCount: playoutIndex,
						reset: true,
						part,
						timings: { plannedStartedPlayback: FIXED_NOW - 3_600_000, take: FIXED_NOW - 3_600_000 },
					})
					for (const piece of partPieces) {
						pieceInstances.push({
							_id: protectString(`old_pi_${partId}_${piece._id}`),
							partInstanceId: protectString(`old_pi_${partId}`),
							rundownId: protectString(rundownId),
							playlistActivationId: protectString('activationOld'),
							reset: true,
							piece,
						})
					}

					// The instance in the current activation. The last one is the next part, so hasn't started yet
					const isNext = playoutIndex === PLAYED_PARTS
					const partInstanceId = `pi_${partId}`
					partInstances.push({
						_id: protectString(partInstanceId),
						rundownId: protectString(rundownId),
						segmentId: protectString(segmentId),
						playlistActivationId: activationId,
						takeCount: playoutIndex,
						part,
						timings: isNext
							? { setAsNext: FIXED_NOW - 60_000 }
							: {
									setAsNext: FIXED_NOW - 600_000 + playoutIndex * 10_000,
									take: FIXED_NOW - 590_000 + playoutIndex * 10_000,
									plannedStartedPlayback: FIXED_NOW - 590_000 + playoutIndex * 10_000,
								},
					})
					for (const piece of partPieces) {
						pieceInstances.push({
							_id: protectString(`${partInstanceId}_${piece._id}`),
							partInstanceId: protectString(partInstanceId),
							rundownId: protectString(rundownId),
							playlistActivationId: activationId,
							piece,
						})
					}
				}

				playoutIndex++
			}
		}
	}

	const playlist = makePlaylist({
		activationId,
		rundownIdsInOrder: rundownIds.map((id) => protectString(id)),
		currentPartInfo: { partInstanceId: partInstances.at(-3)._id },
		nextPartInfo: { partInstanceId: partInstances.at(-1)._id },
	})

	return {
		playlistState: playlist,
		rundownsState: rundowns,
		showStyleBaseExtState: showStyleBaseExt,
		segmentsState: segments,
		partsState: parts,
		partInstancesInPlaylistState: partInstances,
		piecesInPlaylistState: pieces,
		pieceInstancesInPlaylistState: pieceInstances,
	}
}
