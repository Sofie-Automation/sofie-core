jest.mock('../../findObjects')
import { context, TfindLookaheadObjectsForPart } from './helpers/mockSetup.js'
import { findLookaheadForLayer, PartInstanceAndPieceInstancesInfos } from '../../findForLayer.js'
import { findForLayerTestConstants } from './constants.js'
import { findLookaheadObjectsForPart } from '../../findObjects.js'
import { PartAndPieces } from '../../util.js'

const findLookaheadObjectsForPartMockBase = findLookaheadObjectsForPart as TfindLookaheadObjectsForPart
const findLookaheadObjectsForPartMock = findLookaheadObjectsForPartMockBase.mockImplementation(() => []) // Default mock

beforeEach(() => {
	findLookaheadObjectsForPartMock.mockReset().mockReturnValue([])
})

const current = findForLayerTestConstants.current
const nextFuture = findForLayerTestConstants.nextFuture
const layer = findForLayerTestConstants.layer
const playoutState = findForLayerTestConstants.playoutState

describe('playoutState propagates to findLookaheadObjectsForPart', () => {
	test('onAir inHold propagation for partInstances (current and next)', () => {
		const partInstancesInfo: PartInstanceAndPieceInstancesInfos = {
			previous: [],
			current,
			next: nextFuture,
		}

		findLookaheadForLayer(context, partInstancesInfo, [], layer, 1, 1, playoutState.inHoldOnAir)

		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(2)

		// current
		expect(findLookaheadObjectsForPartMock).toHaveBeenNthCalledWith(
			1,
			context,
			partInstancesInfo.current?.part._id,
			layer,
			undefined,
			expect.any(Object),
			partInstancesInfo.current?.part._id,
			playoutState.inHoldOnAir
		)
		// next
		expect(findLookaheadObjectsForPartMock).toHaveBeenNthCalledWith(
			2,
			context,
			partInstancesInfo.current?.part._id,
			layer,
			partInstancesInfo.current?.part.part,
			expect.any(Object),
			partInstancesInfo.next?.part._id,
			playoutState.inHoldOnAir
		)
	})
	test('Rehearsal propagation for partInstances (current and next)', () => {
		const partInstancesInfo: PartInstanceAndPieceInstancesInfos = {
			previous: [],
			current,
			next: nextFuture,
		}

		findLookaheadForLayer(context, partInstancesInfo, [], layer, 1, 1, playoutState.rehearsal)

		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(2)

		// current
		expect(findLookaheadObjectsForPartMock).toHaveBeenNthCalledWith(
			1,
			context,
			partInstancesInfo.current?.part._id,
			layer,
			undefined,
			expect.any(Object),
			partInstancesInfo.current?.part._id,
			{ isInHold: false, isRehearsal: true }
		)
		// next
		expect(findLookaheadObjectsForPartMock).toHaveBeenNthCalledWith(
			2,
			context,
			partInstancesInfo.current?.part._id,
			layer,
			partInstancesInfo.current?.part.part,
			expect.any(Object),
			partInstancesInfo.next?.part._id,
			{ isInHold: false, isRehearsal: true }
		)
	})

	test('Rehearsal inHold propagation future parts always get isInHold: false with includeWhenNotInHoldObjects: true', () => {
		const maxSearchDistance = 5
		const rehearsalInHoldOrderedParts: PartAndPieces[] = [{ _id: 'p1' }, { _id: 'p2' }].map((p) => ({
			part: p as any,
			usesInTransition: true,
			pieces: [{ _id: p._id + '_p1' } as any],
		}))

		findLookaheadForLayer(
			context,
			{
				previous: [],
			},
			rehearsalInHoldOrderedParts,
			layer,
			100,
			maxSearchDistance,
			playoutState.inHoldRehearsal
		)

		const expectedCalls = Math.min(maxSearchDistance, rehearsalInHoldOrderedParts.length)

		expect(findLookaheadObjectsForPartMock).toHaveBeenCalledTimes(expectedCalls)

		// All futures that are considered (limited by the maxSearchDistance)
		for (let i = 0; i < expectedCalls; i++) {
			// All future parts get modified playoutState (isInHold forced to false, includeWhenNotInHoldObjects added)
			expect(findLookaheadObjectsForPartMock).toHaveBeenNthCalledWith(
				i + 1,
				context,
				null,
				layer,
				(i === 0 ? undefined : rehearsalInHoldOrderedParts[i - 1])?.part,
				rehearsalInHoldOrderedParts[i],
				null,
				playoutState.rehearsalIncludeNotInHold
			)
		}
	})
})
