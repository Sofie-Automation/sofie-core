import type { Tracker } from './tracker'

var ReactiveVar: ReactiveVarStatic
interface ReactiveVarStatic {
	/**
	 * Constructor for a ReactiveVar, which represents a single reactive variable.
	 * @param initialValue The initial value to set. `equalsFunc` is ignored when setting the initial value.
	 * @param equalsFunc A function of two arguments, called on the old value and the new value whenever the ReactiveVar is set. If it returns true, no set is performed. If omitted, the default
	 * `equalsFunc` returns true if its arguments are `===` and are of type number, boolean, string, undefined, or null.
	 */
	new <T>(initialValue: T, equalsFunc?: (oldValue: T, newValue: T) => boolean): ReactiveVar<T>
}
interface ReactiveVar<T> {
	/**
	 * Returns the current value of the ReactiveVar, establishing a reactive dependency.
	 * @param fromComputation An optional computation declared to depend on `dependency` instead of the current computation.
	 */
	get(fromComputation?: Tracker.Computation): T
	/**
	 * Sets the current value of the ReactiveVar, invalidating the Computations that called `get` if `newValue` is different from the old value.
	 */
	set(newValue: T): void
}

export { ReactiveVar }
