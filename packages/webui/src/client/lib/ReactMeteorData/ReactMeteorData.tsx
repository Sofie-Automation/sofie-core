import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { Tracker } from 'meteor/tracker'
import { withTranslation, WithTranslation } from 'react-i18next'
import { AllPubSubTypes } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { meteorSubscribe } from '../meteorApi.js'
import { stringifyObjects } from '../tempLib.js'
import _ from 'underscore'

const globalTrackerQueue: Array<() => void> = []
let globalTrackerTimestamp: number | undefined = undefined
let globalTrackerTimeout: number | undefined = undefined

const SUBSCRIPTION_TIMEOUT = 1000

/**
 * Delay an update to be batched with the global tracker invalidation queue
 */
export function useGlobalDelayedTrackerUpdateState<T>(newValue: T): T {
	const [delayedValue, setDelayedValue] = useState<T>(newValue)

	useGlobalDelayedTrackerUpdate(setDelayedValue, newValue)

	return delayedValue
}

/**
 * Delay an update to be batched with the global tracker invalidation queue
 * @param performUpdate Function to call to apply the update
 * @param newValue New value to apply with the tracker
 */
export function useGlobalDelayedTrackerUpdate<T>(performUpdate: (value: T) => void, newValue: T): void {
	const isPending = useRef(false)
	const updateRef = useRef<() => void>()

	useEffect(() => {
		// Store the new callback
		updateRef.current = () => performUpdate(newValue)

		return () => {
			// Invalidated, discard current callback
			updateRef.current = undefined
		}
	}, [performUpdate, newValue])

	// If a call isn't pending, enqueue the callback
	if (!isPending.current) {
		MeteorDataManager.enqueueUpdate(() => {
			isPending.current = false
			if (updateRef.current) {
				updateRef.current()
			}
		})
		isPending.current = true
	}
}

const METEOR_DATA_DEBOUNCE = 120
const METEOR_DATA_DEBOUNCE_STALE = 200

// A class to keep the state and utility methods needed to manage
// the Meteor data for a component.
class MeteorDataManager {
	component: any
	computation: any
	oldData: any
	queueTrackerUpdates: boolean

	constructor(component: any, queueTrackerUpdates: boolean) {
		this.component = component
		this.computation = null
		this.oldData = null
		this.queueTrackerUpdates = queueTrackerUpdates || false
	}

	dispose() {
		if (this.computation) {
			this.computation.stop()
			this.computation = null
		}
	}

	static runUpdates() {
		clearTimeout(globalTrackerTimeout)
		globalTrackerTimeout = undefined
		globalTrackerTimestamp = undefined
		globalTrackerQueue.forEach((func) => func())
		globalTrackerQueue.length = 0
	}

	static enqueueUpdate(func: () => void) {
		if (globalTrackerTimeout !== undefined) {
			clearTimeout(globalTrackerTimeout)
			globalTrackerTimeout = undefined
		}
		if (globalTrackerTimestamp === undefined) {
			globalTrackerTimestamp = Date.now()
		}
		globalTrackerQueue.push(func)
		if (Date.now() - globalTrackerTimestamp < METEOR_DATA_DEBOUNCE_STALE) {
			globalTrackerTimeout = Meteor.setTimeout(MeteorDataManager.runUpdates, METEOR_DATA_DEBOUNCE)
		} else {
			MeteorDataManager.runUpdates()
		}
	}

