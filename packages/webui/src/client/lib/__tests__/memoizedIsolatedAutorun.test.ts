import { memoizedIsolatedAutorun } from '../memoizedIsolatedAutorun.js'
import { Tracker } from 'meteor/tracker'

describe('memoizedIsolatedAutorun', () => {
	describe('Meteor.isClient', () => {
		test('it returns the result of the autorun function', () => {
			const dep = new Tracker.Dependency()
			const result0 = memoizedIsolatedAutorun(() => {
				dep.depend()
				return 'result0'
			}, 'getResult0')
			expect(result0).toBe('result0')
		})
		test('it reruns when the dependency is changed', () => {
			let runCount = 0
			const dep = new Tracker.Dependency()
			const result1 = memoizedIsolatedAutorun(() => {
				runCount++
				dep.depend()
				return 'result1'
			}, 'getResult1')
			expect(result1).toBe('result1')
			expect(runCount).toBe(1)
			dep.changed()
			expect(runCount).toBe(2)
		})
		test("it invalidates the parent computation if it's dependency has changed and the returned result is different", () => {
			let runCount0 = 0
			let runCount1 = 0
			const dep0 = new Tracker.Dependency()
			const dep1 = new Tracker.Dependency()
			let innerResult = ''
			Tracker.autorun(() => {
				runCount0++
				dep0.depend()
				innerResult = memoizedIsolatedAutorun(() => {
					runCount1++
					dep1.depend()
					return 'result2_' + runCount1
				}, 'getResult2')
			})
			expect(innerResult).toBe('result2_1')
			expect(runCount0).toBe(1)
			expect(runCount1).toBe(1)
			dep1.changed()
			expect(innerResult).toBe('result2_2')
			expect(runCount0).toBe(2)
			expect(runCount1).toBe(2)
		})
		test("it doesn't invalidate the parent computation if it's dependency has changed and the returned result is the same", () => {
			let runCount0 = 0
			let runCount1 = 0
			const dep0 = new Tracker.Dependency()
			const dep1 = new Tracker.Dependency()
			Tracker.autorun(() => {
				runCount0++
				dep0.depend()
				memoizedIsolatedAutorun(() => {
					runCount1++
					dep1.depend()
					return 'result3'
				}, 'getResult3')
			})
			expect(runCount0).toBe(1)
			expect(runCount1).toBe(1)
			dep1.changed()
			expect(runCount0).toBe(1)
			expect(runCount1).toBe(2)
		})
		test("it doesn't rerun if the dependency is not changed, even if the outer computation is invalidated", () => {
			let runCount0 = 0
			let runCount1 = 0
			const dep0 = new Tracker.Dependency()
			const dep1 = new Tracker.Dependency()
			Tracker.autorun(() => {
				runCount0++
				dep0.depend()
				memoizedIsolatedAutorun(() => {
					runCount1++
					dep1.depend()
					return 'result4'
				}, 'getResult4')
			})
			expect(runCount0).toBe(1)
			expect(runCount1).toBe(1)
			dep0.changed()
			expect(runCount0).toBe(2)
			expect(runCount1).toBe(1)
		})
	})
})
