import { ABResolverConfiguration, TSR } from '@sofie-automation/blueprints-integration'
import { ABSessionAssignments } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { CommonContext } from '../../../blueprints/context/index.js'
import { AbSessionHelper } from '../abSessionHelper.js'
import { applyAbPlayerObjectAssignments } from '../applyAssignments.js'

const POOL_NAME = 'clip'

describe('applyMediaPlayersAssignments', () => {
	const abSessionHelper = new AbSessionHelper([], [])

	const mockGetPieceSessionId: jest.MockedFunction<typeof abSessionHelper.getPieceABSessionId> = jest.fn()
	const mockGetObjectSessionId: jest.MockedFunction<typeof abSessionHelper.getTimelineObjectAbSessionId> = jest.fn()

	const context = new CommonContext({
		name: 'test',
		identifier: 'test',
	})

	const abConfiguration: Pick<ABResolverConfiguration, 'timelineObjectLayerChangeRules' | 'customApplyToObject'> = {}

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

	test('no assignments', () => {
		const res = applyAbPlayerObjectAssignments(abSessionHelper, context, abConfiguration, [], {}, [], POOL_NAME)
		expect(res).toEqual({})
	})

	test('only previous assignments', () => {
		const previousAssignments: ABSessionAssignments = {
			abc: {
				sessionId: 'abc',
				sessionName: 'abc',
				playerId: 5,
				lookahead: false,
			},
			def: {
				sessionId: 'def',
				sessionName: 'def',
				playerId: 3,
				lookahead: true,
			},
		}

		const res = applyAbPlayerObjectAssignments(
			abSessionHelper,
			context,
			abConfiguration,
			[],
			previousAssignments,
			[],
			POOL_NAME
		)
		expect(res).toEqual({})
	})

	test('object with unmatched assignments', () => {
		const previousAssignments: ABSessionAssignments = {
			piece0_clip_def: {
				sessionId: 'piece0_clip_def',
				sessionName: 'def',
				playerId: 3,
				lookahead: false,
			},
		}
		const pieceInstanceId = 'piece0'
		const partInstanceId = protectString('part0')

		mockGetObjectSessionId.mockImplementation(
			(obj, session) => `${obj.pieceInstanceId}_${session.poolName}_${session.sessionName}`
		)

		const objects = [
			literal<OnGenerateTimelineObjExt>({
				// This should not get assigned, as it is truely unknown, and could cause all kinds of chaos
				id: '0',
				layer: '0',
				enable: {
					start: 900,
					duration: 1000,
				},
				content: {
					deviceType: TSR.DeviceType.ABSTRACT,
				},
				abSessions: [
					{
						sessionName: 'abc',
						poolName: POOL_NAME,
					},
				],
				metaData: null,
				pieceInstanceId: pieceInstanceId,
				partInstanceId: partInstanceId,
				priority: 0,
			}),
			literal<OnGenerateTimelineObjExt>({
				// This should get assigned, as it was previously known
				id: '1',
				layer: '1',
				enable: {
					start: 3000,
					duration: 1000,
				},
				content: {
					deviceType: TSR.DeviceType.ABSTRACT,
				},
				abSessions: [
					{
						sessionName: 'def',
						poolName: POOL_NAME,
					},
				],
				metaData: null,
				pieceInstanceId: pieceInstanceId,
				partInstanceId: partInstanceId,
				priority: 0,
			}),
		]

		const res = applyAbPlayerObjectAssignments(
			abSessionHelper,
			context,
			abConfiguration,
			objects,
			previousAssignments,
			[],
			POOL_NAME
		)
		// expect(context._getNotes()).toHaveLength(0)
		expect(res).toMatchObject({
			piece0_clip_def: {
				sessionId: 'piece0_clip_def',
				playerId: 3,
				lookahead: false,
			},
		})
	})

	// TODO - more tests
})
