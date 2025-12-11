import {
	AbPlayerId,
	ABResolverOptions,
	IBlueprintPieceType,
	PieceAbSessionInfo,
	PieceLifespan,
} from '@sofie-automation/blueprints-integration'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstancePiece, ResolvedPieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ABSessionAssignments } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { AssignmentResult, resolveAbAssignmentsFromRequests } from '../abPlaybackResolver.js'
import { calculateSessionTimeRanges } from '../abPlaybackSessions.js'
import { AbSessionHelper } from '../abSessionHelper.js'

const POOL_NAME = 'clip'

const resolverOptions: ABResolverOptions = {
	idealGapBefore: 1000,
	nowWindow: 2000,
}

function createBasicResolvedPieceInstance(
	id: string,
	start: number,
	duration: number | undefined,
	reqId: string | undefined,
	optional?: boolean,
	uniqueSessionName?: boolean
): ResolvedPieceInstance {
	const piece = literal<PieceInstancePiece>({
		_id: protectString(id),
		externalId: id,
		name: `name-${id}`,
		enable: {
			start,
		},
		sourceLayerId: '',
		outputLayerId: '',
		privateData: {},
		lifespan: PieceLifespan.WithinPart,
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		content: {},
		invalid: false,
		startPartId: protectString(''),
		pieceType: IBlueprintPieceType.Normal,
	})

	if (reqId !== undefined) {
		piece.abSessions = [
			{
				sessionName: reqId,
				poolName: POOL_NAME,
				optional: optional,
				sessionNameIsGloballyUnique: uniqueSessionName,
			},
		]
	}

	return literal<ResolvedPieceInstance>({
		instance: {
			_id: protectString(`inst_${id}`),
			partInstanceId: protectString(''),
			rundownId: protectString(''),
			playlistActivationId: protectString(''),
			piece,
		},
		resolvedStart: start,
		resolvedDuration: duration,
		timelinePriority: 0,
	})
}

function resolveAbSessions(
	abSessionHelper: AbSessionHelper,
	resolverOptions: ABResolverOptions,
	resolvedPieces: ResolvedPieceInstance[],
	timelineObjs: OnGenerateTimelineObjExt[],
	previousAssignmentMap: ABSessionAssignments,
	sessionPool: string,
	playerIds: Array<AbPlayerId>,
	now: number
): AssignmentResult {
	const sessionRequests = calculateSessionTimeRanges(
		abSessionHelper,
		resolvedPieces,
		timelineObjs,
		previousAssignmentMap,
		sessionPool
	)

	return resolveAbAssignmentsFromRequests(resolverOptions, playerIds, sessionRequests, now)
}

