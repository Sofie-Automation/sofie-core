import { StudioRouteBehavior, StudioRouteSet } from '@sofie-automation/blueprints-integration'
import { setupDefaultJobEnvironment } from '../../../__mocks__/context.js'
import { StudioRouteSetUpdater } from '../StudioRouteSetUpdater.js'
import type { WorkerDataCache } from '../../caches.js'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

function setupTest(routeSets: Record<string, StudioRouteSet>) {
	const context = setupDefaultJobEnvironment()
	const mockCache: Pick<WorkerDataCache, 'rawStudio' | 'jobStudio'> = {
		rawStudio: {
			...context.rawStudio,
			routeSetsWithOverrides: wrapDefaultObject(routeSets),
		},
		jobStudio: {
			...context.studio,
			routeSets: routeSets,
		},
	}
	const mockCollection = context.mockCollections.Studios
	const routeSetHelper = new StudioRouteSetUpdater(context.directCollections, mockCache)

	return { context, mockCache, mockCollection, routeSetHelper }
}

const SINGLE_ROUTESET: Record<string, StudioRouteSet> = {
	one: {
		name: 'test',
		active: false,
		behavior: StudioRouteBehavior.TOGGLE,
		routes: [],
		abPlayers: [],
	},
}
const SINGLE_ROUTESET_WITH_AB: Record<string, StudioRouteSet> = {
	one: {
		name: 'test',
		active: false,
		behavior: StudioRouteBehavior.TOGGLE,
		routes: [],
		abPlayers: [{ playerId: 'test', poolName: 'test' }],
	},
}
const EXCLUSIVE_ROUTESETS: Record<string, StudioRouteSet> = {
	one: {
		name: 'test',
		active: false,
		behavior: StudioRouteBehavior.TOGGLE,
		exclusivityGroup: 'main',
		routes: [],
		abPlayers: [{ playerId: 'test', poolName: 'test' }],
	},
	two: {
		name: 'test',
		active: true,
		behavior: StudioRouteBehavior.TOGGLE,
		exclusivityGroup: 'main',
		routes: [],
		abPlayers: [],
	},
	activate: {
		name: 'test',
		active: false,
		behavior: StudioRouteBehavior.ACTIVATE_ONLY,
		exclusivityGroup: 'main',
		routes: [],
		abPlayers: [],
	},
}

