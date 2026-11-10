import '../../../__mocks__/_extendJest'

import { reactiveObserverGroup } from '../observerGroup'
import { sleep } from '../../../lib/lib'
import { testWithAbort } from '../../../__mocks__/helpers/testWithAbort'
import { createChildAbort } from '../../../lib/observerLifetime'

describe('reactiveObserverGroup', () => {
	beforeEach(() => {
		jest.useRealTimers()
	})

	testWithAbort('the generation signal aborts when the parent does', async ({ signal }) => {
		const abort = createChildAbort(signal)
		const generationSignals: AbortSignal[] = []

		await reactiveObserverGroup('test', abort.signal, async (signal) => {
			generationSignals.push(signal)
		})

		expect(generationSignals).toHaveLength(1)
		expect(generationSignals[0].aborted).toBe(false)

		abort.abort()
		expect(generationSignals[0].aborted).toBe(true)
	})

	testWithAbort('restart aborts the previous generation before starting the next', async ({ signal }) => {
		const abort = createChildAbort(signal)
		const generationSignals: AbortSignal[] = []

		const group = await reactiveObserverGroup('test', abort.signal, async (signal) => {
			generationSignals.push(signal)
		})

		group.restart()
		await sleep(21) // wait for the debounce

		expect(generationSignals).toHaveLength(2)
		// The old generation is gone by the time the new one exists, so the two never overlap
		expect(generationSignals[0].aborted).toBe(true)
		expect(generationSignals[1].aborted).toBe(false)

		abort.abort()
		expect(generationSignals[1].aborted).toBe(true)
	})

	testWithAbort('an aborted generation delivers nothing, synchronously', async ({ signal }) => {
		// The whole design rests on abort being synchronous: no callback from a superseded generation
		// may arrive after the restart that replaced it.
		const abort = createChildAbort(signal)
		const delivered: number[] = []
		let generationCount = 0
		const emitters: Array<{ signal: AbortSignal; emit: () => void }> = []

		const group = await reactiveObserverGroup('test', abort.signal, async (signal) => {
			const generationId = ++generationCount
			emitters.push({
				signal,
				emit: () => {
					if (signal.aborted) return
					delivered.push(generationId)
				},
			})
		})

		emitters[0].emit()
		expect(delivered).toEqual([1])

		group.restart()
		await sleep(21)

		// The superseded generation is silent even if its source fires again
		emitters[0].emit()
		emitters[1].emit()
		expect(delivered).toEqual([1, 2])

		abort.abort()
		emitters[1].emit()
		expect(delivered).toEqual([1, 2])
	})

	testWithAbort('a generator failure releases that generation and does not start it', async ({ signal }) => {
		const abort = createChildAbort(signal)
		const generationSignals: AbortSignal[] = []

		await expect(
			reactiveObserverGroup('test', abort.signal, async (signal) => {
				generationSignals.push(signal)
				throw new Error('generator failed')
			})
		).rejects.toThrow('generator failed')

		expect(generationSignals[0].aborted).toBe(true)
		expect(abort.signal.aborted).toBe(false)
	})

	testWithAbort('restart after the parent aborts is rejected', async ({ signal }) => {
		const abort = createChildAbort(signal)
		const group = await reactiveObserverGroup('test', abort.signal, async () => undefined)

		abort.abort()
		await expect(async () => group.restart()).rejects.toThrowSofieError(
			500,
			'ReactiveObserverGroup "test" has been stopped!'
		)
	})
})
