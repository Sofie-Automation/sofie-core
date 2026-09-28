import { type MockedFunction } from 'vitest'
import { setupDefaultJobEnvironment } from '../../../../../__mocks__/context.js'
import { findLookaheadObjectsForPart } from '../../../../../playout/lookahead/findObjects.js'

export type TfindLookaheadObjectsForPart = MockedFunction<typeof findLookaheadObjectsForPart>

export const context = setupDefaultJobEnvironment()
