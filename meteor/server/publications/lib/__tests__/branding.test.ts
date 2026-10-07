import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PartInstances } from '../../../collections'
import { runAllTimers, waitUntil } from '../../../../__mocks__/helpers/jest'
import {
	BrandingContentCache,
	createBrandingContentCache,
	getProjectedBrandingId,
	observeSelectedPartInstancesBranding,
} from '../branding'

const PartInstancesMock = (PartInstances as any).mockCollection as InMemoryMongoCollection<DBPartInstance>

const MAX_WAIT_TIME = 4000

describe('observeSelectedPartInstancesBranding', () => {
	beforeEach(() => {
		jest.useFakeTimers()
		PartInstancesMock.remove({})
	})

	function insertPartInstance(id: string, rundownId: string, brandingId: string | null) {
		PartInstancesMock.insert({
			_id: protectString(id),
			rundownId: protectString(rundownId),
			brandingId,
		} as Partial<DBPartInstance> as DBPartInstance)
	}

	function selectPartInstances(cache: BrandingContentCache, currentId: string | null, nextId: string | null) {
		cache.RundownPlaylists.replace({
			_id: protectString('playlist0'),
			currentPartInfo: currentId ? ({ partInstanceId: protectString(currentId) } as any) : null,
			nextPartInfo: nextId ? ({ partInstanceId: protectString(nextId) } as any) : null,
			defaultBrandingId: 'defaultBranding',
		})
	}

	function getCachedIds(cache: BrandingContentCache): string[] {
		return cache.PartInstances.findFetch({})
			.map((p) => String(p._id))
			.sort()
	}

	test('observes only the selected PartInstances, whichever Rundown they belong to', async () => {
		insertPartInstance('pi0', 'rundownA', 'brandingX')
		insertPartInstance('pi1', 'rundownB', 'brandingY')
		insertPartInstance('pi2', 'rundownB', null)
		insertPartInstance('pi3', 'rundownB', 'brandingW')

		const cache = createBrandingContentCache()
		const handle = await observeSelectedPartInstancesBranding(cache)
		try {
			// Nothing is selected yet
			expect(getCachedIds(cache)).toEqual([])
			expect(getProjectedBrandingId(cache)).toBeNull()

			selectPartInstances(cache, 'pi0', 'pi1')
			await waitUntil(async () => {
				await runAllTimers()
				expect(getCachedIds(cache)).toEqual(['pi0', 'pi1'])
			}, MAX_WAIT_TIME)
			expect(getProjectedBrandingId(cache)).toBe('brandingX')

			// Take: the PartInstance which was next stays resolvable while the observer restarts
			selectPartInstances(cache, 'pi1', 'pi2')
			expect(getProjectedBrandingId(cache)).toBe('brandingY')
			await waitUntil(async () => {
				await runAllTimers()
				expect(getCachedIds(cache)).toEqual(['pi1', 'pi2'])
			}, MAX_WAIT_TIME)

			// A change to the Branding of a selected PartInstance is observed
			PartInstancesMock.update(protectString('pi1'), { $set: { brandingId: 'brandingZ' } })
			await waitUntil(async () => {
				await runAllTimers()
				expect(getProjectedBrandingId(cache)).toBe('brandingZ')
			}, MAX_WAIT_TIME)

			// Deselecting everything falls back to the default
			selectPartInstances(cache, null, null)
			await waitUntil(async () => {
				await runAllTimers()
				expect(getCachedIds(cache)).toEqual([])
			}, MAX_WAIT_TIME)
			expect(getProjectedBrandingId(cache)).toBe('defaultBranding')
		} finally {
			handle.stop()
			await runAllTimers()
		}

		expect(PartInstancesMock.observers).toHaveLength(0)
	})

	test('picks up a selection made while the observer is starting', async () => {
		insertPartInstance('pi0', 'rundownA', 'brandingX')

		const cache = createBrandingContentCache()
		const handlePromise = observeSelectedPartInstancesBranding(cache)
		// The RundownPlaylist is observed concurrently, so may arrive before the PartInstances observer is ready
		selectPartInstances(cache, 'pi0', null)

		const handle = await handlePromise
		try {
			await waitUntil(async () => {
				await runAllTimers()
				expect(getCachedIds(cache)).toEqual(['pi0'])
			}, MAX_WAIT_TIME)
		} finally {
			handle.stop()
			await runAllTimers()
		}
	})
})
