import { Tracker } from 'meteor/tracker'
import { slowDownReactivity } from '../reactiveDataHelper.js'
import { sleep } from '@sofie-automation/shared-lib/dist/lib/lib'

describe('client/lib/reactiveData/reactiveDataHelper', () => {
	describe('slowDownReactivity', () => {
		test('it invalidates the parent computation immediately, when delay === 0', () => {
			let runCount = 0
			const dep = new Tracker.Dependency()
			let result = ''
			Tracker.autorun(() => {
				runCount++
				result = slowDownReactivity(() => {
					dep.depend()
					return 'test' + runCount
				}, 0)
			})

			expect(runCount).toBe(1)
			expect(result).toBe('test1')
			dep.changed()
			expect(runCount).toBe(2)
			expect(result).toBe('test2')
		})
		test("it invalidates the computation after a delay, if it's dependency changes", async () => {
			let runCount = 0
			const dep = new Tracker.Dependency()
			Tracker.autorun(() => {
				runCount++
				slowDownReactivity(() => {
					dep.depend()
				}, 200)
			})

			expect(runCount).toBe(1)
			dep.changed()
			expect(runCount).toBe(1)

			await sleep(100)
			expect(runCount).toBe(1)

			await sleep(200)
			expect(runCount).toBe(2)
		})
		test('it invalidates once after a delay, even when there are additional invalidations in the delay period', async () => {
			let runCount = 0
			const dep = new Tracker.Dependency()
			Tracker.autorun(() => {
				runCount++
				slowDownReactivity(() => {
					dep.depend()
				}, 200)
			})

			expect(runCount).toBe(1)
			dep.changed()
			expect(runCount).toBe(1)
			await sleep(100)
			expect(runCount).toBe(1)
			dep.changed()

			await sleep(50)
			dep.changed()

			await sleep(100)
			expect(runCount).toBe(2)

			await sleep(400)
			expect(runCount).toBe(2)
		})
		test('it cleans up after itself when parent computation is invalidated', async () => {
			let runCount0 = 0
			let runCount1 = 0
			const dep0 = new Tracker.Dependency()
			const dep1 = new Tracker.Dependency()
			Tracker.autorun(() => {
				runCount0++
				dep0.depend()
				slowDownReactivity(
					() => {
						runCount1++
						dep1.depend()
					},
					runCount0 === 1 ? 200 : 0
				)
			})

			// both autoruns have run
			expect(runCount0).toBe(1)
			expect(runCount1).toBe(1)

			// invalidate the inner dependency (Point A)
			dep1.changed()

			// the inner autorun has run, but the outer one hasn't been invalidated yet
			expect(runCount0).toBe(1)
			expect(runCount1).toBe(2)

			await sleep(100)
			// the inner autorun has run, but the outer one still hasn't been invalidated yet
			expect(runCount0).toBe(1)
			expect(runCount1).toBe(2)

			// invalidate the outer dependency
			dep0.changed()
			// the outer autorun has run and the inner autorun has run as well
			expect(runCount0).toBe(2)
			expect(runCount1).toBe(3)

			await sleep(500)
			// the original invalidation (set up in Point A) has been cancelled and did not cause an extra re-run
			expect(runCount0).toBe(2)
			expect(runCount1).toBe(3)
		})
	})
})
