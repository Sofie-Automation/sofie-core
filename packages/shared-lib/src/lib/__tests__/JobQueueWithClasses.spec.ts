import { JobQueueWithClasses } from '../JobQueueWithClasses.js'
import { sleep } from '../lib.js'

describe('JobQueueWithClasses', () => {
	const defaultErrorHandler = jest.fn((e: any) => {
		console.error(e)
		throw e
	})
	test('queue jobs synchronously', async () => {
		const queue = new JobQueueWithClasses()

		const results: string[] = []

		queue
			.add(async () => {
				results.push('start_0')
				await sleep(10)
				results.push('end_0')
			})
			.catch(defaultErrorHandler)
		queue
			.add(async () => {
				results.push('start_2')
				await sleep(5)
				results.push('end_2')
			})
			.catch(defaultErrorHandler)
		queue
			.add(async () => {
				results.push('start_3')
				await sleep(15)
				results.push('end_3')
			})
			.catch(defaultErrorHandler)
		queue
			.add(async () => {
				results.push('start_4')
				await sleep(2)
				results.push('end_4')
			})
			.catch(defaultErrorHandler)

		expect(queue.getWaiting()).toBe(4)
		await queue.waitForDone()
		expect(queue.getWaiting()).toBe(0)

		expect(results).toStrictEqual(['start_0', 'end_0', 'start_2', 'end_2', 'start_3', 'end_3', 'start_4', 'end_4'])
		expect(defaultErrorHandler).toHaveBeenCalledTimes(0)
	})
	test('queue jobs asynchronously', async () => {
		const queue = new JobQueueWithClasses()

		const results: string[] = []

		queue
			.add(async () => {
				results.push('start_0')
				await sleep(5)
				results.push('end_0')
			})
			.catch(defaultErrorHandler)
		expect(queue.getWaiting()).toBe(1)

		queue
			.add(async () => {
				results.push('start_2')
				await sleep(1)
				results.push('end_2')
			})
			.catch(defaultErrorHandler)
		expect(queue.getWaiting()).toBe(2)
		expect(results).toStrictEqual([])

		await queue.add(async () => {
			results.push('start_3')
			await sleep(10)
			results.push('end_3')
		})
		expect(queue.getWaiting()).toBe(0) // since 3 have now executed

		expect(results).toStrictEqual(['start_0', 'end_0', 'start_2', 'end_2', 'start_3', 'end_3'])
		expect(defaultErrorHandler).toHaveBeenCalledTimes(0)
	})

	test('remove classNames synchronously', async () => {
		const errorHandler = jest.fn((...args) => console.error(...args))

		const queue = new JobQueueWithClasses()

		const results: string[] = []

		queue
			.add(
				async () => {
					results.push('start_0')
				},
				{
					className: 'a',
				}
			)
			.catch(defaultErrorHandler)

		queue.remove('a')
		expect(queue.getWaiting()).toBe(0)
		await queue.waitForDone()
		expect(results).toStrictEqual([])

		queue
			.add(
				async () => {
					results.push('start_a0')
					await sleep(5)
					results.push('end_a0')
				},
				{
					className: 'a',
				}
			)
			.catch(errorHandler)
		queue
			.add(
				async () => {
					results.push('start_b0')
					await sleep(1)
					results.push('end_b0')
				},
				{
					className: 'b',
				}
			)
			.catch(errorHandler)
		queue
			.add(
				async () => {
					results.push('start_a1')
					await sleep(10)
					results.push('end_a1')
				},
				{
					className: 'a',
				}
			)
			.catch(errorHandler)
		queue
			.add(
				async () => {
					results.push('start_b1')
					await sleep(1)
					results.push('end_b1')
				},
				{
					className: 'b',
				}
			)
			.catch(errorHandler)

		expect(queue.getWaiting()).toBe(4)
		queue.remove('a')
		expect(queue.getWaiting()).toBe(2)
		await queue.waitForDone()
		expect(queue.getWaiting()).toBe(0)
		expect(results).toStrictEqual(['start_b0', 'end_b0', 'start_b1', 'end_b1'])
		expect(errorHandler).toHaveBeenCalledTimes(0)
		expect(defaultErrorHandler).toHaveBeenCalledTimes(0)
	})

	test('remove classNames asynchronously', async () => {
		const errorHandler = jest.fn((...args) => console.error(...args))
		const queue = new JobQueueWithClasses()

		const results: string[] = []

		queue
			.add(
				async () => {
					results.push('start_a0')
					await sleep(1)
					results.push('end_a0')
				},
				{
					className: 'a',
				}
			)
			.catch(errorHandler)
		queue
			.add(
				async () => {
					results.push('start_a1')
					await sleep(1)
					results.push('end_a1')
				},
				{
					className: 'a',
				}
			)
			.catch(errorHandler)
		expect(queue.getWaiting()).toBe(2)
		await sleep(1) // wait for a1 to start
		expect(queue.getWaiting()).toBe(1)
		expect(results).toHaveLength(1)

		queue.remove('a') // should unqueue a1 but leave a0 since that has already started
		expect(queue.getWaiting()).toBe(0)

		queue
			.add(
				async () => {
					results.push('start_a2')
					await sleep(11)
					results.push('end_a2')
				},
				{
					className: 'a',
				}
			)
			.catch(errorHandler)

		expect(queue.getWaiting()).toBe(1)
		await queue.waitForDone()
		expect(queue.getWaiting()).toBe(0)
		expect(results).toStrictEqual(['start_a0', 'end_a0', 'start_a2', 'end_a2'])

		expect(errorHandler).toHaveBeenCalledTimes(0)
		expect(defaultErrorHandler).toHaveBeenCalledTimes(0)
	})
	test('handle Errors', async () => {
		const errorHandler = jest.fn()
		const queue = new JobQueueWithClasses()

		// const results: string[] = []

		queue
			.add(
				async () => {
					throw new Error('An Error')
				},
				{
					className: 'a',
				}
			)
			.catch(errorHandler)

		expect(queue.getWaiting()).toBe(1)
		expect(errorHandler).toHaveBeenCalledTimes(0)
		await queue.waitForDone()
		expect(queue.getWaiting()).toBe(0)

		expect(errorHandler).toHaveBeenCalledTimes(1)

		expect(errorHandler.mock.calls[0][0].toString()).toBe('Error: An Error')
		expect(defaultErrorHandler).toHaveBeenCalledTimes(0)
	})
	test('executionWrapper', async () => {
		const errorHandler = jest.fn()

		let wrapCalls = 0
		const results: string[] = []

		const queue = new JobQueueWithClasses({
			executionWrapper: (fnc: () => any) => {
				wrapCalls++
				results.push('wrap_setup')
				return async () => {
					results.push('start_wrap')
					const result = await fnc()
					results.push('end_wrap')
					return result
				}
			},
		})

		queue
			.add(async () => {
				results.push('start_0')
				await sleep(1)
				results.push('end_0')
			})
			.catch(errorHandler)
		queue
			.add(async () => {
				results.push('start_1')
				await sleep(1)
				results.push('end_1')
			})
			.catch(errorHandler)

		expect(wrapCalls).toBe(2)
		expect(queue.getWaiting()).toBe(2)

		expect(results).toStrictEqual(['wrap_setup', 'wrap_setup'])
		await queue.waitForDone()
		expect(queue.getWaiting()).toBe(0)

		expect(wrapCalls).toBe(2)
		expect(results).toStrictEqual([
			'wrap_setup',
			'wrap_setup',

			'start_wrap',
			'start_0',
			'end_0',
			'end_wrap',

			'start_wrap',
			'start_1',
			'end_1',
			'end_wrap',
		])

		expect(errorHandler).toHaveBeenCalledTimes(0)
		expect(defaultErrorHandler).toHaveBeenCalledTimes(0)
	})
	test('error in executionWrapper setup', async () => {
		const errorHandler = jest.fn()

		const results: string[] = []

		const queue = new JobQueueWithClasses({
			executionWrapper: () => {
				results.push('wrap_setup')
				throw new Error('An Error in wrapper setup')
			},
		})

		queue
			.add(async () => {
				results.push('start_0')
				await sleep(1)
				results.push('end_0')
			})
			.catch(errorHandler)

		expect(results).toStrictEqual(['wrap_setup'])

		await sleep(1)
		expect(queue.getWaiting()).toBe(0)

		await queue.waitForDone()
		expect(errorHandler).toHaveBeenCalledTimes(1)
		expect(errorHandler.mock.calls[0][0].toString()).toBe('Error: An Error in wrapper setup')
		expect(results).toStrictEqual(['wrap_setup'])
		expect(defaultErrorHandler).toHaveBeenCalledTimes(0)
	})
	test('error in executionWrapper execution', async () => {
		const errorHandler = jest.fn()

		const results: string[] = []

		const queue = new JobQueueWithClasses({
			executionWrapper: () => {
				return () => {
					throw new Error('An Error in wrapper execution')
				}
			},
		})
		queue
			.add(async () => {
				results.push('start_0')
			})
			.catch(errorHandler)

		await queue.waitForDone()

		expect(errorHandler).toHaveBeenCalledTimes(1)
		expect(errorHandler.mock.calls[0][0].toString()).toBe('Error: An Error in wrapper execution')
		expect(results).toStrictEqual([])
		expect(defaultErrorHandler).toHaveBeenCalledTimes(0)
	})
})
