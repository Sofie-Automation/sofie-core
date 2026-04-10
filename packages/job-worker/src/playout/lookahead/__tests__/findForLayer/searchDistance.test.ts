jest.mock('../../findObjects')
import { context, TfindLookaheadObjectsForPart } from './helpers/mockSetup.js'
import { findLookaheadForLayer } from '../../findForLayer.js'
import { expectInstancesToMatch } from '../utils.js'
import { findForLayerTestConstants } from './constants.js'
import { findLookaheadObjectsForPart } from '../../findObjects.js'

const findLookaheadObjectsForPartMockBase = findLookaheadObjectsForPart as TfindLookaheadObjectsForPart
const findLookaheadObjectsForPartMock = findLookaheadObjectsForPartMockBase.mockImplementation(() => []) // Default mock

beforeEach(() => {
	findLookaheadObjectsForPartMock.mockReset()
})

const previous = findForLayerTestConstants.previous
const current = findForLayerTestConstants.current
const nextFuture = findForLayerTestConstants.nextFuture
const orderedParts = findForLayerTestConstants.orderedParts
const layer = findForLayerTestConstants.layer
const onAirPlayoutState = findForLayerTestConstants.playoutState.onAir

describe('findLookaheadForLayer – search distance', () => {
	test('searchDistance = 0 ignores future parts', () => {
		findLookaheadObjectsForPartMock.mockReturnValueOnce([] as any).mockReturnValueOnce(['cur0', 'cur1'] as any)

		const res = findLookaheadForLayer(
			context,
			{ previous, current, next: nextFuture },
			orderedParts,
			layer,
			1,
			0,
			onAirPlayoutState,
			null
		)

		expect(res.timed).toEqual(['cur0', 'cur1'])
		expect(res.future).toHaveLength(0)

		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(3)
		expectInstancesToMatch(findLookaheadObjectsForPartMock, 2, layer, current, previous[0], onAirPlayoutState)
		expectInstancesToMatch(findLookaheadObjectsForPartMock, 3, layer, nextFuture, current, onAirPlayoutState)
	})

	test('returns nothing when maxSearchDistance is too small', () => {
		findLookaheadObjectsForPartMock
			.mockReturnValue([])
			.mockReturnValueOnce(['t0', 't1'] as any)
			.mockReturnValueOnce(['t2', 't3'] as any)
			.mockReturnValueOnce(['t4', 't5'] as any)
			.mockReturnValueOnce(['t6', 't7'] as any)
			.mockReturnValueOnce(['t8', 't9'] as any)

		const res = findLookaheadForLayer(
			context,
			{
				previous: [],
			},
			orderedParts,
			layer,
			1,
			1,
			onAirPlayoutState,
			null
		)

		expect(res.timed).toHaveLength(0)
		expect(res.future).toHaveLength(0)
		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(0)
	})
})