describe('resolveMediaPlayers', () => {
	// TODO - rework this to use an interface instead of mocking the methods
	const abSessionHelper = new AbSessionHelper([], [])

	const mockGetPieceSessionId: jest.MockedFunction<typeof abSessionHelper.getPieceABSessionId> = jest.fn()
	const mockGetObjectSessionId: jest.MockedFunction<typeof abSessionHelper.getTimelineObjectAbSessionId> = jest.fn()

	abSessionHelper.getPieceABSessionId = mockGetPieceSessionId
	abSessionHelper.getTimelineObjectAbSessionId = mockGetObjectSessionId

	beforeEach(() => {
		mockGetPieceSessionId.mockReset().mockImplementation(() => {
			throw new Error('Method not implemented.')
		})
		mockGetObjectSessionId.mockReset().mockImplementation(() => {
			throw new Error('Method not implemented.')
		})
	})

	test('no pieces', () => {
		const assignments = resolveAbSessions(abSessionHelper, resolverOptions, [], [], {}, POOL_NAME, [1, 2], 5000)
		expect(assignments.failedRequired).toHaveLength(0)
		expect(assignments.failedOptional).toHaveLength(0)
		expect(assignments.requests).toHaveLength(0)
	})

	test('basic pieces', () => {
		const previousAssignments = {}
		const pieces = [
			createBasicResolvedPieceInstance('0', 400, 5000, 'abc'),
			createBasicResolvedPieceInstance('1', 400, 5000, 'def'),
			createBasicResolvedPieceInstance('2', 800, 4000, 'ghi'),
		]

		mockGetPieceSessionId.mockImplementation(
			(piece, session) => `${piece._id}_${session.poolName}_${session.sessionName}`
		)

		const assignments = resolveAbSessions(
			abSessionHelper,
			resolverOptions,
			pieces,
			[],
			previousAssignments,
			POOL_NAME,
			[1, 2],
			4500
		)
		expect(assignments.failedRequired).toEqual([{ id: 'inst_2_clip_ghi', name: 'ghi', pieceNames: ['name-2'] }])
		expect(assignments.failedOptional).toHaveLength(0)
		expect(assignments.requests).toHaveLength(3)
		expect(assignments.requests).toEqual([
			{
				end: 5400,
				id: 'inst_0_clip_abc',
				name: 'abc',
				playerId: 1,
				start: 400,
				optional: false,
				pieceNames: ['name-0'],
			},
			{
				end: 5400,
				id: 'inst_1_clip_def',
				name: 'def',
				playerId: 2,
				start: 400,
				optional: false,
				pieceNames: ['name-1'],
			},
			{
				end: 4800,
				id: 'inst_2_clip_ghi',
				name: 'ghi',
				playerId: undefined,
				start: 800,
				optional: false,
				pieceNames: ['name-2'],
			}, // Massive overlap
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0].instance, {
			poolName: 'clip',
			sessionName: 'abc',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1].instance, {
			poolName: 'clip',
			sessionName: 'def',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2].instance, {
			poolName: 'clip',
			sessionName: 'ghi',
		} satisfies PieceAbSessionInfo)
	})

	test('basic pieces - players with string Ids', () => {
		const previousAssignments = {}
		const pieces = [
			createBasicResolvedPieceInstance('0', 400, 5000, 'abc'),
			createBasicResolvedPieceInstance('1', 400, 5000, 'def'),
			createBasicResolvedPieceInstance('2', 800, 4000, 'ghi'),
		]

		mockGetPieceSessionId.mockImplementation(
			(piece, session) => `${piece._id}_${session.poolName}_${session.sessionName}`
		)

		const assignments = resolveAbSessions(
			abSessionHelper,
			resolverOptions,
			pieces,
			[],
			previousAssignments,
			POOL_NAME,
			['player1', 'player2'],
			4500
		)
		expect(assignments.failedRequired).toEqual([{ id: 'inst_2_clip_ghi', name: 'ghi', pieceNames: ['name-2'] }])
		expect(assignments.failedOptional).toHaveLength(0)
		expect(assignments.requests).toHaveLength(3)
		expect(assignments.requests).toEqual([
			{
				end: 5400,
				id: 'inst_0_clip_abc',
				name: 'abc',
				playerId: 'player1',
				start: 400,
				optional: false,
				pieceNames: ['name-0'],
			},
			{
				end: 5400,
				id: 'inst_1_clip_def',
				name: 'def',
				playerId: 'player2',
				start: 400,
				optional: false,
				pieceNames: ['name-1'],
			},
			{
				end: 4800,
				id: 'inst_2_clip_ghi',
				name: 'ghi',
				playerId: undefined,
				start: 800,
				optional: false,
				pieceNames: ['name-2'],
			}, // Massive overlap
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0].instance, {
			poolName: 'clip',
			sessionName: 'abc',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1].instance, {
			poolName: 'clip',
			sessionName: 'def',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2].instance, {
			poolName: 'clip',
			sessionName: 'ghi',
		} satisfies PieceAbSessionInfo)
	})

	test('basic pieces - players with number and string Ids', () => {
		const previousAssignments = {}
		const pieces = [
			createBasicResolvedPieceInstance('0', 400, 5000, 'abc'),
			createBasicResolvedPieceInstance('1', 400, 5000, 'def'),
			createBasicResolvedPieceInstance('2', 800, 4000, 'ghi'),
		]

		mockGetPieceSessionId.mockImplementation(
			(piece, session) => `${piece._id}_${session.poolName}_${session.sessionName}`
		)

		const assignments = resolveAbSessions(
			abSessionHelper,
			resolverOptions,
			pieces,
			[],
			previousAssignments,
			POOL_NAME,
			[1, 'player2'],
			4500
		)
		expect(assignments.failedRequired).toEqual([{ id: 'inst_2_clip_ghi', name: 'ghi', pieceNames: ['name-2'] }])
		expect(assignments.failedOptional).toHaveLength(0)
		expect(assignments.requests).toHaveLength(3)
		expect(assignments.requests).toEqual([
			{
				end: 5400,
				id: 'inst_0_clip_abc',
				name: 'abc',
				playerId: 1,
				start: 400,
				optional: false,
				pieceNames: ['name-0'],
			},
			{
				end: 5400,
				id: 'inst_1_clip_def',
				name: 'def',
				playerId: 'player2',
				start: 400,
				optional: false,
				pieceNames: ['name-1'],
			},
			{
				end: 4800,
				id: 'inst_2_clip_ghi',
				name: 'ghi',
				playerId: undefined,
				start: 800,
				optional: false,
				pieceNames: ['name-2'],
			}, // Massive overlap
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0].instance, {
			poolName: 'clip',
			sessionName: 'abc',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1].instance, {
			poolName: 'clip',
			sessionName: 'def',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2].instance, {
			poolName: 'clip',
			sessionName: 'ghi',
		} satisfies PieceAbSessionInfo)
	})

	test('Multiple pieces same id', () => {
		const previousAssignments = {}
		const pieces = [
			createBasicResolvedPieceInstance('0', 400, 5000, 'abc'), // First
			createBasicResolvedPieceInstance('1', 800, 4000, 'abc'), // Overlap
			createBasicResolvedPieceInstance('2', 5400, 1000, 'abc'), // Flush with last
			createBasicResolvedPieceInstance('3', 6400, 1000, 'abc'), // Gap before
		]

		mockGetPieceSessionId.mockImplementation((_piece, session) => `tmp_${session.poolName}_${session.sessionName}`)

		const assignments = resolveAbSessions(
			abSessionHelper,
			resolverOptions,
			pieces,
			[],
			previousAssignments,
			POOL_NAME,
			[1, 2],
			2500
		)
		expect(assignments.failedRequired).toHaveLength(0)
		expect(assignments.failedOptional).toHaveLength(0)
		expect(assignments.requests).toHaveLength(1)
		expect(assignments.requests).toEqual([
			{
				end: 7400,
				id: 'tmp_clip_abc',
				name: 'abc',
				playerId: 1,
				start: 400,
				optional: false,
				pieceNames: ['name-0', 'name-1', 'name-2', 'name-3'],
			},
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(4)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0].instance, {
			poolName: 'clip',
			sessionName: 'abc',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1].instance, {
			poolName: 'clip',
			sessionName: 'abc',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2].instance, {
			poolName: 'clip',
			sessionName: 'abc',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(4, pieces[3].instance, {
			poolName: 'clip',
			sessionName: 'abc',
		} satisfies PieceAbSessionInfo)
	})

	test('Reuse after gap', () => {
		const previousAssignments = {}
		const pieces = [
			createBasicResolvedPieceInstance('0', 400, 5000, 'abc'), // First
			createBasicResolvedPieceInstance('1', 800, 4000, 'def'), // Second
			createBasicResolvedPieceInstance('3', 6400, 1000, 'ghi'), // Wait, then reuse first
		]

		mockGetPieceSessionId.mockImplementation(
			(piece, session) => `${piece._id}_${session.poolName}_${session.sessionName}`
		)

		const assignments = resolveAbSessions(
			abSessionHelper,
			resolverOptions,
			pieces,
			[],
			previousAssignments,
			POOL_NAME,
			[1, 2],
			2500
		)
		expect(assignments.failedRequired).toHaveLength(0)
		expect(assignments.failedOptional).toHaveLength(0)
		expect(assignments.requests).toHaveLength(3)
		expect(assignments.requests).toEqual([
			{
				end: 5400,
				id: 'inst_0_clip_abc',
				name: 'abc',
				playerId: 1,
				start: 400,
				optional: false,
				pieceNames: ['name-0'],
			},
			{
				end: 4800,
				id: 'inst_1_clip_def',
				name: 'def',
				playerId: 2,
				start: 800,
				optional: false,
				pieceNames: ['name-1'],
			},
			{
				end: 7400,
				id: 'inst_3_clip_ghi',
				name: 'ghi',
				playerId: 2,
				start: 6400,
				optional: false,
				pieceNames: ['name-3'],
			},
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0].instance, {
			poolName: 'clip',
			sessionName: 'abc',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1].instance, {
			poolName: 'clip',
			sessionName: 'def',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2].instance, {
			poolName: 'clip',
			sessionName: 'ghi',
		} satisfies PieceAbSessionInfo)
	})

	test('Reuse immediately', () => {
		const previousAssignments = {}
		const pieces = [
			createBasicResolvedPieceInstance('0', 400, 5000, 'abc'), // First
			createBasicResolvedPieceInstance('1', 800, 6000, 'def'), // Second
			createBasicResolvedPieceInstance('3', 5400, 1000, 'ghi'), // Wait, then reuse first
		]

		mockGetPieceSessionId.mockImplementation(
			(piece, session) => `${piece._id}_${session.poolName}_${session.sessionName}`
		)

		const assignments = resolveAbSessions(
			abSessionHelper,
			resolverOptions,
			pieces,
			[],
			previousAssignments,
			POOL_NAME,
			[1, 2],
			2500
		)
		expect(assignments.failedRequired).toHaveLength(0)
		expect(assignments.failedOptional).toHaveLength(0)
		expect(assignments.requests).toHaveLength(3)
		expect(assignments.requests).toEqual([
			{
				end: 5400,
				id: 'inst_0_clip_abc',
				name: 'abc',
				playerId: 1,
				start: 400,
				optional: false,
				pieceNames: ['name-0'],
			},
			{
				end: 6800,
				id: 'inst_1_clip_def',
				name: 'def',
				playerId: 2,
				start: 800,
				optional: false,
				pieceNames: ['name-1'],
			},
			{
				end: 6400,
				id: 'inst_3_clip_ghi',
				name: 'ghi',
				playerId: 1,
				start: 5400,
				optional: false,
				pieceNames: ['name-3'],
			},
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0].instance, {
			poolName: 'clip',
			sessionName: 'abc',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1].instance, {
			poolName: 'clip',
			sessionName: 'def',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2].instance, {
			poolName: 'clip',
			sessionName: 'ghi',
		} satisfies PieceAbSessionInfo)
	})

	test('Reuse immediately dense', () => {
		const previousAssignments = {}
		const pieces = [
			createBasicResolvedPieceInstance('0', 400, 5000, 'abc'), // First
			createBasicResolvedPieceInstance('1', 800, 6000, 'def'), // Second
			createBasicResolvedPieceInstance('3', 5400, 1000, 'ghi'), // Wait, then reuse first
		]

		mockGetPieceSessionId.mockImplementation(
			(piece, session) => `${piece._id}_${session.poolName}_${session.sessionName}`
		)

		const assignments = resolveAbSessions(
			abSessionHelper,
			resolverOptions,
			pieces,
			[],
			previousAssignments,
			POOL_NAME,
			[1, 2],
			4000
		)
		expect(assignments.failedRequired).toHaveLength(0)
		expect(assignments.failedOptional).toHaveLength(0)
		expect(assignments.requests).toHaveLength(3)
		expect(assignments.requests).toEqual([
			{
				end: 5400,
				id: 'inst_0_clip_abc',
				name: 'abc',
				playerId: 1,
				start: 400,
				optional: false,
				pieceNames: ['name-0'],
			},
			{
				end: 6800,
				id: 'inst_1_clip_def',
				name: 'def',
				playerId: 2,
				start: 800,
				optional: false,
				pieceNames: ['name-1'],
			},
			{
				end: 6400,
				id: 'inst_3_clip_ghi',
				name: 'ghi',
				playerId: 1,
				start: 5400,
				optional: false,
				pieceNames: ['name-3'],
			},
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0].instance, {
			poolName: 'clip',
			sessionName: 'abc',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1].instance, {
			poolName: 'clip',
			sessionName: 'def',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2].instance, {
			poolName: 'clip',
			sessionName: 'ghi',
		} satisfies PieceAbSessionInfo)
	})

	test('basic reassignment', () => {
		const previousAssignments: ABSessionAssignments = {
			inst_0_clip_abc: {
				sessionId: 'inst_0_clip_abc',
				sessionName: 'abc',
				playerId: 5,
				lookahead: false,
			},
			inst_1_clip_def: {
				sessionId: 'inst_1_clip_def',
				sessionName: 'def',
				playerId: 1,
				lookahead: true,
			},
		}
		const pieces = [
			createBasicResolvedPieceInstance('0', 2400, 5000, 'abc'),
			createBasicResolvedPieceInstance('1', 2400, 5000, 'def'),
			createBasicResolvedPieceInstance('2', 2800, 4000, 'ghi'),
		]

		mockGetPieceSessionId.mockImplementation(
			(piece, session) => `${piece._id}_${session.poolName}_${session.sessionName}`
		)

		const assignments = resolveAbSessions(
			abSessionHelper,
			resolverOptions,
			pieces,
			[],
			previousAssignments,
			POOL_NAME,
			[1, 2],
			0
		)
		expect(assignments.failedRequired).toEqual([{ id: 'inst_2_clip_ghi', name: 'ghi', pieceNames: ['name-2'] }])
		expect(assignments.failedOptional).toHaveLength(0)
		expect(assignments.requests).toHaveLength(3)
		expect(assignments.requests).toEqual([
			{
				end: 7400,
				id: 'inst_0_clip_abc',
				name: 'abc',
				playerId: 2,
				start: 2400,
				optional: false,
				pieceNames: ['name-0'],
			},
			{
				end: 7400,
				id: 'inst_1_clip_def',
				name: 'def',
				playerId: 1,
				start: 2400,
				optional: false,
				pieceNames: ['name-1'],
			},
			{
				end: 6800,
				id: 'inst_2_clip_ghi',
				name: 'ghi',
				playerId: undefined,
				start: 2800,
				optional: false,
				pieceNames: ['name-2'],
			},
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0].instance, {
			poolName: 'clip',
			sessionName: 'abc',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1].instance, {
			poolName: 'clip',
			sessionName: 'def',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2].instance, {
			poolName: 'clip',
			sessionName: 'ghi',
		} satisfies PieceAbSessionInfo)
	})

	test('optional gets discarded', () => {
		const previousAssignments: ABSessionAssignments = {
			inst_0_clip_abc: {
				sessionId: 'inst_0_clip_abc',
				sessionName: 'abc',
				playerId: 2,
				lookahead: false,
			},
			inst_1_clip_def: {
				sessionId: 'inst_1_clip_def',
				sessionName: 'def',
				playerId: 1,
				lookahead: false,
			},
		}
		const pieces = [
			createBasicResolvedPieceInstance('0', 2400, 5000, 'abc'),
			createBasicResolvedPieceInstance('1', 2400, 5000, 'def', true),
			createBasicResolvedPieceInstance('2', 2800, 4000, 'ghi'),
		]

		mockGetPieceSessionId.mockImplementation(
			(piece, session) => `${piece._id}_${session.poolName}_${session.sessionName}`
		)

		const assignments = resolveAbSessions(
			abSessionHelper,
			resolverOptions,
			pieces,
			[],
			previousAssignments,
			POOL_NAME,
			[1, 2],
			0
		)
		expect(assignments.failedRequired).toHaveLength(0)
		expect(assignments.failedOptional).toEqual([{ id: 'inst_1_clip_def', name: 'def', pieceNames: ['name-1'] }])
		expect(assignments.requests).toHaveLength(3)
		expect(assignments.requests).toEqual([
			{
				end: 7400,
				id: 'inst_0_clip_abc',
				name: 'abc',
				playerId: 2,
				start: 2400,
				optional: false,
				pieceNames: ['name-0'],
			},
			{
				end: 7400,
				id: 'inst_1_clip_def',
				name: 'def',
				playerId: undefined,
				start: 2400,
				optional: true,
				pieceNames: ['name-1'],
			},
			{
				end: 6800,
				id: 'inst_2_clip_ghi',
				name: 'ghi',
				playerId: 1,
				start: 2800,
				optional: false,
				pieceNames: ['name-2'],
			},
		])

		expect(mockGetPieceSessionId).toHaveBeenCalledTimes(3)
		expect(mockGetObjectSessionId).toHaveBeenCalledTimes(0)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(1, pieces[0].instance, {
			poolName: 'clip',
			sessionName: 'abc',
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(2, pieces[1].instance, {
			poolName: 'clip',
			sessionName: 'def',
			optional: true,
		} satisfies PieceAbSessionInfo)
		expect(mockGetPieceSessionId).toHaveBeenNthCalledWith(3, pieces[2].instance, {
			poolName: 'clip',
			sessionName: 'ghi',
		} satisfies PieceAbSessionInfo)
	})

	// TODO add some tests which check lookahead
})
