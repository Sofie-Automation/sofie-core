import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import _ from 'underscore'
import { RundownTiming } from './RundownTiming.js'
import { RundownTimingContext } from '../../../lib/rundownTiming.js'

export type TimingFilterFunction = (durations: RundownTimingContext) => any

export enum TimingTickResolution {
	/** Used for things that we want to "tick" at the same time (every full second) for all things in the GUI. */
	Synced = 0,
	/** Updated with Low accuracy (ie about 4 times a second - based on LOW_RESOLUTION_TIMING_DECIMATOR). */
	Low = 1,
	/** Updated with high accuracy (ie many times per second), to be used for things like countdowns. */
	High = 2,
}

export enum TimingDataResolution {
	/** Data for the last synced (full-second) "tick". Whenever a component with TimingTickResolutionupdates for reasons other than timing, the durations will not change randomly. */
	Synced = 0,
	/** The most accurate data, whenever accessed. Used by components with TimingTickResolution.Low and TimingTickResolution.High. */
	High = 2,
}

export interface WithTimingOptions {
	tickResolution: TimingTickResolution
	dataResolution: TimingDataResolution
	filter?: TimingFilterFunction | string | (string | number)[]
}
export type WithTiming<T> = T & RundownTiming.InjectedROTimingProps & { children?: React.ReactNode }
type IWrappedComponent<IProps, IState> =
	| (new (props: WithTiming<IProps>, state: IState) => React.Component<WithTiming<IProps>, IState>)
	| ((props: WithTiming<IProps>) => JSX.Element | null)

export interface IRundownTimingProviderValues {
	durations: RundownTimingContext
	syncedDurations: RundownTimingContext
}
export const RundownTimingProviderContext = React.createContext<IRundownTimingProviderValues>({
	durations: {
		isLowResolution: false,
	},
	syncedDurations: {
		isLowResolution: true,
	},
})

/**
 * Wrap a component in a HOC that will inject a the timing context as a prop. Takes an optional options object that
 * allows a high timing resolution or filtering of the changes in the context, so that the child component only
 * re-renders when a change to the filtered value happens.
 * The options object can also be replaced with an options generator function that will take the incoming props
 * as an argument and produce a {WithTimingOptions} object
 * @export
 * @template IProps The props interface of the child component
 * @template IState The state interface of the child component
 * @param  {(WithTimingOptions | ((props: IProps) => WithTimingOptions))} [options] The options object or the options object generator
 * @return (WrappedComponent: IWrappedComponent<IProps, IState>) =>
 * 		new (props: IProps, context: any ) => React.Component<IProps, IState>
 */
export function withTiming<IProps, IState>(
	options?: Partial<WithTimingOptions> | ((props: IProps) => Partial<WithTimingOptions>)
): (
	WrappedComponent: IWrappedComponent<IProps, IState>
) => React.ComponentType<Omit<IProps, keyof RundownTiming.InjectedROTimingProps>> {
	let expandedOptions: WithTimingOptions = {
		tickResolution: TimingTickResolution.Synced,
		dataResolution: TimingDataResolution.Synced,
		...(typeof options === 'function' ? {} : options),
	}

	return (WrappedComponent) => {
		return class WithTimingHOCComponent extends React.Component<IProps, IState> {
			static contextType = RundownTimingProviderContext
			declare context: React.ContextType<typeof RundownTimingProviderContext>

			filterGetter: ((o: any) => any) | undefined
			previousValue: any = undefined
			isDirty = false

			constructor(props: any, context: any) {
				super(props, context)

				this.configureOptions()
			}

			private configureOptions() {
				if (typeof options === 'function') {
					expandedOptions = {
						...expandedOptions,
						...options(this.props),
					}
				}

				if (typeof expandedOptions.filter === 'function') {
					this.filterGetter = expandedOptions.filter
				} else if (expandedOptions.filter) {
					this.filterGetter = _.property(expandedOptions.filter as string)
				}
			}

			componentDidMount(): void {
				window.addEventListener(
					rundownTimingEventFromTickResolution(expandedOptions.tickResolution),
					this.refreshComponent
				)
			}

			componentWillUnmount(): void {
				window.removeEventListener(
					rundownTimingEventFromTickResolution(expandedOptions.tickResolution),
					this.refreshComponent
				)
			}

			refreshComponent = () => {
				if (!this.filterGetter) {
					this.forceUpdate()
				} else {
					const buf = this.filterGetter(this.context.durations || {})
					if (this.isDirty || !_.isEqual(buf, this.previousValue)) {
						this.previousValue = buf
						this.isDirty = false
						this.forceUpdate()
					}
				}
			}

			render(): JSX.Element {
				const highResDurations: RundownTimingContext = this.context.durations
				const syncedDurations: RundownTimingContext = this.context.syncedDurations

				// If the timing HOC is supposed to be low resolution and we are rendering
				// during a high resolution tick, the WrappedComponent will render using
				// a RundownTimingContext that has not gone through the filter and thus
				// previousValue may go out of sync.
				// To bring it back to sync, we mark the component as dirty, which will
				// force an update on the next low resoluton tick, regardless of what
				// the filter says.
				if (componentIsDirty(this.filterGetter, highResDurations, expandedOptions.dataResolution)) {
					this.isDirty = true
				}

				return (
					<WrappedComponent
						{...this.props}
						timingDurations={rundownTimingDataFromDataResolution(
							expandedOptions.dataResolution,
							highResDurations,
							syncedDurations
						)}
					/>
				)
			}
		}
	}
}