describe('StudioRouteSetUpdater', () => {
	it('no changes should not save', async () => {
		const { mockCollection, routeSetHelper } = setupTest(SINGLE_ROUTESET)

		expect(mockCollection.operations).toHaveLength(0)
		await routeSetHelper.saveRouteSetChanges()
		expect(mockCollection.operations).toHaveLength(0)
	})

	it('no changes when setting missing routeset', async () => {
		const { mockCollection, routeSetHelper } = setupTest(SINGLE_ROUTESET)

		expect(() => routeSetHelper.setRouteSetActive('missing', true)).toThrow(/not found/)

		expect(mockCollection.operations).toHaveLength(0)
		await routeSetHelper.saveRouteSetChanges()
		expect(mockCollection.operations).toHaveLength(0)
	})

	it('change when setting routeset - true', async () => {
		const { mockCollection, routeSetHelper } = setupTest(SINGLE_ROUTESET)

		routeSetHelper.setRouteSetActive('one', true)

		expect(mockCollection.operations).toHaveLength(0)
		await routeSetHelper.saveRouteSetChanges()
		expect(mockCollection.operations).toEqual([
			{
				type: 'update',
				args: [
					{ _id: 'mockStudio0' },
					{
						$set: {
							'routeSetsWithOverrides.overrides': [
								{
									op: 'set',
									path: 'one.active',
									value: true,
								},
							],
						},
					},
				],
			},
		])
	})
	it('change when setting routeset - false', async () => {
		const { mockCollection, routeSetHelper } = setupTest(SINGLE_ROUTESET)

		routeSetHelper.setRouteSetActive('one', false)

		expect(mockCollection.operations).toHaveLength(0)
		await routeSetHelper.saveRouteSetChanges()
		expect(mockCollection.operations).toEqual([
			{
				type: 'update',
				args: [
					{ _id: 'mockStudio0' },
					{
						$set: {
							'routeSetsWithOverrides.overrides': [
								{
									op: 'set',
									path: 'one.active',
									value: false,
								},
							],
						},
					},
				],
			},
		])
	})
	it('change when setting routeset - toggle', async () => {
		const { mockCollection, routeSetHelper } = setupTest(SINGLE_ROUTESET)

		routeSetHelper.setRouteSetActive('one', 'toggle')

		expect(mockCollection.operations).toHaveLength(0)
		await routeSetHelper.saveRouteSetChanges()
		expect(mockCollection.operations).toEqual([
			{
				type: 'update',
				args: [
					{ _id: 'mockStudio0' },
					{
						$set: {
							'routeSetsWithOverrides.overrides': [
								{
									op: 'set',
									path: 'one.active',
									value: true,
								},
							],
						},
					},
				],
			},
		])
	})
	it('change when setting routeset - toggle twice', async () => {
		const { mockCollection, routeSetHelper } = setupTest(SINGLE_ROUTESET)

		routeSetHelper.setRouteSetActive('one', 'toggle')
		routeSetHelper.setRouteSetActive('one', 'toggle')

		expect(mockCollection.operations).toHaveLength(0)
		await routeSetHelper.saveRouteSetChanges()
		expect(mockCollection.operations).toEqual([
			{
				type: 'update',
				args: [
					{ _id: 'mockStudio0' },
					{
						$set: {
							'routeSetsWithOverrides.overrides': [
								{
									op: 'set',
									path: 'one.active',
									value: false,
								},
							],
						},
					},
				],
			},
		])
	})

	it('discard changes should not save', async () => {
		const { mockCollection, routeSetHelper } = setupTest(SINGLE_ROUTESET)

		routeSetHelper.setRouteSetActive('one', true)

		expect(routeSetHelper.rawStudioWithChanges).toBeTruthy()
		expect(routeSetHelper.jobStudioWithChanges).toBeTruthy()

		routeSetHelper.discardRouteSetChanges()

		expect(routeSetHelper.rawStudioWithChanges).toBeFalsy()
		expect(routeSetHelper.jobStudioWithChanges).toBeFalsy()

		expect(mockCollection.operations).toHaveLength(0)
		await routeSetHelper.saveRouteSetChanges()
		expect(mockCollection.operations).toHaveLength(0)
	})

	it('save should update mockCache', async () => {
		const { mockCache, mockCollection, routeSetHelper } = setupTest(SINGLE_ROUTESET)

		const rawStudioBefore = mockCache.rawStudio
		const jobStudioBefore = mockCache.jobStudio
		expect(routeSetHelper.rawStudioWithChanges).toBeFalsy()
		expect(routeSetHelper.jobStudioWithChanges).toBeFalsy()

		routeSetHelper.setRouteSetActive('one', true)
		expect(routeSetHelper.rawStudioWithChanges).toBeTruthy()
		expect(routeSetHelper.jobStudioWithChanges).toBeTruthy()

		expect(mockCollection.operations).toHaveLength(0)
		await routeSetHelper.saveRouteSetChanges()
		expect(mockCollection.operations).toHaveLength(1)

		// Object should have changed
		expect(mockCache.rawStudio).not.toBe(rawStudioBefore)
		expect(mockCache.jobStudio).not.toBe(jobStudioBefore)
		// Object should not be equal
		expect(mockCache.rawStudio).not.toEqual(rawStudioBefore)
		expect(mockCache.jobStudio).not.toEqual(jobStudioBefore)
		expect(routeSetHelper.rawStudioWithChanges).toBeFalsy()
		expect(routeSetHelper.jobStudioWithChanges).toBeFalsy()
	})

	it('no changes should not update mockCache', async () => {
		const { mockCache, mockCollection, routeSetHelper } = setupTest(SINGLE_ROUTESET)

		const rawStudioBefore = mockCache.rawStudio
		const jobStudioBefore = mockCache.jobStudio
		expect(routeSetHelper.rawStudioWithChanges).toBeFalsy()
		expect(routeSetHelper.jobStudioWithChanges).toBeFalsy()

		expect(mockCollection.operations).toHaveLength(0)
		await routeSetHelper.saveRouteSetChanges()
		expect(mockCollection.operations).toHaveLength(0)

		expect(mockCache.rawStudio).toBe(rawStudioBefore)
		expect(mockCache.jobStudio).toBe(jobStudioBefore)
		expect(routeSetHelper.rawStudioWithChanges).toBeFalsy()
		expect(routeSetHelper.jobStudioWithChanges).toBeFalsy()
	})

	it('discard changes should not update mockCache', async () => {
		const { mockCache, mockCollection, routeSetHelper } = setupTest(SINGLE_ROUTESET)

		const rawStudioBefore = mockCache.rawStudio
		const jobStudioBefore = mockCache.jobStudio
		expect(routeSetHelper.rawStudioWithChanges).toBeFalsy()
		expect(routeSetHelper.jobStudioWithChanges).toBeFalsy()

		routeSetHelper.setRouteSetActive('one', true)
		expect(routeSetHelper.rawStudioWithChanges).toBeTruthy()
		expect(routeSetHelper.jobStudioWithChanges).toBeTruthy()
		routeSetHelper.discardRouteSetChanges()
		expect(routeSetHelper.rawStudioWithChanges).toBeFalsy()
		expect(routeSetHelper.jobStudioWithChanges).toBeFalsy()

		expect(mockCollection.operations).toHaveLength(0)
		await routeSetHelper.saveRouteSetChanges()
		expect(mockCollection.operations).toHaveLength(0)

		expect(mockCache.rawStudio).toBe(rawStudioBefore)
		expect(mockCache.jobStudio).toBe(jobStudioBefore)
		expect(routeSetHelper.rawStudioWithChanges).toBeFalsy()
		expect(routeSetHelper.jobStudioWithChanges).toBeFalsy()
	})

	it('ACTIVATE_ONLY routeset can be activated', async () => {
		const { mockCollection, routeSetHelper } = setupTest(EXCLUSIVE_ROUTESETS)

		routeSetHelper.setRouteSetActive('activate', true)

		expect(mockCollection.operations).toHaveLength(0)
		await routeSetHelper.saveRouteSetChanges()
		expect(mockCollection.operations).toHaveLength(1)
	})

	it('ACTIVATE_ONLY routeset canot be deactivated', async () => {
		const { mockCollection, routeSetHelper } = setupTest(EXCLUSIVE_ROUTESETS)

		expect(() => routeSetHelper.setRouteSetActive('activate', false)).toThrow(/ACTIVATE_ONLY/)

		expect(mockCollection.operations).toHaveLength(0)
		await routeSetHelper.saveRouteSetChanges()
		expect(mockCollection.operations).toHaveLength(0)
	})

	describe('exclusive groups', () => {
		it('deactivate member of exclusive group', async () => {
			const { mockCollection, routeSetHelper } = setupTest(EXCLUSIVE_ROUTESETS)

			routeSetHelper.setRouteSetActive('one', false)

			expect(mockCollection.operations).toHaveLength(0)
			await routeSetHelper.saveRouteSetChanges()
			expect(mockCollection.operations).toEqual([
				{
					type: 'update',
					args: [
						{ _id: 'mockStudio0' },
						{
							$set: {
								'routeSetsWithOverrides.overrides': [
									{
										op: 'set',
										path: 'one.active',
										value: false,
									},
								],
							},
						},
					],
				},
			])
		})

		it('activate member of exclusive group', async () => {
			const { mockCollection, routeSetHelper } = setupTest(EXCLUSIVE_ROUTESETS)

			routeSetHelper.setRouteSetActive('one', true)

			expect(mockCollection.operations).toHaveLength(0)
			await routeSetHelper.saveRouteSetChanges()
			expect(mockCollection.operations).toEqual([
				{
					type: 'update',
					args: [
						{ _id: 'mockStudio0' },
						{
							$set: {
								'routeSetsWithOverrides.overrides': [
									{
										op: 'set',
										path: 'one.active',
										value: true,
									},
									{
										op: 'set',
										path: 'two.active',
										value: false,
									},
									{
										op: 'set',
										path: 'activate.active',
										value: false,
									},
								],
							},
						},
					],
				},
			])
		})
	})

	describe('Return value', () => {
		it('update player with ab', async () => {
			const { mockCollection, routeSetHelper } = setupTest(SINGLE_ROUTESET_WITH_AB)

			expect(routeSetHelper.setRouteSetActive('one', false)).toBe(true)

			expect(mockCollection.operations).toHaveLength(0)
			await routeSetHelper.saveRouteSetChanges()
			expect(mockCollection.operations).toHaveLength(1)
		})

		it('update player without ab', async () => {
			const { mockCollection, routeSetHelper } = setupTest(SINGLE_ROUTESET)

			expect(routeSetHelper.setRouteSetActive('one', false)).toBe(false)

			expect(mockCollection.operations).toHaveLength(0)
			await routeSetHelper.saveRouteSetChanges()
			expect(mockCollection.operations).toHaveLength(1)
		})

		it('update exclusive group - disabling player without ab', async () => {
			const { mockCollection, routeSetHelper } = setupTest(EXCLUSIVE_ROUTESETS)

			expect(routeSetHelper.setRouteSetActive('two', false)).toBe(false)

			expect(mockCollection.operations).toHaveLength(0)
			await routeSetHelper.saveRouteSetChanges()
			expect(mockCollection.operations).toHaveLength(1)
		})

		it('update exclusive group - disabling player with ab', async () => {
			const { mockCollection, routeSetHelper } = setupTest(EXCLUSIVE_ROUTESETS)

			expect(routeSetHelper.setRouteSetActive('one', false)).toBe(true)

			expect(mockCollection.operations).toHaveLength(0)
			await routeSetHelper.saveRouteSetChanges()
			expect(mockCollection.operations).toHaveLength(1)
		})

		it('update exclusive group - enabling player without ab', async () => {
			const { mockCollection, routeSetHelper } = setupTest(EXCLUSIVE_ROUTESETS)

			expect(routeSetHelper.setRouteSetActive('two', true)).toBe(true)

			expect(mockCollection.operations).toHaveLength(0)
			await routeSetHelper.saveRouteSetChanges()
			expect(mockCollection.operations).toHaveLength(1)
		})
	})
})
