import { setupDefaultJobEnvironment } from '../../../../../__mocks__/context.js'

jest.mock('../../../findObjects')
import { findLookaheadObjectsForPart } from '../../../../../playout/lookahead/findObjects.js'

export type TfindLookaheadObjectsForPart = jest.MockedFunction<typeof findLookaheadObjectsForPart>

export const context = setupDefaultJobEnvironment()

const findLookaheadObjectsForPartMockBase = findLookaheadObjectsForPart as TfindLookaheadObjectsForPart
export const findLookaheadObjectsForPartMock = findLookaheadObjectsForPartMockBase.mockImplementation(() => []) // Default mock

beforeEach(() => {
	findLookaheadObjectsForPartMock.mockReset()
})
