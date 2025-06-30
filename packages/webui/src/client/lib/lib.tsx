import React, { useEffect, useRef, useState } from 'react'
import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { Time } from './tempLib.js'
import { getCurrentTime, systemTime } from './systemTime.js'
import { logger } from './logging.js'
import shajs from 'sha.js'
import { SINGLE_USE_TOKEN_SALT } from '@sofie-automation/meteor-lib/dist/api/userActions'
import RundownViewEventBus, {
	RundownViewEventBusEvents,
	RundownViewEvents,
} from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'

export { multilineText, isEventInInputField }

function multilineText(txt: string): React.ReactNode {
	return _.map((txt + '').split('\n'), (line: string, i) => {
		return <p key={i}>{line}</p>
	})
}

function isEventInInputField(e: Event): boolean {
	// @ts-expect-error localName
	return e && e.target && ['textarea', 'input'].indexOf(e.target.localName + '') !== -1
}

export function contextMenuHoldToDisplayTime(): number {
	return isTouchDevice() ? 1000 : -1
}

let touchDeviceCache: undefined | boolean = undefined
export function isTouchDevice(): boolean {
	if (touchDeviceCache !== undefined) return touchDeviceCache

	touchDeviceCache = false
	if (window.matchMedia('(any-pointer: coarse)').matches) {
		touchDeviceCache = true
	}
	return touchDeviceCache
}

/**
 * Wrapper around fetch(), which rejects the promise if the result is an error
 */
export function fetchFrom(input: RequestInfo, init?: RequestInit): Promise<Response & { bodyText: string }> {
	return fetch(input, init).then((response) => {
		// Read the body:
		return response.text().then((bodyText: string) => {
			if (response.status !== 200) {
				// If the response is bad, throw the error:
				throw new Error(`${response.status}: ${bodyText || response.statusText || 'Unknown error'}`)
			} else {
				return {
					...response,
					bodyText: bodyText,
				}
			}
		})
	})
}

/**
 * This CSS Variable is used to indicate to the UI that it's being run on a Browser without ordinary pointers
 * but one that emulates mouse-clicks using some other input method (like a Stream Deck).
 */
export const USER_AGENT_POINTER_PROPERTY = '--pointer'
export enum UserAgentPointer {
	NO_POINTER = 'no-pointer',
}

type MutableRef<T> = ((instance: T | null) => void) | React.MutableRefObject<T | null> | null

export function useCombinedRefs<T>(initial: T | null, ...refs: MutableRef<T>[]): React.RefObject<T> {
	const targetRef = useRef<T>(initial)

	useEffect(() => {
		refs.forEach((ref) => {
			if (!ref) return

			if (typeof ref === 'function') {
				ref(targetRef.current)
			} else {
				ref.current = targetRef.current
			}
		})
	}, [refs])

	return targetRef
}

/**
 * A reactive hook that will turn the return value of `func` to a state and re-evaluate `func` on an interval `interval`.
 * `func` returns a Tuple: a value that is the state and the timespan until next re-validation.
 *
 * `func` will be ran synchronously once to get the initial state.
 *
 * Like with any hook, dependencies need to be declared. If the dependencies change, the entire hook is invalidated and the
 * state will start from the initial value.
 *
 * @template K
 * @param {() => [K, number?]} func
 * @param {any[]} [deps] external values `func` depends on. Uses same rules as `useEffect`.
 * @return {K} the current value of the state
 */
export function useInvalidateTimeout<K>(func: () => [K, number], deps: any[]): K | null {
	const [value, setValue] = useState<K | null>(null)
	const invalidateHandle = useRef<number | null>(null)

	useEffect(() => {
		const reevaluate = () => {
			const [newValue, revalidateIn] = func()
			if (revalidateIn > 0) {
				invalidateHandle.current = Meteor.setTimeout(reevaluate, revalidateIn)
			} else {
				invalidateHandle.current = null
			}
			if (!_.isEqual(newValue, value)) {
				setValue(newValue)
			}
		}

		const [mountValue, timeout] = func()
		setValue(mountValue)

		if (timeout > 0) {
			invalidateHandle.current = Meteor.setTimeout(reevaluate, timeout)
		}

		return () => {
			if (invalidateHandle.current !== null) {
				Meteor.clearTimeout(invalidateHandle.current)
				invalidateHandle.current = null
			}
		}
	}, [...deps])

	return value
}