	calculateData() {
		const component = this.component

		if (!component.getMeteorData) {
			return null
		}

		if (this.computation) {
			this.computation.stop()
			this.computation = null
		}

		let data: any
		// Use Tracker.nonreactive in case we are inside a Tracker Computation.
		// This can happen if someone calls `ReactDOM.render` inside a Computation.
		// In that case, we want to opt out of the normal behavior of nested
		// Computations, where if the outer one is invalidated or stopped,
		// it stops the inner one.
		this.computation = Tracker.nonreactive(() =>
			Tracker.autorun((c) => {
				if (c.firstRun) {
					const savedSetState = component.setState
					try {
						component.setState = () => {
							throw new Error(
								"Can't call `setState` inside `getMeteorData` as this could " +
									'cause an endless loop. To respond to Meteor data changing, ' +
									'consider making this component a "wrapper component" that ' +
									'only fetches data and passes it in as props to a child ' +
									'component. Then you can use `componentWillReceiveProps` in ' +
									'that child component.'
							)
						}

						data = component.getMeteorData()
					} finally {
						component.setState = savedSetState
					}
				} else {
					// Stop this computation instead of using the re-run.
					// We use a brand-new autorun for each call to getMeteorData
					// to capture dependencies on any reactive data sources that
					// are accessed.  The reason we can't use a single autorun
					// for the lifetime of the component is that Tracker only
					// re-runs autoruns at flush time, while we need to be able to
					// re-call getMeteorData synchronously whenever we want, e.g.
					// from UNSAFE_componentWillUpdate.
					c.stop()
					// Calling forceUpdate() triggers UNSAFE_componentWillUpdate which
					// recalculates getMeteorData() and re-renders the component.

					// TODO(performance): optionally queue tracker updates for a while
					if (this.queueTrackerUpdates) {
						MeteorDataManager.enqueueUpdate(() => {
							if (this.computation) {
								component.forceUpdate()
							}
						})
					} else {
						component.forceUpdate()
					}
				}
			})
		)

		if (Mongo && data) {
			Object.keys(data).forEach((key) => {
				if (data[key] instanceof Mongo.Cursor) {
					console.warn(
						'Warning: you are returning a Mongo cursor from getMeteorData. ' +
							'This value will not be reactive. You probably want to call ' +
							'`.fetch()` on the cursor before returning it.'
					)
				}
			})
		}

		return data
	}

	updateData(newData: any) {
		const component = this.component
		const oldData = this.oldData

		if (!(newData && typeof newData === 'object')) {
			throw new Error('Expected object returned from getMeteorData')
		}
		// update componentData in place based on newData
		for (const key in newData) {
			component.data[key] = newData[key]
		}
		// if there is oldData (which is every time this method is called
		// except the first), delete keys in newData that aren't in
		// oldData.  don't interfere with other keys, in case we are
		// co-existing with something else that writes to a component's
		// this.data.
		if (oldData) {
			for (const key in oldData) {
				if (!(key in newData)) {
					delete component.data[key]
				}
			}
		}
		this.oldData = newData
	}
}
export const ReactMeteorData = {
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	UNSAFE_componentWillMount(this: any): void {
		this.data = {}
		this._meteorDataManager = new MeteorDataManager(this, this._queueTrackerUpdates || false)
		const newData = this._meteorDataManager.calculateData()
		this._meteorDataManager.updateData(newData)
	},

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	UNSAFE_componentWillUpdate(this: any, nextProps: any, nextState: any): void {
		const saveProps = this.props
		const saveState = this.state
		let newData
		try {
			// Temporarily assign this.state and this.props,
			// so that they are seen by getMeteorData!
			// This is a simulation of how the proposed Observe API
			// for React will work, which calls observe() after
			// UNSAFE_componentWillUpdate and after props and state are
			// updated, but before render() is called.
			// See https://github.com/facebook/react/issues/3398.
			this.props = nextProps
			this.state = nextState
			newData = this._meteorDataManager.calculateData()
		} finally {
			this.props = saveProps
			this.state = saveState
		}

		this._meteorDataManager.updateData(newData)
	},

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	componentWillUnmount(this: any): void {
		this._meteorDataManager.dispose()
	},
}

class ReactMeteorComponentWrapper<P, S> extends React.Component<P, S> {
	data: any
	// _renderedContent: any
}
Object.assign(ReactMeteorComponentWrapper.prototype, ReactMeteorData)
class ReactMeteorPureComponentWrapper<P, S> extends React.PureComponent<P, S> {}
Object.assign(ReactMeteorPureComponentWrapper.prototype, ReactMeteorData)

