import { Tracker } from 'meteor/tracker'
import { AllPubSubTypes } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { meteorSubscribe } from '../meteorApi.js'
import { Meteor } from 'meteor/meteor'

/**
 * Slow down the reactivity of the inner function `fnc` to the outer computation.
 *
 * This is essentially a `throttle` for reactivity. If the inner `fnc` computation is invalidated, it will wait `delay`
 * time to invalidate the outer computation.
 *
 * @export
 * @template T
 * @param {T} fnc The wrapped computation
 * @param {number} delay The amount of time to wait before invalidating the outer function
 * @return {*}  {ReturnType<T>}
 */
export function slowDownReactivity<T extends (...args: any) => any>(fnc: T, delay: number): ReturnType<T> {
	// if the delay is <= 0, call straight away and register a direct dependency
	if (delay <= 0) {
		return fnc()
	}

	// if the delay is > 0, slow down the reactivity
	const dep = new Tracker.Dependency()
	dep.depend()

	let result: ReturnType<T>
	let invalidationTimeout: number | null = null
	let parentInvalidated = false
	const parentComputation = Tracker.currentComputation
	const computation = Tracker.nonreactive(() => {
		const computation = Tracker.autorun(() => {
			result = fnc()
		})
		computation.onInvalidate(() => {
			// if the parent hasn't been invalidated and there is no scheduled invalidation
			if (parentInvalidated === false && invalidationTimeout === null) {
				invalidationTimeout = Meteor.setTimeout(() => {
					invalidationTimeout = null
					dep.changed()
				}, delay)
			}
		})
		return computation
	})
	parentComputation?.onInvalidate(() => {
		// stop the inner computation, if the parent computation has been invalidated
		// and clean out any timeouts that may have been registered
		parentInvalidated = true
		computation.stop()
		if (invalidationTimeout) Meteor.clearTimeout(invalidationTimeout)
	})

	// @ts-expect-error it is assigned by the tracker
	return result
}

export abstract class WithManagedTracker {
	private _autoruns: Tracker.Computation[] = []
	private _subs: Meteor.SubscriptionHandle[] = []

	stop(): void {
		this._autoruns.forEach((comp) => comp.stop())
		setTimeout(() => {
			this._subs.forEach((comp) => comp.stop())
		}, 2000) // wait for a couple of seconds, before unsubscribing
	}

	subscriptionsReady(): boolean {
		return this._subs.every((e) => e.ready())
	}

	protected subscribe<K extends keyof AllPubSubTypes>(sub: K, ...args: Parameters<AllPubSubTypes[K]>): void {
		this._subs.push(meteorSubscribe(sub, ...args))
	}

	protected autorun(
		func: (comp: Tracker.Computation) => void,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
		options?: { onError: Function | undefined }
	): Tracker.Computation {
		return Tracker.nonreactive(() => {
			const comp = Tracker.autorun(func, options)
			this._autoruns.push(comp)
			return comp
		})
	}
}

// let s = 'abc'
// let n = 123
// let arr = [s,n]

// function testFcn (a1: string, a2: number): number
// function testFcn (...params) {
// 	return params[1]
// }

// function fixFunction<T> (f: () => T): () => T {
// 	return f
// }

// let f = fixFunction( function (): string {
// 	return 'hello'
// })

// let retVal = f()
