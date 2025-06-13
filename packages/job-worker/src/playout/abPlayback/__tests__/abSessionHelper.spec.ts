import { PartInstanceId, PieceInstanceInfiniteId, PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ABSessionInfo } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { clone, getRandomId, omit } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { MockJobContext, setupDefaultJobEnvironment } from '../../../__mocks__/context.js'
import _ from 'underscore'
import { setupDefaultRundownPlaylist, setupMockShowStyleCompound } from '../../../__mocks__/presetCollections.js'
import { AbSessionHelper } from '../abSessionHelper.js'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { TimelineObjectAbSessionInfo } from '@sofie-automation/shared-lib/dist/core/model/Timeline'

describe('AbSessionHelper', () => {
	let jobContext: MockJobContext
	beforeEach(async () => {
		jobContext = setupDefaultJobEnvironment()

		await setupMockShowStyleCompound(jobContext)
	})

	const getSessionId = (n: number): string => `session#${n}`
	function getSessionHelper(
		trackedAbSessions: ABSessionInfo[],
		...sortedPartInstances: Array<DBPartInstance | undefined>
	) {
		const partInstances = _.compact(sortedPartInstances)

		const abSessionHelper = new AbSessionHelper(partInstances, clone<ABSessionInfo[]>(trackedAbSessions ?? []))

		let nextId = 0
		abSessionHelper.getNewSessionId = () => getSessionId(nextId++)

		return abSessionHelper
	}

	function getAllKnownSessions(abSessionHelper: AbSessionHelper): ABSessionInfo[] {
		const sessions: ABSessionInfo[] = abSessionHelper.allKnownSessions
		expect(sessions).toBeTruthy()

		return sessions.map((s) => omit<ABSessionInfo & { keep?: boolean }, 'keep'>(s, 'keep'))
	}
	// function overwriteKnownSessions(context: TimelineEventContext, sessions: ABSessionInfo[]): void {
	// 	const context2 = context as any
	// 	context2._knownSessions = sessions
	// }
	function createPieceInstance(
		partInstanceId: PartInstanceId | string,
		infiniteInstanceId?: PieceInstanceInfiniteId
	): PieceInstance {
		// This defines only the minimum required values for the method we are calling
		const pieceInstance = {
			_id: getRandomId(),
			partInstanceId,
			infinite: infiniteInstanceId ? { infiniteInstanceId } : undefined,
		} as any

		return pieceInstance
	}
	function createTimelineObject(
		partInstanceId: PartInstanceId | string | null,
		infinitePieceInstanceId?: PieceInstanceInfiniteId,
		isLookahead?: boolean
	): OnGenerateTimelineObjExt {
		// This defines only the minimum required values for the method we are calling
		return {
			partInstanceId,
			infinitePieceInstanceId,
			isLookahead: !!isLookahead,
		} as any
	}
	function createPartInstance(id: string, partId: string, rank: number): DBPartInstance {
		// This defines only the minimum required values for the method we are calling
		return {
			_id: id,
			part: {
				_id: partId,
				_rank: rank,
			},
		} as any
	}

	const testSession0: TimelineObjectAbSessionInfo = {
		poolName: 'pool0',
		sessionName: 'name0',
	}
	const testSession1: TimelineObjectAbSessionInfo = {
		poolName: 'pool0',
		sessionName: 'name1',
	}
	const testSession2: TimelineObjectAbSessionInfo = {
		poolName: 'pool0',
		sessionName: 'name2',
	}

	const unqiueSession0: TimelineObjectAbSessionInfo = {
		...testSession0,
		sessionNameIsGloballyUnique: true,
	}
	const unqiueSession1: TimelineObjectAbSessionInfo = {
		...testSession1,
		sessionNameIsGloballyUnique: true,
	}

	test('getPieceABSessionId - knownSessions basic', async () => {
		const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
		const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		// No sessions
		{
			const abSessionHelper = getSessionHelper([])
			expect(abSessionHelper.knownSessions).toEqual([])
		}

		// some sessions
		{
			const sessions: ABSessionInfo[] = [{ id: 'abc', name: 'no', isUniqueName: false }]
			// Mod the sessions to be returned by knownSessions
			const moddedSessions = sessions.map((s) => ({ ...s, keep: true }))
			const abSessionHelper = getSessionHelper(moddedSessions)
			expect(abSessionHelper.knownSessions).toEqual(sessions)
		}
	})

	test('getPieceABSessionId - bad parameters', async () => {
		const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
		const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		{
			const abSessionHelper = getSessionHelper([])

			const piece1 = createPieceInstance(undefined as any)
			expect(() => abSessionHelper.getPieceABSessionId(piece1, testSession0)).toThrow(
				'Unknown partInstanceId in call to getPieceABSessionId'
			)

			const piece2 = createPieceInstance('defdef')
			expect(() => abSessionHelper.getPieceABSessionId(piece2, testSession0)).toThrow(
				'Unknown partInstanceId in call to getPieceABSessionId'
			)
		}

		{
			const tmpPartInstance = createPartInstance('abcdef', 'aaa', 1)
			const abSessionHelper = getSessionHelper([], tmpPartInstance)

			const piece0 = createPieceInstance('defdef')
			expect(() => abSessionHelper.getPieceABSessionId(piece0, testSession0)).toThrow(
				'Unknown partInstanceId in call to getPieceABSessionId'
			)

			const piece1 = createPieceInstance('abcdef')
			expect(abSessionHelper.getPieceABSessionId(piece1, testSession0)).toBeTruthy()
		}
	})

	test('getPieceABSessionId - normal session', async () => {
		const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
		const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
		const currentPartInstance = createPartInstance('12345', 'bbb', 0)
		const abSessionHelper = getSessionHelper([], currentPartInstance, nextPartInstance)

		// Get the id
		const piece0 = createPieceInstance(nextPartInstance._id)
		const expectedSessions: ABSessionInfo[] = [
			{
				id: getSessionId(0),
				infiniteInstanceId: undefined,
				name: 'pool0_name0',
				isUniqueName: false,
				partInstanceIds: [nextPartInstance._id],
			},
		]
		expect(abSessionHelper.getPieceABSessionId(piece0, testSession0)).toEqual(expectedSessions[0].id)
		expect(getAllKnownSessions(abSessionHelper)).toEqual(expectedSessions)
		expect(abSessionHelper.knownSessions).toHaveLength(1)

		// Should get the same id again
		expect(abSessionHelper.getPieceABSessionId(piece0, testSession0)).toEqual(expectedSessions[0].id)
		expect(getAllKnownSessions(abSessionHelper)).toEqual(expectedSessions)
		expect(abSessionHelper.knownSessions).toHaveLength(1)

		const piece1 = createPieceInstance(nextPartInstance._id)
		expect(abSessionHelper.getPieceABSessionId(piece1, testSession0)).toEqual(expectedSessions[0].id)
		expect(getAllKnownSessions(abSessionHelper)).toEqual(expectedSessions)
		expect(abSessionHelper.knownSessions).toHaveLength(1)

		// Try for the other part
		const piece2 = createPieceInstance(currentPartInstance._id)
		expect(abSessionHelper.getPieceABSessionId(piece2, testSession0)).not.toEqual(expectedSessions[0].id)
		expect(abSessionHelper.knownSessions).toHaveLength(2)

		// Or another name
		expect(abSessionHelper.getPieceABSessionId(piece1, testSession1)).not.toEqual(expectedSessions[0].id)
		expect(abSessionHelper.knownSessions).toHaveLength(3)
	})

	test('getPieceABSessionId - existing normal sessions', async () => {
		const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
		const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
		const currentPartInstance = createPartInstance('12345', 'bbb', 0)

		const expectedSessions: ABSessionInfo[] = [
			{
				id: 'current0',
				name: 'pool0_name0',
				isUniqueName: false,
				partInstanceIds: [currentPartInstance._id],
			},
			{
				id: 'current1',
				name: 'pool0_name1',
				isUniqueName: false,
				partInstanceIds: [currentPartInstance._id],
			},
			{
				id: 'next0',
				name: 'pool0_name0',
				isUniqueName: false,
				partInstanceIds: [nextPartInstance._id],
			},
		]

		const abSessionHelper = getSessionHelper(expectedSessions, currentPartInstance, nextPartInstance)

		// Reuse the ids
		const piece0 = createPieceInstance(currentPartInstance._id)
		expect(abSessionHelper.getPieceABSessionId(piece0, testSession0)).toEqual(expectedSessions[0].id)
		expect(getAllKnownSessions(abSessionHelper)).toEqual(expectedSessions)
		expect(abSessionHelper.knownSessions).toHaveLength(1)

		const piece1 = createPieceInstance(currentPartInstance._id)
		expect(abSessionHelper.getPieceABSessionId(piece1, testSession1)).toEqual(expectedSessions[1].id)
		expect(getAllKnownSessions(abSessionHelper)).toEqual(expectedSessions)
		expect(abSessionHelper.knownSessions).toHaveLength(2)

		const piece2 = createPieceInstance(nextPartInstance._id)
		expect(abSessionHelper.getPieceABSessionId(piece2, testSession0)).toEqual(expectedSessions[2].id)
		expect(getAllKnownSessions(abSessionHelper)).toEqual(expectedSessions)
		expect(abSessionHelper.knownSessions).toHaveLength(3)
	})

	test('getPieceABSessionId - continue normal session from previous part', async () => {
		const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
		const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
		const currentPartInstance = createPartInstance('12345', 'bbb', 0)

		const abSessionHelper = getSessionHelper([], currentPartInstance, nextPartInstance)

		const sessionId = getSessionId(0)
		const piece0 = createPieceInstance(currentPartInstance._id)
		expect(abSessionHelper.getPieceABSessionId(piece0, testSession0)).toEqual(sessionId)
		expect(abSessionHelper.knownSessions).toHaveLength(1)

		const piece2 = createPieceInstance(nextPartInstance._id)
		expect(abSessionHelper.getPieceABSessionId(piece2, testSession0)).toEqual(sessionId)
		expect(abSessionHelper.knownSessions).toHaveLength(1)
	})

	test('getPieceABSessionId - promote lookahead session from previous part', async () => {
		const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
		const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		const previousPartInstance = createPartInstance('abcdef', 'aaa', 0)
		const currentPartInstance = createPartInstance('12345', 'bbb', 1)
		const distantPartId: PartId = protectString('future-part')

		const lookaheadSessions: ABSessionInfo[] = [
			{
				id: 'lookahead0',
				name: 'pool0_name0',
				isUniqueName: false,
				lookaheadForPartId: currentPartInstance.part._id,
				partInstanceIds: [currentPartInstance._id],
			},
			{
				id: 'lookahead1',
				name: 'pool0_name1',
				isUniqueName: false,
				lookaheadForPartId: currentPartInstance.part._id,
				partInstanceIds: undefined,
			},
			{
				id: 'lookahead2',
				name: 'pool0_name2',
				isUniqueName: false,
				lookaheadForPartId: distantPartId,
				partInstanceIds: undefined,
			},
		]

		const abSessionHelper = getSessionHelper(lookaheadSessions, previousPartInstance, currentPartInstance)

		// lookahead0 is for us
		const piece0 = createPieceInstance(currentPartInstance._id)
		expect(abSessionHelper.getPieceABSessionId(piece0, testSession0)).toEqual('lookahead0')
		expect(abSessionHelper.knownSessions).toHaveLength(1)

		// lookahead1 is for us
		const piece1 = createPieceInstance(currentPartInstance._id)
		expect(abSessionHelper.getPieceABSessionId(piece1, testSession1)).toEqual('lookahead1')
		expect(abSessionHelper.knownSessions).toHaveLength(2)

		// lookahead2 is not for us, so we shouldnt get it
		const sessionId = getSessionId(0)
		const piece2 = createPieceInstance(currentPartInstance._id)
		expect(abSessionHelper.getPieceABSessionId(piece2, testSession2)).toEqual(sessionId)
		expect(abSessionHelper.knownSessions).toHaveLength(3)
	})

	test('getPieceABSessionId - infinite sessions', async () => {
		const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
		const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
		const currentPartInstance = createPartInstance('12345', 'bbb', 10)

		const abSessionHelper = getSessionHelper([], currentPartInstance, nextPartInstance)

		// Start a new infinite session
		const sessionId0 = getSessionId(0)
		const infinite0 = protectString('infinite0')
		const piece0 = createPieceInstance(currentPartInstance._id, infinite0)
		expect(abSessionHelper.getPieceABSessionId(piece0, testSession0)).toEqual(sessionId0)
		expect(abSessionHelper.knownSessions).toHaveLength(1)

		// Double check the reuslt
		expect(abSessionHelper.getPieceABSessionId(piece0, testSession0)).toEqual(sessionId0)
		expect(abSessionHelper.knownSessions).toHaveLength(1)

		// Normal piece in the same part gets different id
		const sessionId1 = getSessionId(1)
		const piece1 = createPieceInstance(currentPartInstance._id)
		expect(abSessionHelper.getPieceABSessionId(piece1, testSession0)).toEqual(sessionId1)
		expect(abSessionHelper.knownSessions).toHaveLength(2)

		// Span session to a part with a lower rank
		const piece2 = createPieceInstance(nextPartInstance._id, infinite0)
		expect(abSessionHelper.getPieceABSessionId(piece2, testSession0)).toEqual(sessionId0)
		expect(abSessionHelper.knownSessions).toHaveLength(2)
	})

	test('getPieceABSessionId - unique session', async () => {
		const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
		const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
		const currentPartInstance = createPartInstance('12345', 'bbb', 0)
		const abSessionHelper = getSessionHelper([], currentPartInstance, nextPartInstance)

		// Get the id
		const piece0 = createPieceInstance(nextPartInstance._id)
		const expectedSessions: ABSessionInfo[] = [
			{
				id: getSessionId(0),
				name: 'pool0_name0',
				isUniqueName: true,
			},
		]
		expect(abSessionHelper.getPieceABSessionId(piece0, unqiueSession0)).toEqual(expectedSessions[0].id)
		expect(getAllKnownSessions(abSessionHelper)).toEqual(expectedSessions)
		expect(abSessionHelper.knownSessions).toHaveLength(1)

		// Should get the same id again
		expect(abSessionHelper.getPieceABSessionId(piece0, unqiueSession0)).toEqual(expectedSessions[0].id)
		expect(getAllKnownSessions(abSessionHelper)).toEqual(expectedSessions)
		expect(abSessionHelper.knownSessions).toHaveLength(1)

		const piece1 = createPieceInstance(nextPartInstance._id)
		expect(abSessionHelper.getPieceABSessionId(piece1, unqiueSession0)).toEqual(expectedSessions[0].id)
		expect(getAllKnownSessions(abSessionHelper)).toEqual(expectedSessions)
		expect(abSessionHelper.knownSessions).toHaveLength(1)

		// Try for the other part
		const piece2 = createPieceInstance(currentPartInstance._id)
		expect(abSessionHelper.getPieceABSessionId(piece2, unqiueSession0)).toEqual(expectedSessions[0].id)
		expect(abSessionHelper.knownSessions).toHaveLength(1)

		// Or the non-unique version
		expect(
			abSessionHelper.getPieceABSessionId(piece1, { ...unqiueSession0, sessionNameIsGloballyUnique: false })
		).not.toEqual(expectedSessions[0].id)
		expect(abSessionHelper.knownSessions).toHaveLength(2)
	})

	test('getTimelineObjectAbSessionId - bad parameters', async () => {
		const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
		const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		const abSessionHelper = getSessionHelper([])

		// no session needed
		expect(abSessionHelper.getTimelineObjectAbSessionId({} as any, testSession0)).toBeUndefined()

		// unknown partInstance
		const obj1 = createTimelineObject('abcd')
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj1, testSession0)).toBeUndefined()
	})

	function generateGetTimelineObjectAbSessionIdSessions(
		currentPartInstance: DBPartInstance,
		nextPartInstance: DBPartInstance,
		distantPartId: PartId,
		infinite0: PieceInstanceInfiniteId,
		infinite1: PieceInstanceInfiniteId
	): ABSessionInfo[] {
		return [
			{
				id: 'current0',
				name: 'pool0_name0',
				isUniqueName: false,
				partInstanceIds: [currentPartInstance._id],
			},
			{
				id: 'current1',
				name: 'pool0_name1',
				isUniqueName: false,
				partInstanceIds: [currentPartInstance._id],
			},
			{
				id: 'next0',
				name: 'pool0_name0',
				isUniqueName: false,
				partInstanceIds: [nextPartInstance._id],
			},
			{
				id: 'lookahead0',
				name: 'pool0_name0',
				isUniqueName: false,
				lookaheadForPartId: currentPartInstance.part._id,
				partInstanceIds: [currentPartInstance._id],
			},
			{
				id: 'lookahead1',
				name: 'pool0_name1',
				isUniqueName: false,
				lookaheadForPartId: currentPartInstance.part._id,
				partInstanceIds: undefined,
			},
			{
				id: 'lookahead2',
				name: 'pool0_name2',
				isUniqueName: false,
				lookaheadForPartId: distantPartId,
				partInstanceIds: undefined,
			},
			{
				id: 'inf0',
				name: 'pool0_name0',
				isUniqueName: false,
				infiniteInstanceId: infinite0,
			},
			{
				id: 'inf1',
				name: 'pool0_name0',
				isUniqueName: false,
				infiniteInstanceId: infinite1,
			},
		]
	}

	test('getTimelineObjectAbSessionId - normal', async () => {
		const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
		const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
		const currentPartInstance = createPartInstance('12345', 'bbb', 10)

		const existingSessions = generateGetTimelineObjectAbSessionIdSessions(
			currentPartInstance,
			createPartInstance('unknown', 'unknwon1', 9),
			protectString('nope'),
			protectString('infinite0'),
			protectString('infinite1')
		)

		const abSessionHelper = getSessionHelper(existingSessions, currentPartInstance, nextPartInstance)

		// no session recorded for partInstance
		const obj1 = createTimelineObject(nextPartInstance._id)
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj1, testSession0)).toBeUndefined()

		// partInstance with session
		const obj2 = createTimelineObject(currentPartInstance._id)
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj2, testSession0)).toEqual('current0')
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj2, testSession1)).toEqual('current1')

		// // define a session now
		// overwriteKnownSessions(context, [{
		// 	{
		// 		id: 'current0',
		// 		name: 'pool0_name0',
		// 		partInstanceIds: [currentPartInstance._id],
		// 	},
		// }])

		// Ensure the sessions havent changed
		expect(getAllKnownSessions(abSessionHelper)).toEqual(existingSessions)
	})

	test('getTimelineObjectAbSessionId - lookahead', async () => {
		const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
		const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
		const currentPartInstance = createPartInstance('12345', 'bbb', 10)

		const distantPartId: PartId = protectString('distant0')
		const existingSessions = generateGetTimelineObjectAbSessionIdSessions(
			currentPartInstance,
			nextPartInstance,
			distantPartId,
			protectString('infinite0'),
			protectString('infinite1')
		)

		const abSessionHelper = getSessionHelper([...existingSessions], currentPartInstance, nextPartInstance)

		// no session if no partId
		const obj1 = createTimelineObject(null, undefined, true)
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj1, testSession0)).toBeUndefined()
		expect(abSessionHelper.knownSessions).toHaveLength(0)

		// existing 'distant' lookahead session
		const obj2 = createTimelineObject(unprotectString(distantPartId), undefined, true)
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj2, testSession2)).toEqual('lookahead2')
		expect(abSessionHelper.knownSessions).toHaveLength(1)

		// new 'distant' lookahead session
		const obj2a = createTimelineObject(unprotectString(distantPartId), undefined, true)
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj2a, testSession0)).toEqual(getSessionId(0))
		expect(abSessionHelper.knownSessions).toHaveLength(2)
		existingSessions.push({
			id: getSessionId(0),
			lookaheadForPartId: distantPartId,
			name: 'pool0_name0',
			isUniqueName: false,
		})

		// current partInstance session
		const obj3 = createTimelineObject(currentPartInstance._id, undefined, true)
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj3, testSession1)).toEqual('current1')
		expect(abSessionHelper.knownSessions).toHaveLength(3)

		// next partInstance session
		const obj4 = createTimelineObject(nextPartInstance._id, undefined, true)
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj4, testSession0)).toEqual('next0')
		expect(abSessionHelper.knownSessions).toHaveLength(4)

		// next partInstance new session
		const obj5 = createTimelineObject(nextPartInstance._id, undefined, true)
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj5, testSession1)).toEqual(getSessionId(1))
		expect(abSessionHelper.knownSessions).toHaveLength(5)

		existingSessions.push({
			id: getSessionId(1),
			lookaheadForPartId: nextPartInstance.part._id,
			name: 'pool0_name1',
			isUniqueName: false,
			partInstanceIds: [nextPartInstance._id],
		})

		// Ensure the sessions havent changed
		expect(getAllKnownSessions(abSessionHelper)).toEqual(existingSessions)
	})

	test('getTimelineObjectAbSessionId - lookahead2', async () => {
		const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
		const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
		const currentPartInstance = createPartInstance('12345', 'bbb', 10)

		const distantPartId: PartId = protectString('distant0')
		const infinite0: PieceInstanceInfiniteId = protectString('infinite0')
		const infinite1: PieceInstanceInfiniteId = protectString('infinite1')
		const existingSessions = generateGetTimelineObjectAbSessionIdSessions(
			currentPartInstance,
			nextPartInstance,
			distantPartId,
			infinite0,
			infinite1
		)

		const abSessionHelper = getSessionHelper([...existingSessions], currentPartInstance, nextPartInstance)

		const obj1 = createTimelineObject(currentPartInstance._id, infinite0)
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj1, testSession0)).toEqual('inf0')
		expect(abSessionHelper.knownSessions).toHaveLength(1)

		const obj2 = createTimelineObject(null, infinite1)
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj2, testSession0)).toEqual('inf1')
		expect(abSessionHelper.knownSessions).toHaveLength(2)

		const obj3 = createTimelineObject(null, protectString('fake'))
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj3, testSession0)).toBeUndefined()
		expect(abSessionHelper.knownSessions).toHaveLength(2)

		// Ensure the sessions havent changed
		expect(getAllKnownSessions(abSessionHelper)).toEqual(existingSessions)
	})

	test('getTimelineObjectAbSessionId - unique session', async () => {
		const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
		const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
		const currentPartInstance = createPartInstance('12345', 'bbb', 10)

		const existingSessions: ABSessionInfo[] = [
			{
				id: 'unique0',
				name: 'pool0_name0',
				isUniqueName: true,
			},
			{
				id: 'unique1',
				name: 'pool0_name1',
				isUniqueName: true,
			},
			{
				id: 'normal0',
				name: 'pool0_name0',
				isUniqueName: false,
				partInstanceIds: [currentPartInstance._id],
			},
		]

		const abSessionHelper = getSessionHelper(existingSessions, currentPartInstance, nextPartInstance)

		// no session recorded for partInstance
		const obj1 = createTimelineObject(nextPartInstance._id)
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj1, unqiueSession0)).toEqual('unique0')

		// partInstance with session
		const obj2 = createTimelineObject(currentPartInstance._id)
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj2, unqiueSession0)).toEqual('unique0')
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj2, unqiueSession1)).toEqual('unique1')

		// Non unique sessions
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj2, testSession0)).toEqual('normal0')
		expect(abSessionHelper.getTimelineObjectAbSessionId(obj1, testSession0)).toBeUndefined()

		// Ensure the sessions havent changed
		expect(getAllKnownSessions(abSessionHelper)).toEqual(existingSessions)
	})
})