export interface WithTrackerOptions<IProps, IState, TrackedProps> {
	getMeteorData: (props: IProps) => TrackedProps
	shouldComponentUpdate?: (data: any, props: IProps, nextProps: IProps, state?: IState, nextState?: IState) => boolean
	queueTrackerUpdates?: boolean
	// pure?: boolean
}
// @todo: add withTrackerPure()
export function withTracker<IProps, IState, TrackedProps>(
	autorunFunction: (props: IProps) => TrackedProps,
	checkUpdate?: (data: any, props: IProps, nextProps: IProps, state?: IState, nextState?: IState) => boolean,
	queueTrackerUpdates?: boolean
): (component: React.ComponentType<IProps & TrackedProps>) => React.ComponentType<IProps> {
	const expandedOptions: WithTrackerOptions<IProps, IState, TrackedProps> = {
		getMeteorData: autorunFunction,
		shouldComponentUpdate: checkUpdate,
		queueTrackerUpdates,
	}

	return (WrappedComponent) => {
		// return ''
		const HOC = class HOC extends ReactMeteorComponentWrapper<IProps, IState> {
			_queueTrackerUpdates = expandedOptions.queueTrackerUpdates

			getMeteorData() {
				return expandedOptions.getMeteorData.call(this, this.props)
			}
			// This hook allows lower-level components to do smart optimization,
			// without running a potentially heavy recomputation of the getMeteorData.
			// This is potentially very dangerous, so use with caution.
			shouldComponentUpdate(nextProps: IProps, nextState: IState): boolean {
				if (typeof expandedOptions.shouldComponentUpdate === 'function') {
					return expandedOptions.shouldComponentUpdate(this.data, this.props, nextProps, this.state, nextState)
				}
				return true
			}
			render(): JSX.Element {
				return <WrappedComponent {...this.props} {...this.data} />
			}
		}
		;(HOC as any)['displayName'] = `ReactMeteorComponentWrapper(${
			(WrappedComponent as any)['displayName'] || WrappedComponent.name || 'Unnamed component'
		})`
		return HOC
	}
}
export function translateWithTracker<IProps, IState, TrackedProps>(
	autorunFunction: (props: Translated<IProps>, state?: IState) => TrackedProps,
	checkUpdate?: (data: any, props: IProps, nextProps: IProps, state?: IState, nextState?: IState) => boolean,
	queueTrackerUpdates?: boolean
): (component: React.ComponentType<Translated<IProps & TrackedProps>>) => React.ComponentType<IProps> {
	return (WrappedComponent) => {
		const inner: React.ComponentType<Translated<IProps>> = withTracker<Translated<IProps>, IState, TrackedProps>(
			autorunFunction,
			checkUpdate,
			queueTrackerUpdates
		)(WrappedComponent)
		return withTranslation()(inner) as React.ComponentType<IProps>
	}
}
export type Translated<T> = T & WithTranslation

// function withTracker<IProps, IState, TrackedProps>
// 	(
// 		autorunFunction: (props: IProps, state?: IState | undefined) => TrackedProps
// 	): (
// 		WrappedComponent: new (
// 			props: TrackedProps,
// 			state: IState
// 		) => React.Component<TrackedProps, IState, never>
// 	) => any

/**
 * A Meteor Tracker hook that allows using React Functional Components and the Hooks API with Meteor Tracker
 *
 * @export
 * @template T
 * @template K
 * @param {() => T} autorun The autorun function to be run.
 * @param {React.DependencyList} [deps] A required list of dependenices to limit the tracker re-running. Can be left empty, if tracker
 * 		has no external dependencies and should only be rerun when it's invalidated.
 * @param {K} [initial] An optional, initial state of the tracker. If not provided, the tracker may return undefined.
 * @return {*}  {(T | K)}
 */
export function useTracker<T>(
	autorun: (computation: Tracker.Computation) => T,
	deps: React.DependencyList
): T | undefined
export function useTracker<T>(
	autorun: (computation: Tracker.Computation) => T,
	deps: React.DependencyList,
	initial: T
): T
export function useTracker<T, K extends undefined | T = undefined>(
	autorun: (computation: Tracker.Computation) => T,
	deps: React.DependencyList,
	initial?: K
): T | K {
	const [meteorData, setMeteorData] = useState<T | K>(initial as K)

	useEffect(() => {
		const computation = Tracker.nonreactive(() =>
			Tracker.autorun((innerComputation) => setMeteorData(autorun(innerComputation)))
		)
		return () => computation.stop()
	}, deps)

	return meteorData
}

