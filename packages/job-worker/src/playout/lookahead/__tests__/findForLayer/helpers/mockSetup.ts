import { setupDefaultJobEnvironment } from '../../../../../__mocks__/context.js'
import { findLookaheadObjectsForPart } from '../../../../../playout/lookahead/findObjects.js'

export type TfindLookaheadObjectsForPart = jest.MockedFunction<typeof findLookaheadObjectsForPart>

export const context = setupDefaultJobEnvironment()
