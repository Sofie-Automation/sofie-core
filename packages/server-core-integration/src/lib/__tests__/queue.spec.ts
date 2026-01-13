/* eslint-disable jest/no-conditional-expect */
import { Queue } from '../queue.js'

test('queue', async () => {
	let runCount = 0
	let resolveCount = 0
	let rejectCount = 0

	const q = new Queue()

	const ps = [
		q
			.putOnQueue(async () => {
				return new Promise((resolve) => {
					expect(runCount).toEqual(0)
					runCount++
					setTimeout(resolve, 50)
				})
			})
			.then(() => {
				expect(resolveCount).toEqual(0)
				resolveCount++
			}),
		q
			.putOnQueue(async () => {
				return new Promise((resolve) => {
					expect(runCount).toEqual(1)
					runCount++
					setTimeout(resolve, 10)
				})
			})
			.then(() => {
				expect(resolveCount).toEqual(1)
				resolveCount++
			}),
		q
			.putOnQueue(async () => {
				return new Promise((_resolve, reject) => {
					expect(runCount).toEqual(2)
					runCount++
					setTimeout(reject, 60)
				})
			})
			.catch(() => {
				expect(rejectCount).toEqual(0)
				rejectCount++
			}),
		q
			.putOnQueue(() => {
				throw new Error('myError')
			})
			.catch(() => {
				expect(rejectCount).toEqual(1)
				rejectCount++
			}),
		q
			.putOnQueue(async () => {
				return new Promise((resolve) => {
					expect(runCount).toEqual(3)
					runCount++
					setTimeout(resolve, 20)
				})
			})
			.then(() => {
				expect(resolveCount).toEqual(2)
				resolveCount++
			}),
	]

	expect(runCount).toEqual(0)
	expect(resolveCount).toEqual(0)
	expect(rejectCount).toEqual(0)
	await Promise.all(ps)

	expect(runCount).toEqual(4)
	expect(resolveCount).toEqual(3)
	expect(rejectCount).toEqual(2)
})