/**
 * A Meteor Tracker hook that allows using React Functional Components and the Hooks API with Meteor Tracker
 *
 * This is an alternate implementation which supports promises in the autorun function, and will preserve the previous value until the promise resolves.
 *
 * @param {() => Promise<T>} autorun The autorun function to be run.
 * @param {React.DependencyList} [deps] A required list of dependencies to limit the tracker re-running. Can be left empty, if tracker
 * 		has no external dependencies and should only be rerun when it's invalidated.
 * @param {K} [initial] An optional, initial state of the tracker. If not provided, the tracker may return undefined.
 * @return {*}  {(T | K)}
 */
export function useTrackerAsync<T, K extends undefined | T = undefined>(
	autorun: (computation: Tracker.Computation) => Promise<T>,
	deps: React.DependencyList,
	initial?: K
): T | K {
	const [meteorData, setMeteorData] = useState<T | K>(initial as K)

	useEffect(() => {
		const computation = Tracker.nonreactive(() =>
			Tracker.autorun(async (innerComputation) => {
				setMeteorData(await autorun(innerComputation))
			})
		)
		return () => computation.stop()
	}, deps)

	return meteorData
}

/**
 * A hook to track a boolean state with a sort of histeresis, with preference for `true`. `setState` makes the returned
 * `state` be `true` immediately, but `false` only after `resetState` is called and `timeout` elapses. If `setState`
 * is called with `true` before `timeout` elapses, then `resetState` is aborted and `state` will remain `ture.
 *
 * Later `resetState` calls replace earlier unelapsed calls and their timeout periods.
 *
 * @param {boolean} [initialState=false]
 * @return {*}  {{
 * 	state: boolean
 * 	setState: (value: boolean) => void
 * 	resetState: (timeout: number) => void
 * }}
 */
function useDelayState(initialState = false): {
	state: boolean
	setState: (value: boolean) => void
	resetState: (timeout: number) => void
} {
	const [state, setState] = useState(initialState)
	const [prevState, setPrevState] = useState(initialState)
	const prevReadyTimeoutRef = useRef<number | null>(null)

	const setStateAndClearResets = useCallback(
		(value: boolean) => {
			setState(value)

			if (value) {
				setPrevState(true)
				if (prevReadyTimeoutRef.current !== null) {
					window.clearTimeout(prevReadyTimeoutRef.current)
					prevReadyTimeoutRef.current = null
				}
			}
		},
		[setState, setPrevState]
	)

	const resetStateAfterDelay = useCallback((timeout: number) => {
		if (prevReadyTimeoutRef.current !== null) {
			window.clearTimeout(prevReadyTimeoutRef.current)
		}
		prevReadyTimeoutRef.current = window.setTimeout(() => {
			prevReadyTimeoutRef.current = null
			setPrevState(false)
		}, timeout)
	}, [])

	return {
		state: state || prevState,
		setState: setStateAndClearResets,
		resetState: resetStateAfterDelay,
	}
}

/**
 * A Meteor Subscription hook that allows using React Functional Components and the Hooks API with Meteor subscriptions.
 * Subscriptions will be torn down 1000ms after unmounting the component.
 *
 * @export
 * @param {PubSub} sub The subscription to be subscribed to
 * @param {...any[]} args A list of arugments for the subscription. This is used for optimizing the subscription across
 * 		renders so that it isn't torn down and created for every render.
 */
export function useSubscription<K extends keyof AllPubSubTypes>(
	sub: K,
	...args: Parameters<AllPubSubTypes[K]>
): boolean {
	const { state: ready, setState: setReady, resetState: cancelPreviousReady } = useDelayState()

	useEffect(() => {
		const subscription = Tracker.nonreactive(() => meteorSubscribe(sub, ...args))
		const isReadyComp = Tracker.nonreactive(() =>
			Tracker.autorun(() => {
				const isNowReady = subscription.ready()
				setReady(isNowReady)
			})
		)
		return () => {
			isReadyComp.stop()
			setTimeout(() => {
				subscription.stop()
			}, SUBSCRIPTION_TIMEOUT)
			cancelPreviousReady(SUBSCRIPTION_TIMEOUT)
		}
	}, [sub, stringifyObjects(args)])

	const isReady = ready

	return isReady
}