/**
 * Limit the reactivity of a value and wait at least `delay` number of milliseconds before updating
 *
 * @export
 * @template K
 * @param {K} value value to be debounced
 * @param {number} delay how long to wait after an update before updating the state
 * @param shouldUpdate optional function to filter whether the value has changed
 * @return {K} debounced value
 */
export function useDebounce<K>(value: K, delay: number, shouldUpdate?: (oldVal: K, newVal: K) => boolean): K {
	const [debouncedValue, setDebouncedValue] = useState(value)

	// Store the function in a ref to avoid the debounce being reactive to the function changing
	const shouldUpdateFn = useRef<(oldVal: K, newVal: K) => boolean>()
	shouldUpdateFn.current = shouldUpdate

	useEffect(() => {
		const handler = setTimeout(() => {
			const shouldUpdate = shouldUpdateFn.current
			if (typeof shouldUpdate === 'function') {
				setDebouncedValue((oldVal) => {
					if (shouldUpdate(oldVal, value)) {
						return value
					} else {
						return oldVal
					}
				})
			} else {
				setDebouncedValue(value)
			}
		}, delay)

		return () => {
			clearTimeout(handler)
		}
	}, [value, delay])

	return debouncedValue
}

/**
 * This hook returns the current time and updates it at the specified refresh period.
 * It uses a timeout to schedule the next update based on the refresh period.
 * The time is calculated as the current time in milliseconds since the Unix epoch.
 * The hook also cleans up the timeout when the component using it unmounts.
 *
 * @param refreshPeriod - The period in milliseconds at which the current time should be refreshed.
 * @returns The current time in milliseconds since the Unix epoch.
 */
export function useCurrentTime(refreshPeriod = 1000): number {
	const [time, setTime] = useState(getCurrentTime())
	const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		function updateTime() {
			const current = getCurrentTime()
			setTime(current)
			const delay = refreshPeriod - (current % refreshPeriod)
			timeoutId.current = setTimeout(updateTime, delay)
		}

		updateTime() // Initial call to start the timer

		return () => {
			if (timeoutId.current) {
				clearTimeout(timeoutId.current) // Cleanup on unmount
			}
		}
	}, [refreshPeriod])

	return time
}

export function isRunningInPWA(): boolean {
	if (window.matchMedia('(display-mode: browser)').matches) {
		return false
	}
	return true
}

export function getEventTimestamp(e: Event): Time {
	return e?.timeStamp ? performance.timeOrigin + e.timeStamp + systemTime.timeOriginDiff : getCurrentTime()
}

export function mapOrFallback<T = any, K = any, L = any>(
	array: T[],
	callbackFn: (value: T, index: number, array: T[]) => K,
	fallbackCallbackFn: () => L
): K[] | L {
	if (array.length === 0) return fallbackCallbackFn()

	return array.map(callbackFn)
}

export function firstIfArray<T>(value: T | T[] | null | undefined): T | null | undefined
export function firstIfArray<T>(value: T | T[] | null): T | null
export function firstIfArray<T>(value: T | T[] | undefined): T | undefined
export function firstIfArray<T>(value: T | T[]): T
export function firstIfArray<T>(value: unknown): T {
	return _.isArray(value) ? _.first(value) : value
}

export const TOOLTIP_DEFAULT_DELAY = 0.5

/**
 * Returns a function that logs the error along with the context.
 * @usage Instead of .catch(console.error), do .catch(catchError('myContext'))
 *
 */
export function catchError(context: string): (...errs: any[]) => void {
	return (...errs: any[]) => logger.error(context, ...errs)
}

export function hashSingleUseToken(token: string): string {
	// Future: it would be nice for this to use a better webcrypto/better library, but this works
	return shajs('sha1')
		.update(SINGLE_USE_TOKEN_SALT + token)
		.digest('base64')
		.replace(/[+/=]/g, '_')
}

export function useRundownViewEventBusListener<TEvent extends RundownViewEvents>(
	name: TEvent,
	cb: (...args: RundownViewEventBusEvents[TEvent]) => void
): void {
	useEffect(() => {
		// We need to force the cb type, typescript can't infer this through the generic
		RundownViewEventBus.on(name, cb as any)
		return () => {
			RundownViewEventBus.off(name, cb as any)
		}
	}, [name, cb])
}
