import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { Meteor } from 'meteor/meteor'
import { LiveQueryHandle, lazyIgnore } from '../../lib/lib'
import { waitForAllObserversReady } from './lib'

export interface ReactiveMongoObserverGroupHandle extends LiveQueryHandle {
	/**
	 * Trigger a restart of the observers inside this group
	 */
	restart(): void
}

const REACTIVITY_DEBOUNCE = 20

/**
 * Helper to trigger reactivity inside of an OptimisedObserver whenever one of the other Mongo observers changes
 * Note: care needs to be taken when using this, as Mongo observers call `added` for every document when they start. It is very easy to form an infinite loop of observer invalidations
 * @param generator Function to generate the `LiveQueryHandle`s
 * @returns Handle to stop and restart the observer group
 */
export async function ReactiveMongoObserverGroup(
	generator: () => Promise<Array<Promise<LiveQueryHandle>>>
): Promise<ReactiveMongoObserverGroupHandle> {
	let running = true
	let pendingStop: PromiseWithResolvers<void> | undefined
	let pendingRestart = false
	let handles: Array<LiveQueryHandle> | null = null

	const stopAll = async () => {
		if (handles) {
			await Promise.allSettled(handles.map(async (h) => h.stop()))
			handles = null
		}
	}

	const id = `ReactiveMongoObserverGroup:${getRandomString()}`

	let checkRunning = false
	const runCheck = async () => {
		let result: PromiseWithResolvers<void> | undefined
		try {
			if (!running) throw new Meteor.Error(500, 'ObserverGroup has been stopped!')

			if (checkRunning) return
			checkRunning = true

			// stop() has been called
			if (pendingStop) {
				running = false

				result = pendingStop
				pendingStop = undefined

				// Stop the child observers
				await stopAll()

				result.resolve()

				// Stop loop
				return
			}

			// restart() has been called
			if (pendingRestart) {
				pendingRestart = false

				// Stop the child observers
				await stopAll()
			}

			// Start the child observers
			if (!handles) {
				handles = await waitForAllObserversReady(await generator())

				// check for another pending operation
				deferCheck()
			}

			// Inform caller
			if (result) result.resolve()
		} catch (e: any) {
			if (result) result.reject(e)
		} finally {
			checkRunning = false
		}
	}

	// Debounce calls, in most cases
	const deferCheck = () => lazyIgnore(id, runCheck, REACTIVITY_DEBOUNCE)

	const handle: ReactiveMongoObserverGroupHandle = {
		stop: async () => {
			if (!running) throw new Meteor.Error(500, 'ReactiveMongoObserverGroup is not running!')

			pendingStop = pendingStop || Promise.withResolvers<void>()

			deferCheck()

			// Block the caller until the stop has completed
			await pendingStop.promise
		},
		restart: () => {
			if (!running) throw new Meteor.Error(500, 'ReactiveMongoObserverGroup is not running!')

			// Ensure there is not a pending stop
			if (pendingStop) throw new Meteor.Error(500, 'ReactiveMongoObserverGroup has been stopped')

			pendingRestart = true

			deferCheck()
		},
	}

	// wait for initial setup of observers, so that they are running once we return
	await runCheck()

	return handle
}
