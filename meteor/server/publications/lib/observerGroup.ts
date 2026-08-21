import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { lazyIgnore } from '../../lib/lib'
import { AbortScope, createChildAbort } from '../../lib/observerLifetime'
import { logger } from '../../logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { SofieError } from '@sofie-automation/corelib/dist/error'

export interface ReactiveObserverGroup {
	/**
	 * Tear down the current generation of observers and start a fresh one.
	 * Debounced, so a burst of calls results in a single restart.
	 */
	restart(): void
}

const REACTIVITY_DEBOUNCE = 20

/**
 * Helper to trigger reactivity inside of an OptimisedObserver whenever one of the other Mongo observers changes.
 *
 * Each "generation" of observers runs on its own child signal of `parentSignal`. Restarting aborts the
 * current generation - which stops its observers synchronously - before starting the next, and aborting
 * `parentSignal` ends the group for good.
 *
 * Note: care needs to be taken when using this, as Mongo observers call `added` for every document when they
 * start. It is very easy to form an infinite loop of observer invalidations.
 *
 * @param parentSignal The lifetime of the group as a whole
 * @param generator Start the observers of one generation, on the signal it is given
 * @returns Handle to restart the observer group
 */
export async function reactiveObserverGroup(
	parentSignal: AbortSignal,
	generator: (generationSignal: AbortSignal) => Promise<void>
): Promise<ReactiveObserverGroup> {
	const id = `ReactiveObserverGroup:${getRandomString()}`

	/** The scope of the generation currently running, if any */
	let generation: AbortScope | undefined
	let pendingRestart = false
	let checkRunning = false

	const stopCurrentGeneration = () => {
		// Aborting is synchronous: the observers of this generation deliver nothing more
		generation?.abort()
		generation = undefined
	}

	const runCheck = async () => {
		if (parentSignal.aborted) return
		if (checkRunning) return
		checkRunning = true

		try {
			if (pendingRestart) {
				pendingRestart = false
				stopCurrentGeneration()
			}

			if (!generation) {
				const thisGeneration = createChildAbort(parentSignal)
				generation = thisGeneration
				try {
					await generator(thisGeneration.signal)
				} catch (e) {
					// Release anything the generator started before it threw
					thisGeneration.abort()
					if (generation === thisGeneration) generation = undefined
					throw e
				}

				// Another operation may have been requested while we were starting
				if (pendingRestart) deferCheck()
			}
		} finally {
			checkRunning = false
		}
	}

	// Debounce calls, in most cases
	const deferCheck = () =>
		lazyIgnore(
			id,
			() => {
				runCheck().catch((e) => {
					logger.error(`${id} failed to restart observers: ${stringifyError(e)}`)
				})
			},
			REACTIVITY_DEBOUNCE
		)

	// The group as a whole ends with the parent signal
	if (parentSignal.aborted) throw new SofieError(500, 'ReactiveObserverGroup started with an aborted signal')
	parentSignal.addEventListener('abort', () => stopCurrentGeneration(), { once: true })

	// Wait for the initial setup of the observers, so that they are running once we return
	await runCheck()

	return {
		restart: () => {
			if (parentSignal.aborted) throw new SofieError(500, 'ReactiveObserverGroup has been stopped!')

			pendingRestart = true
			deferCheck()
		},
	}
}
