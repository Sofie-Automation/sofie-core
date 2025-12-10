import { findLookaheadForLayer } from '../../findForLayer.js'
import { setupDefaultJobEnvironment } from '../../../../__mocks__/context.js'

jest.mock('../../findObjects')
import { findForLayerTestConstants } from './constants.js'
import { expectPartToMatch } from '../utils.js'
import { findLookaheadObjectsForPartMock } from './helpers/mockSetup.js'

const orderedParts = findForLayerTestConstants.orderedParts
const layer = findForLayerTestConstants.layer

describe('findLookaheadForLayer - orderedParts', () => {
	beforeEach(() => {
		findLookaheadObjectsForPartMock.mockReset()
	})

	const context = setupDefaultJobEnvironment()

	test('finds lookahead for target index 1', () => {
		findLookaheadObjectsForPartMock
			.mockReturnValue([])
			.mockReturnValueOnce(['t0', 't1'] as any)
			.mockReturnValueOnce(['t2', 't3'] as any)
			.mockReturnValueOnce(['t4', 't5'] as any)
			.mockReturnValueOnce(['t6', 't7'] as any)
			.mockReturnValueOnce(['t8', 't9'] as any)

		const res2 = findLookaheadForLayer(context, {}, orderedParts, layer, 1, 4, null)

		expect(res2.timed).toHaveLength(0)
		expect(res2.future).toEqual(['t0', 't1'])
		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(1)

		expectPartToMatch(1, layer, orderedParts[0], undefined)
	})

	test('returns nothing when target index is 0', () => {
		findLookaheadObjectsForPartMock.mockReturnValue([])

		const res3 = findLookaheadForLayer(context, {}, orderedParts, layer, 0, 4, null)

		expect(res3.timed).toHaveLength(0)
		expect(res3.future).toHaveLength(0)
		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(0)
	})

	test('searches across maximum search distance', () => {
		findLookaheadObjectsForPartMock
			.mockReturnValue([])
			.mockReturnValueOnce(['t0', 't1'] as any)
			.mockReturnValueOnce(['t2', 't3'] as any)
			.mockReturnValueOnce(['t4', 't5'] as any)
			.mockReturnValueOnce(['t6', 't7'] as any)
			.mockReturnValueOnce(['t8', 't9'] as any)

		const res4 = findLookaheadForLayer(context, {}, orderedParts, layer, 100, 5, null)

		expect(res4.timed).toHaveLength(0)
		expect(res4.future).toEqual(['t0', 't1', 't2', 't3', 't4', 't5'])

		// Called for parts: [0], [2], [3]
		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(3)

		expectPartToMatch(1, layer, orderedParts[0], undefined)
		expectPartToMatch(2, layer, orderedParts[2], orderedParts[0].part)
		expectPartToMatch(3, layer, orderedParts[3], orderedParts[2].part)
	})
})
