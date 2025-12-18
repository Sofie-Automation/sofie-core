import { isPromise } from '@sofie-automation/shared-lib/dist/lib/lib'
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import _ from 'underscore'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'

const isolatedAutorunsMem: {
	[key: string]: {
		dependancy: Tracker.Dependency
		value: any
	}
} = {}

/**
 * Create a reactive computation that will be run independently of the outer one. If the same function (using the same
 * name and parameters) will be used again, this computation will only be computed once on invalidation and it's
 * result will be memoized and reused on every other call.
 *
 * The function will be considered "same", if `functionName` and `params` match.
 *
 * If the `fnc` computation is invalidated, the outer computations will only be invalidated if the value returned from
 * `fnc` fails a deep equality check (_.isEqual).
 *
 * If used in server code, thie `fnc` will be run as-is, without any reactivity
 *
 * @export
 * @template T
 * @param {T} fnc The computation function to be memoized and calculated separately from the outer one.
 * @param {string} functionName The name of this computation function
 * @param {...Parameters<T>} params Params `fnc` depends on from the outer scope. All parameters will be passed through to the function.
 * @return {*}  {ReturnType<T>}
 */
export function memoizedIsolatedAutorun<T extends (...args: any) => any>(
	fnc: T,
	functionName: string,
	...params: Parameters<T>
): ReturnType<T> {
	function hashFncAndParams(fName: string, p: any): string {
		return fName + '_' + JSON.stringify(p)
	}

	let result: ReturnType<T>
	const fId = hashFncAndParams(functionName, params)
	// const _parentComputation = Tracker.currentComputation
	if (isolatedAutorunsMem[fId] === undefined) {
		const dep = new Tracker.Dependency()
		dep.depend()
		const computation = Tracker.nonreactive(() => {
			const computation = Tracker.autorun(() => {
				result = fnc(...(params as any))

				const oldValue = isolatedAutorunsMem[fId] && isolatedAutorunsMem[fId].value

				isolatedAutorunsMem[fId] = {
					dependancy: dep,
					value: result,
				}

				if (Tracker.currentComputation && !Tracker.currentComputation.firstRun) {
					if (!_.isEqual(oldValue, result)) {
						dep.changed()
					}
				}
			})
			computation.onStop(() => {
				delete isolatedAutorunsMem[fId]
			})
			return computation
		})
		const gc = Meteor.setInterval(() => {
			if (!dep.hasDependents()) {
				Meteor.clearInterval(gc)
				computation.stop()
			}
		}, 5000)
	} else {
		result = isolatedAutorunsMem[fId].value
		isolatedAutorunsMem[fId].dependancy.depend()
	}
	// @ts-expect-error it is assigned by the tracker
	return result
}

interface IsolatedAsyncAutorunState {
	computationId: string
	dependancy: Tracker.Dependency
	value: any
}

const isolatedAsyncAutorunsMem: {
	[key: string]: IsolatedAsyncAutorunState
} = {}

export async function memoizedIsolatedAutorunAsync<TArgs extends any[], TRes>(
	parentComputation: Tracker.Computation | null,
	fnc: (computation: Tracker.Computation, ...args: TArgs) => Promise<TRes>,
	functionName: string,
	...params: TArgs
): Promise<TRes> {
	function hashFncAndParams(fName: string, p: any): string {
		return fName + '_' + JSON.stringify(p)
	}

	const fId = hashFncAndParams(functionName, params)
	// Computation is already running, depend on it
	if (isolatedAsyncAutorunsMem[fId]) {
		const result = isolatedAsyncAutorunsMem[fId].value
		isolatedAsyncAutorunsMem[fId].dependancy.depend(parentComputation)

		return result
	}

	// Setup the computation
	const computationId = getRandomString()
	const dep = new Tracker.Dependency()
	dep.depend(parentComputation)
	const computation = Tracker.nonreactive(() => {
		const computationState: IsolatedAsyncAutorunState = {
			computationId,
			dependancy: dep,
			value: null, // Filled in later
		}

		const computation = Tracker.autorun(async (innerComputation) => {
			// Start executing the function
			const rawValue: Promise<TRes> = fnc(innerComputation, ...params)

			// Fetch the previous value and the new value
			const oldValue = computationState.value
			const newValue = await rawValue

			// If the old value is an unresolved promise, we can't compare it
			const oldRealValue = isPromise(oldValue) ? null : oldValue

			// If the values are different, invalidate the dependency
			// Do this even for the first run, as other listeners might have joined while the promise was resolving
			if (!_.isEqual(oldRealValue, newValue)) {
				dep.changed()
			}

			return newValue as void // Tracker.autorun isn't generic
		})
		computation.onStop(() => {
			// Only delete if it is this computation that is stopping
			if (isolatedAsyncAutorunsMem[fId]?.computationId === computationId) {
				delete isolatedAsyncAutorunsMem[fId]
			}
		})

		// Store the first value
		computationState.value = computation.firstRunPromise
		isolatedAsyncAutorunsMem[fId] = computationState

		return computation
	})
	const gc = Meteor.setInterval(() => {
		if (!dep.hasDependents()) {
			Meteor.clearInterval(gc)
			computation.stop()
		}
	}, 5000)

	// Return the promise of the first value
	return computation.firstRunPromise as TRes // Tracker.autorun isn't generic
}
