import { ABResolverOptions } from '@sofie-automation/blueprints-integration'
import { AssignmentResult, resolveAbAssignmentsFromRequests, SessionRequest } from '../abPlaybackResolver.js'

const resolverOptions: ABResolverOptions = {
	idealGapBefore: 1000,
	nowWindow: 2000,
}

describe('resolveAbAssignmentsFromRequests', () => {
	const TWO_SLOTS = [1, 2]
	const THREE_SLOTS = [1, 2, 3]

	function expectGotPlayer(res: AssignmentResult, id: string, playerId: number | undefined): void {
		const req = res.requests.find((r) => r.id === id)
		expect(req).toBeTruthy()
		expect(req?.playerId).toEqual(playerId)
	}

	test('No pending should do nothing', () => {
		const requests: SessionRequest[] = [
			// Note: these should all collide
			{
				id: 'a',
				name: 'a',
				start: 1000,
				end: undefined,
				playerId: 1,
				pieceNames: [],
			},
			{
				id: 'b',
				name: 'b',
				start: 1000,
				end: undefined,
				playerId: 1,
				pieceNames: [],
			},
			{
				id: 'c',
				name: 'c',
				start: 1000,
				end: undefined,
				playerId: 1,
				pieceNames: [],
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expect(res.requests).toEqual(requests)
	})

	test('Very basic scenario', () => {
		const requests: SessionRequest[] = [
			{
				id: 'a',
				name: 'a',
				start: 1000,
				end: undefined,
				pieceNames: [],
			},
			{
				id: 'b',
				name: 'b',
				start: 2000,
				end: undefined,
				pieceNames: [],
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 1)
		expectGotPlayer(res, 'b', 2)
	})

	test('Very basic scenario - sticky', () => {
		const requests: SessionRequest[] = [
			{
				id: 'a',
				name: 'a',
				start: 1000,
				end: undefined,
				playerId: 2,
				pieceNames: [],
			},
			{
				id: 'b',
				name: 'b',
				start: 2000,
				end: undefined,
				pieceNames: [],
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
	})

	test('Very basic collision', () => {
		const requests: SessionRequest[] = [
			{
				id: 'a',
				name: 'a',
				start: 1000,
				end: undefined,
				pieceNames: [],
			},
			{
				id: 'b',
				name: 'b',
				start: 2000,
				end: undefined,
				pieceNames: [],
			},
			{
				id: 'c',
				name: 'c',
				start: 3000,
				end: undefined,
				pieceNames: [],
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([{ id: 'c', name: 'c', pieceNames: [] }])
		expectGotPlayer(res, 'a', 1)
		expectGotPlayer(res, 'b', 2)
		expectGotPlayer(res, 'c', undefined)
	})

	test('Very basic collision - sticky', () => {
		const requests: SessionRequest[] = [
			{
				id: 'a',
				name: 'a',
				start: 1000,
				end: undefined,
				playerId: 2,
				pieceNames: [],
			},
			{
				id: 'b',
				name: 'b',
				start: 2000,
				end: undefined,
				pieceNames: [],
			},
			{
				id: 'c',
				name: 'c',
				start: 3000,
				end: undefined,
				playerId: 1,
				pieceNames: [],
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([{ id: 'b', name: 'b', pieceNames: [] }])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', undefined)
		expectGotPlayer(res, 'c', 1)
	})

	test('Immediate playback', () => {
		const requests: SessionRequest[] = [
			{
				id: 'a',
				name: 'a',
				start: 1000,
				end: 10000,
				playerId: 2,
				pieceNames: [],
			},
			{
				id: 'b',
				name: 'b',
				start: 2000,
				end: 10500,
				playerId: 1,
				pieceNames: [],
			},
			{
				id: 'c',
				name: 'c',
				start: 10900,
				end: undefined,
				pieceNames: [],
			},
			{
				id: 'd',
				name: 'd',
				start: 10950,
				end: undefined,
				pieceNames: [],
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'c', 1)
		expectGotPlayer(res, 'd', 2)
	})

	test('Immediate playback - gaps before', () => {
		const requests: SessionRequest[] = [
			{
				id: 'a',
				name: 'a',
				start: 1000,
				end: 9000,
				playerId: 2,
				pieceNames: [],
			},
			{
				id: 'b',
				name: 'b',
				start: 2000,
				end: 8500,
				playerId: 1,
				pieceNames: [],
			},
			{
				id: 'c',
				name: 'c',
				start: 10900,
				end: undefined,
				pieceNames: [],
			},
			{
				id: 'd',
				name: 'd',
				start: 10950,
				end: undefined,
				pieceNames: [],
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'c', 1)
		expectGotPlayer(res, 'd', 2)
	})

	test('Future request', () => {
		const requests: SessionRequest[] = [
			{
				id: 'a',
				name: 'a',
				start: 1000,
				end: 15000,
				playerId: 3,
				pieceNames: [],
			},
			{
				id: 'b',
				name: 'b',
				start: 2000,
				end: 16000,
				playerId: 1,
				pieceNames: [],
			},
			{
				id: 'c',
				name: 'c',
				start: 20000,
				end: 40000,
				pieceNames: [],
			},
			{
				id: 'd',
				name: 'd',
				start: 30000,
				end: undefined,
				playerId: 1,
				pieceNames: [],
			},
			{
				id: 'e',
				name: 'e',
				start: 35000,
				end: undefined,
				pieceNames: [],
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, THREE_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 3)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'c', 2)
		expectGotPlayer(res, 'd', 1)
		expectGotPlayer(res, 'e', 3)
	})

	test('Run adlib bak', () => {
		const requests: SessionRequest[] = [
			// current part
			{
				id: 'a',
				name: 'a',
				start: 1000,
				end: undefined,
				playerId: 2,
				pieceNames: [],
			},
			// adlib
			{
				id: 'b',
				name: 'b',
				start: 10000,
				end: undefined,
				pieceNames: [],
			},
			// lookaheads
			{
				id: 'c',
				name: 'c',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				playerId: 1,
				lookaheadRank: 1,
				pieceNames: [],
			},
			{
				id: 'd',
				name: 'd',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				lookaheadRank: 2,
				pieceNames: [],
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'c', undefined)
		expectGotPlayer(res, 'd', undefined)
	})

	test('Run adlib bts', () => {
		const requests: SessionRequest[] = [
			// current part
			{
				id: 'a',
				name: 'a',
				start: 1000,
				end: 10500,
				playerId: 2,
				pieceNames: [],
			},
			// adlib
			{
				id: 'b',
				name: 'b',
				start: 10000,
				end: undefined,
				pieceNames: [],
			},
			// lookaheads (in order of future use)
			{
				id: 'c',
				name: 'c',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				playerId: 1,
				lookaheadRank: 1,
				pieceNames: [],
			},
			{
				id: 'd',
				name: 'd',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				playerId: 2,
				lookaheadRank: 2,
				pieceNames: [],
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'c', 2)
		expectGotPlayer(res, 'd', undefined)
	})
	test('Run adlib bts x2', () => {
		const requests: SessionRequest[] = [
			// current part
			{
				id: 'a',
				name: 'a',
				start: 1000,
				end: 9500,
				playerId: 2,
				pieceNames: [],
			},
			// adlib
			{
				id: 'b',
				name: 'b',
				start: 10000,
				end: undefined,
				pieceNames: [],
			},
			// adlib
			{
				id: 'e',
				name: 'e',
				start: 10000,
				end: undefined,
				pieceNames: [],
			},
			// lookaheads (in order of future use)
			{
				id: 'c',
				name: 'c',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				playerId: 1,
				lookaheadRank: 1,
				pieceNames: [],
			},
			{
				id: 'd',
				name: 'd',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				playerId: 2,
				lookaheadRank: 2,
				pieceNames: [],
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'e', 2)
		expectGotPlayer(res, 'c', undefined)
		expectGotPlayer(res, 'd', undefined)
	})
	test('Run timed adlib bts', () => {
		const requests: SessionRequest[] = [
			// current part
			{
				id: 'a',
				name: 'a',
				start: 1000,
				end: 10500,
				playerId: 2,
				pieceNames: [],
			},
			// adlib
			{
				id: 'b',
				name: 'b',
				start: 10000,
				end: 15000,
				pieceNames: [],
			},
			// lookaheads (in order of future use)
			{
				id: 'c',
				name: 'c',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				playerId: 1,
				lookaheadRank: 1,
				pieceNames: [],
			},
			{
				id: 'd',
				name: 'd',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				playerId: 2,
				lookaheadRank: 2,
				pieceNames: [],
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'c', 2) // moved so that it alternates
		expectGotPlayer(res, 'd', 1)
	})

	test('Autonext run bts', () => {
		const requests: SessionRequest[] = [
			// current part
			{
				id: 'a',
				name: 'a',
				start: 1000,
				end: 10500,
				playerId: 2,
				pieceNames: [],
			},
			// adlib
			{
				id: 'b',
				name: 'b',
				start: 10000,
				end: 20500,
				pieceNames: [],
			},
			// next part
			{
				id: 'a',
				name: 'a',
				start: 20000,
				end: undefined,
				playerId: 1,
				pieceNames: [],
			},
			// lookaheads (in order of future use)
			{
				id: 'c',
				name: 'c',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				playerId: 2,
				lookaheadRank: 1,
				pieceNames: [],
			},
			{
				id: 'd',
				name: 'd',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				lookaheadRank: 2,
				pieceNames: [],
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'c', 2)
		expectGotPlayer(res, 'd', undefined)
	})

	test('Autonext run bts in 5s', () => {
		const requests: SessionRequest[] = [
			// current part
			{
				id: 'a',
				name: 'a',
				start: 1000,
				end: 10500,
				playerId: 2,
				pieceNames: [],
			},
			// adlib
			{
				id: 'b',
				name: 'b',
				start: 10000,
				end: 20500,
				pieceNames: [],
			},
			// next part
			{
				id: 'e',
				name: 'e',
				start: 20000,
				end: undefined,
				playerId: 1,
				pieceNames: [],
			},
			// lookaheads (in order of future use)
			{
				id: 'c',
				name: 'c',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				playerId: 2,
				lookaheadRank: 1,
				pieceNames: [],
			},
			{
				id: 'd',
				name: 'd',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				lookaheadRank: 2,
				pieceNames: [],
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 5000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'e', 2)
		expectGotPlayer(res, 'c', 1)
		expectGotPlayer(res, 'd', undefined)
	})

	test('Preserve on-air optional over a required', () => {
		const requests: SessionRequest[] = [
			// current part
			{
				id: 'a',
				name: 'a',
				start: 1000,
				end: undefined,
				playerId: 2,
				pieceNames: [],
			},
			// bak
			{
				id: 'b',
				name: 'b',
				start: 5000,
				optional: true,
				playerId: 1,
				end: undefined,
				pieceNames: [],
			},
			// adlib
			{
				id: 'c',
				name: 'c',
				start: 10000,
				end: undefined,
				pieceNames: [],
			},
			// lookaheads
			{
				id: 'd',
				name: 'd',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				lookaheadRank: 1,
				pieceNames: [],
			},
			{
				id: 'e',
				name: 'e',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				lookaheadRank: 2,
				pieceNames: [],
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([{ id: 'c', name: 'c', pieceNames: [] }])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'c', undefined)
		expectGotPlayer(res, 'd', undefined)
	})
	test('Preserve visible lookahead assignment', () => {
		const requests: SessionRequest[] = [
			// current clip
			{
				id: 'a',
				name: 'a',
				start: 1000,
				end: undefined,
				playerId: 2,
				pieceNames: [],
			},
			// previous clip
			{
				id: 'b',
				name: 'b',
				start: 0,
				playerId: 1,
				end: 5000,
				pieceNames: [],
			},
			// lookaheads
			{
				id: 'd',
				name: 'd',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				lookaheadRank: 1,
				pieceNames: [],
			},
			{
				id: 'e',
				name: 'e',
				start: Number.POSITIVE_INFINITY,
				playerId: 3, // From before
				end: undefined,
				lookaheadRank: 2,
				pieceNames: [],
			},
			{
				id: 'f',
				name: 'f',
				start: Number.POSITIVE_INFINITY,
				end: undefined,
				lookaheadRank: 3,
				pieceNames: [],
			},
		]

		const res = resolveAbAssignmentsFromRequests(resolverOptions, THREE_SLOTS, requests, 10000)
		expect(res).toBeTruthy()
		expect(res.failedOptional).toEqual([])
		expect(res.failedRequired).toEqual([])
		expectGotPlayer(res, 'a', 2)
		expectGotPlayer(res, 'b', 1)
		expectGotPlayer(res, 'd', 1)
		expectGotPlayer(res, 'e', 3)
		expectGotPlayer(res, 'f', undefined)
	})

	describe('add/remove players', () => {
		test('reshuffle lookahead when removing player', () => {
			const requests: SessionRequest[] = [
				// current clip
				{
					id: 'a',
					name: 'a',
					start: 1000,
					end: undefined,
					playerId: 2,
					pieceNames: [],
				},
				// previous clip
				{
					id: 'b',
					name: 'b',
					start: 0,
					playerId: 1,
					end: 5000,
					pieceNames: [],
				},
				// lookaheads
				{
					id: 'd',
					name: 'd',
					start: Number.POSITIVE_INFINITY,
					end: undefined,
					lookaheadRank: 1,
					playerId: 1,
					pieceNames: [],
				},
				{
					id: 'e',
					name: 'e',
					start: Number.POSITIVE_INFINITY,
					playerId: 3, // From before
					end: undefined,
					lookaheadRank: 2,
					pieceNames: [],
				},
				{
					id: 'f',
					name: 'f',
					start: Number.POSITIVE_INFINITY,
					end: undefined,
					lookaheadRank: 3,
					playerId: 2,
					pieceNames: [],
				},
			]

			const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
			expect(res).toBeTruthy()
			expect(res.failedOptional).toEqual([])
			expect(res.failedRequired).toEqual([])
			expectGotPlayer(res, 'a', 2)
			expectGotPlayer(res, 'b', 1)
			expectGotPlayer(res, 'd', 1)
			expectGotPlayer(res, 'e', undefined)
			expectGotPlayer(res, 'f', undefined)
		})

		test('reshuffle current when removing player', () => {
			const requests: SessionRequest[] = [
				// current clip
				{
					id: 'a',
					name: 'a',
					start: 1000,
					end: undefined,
					playerId: 3,
					pieceNames: [],
				},
				// previous clip
				{
					id: 'b',
					name: 'b',
					start: 0,
					playerId: 1,
					end: 5000,
					pieceNames: [],
				},
				// lookaheads
				{
					id: 'd',
					name: 'd',
					start: Number.POSITIVE_INFINITY,
					end: undefined,
					lookaheadRank: 1,
					playerId: 1,
					pieceNames: [],
				},
				{
					id: 'e',
					name: 'e',
					start: Number.POSITIVE_INFINITY,
					playerId: 2,
					end: undefined,
					lookaheadRank: 2,
					pieceNames: [],
				},
			]

			const res = resolveAbAssignmentsFromRequests(resolverOptions, TWO_SLOTS, requests, 10000)
			expect(res).toBeTruthy()
			expect(res.failedOptional).toEqual([])
			expect(res.failedRequired).toEqual([])
			expectGotPlayer(res, 'a', 2)
			expectGotPlayer(res, 'b', 1)
			expectGotPlayer(res, 'd', 1)
			expectGotPlayer(res, 'e', undefined)
		})

		test('add player allows distributing timed clips', () => {
			const requests: SessionRequest[] = [
				// current clip
				{
					id: 'a',
					name: 'a',
					start: 1000,
					end: 11000,
					playerId: 1,
					pieceNames: [],
				},
				{
					id: 'b',
					name: 'b',
					start: 13000, // soon
					end: undefined,
					playerId: 1,
					pieceNames: [],
				},
				{
					id: 'c',
					name: 'c',
					start: 1000,
					end: undefined,
					playerId: 2,
					pieceNames: [],
				},
				// lookaheads
				{
					id: 'd',
					name: 'd',
					start: Number.POSITIVE_INFINITY,
					end: undefined,
					lookaheadRank: 1,
					playerId: 1,
					pieceNames: [],
				},
				{
					id: 'e',
					name: 'e',
					start: Number.POSITIVE_INFINITY,
					playerId: 2,
					end: undefined,
					lookaheadRank: 2,
					pieceNames: [],
				},
			]

			const res = resolveAbAssignmentsFromRequests(resolverOptions, THREE_SLOTS, requests, 10000)
			expect(res).toBeTruthy()
			expect(res.failedOptional).toEqual([])
			expect(res.failedRequired).toEqual([])
			expectGotPlayer(res, 'a', 1)
			expectGotPlayer(res, 'b', 3)
			expectGotPlayer(res, 'c', 2)
			expectGotPlayer(res, 'd', 1)
			expectGotPlayer(res, 'e', undefined)
		})
	})
})
