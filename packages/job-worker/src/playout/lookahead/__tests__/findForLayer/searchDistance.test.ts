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

describe('findLookaheadForLayer – search distance', () => {
	test('searchDistance = 0 ignores future parts', () => {
		findLookaheadObjectsForPartMock.mockReturnValueOnce(['cur0', 'cur1'] as any)

		const res = findLookaheadForLayer(
			context,
			{ previous, current, next: nextFuture },
			orderedParts,
			layer,
			1,
			0,
			null
		)

		expect(res.timed).toEqual(['cur0', 'cur1'])
		expect(res.future).toHaveLength(0)

		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(2)
		expectInstancesToMatch(findLookaheadObjectsForPartMock, 1, layer, current, previous)
		expectInstancesToMatch(findLookaheadObjectsForPartMock, 2, layer, nextFuture, current)
	})

	test('returns nothing when maxSearchDistance is too small', () => {
		findLookaheadObjectsForPartMock
			.mockReturnValue([])
			.mockReturnValueOnce(['t0', 't1'] as any)
			.mockReturnValueOnce(['t2', 't3'] as any)
			.mockReturnValueOnce(['t4', 't5'] as any)
			.mockReturnValueOnce(['t6', 't7'] as any)
			.mockReturnValueOnce(['t8', 't9'] as any)

		const res = findLookaheadForLayer(context, {}, orderedParts, layer, 1, 1, null)

		expect(res.timed).toHaveLength(0)
		expect(res.future).toHaveLength(0)
		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(0)
	})
})
