jest.mock('../../findObjects')
import { context, TfindLookaheadObjectsForPart } from './helpers/mockSetup.js'
import { findLookaheadForLayer } from '../../findForLayer.js'
import { expectInstancesToMatch } from '../utils.js'
import { findForLayerTestConstants } from './constants.js'
import { findLookaheadObjectsForPart } from '../../findObjects.js'

const findLookaheadObjectsForPartMockBase = findLookaheadObjectsForPart as TfindLookaheadObjectsForPart
const findLookaheadObjectsForPartMock = findLookaheadObjectsForPartMockBase.mockImplementation(() => []) // Default mock
const onAirPlayoutState = findForLayerTestConstants.playoutState.onAir

beforeEach(() => {
	findLookaheadObjectsForPartMock.mockReset()
})

const previous = findForLayerTestConstants.previous
const current = findForLayerTestConstants.current
const nextTimed = findForLayerTestConstants.nextTimed
const nextFuture = findForLayerTestConstants.nextFuture
const layer = findForLayerTestConstants.layer

describe('findLookaheadForLayer – timing', () => {
	test('current part with timed next part (all goes into timed)', () => {
		findLookaheadObjectsForPartMock
			.mockReturnValueOnce([] as any)
			.mockReturnValueOnce([] as any)
			.mockReturnValueOnce(['cur0', 'cur1'] as any)
			.mockReturnValueOnce(['nT0', 'nT1'] as any)

		const res = findLookaheadForLayer(
			context,
			{ previous, current, next: nextTimed },
			[],
			layer,
			1,
			1,
			onAirPlayoutState,
			null
		)

		expect(res.timed).toEqual(['cur0', 'cur1', 'nT0', 'nT1']) // should have all pieces
		expect(res.future).toHaveLength(0) // should be empty

		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(4)
		expectInstancesToMatch(findLookaheadObjectsForPartMock, 3, layer, current, previous[1], onAirPlayoutState)
		expectInstancesToMatch(findLookaheadObjectsForPartMock, 4, layer, nextTimed, current, onAirPlayoutState)
	})

	test('current part with un-timed next part (next goes into future)', () => {
		findLookaheadObjectsForPartMock
			.mockReturnValueOnce([] as any)
			.mockReturnValueOnce([] as any)
			.mockReturnValueOnce(['cur0', 'cur1'] as any)
			.mockReturnValueOnce(['nF0', 'nF1'] as any)

		const res = findLookaheadForLayer(
			context,
			{ previous, current, next: nextFuture },
			[],
			layer,
			1,
			1,
			onAirPlayoutState,
			null
		)

		expect(res.timed).toEqual(['cur0', 'cur1']) // Should only contain the current part's pieces
		expect(res.future).toEqual(['nF0', 'nF1']) // Should only contain the future pieces

		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(4)
		expectInstancesToMatch(findLookaheadObjectsForPartMock, 3, layer, current, previous[1], onAirPlayoutState)
		expectInstancesToMatch(findLookaheadObjectsForPartMock, 4, layer, nextFuture, current, onAirPlayoutState)
	})
})
