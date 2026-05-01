import { toResolvedPieceStatus } from '../pieces/toResolvedPieceStatus.js'
import { makePieceInstance } from './resolvedPlaylistConversionTestUtils.js'

describe('toResolvedPieceStatus', () => {
	it('maps rendered timings and basic fields', () => {
		const pieceExtended = {
			renderedInPoint: 345,
			renderedDuration: 678,
			instance: makePieceInstance('inst0'),
		} as any

		const result = toResolvedPieceStatus(pieceExtended)
		expect(result).toMatchObject({
			id: 'piece_inst0',
			instanceId: 'inst0',
			createdByAdLib: true,
			externalId: 'ext_piece_inst0',
			name: 'Piece inst0',
			priority: 9,
			sourceLayerId: 'sl1',
			outputLayerId: 'ol1',
			invalid: false,
			tags: ['tag1'],
			timing: {
				startMs: 345,
				durationMs: 678,
				prerollMs: undefined,
			},
			abSessions: [{ poolName: 'poolA', sessionName: 'sessionA', playerId: 'playerA' }],
		})
	})

	it('falls back to computed duration from userDuration or resolvedEndCap', () => {
		const pieceWithUserDuration = {
			instance: {
				...makePieceInstance('inst1'),
				userDuration: { endRelativeToPart: 500 },
			},
		} as any
		const first = toResolvedPieceStatus(pieceWithUserDuration)
		expect(first.timing.startMs).toBe(100)
		expect(first.timing.durationMs).toBe(400)

		const pieceWithResolvedEndCap = {
			instance: {
				...makePieceInstance('inst2'),
				userDuration: undefined,
				resolvedEndCap: 350,
			},
		} as any
		const second = toResolvedPieceStatus(pieceWithResolvedEndCap)
		expect(second.timing.durationMs).toBe(250)
	})

	it('filters invalid abSessions entries', () => {
		const pieceExtended = {
			instance: {
				...makePieceInstance('inst3'),
				piece: {
					...makePieceInstance('inst3').piece,
					abSessions: [{ poolName: 'ok', sessionName: 'ok', playerId: 'p0' }, { poolName: 'bad' }],
				},
			},
		} as any

		const result = toResolvedPieceStatus(pieceExtended)
		expect(result.abSessions).toEqual([{ poolName: 'ok', sessionName: 'ok', playerId: 'p0' }])
	})
})
