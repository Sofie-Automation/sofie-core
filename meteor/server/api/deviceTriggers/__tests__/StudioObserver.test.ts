import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'

import type { ContentCache as RundownContentCache } from '../reactiveContentCache'
import type { ContentCache as PieceInstancesContentCache } from '../reactiveContentCacheForPieceInstances'
import { runAllTimers } from '../../../../__mocks__/helpers/jest'

type OnChangedRundown = (cache: RundownContentCache) => () => void
type OnChangedPieceInstances = (cache: PieceInstancesContentCache) => () => void

let capturedRundownContentOnChanged: OnChangedRundown | undefined
let capturedPieceInstancesOnChanged: OnChangedPieceInstances | undefined

jest.mock('../../../publications/lib/observerChain', () => {
	const fakeHandle = { stop: jest.fn() }
	const chain: any = {
		next: jest.fn(() => chain),
		end: jest.fn(() => fakeHandle),
	}
	return {
		observerChain: jest.fn(() => chain),
	}
})

jest.mock('../RundownsObserver', () => {
	return {
		RundownsObserver: {
			create: jest.fn(
				async (_playlistId: RundownPlaylistId, onChanged: (ids: RundownId[]) => Promise<() => void>) => {
					// Immediately drive the callback once, to emulate initial observer execution
					await onChanged([protectString<RundownId>('r0')])
					return { stop: jest.fn() }
				}
			),
		},
	}
})

jest.mock('../RundownContentObserver', () => {
	return {
		RundownContentObserver: {
			create: jest.fn(
				async (
					_playlistId: RundownPlaylistId,
					_showStyleBaseId: ShowStyleBaseId,
					_rundownIds: RundownId[],
					onChanged: OnChangedRundown
				) => {
					capturedRundownContentOnChanged = onChanged
					return { stop: jest.fn() }
				}
			),
		},
	}
})

jest.mock('../PieceInstancesObserver', () => {
	return {
		PieceInstancesObserver: {
			create: jest.fn(
				async (
					_activationId: RundownPlaylistActivationId,
					_showStyleBaseId: ShowStyleBaseId,
					onChanged: OnChangedPieceInstances
				) => {
					capturedPieceInstancesOnChanged = onChanged
					return { stop: jest.fn() }
				}
			),
		},
	}
})

describe('StudioObserver', () => {
	beforeEach(() => {
		jest.useFakeTimers()
		capturedRundownContentOnChanged = undefined
		capturedPieceInstancesOnChanged = undefined
	})

	test('rundown deactivation regression: observer callbacks must not depend on `this` (private fields)', async () => {
		// Import after mocks are in place
		const { StudioObserver } = await import('../StudioObserver')

		const studioId = protectString<StudioId>('studio0')
		const playlistId = protectString<RundownPlaylistId>('playlist0')
		const activationId = protectString<RundownPlaylistActivationId>('activation0')
		const rundownId = protectString<RundownId>('rundown0')
		const showStyleBaseId = protectString<ShowStyleBaseId>('showStyleBase0')

		const rundownCleanup = jest.fn()
		const pieceCleanup = jest.fn()

		const onRundownContentChanged = jest.fn(
			(_ssbId: ShowStyleBaseId, _cache: RundownContentCache) => rundownCleanup
		)
		const onPieceInstancesChanged = jest.fn(
			(_ssbId: ShowStyleBaseId, _cache: PieceInstancesContentCache) => pieceCleanup
		)

		const observer = new StudioObserver(studioId, onRundownContentChanged, onPieceInstancesChanged)

		// Prime state so updateShowStyle goes down the creation path
		;(observer as any).nextProps = {
			activePlaylistId: playlistId,
			activationId,
			currentRundownId: rundownId,
		}

		const state = {
			currentRundown: { _id: rundownId, showStyleBaseId },
			showStyleBase: { _id: showStyleBaseId },
		}

		// Trigger the debounced execution
		const ps: Promise<void> = (observer as any).updateShowStyle.call(state)

		// Flush debounce timers and any queued promises
		await jest.advanceTimersByTimeAsync(25)
		await runAllTimers()
		await ps

		// Ensure we captured callbacks from the two observers
		expect(capturedRundownContentOnChanged).toBeTruthy()
		expect(capturedPieceInstancesOnChanged).toBeTruthy()

		const mockRundownCache = {} as any as RundownContentCache
		const mockPieceInstancesCache = {} as any as PieceInstancesContentCache

		// Regression: invoke callbacks without a bound `this` (simulates lost context)
		expect(() => capturedRundownContentOnChanged!(mockRundownCache)).not.toThrow()
		expect(() => capturedPieceInstancesOnChanged!(mockPieceInstancesCache)).not.toThrow()

		// They should return cleanup fns
		const cleanup1 = capturedRundownContentOnChanged!(mockRundownCache)
		const cleanup2 = capturedPieceInstancesOnChanged!(mockPieceInstancesCache)
		expect(typeof cleanup1).toBe('function')
		expect(typeof cleanup2).toBe('function')

		// Ensure our handlers were called with expected args
		expect(onRundownContentChanged).toHaveBeenCalledWith(showStyleBaseId, mockRundownCache)
		expect(onPieceInstancesChanged).toHaveBeenCalledWith(showStyleBaseId, mockPieceInstancesCache)

		// Ensure returned cleanup fns are callable
		expect(() => cleanup1()).not.toThrow()
		expect(() => cleanup2()).not.toThrow()

		observer.stop()
	})
})