function getFilterFunction(
	filter: TimingFilterFunction | string | (string | number)[] | undefined
): TimingFilterFunction | undefined {
	if (typeof filter === 'function') {
		return filter
	} else if (filter) {
		return _.property(filter as string)
	}
	return undefined
}

export function useTiming(
	tickResolution: TimingTickResolution = TimingTickResolution.Synced,
	dataResolution: TimingDataResolution = TimingDataResolution.Synced,
	filter?: TimingFilterFunction | string | (string | number)[]
): RundownTimingContext {
	const [_0, setForceUpdate] = useState(0)

	const context = useContext(RundownTimingProviderContext)

	const highResDurations: RundownTimingContext = context.durations
	const syncedDurations: RundownTimingContext = context.syncedDurations

	const isDirty = useRef(false)
	const previousValue = useRef<RundownTimingContext | null>(null)

	const filterGetter = useRef<TimingFilterFunction | undefined>()
	filterGetter.current = getFilterFunction(filter)

	const refreshComponent = useCallback(() => {
		if (!filterGetter.current) {
			setForceUpdate(Date.now())
		} else {
			const buf = filterGetter.current?.(context.durations || {})
			if (isDirty.current || !_.isEqual(buf, previousValue.current)) {
				previousValue.current = buf
				isDirty.current = false
				setForceUpdate(Date.now())
			}
		}
	}, [])

	useEffect(() => {
		window.addEventListener(rundownTimingEventFromTickResolution(tickResolution), refreshComponent)

		return () => {
			window.removeEventListener(rundownTimingEventFromTickResolution(tickResolution), refreshComponent)
		}
	}, [tickResolution, refreshComponent])

	if (componentIsDirty(filterGetter.current, highResDurations, dataResolution)) {
		isDirty.current = true
	}

	return rundownTimingDataFromDataResolution(dataResolution, highResDurations, syncedDurations)
}

function componentIsDirty(
	filterGetter: ((...args: any[]) => any) | undefined,
	highResDurations: RundownTimingContext,
	dataResolution: TimingDataResolution
) {
	return !!filterGetter && highResDurations.isLowResolution && dataResolution !== TimingDataResolution.Synced
}

/**
 * Finds the Rundown Timing Event that corresponds to a given TimingTickResolution
 */
function rundownTimingEventFromTickResolution(resolution: TimingTickResolution): RundownTiming.Events {
	switch (resolution) {
		case TimingTickResolution.High:
			return RundownTiming.Events.timeupdateHighResolution
		case TimingTickResolution.Low:
			return RundownTiming.Events.timeupdateLowResolution
		case TimingTickResolution.Synced:
			return RundownTiming.Events.timeupdateSynced
	}
}

/**
 * Returns the durations corresponding to a given TimingDataResolution
 */
function rundownTimingDataFromDataResolution(
	resolution: TimingDataResolution,
	highResDurations: RundownTimingContext,
	syncedDurations: RundownTimingContext
): RundownTimingContext {
	switch (resolution) {
		case TimingDataResolution.High:
			return highResDurations
		case TimingDataResolution.Synced:
			return syncedDurations
	}
}
