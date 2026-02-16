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

const current = findForLayerTestConstants.current
const nextFuture = findForLayerTestConstants.nextFuture
const layer = findForLayerTestConstants.layer

describe('findLookaheadForLayer – basic behavior', () => {
	test('no parts', () => {
		const res = findLookaheadForLayer(context, {}, [], 'abc', 1, 1)

		expect(res.timed).toHaveLength(0)
		expect(res.future).toHaveLength(0)
	})
	test('if the previous part is unset', () => {
		findLookaheadObjectsForPartMock.mockReturnValue([])

		findLookaheadForLayer(context, { previous: undefined, current, next: nextFuture }, [], layer, 1, 1)

		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(2)
		expectInstancesToMatch(findLookaheadObjectsForPartMock, 1, layer, current, undefined)
	})
})
