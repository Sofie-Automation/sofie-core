import type { TriggerTrackerComputation } from './triggersContext.js'

// Copied from Meteor
export interface TriggerReactiveVar<T> {
	/**
	 * Returns the current value of the ReactiveVar, establishing a reactive dependency.
	 */
	get(computation: TriggerTrackerComputation | null): T
	/**
	 * Sets the current value of the ReactiveVar, invalidating the Computations that called `get` if `newValue` is different from the old value.
	 */
	set(newValue: T): void
}

/**
 * This just looks like a ReactiveVar, but is not reactive.
 * It's used to use the same interface/typings, but when code is run on both client and server side.
 * */
export class DummyReactiveVar<T> implements TriggerReactiveVar<T> {
	constructor(private value: T) {}
	public get(): T {
		return this.value
	}
	public set(newValue: T): void {
		this.value = newValue
	}
}