/**
 * A Meteor Subscription hook that allows using React Functional Components and the Hooks API with Meteor subscriptions.
 * Subscriptions will be torn down 1000ms after unmounting the component.
 * If the subscription is not enabled, the subscription will not be created, and the ready state will always be true.
 *
 * @export
 * @param {PubSub} sub The subscription to be subscribed to
 * @param {boolean} enable Whether the subscription is enabled
 * @param {...any[]} args A list of arugments for the subscription. This is used for optimizing the subscription across
 * 		renders so that it isn't torn down and created for every render.
 */
export function useSubscriptionIfEnabled<K extends keyof AllPubSubTypes>(
	sub: K,
	enable: boolean,
	...args: Parameters<AllPubSubTypes[K]>
): boolean {
	const { state: ready, setState: setReady, resetState: cancelPreviousReady } = useDelayState()

	useEffect(() => {
		if (!enable) {
			setReady(false)
			return
		}

		const subscription = Tracker.nonreactive(() => meteorSubscribe(sub, ...args))
		const isReadyComp = Tracker.nonreactive(() =>
			Tracker.autorun(() => {
				const isNowReady = subscription.ready()
				setReady(isNowReady)
			})
		)
		return () => {
			isReadyComp.stop()
			setTimeout(() => {
				subscription.stop()
			}, SUBSCRIPTION_TIMEOUT)
			cancelPreviousReady(SUBSCRIPTION_TIMEOUT)
		}
	}, [sub, enable, stringifyObjects(args)])

	const isReady = !enable || ready

	return isReady
}

/**
 * A Meteor Subscription hook that allows using React Functional Components and the Hooks API with Meteor subscriptions.
 * Subscriptions will be torn down 1000ms after unmounting the component.
 * If the subscription is not enabled, the subscription will not be created, and the ready state will always be true.
 *
 * @export
 * @param {PubSub} sub The subscription to be subscribed to
 * @param {boolean} enable Whether the subscription is enabled
 * @param {...any[]} args A list of arugments for the subscription. This is used for optimizing the subscription across
 * 		renders so that it isn't torn down and created for every render.
 */
export function useSubscriptionIfEnabledReadyOnce<K extends keyof AllPubSubTypes>(
	sub: K,
	enable: boolean,
	...args: Parameters<AllPubSubTypes[K]>
): boolean {
	const { state: ready, setState: setReady, resetState: cancelPreviousReady } = useDelayState()

	useEffect(() => {
		if (!enable) {
			setReady(false)
			return
		}

		const subscription = Tracker.nonreactive(() => meteorSubscribe(sub, ...args))
		const isReadyComp = Tracker.nonreactive(() =>
			Tracker.autorun(() => {
				const isNowReady = subscription.ready()
				if (isNowReady) setReady(true)
			})
		)
		return () => {
			isReadyComp.stop()
			setTimeout(() => {
				subscription.stop()
			}, SUBSCRIPTION_TIMEOUT)
			cancelPreviousReady(SUBSCRIPTION_TIMEOUT)
		}
	}, [sub, enable, stringifyObjects(args)])

	const isReady = !enable || ready

	return isReady
}

/**
 * Sets up multiple subscriptions of the same type, but with different arguments
 */
export function useSubscriptions<K extends keyof AllPubSubTypes>(
	sub: K,
	argsArray: Array<Parameters<AllPubSubTypes[K]> | undefined | null | false>
): boolean {
	const [ready, setReady] = useState<boolean>(false)

	useEffect(() => {
		const subscriptions = Tracker.nonreactive(() => _.compact(argsArray).map((args) => meteorSubscribe(sub, ...args)))
		const isReadyComp = Tracker.nonreactive(() =>
			Tracker.autorun(() => setReady(subscriptions.reduce((memo, subscription) => memo && subscription.ready(), true)))
		)
		return () => {
			isReadyComp.stop()
			setTimeout(() => {
				for (const subscription of subscriptions) {
					subscription.stop()
				}
			}, 1000)
		}
	}, [sub, stringifyObjects(argsArray)])

	return ready
}
