import * as _ from 'underscore';
import { ReactiveVar } from 'meteor/reactive-var';
import { Tracker } from 'meteor/tracker';
import { PubSub } from '../../../lib/api/pubsub';
import { Meteor } from 'meteor/meteor';

export namespace ReactiveDataHelper {
	const rVarCache: _.Dictionary<ReactiveVar<any>> = {};

	function cacheId(...params): string {
		return params.join('_');
	}

	export function simpleObjCompare(objA, objB) {
		if (objA === objB) {
			return true;
		} else if (objA && objB) {
			return JSON.stringify(objA) === JSON.stringify(objB);
		} else {
			return false;
		}
	}

	export function memoizeRVar<T, A0>(
		computation: (a0: A0) => ReactiveVar<T>,
		...labels
	): (a0: A0) => ReactiveVar<T>;
	export function memoizeRVar<T, A0, A1>(
		computation: (a0: A0, a1: A1) => ReactiveVar<T>,
		...labels
	): (a0: A0, a1: A1) => ReactiveVar<T>;
	export function memoizeRVar<T, A0, A1, A2>(
		computation: (a0: A0, a1: A1, a2: A2) => ReactiveVar<T>,
		...labels
	): (a0: A0, a1: A1, a2: A2) => ReactiveVar<T>;
	export function memoizeRVar<T>(
		computation: (...params) => ReactiveVar<T>,
		...labels
	): (...params) => ReactiveVar<T> {
		return function(...params): ReactiveVar<T> {
			const cId = cacheId(computation.name, ...labels, ...params);
			if (rVarCache[cId]) {
				return rVarCache[cId];
			} else {
				const rVar = computation(...params);
				rVarCache[cId] = rVar;
				return rVar;
			}
		};
	}
}

export abstract class WithManagedTracker {
	private _autoruns: Tracker.Computation[] = [];
	private _subs: Meteor.SubscriptionHandle[] = [];

	stop() {
		this._autoruns.forEach((comp) => comp.stop());
		setTimeout(() => {
			this._subs.forEach((comp) => comp.stop());
		}, 2000); // wait for a couple of seconds, before unsubscribing
	}

	protected subscribe(sub: PubSub, ...args: any[]) {
		this._subs.push(Meteor.subscribe(sub, ...args));
	}

	protected autorun(
		func: (comp: Tracker.Computation) => void,
		options?: { onError: Function | undefined } | undefined
	): Tracker.Computation {
		return (Tracker.nonreactive(() => {
			const comp = Tracker.autorun(func, options);
			this._autoruns.push(comp);
			return comp;
		}) as any) as Tracker.Computation;
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
