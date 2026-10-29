import React, { type PropsWithChildren } from 'react'
import { Meteor } from 'meteor/meteor'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { RundownTiming, type TimeEventArgs } from './RundownTiming.js'
import { getCurrentTime } from '../../../lib/systemTime.js'

const TIMING_DEFAULT_REFRESH_INTERVAL = 1000 / 60 // the interval for high-resolution events (timeupdateHR)
const LOW_RESOLUTION_TIMING_DECIMATOR = 15

// LOW_RESOLUTION_TIMING_DECIMATOR-th time of the high-resolution events

const CURRENT_TIME_GRANULARITY = 1000 / 60

/**
 * RundownTimingProvider properties.
 * @interface IRundownTimingProviderProps
 */
interface IRundownTimingProviderProps {
	/** Rundown Playlist that is to be used for generating the timing information. */
	playlist?: DBRundownPlaylist

	/** Interval for high-resolution timing events. If undefined, it will fall back
	 * onto TIMING_DEFAULT_REFRESH_INTERVAL.
	 */
	refreshInterval?: number
}

interface IRundownTimingProviderState {}

/**
 * Drives the timing clock for everything below it, and names the playlist that the published timing
 * state should be read from.
 *
 * It computes nothing: the timing values themselves come from the `playlistTimingState` publication,
 * and consumers evaluate the published TimerStates against these ticks. This is deliberate - the
 * same documents drive external clients, so anything the UI needed but the publication did not
 * provide would be a gap those clients could not fill.
 */
export class RundownTimingProvider extends React.Component<
	PropsWithChildren<IRundownTimingProviderProps>,
	IRundownTimingProviderState
> {
	private refreshTimer: number | undefined
	private refreshTimerInterval: number
	private refreshDecimator: number

	/** last time (ms rounded down to full seconds) for which the timeupdateSynced event was dispatched */
	private lastSyncedTime = 0

	constructor(props: PropsWithChildren<IRundownTimingProviderProps>) {
		super(props)

		this.refreshTimerInterval = props.refreshInterval || TIMING_DEFAULT_REFRESH_INTERVAL

		this.refreshDecimator = 0
	}

	private calmDownTiming = (time: number) => {
		return Math.round(time / CURRENT_TIME_GRANULARITY) * CURRENT_TIME_GRANULARITY
	}

	private onRefreshTimer = () => {
		const now = getCurrentTime()
		const calmedDownNow = this.calmDownTiming(now)
		this.dispatchHREvent(calmedDownNow)

		const dispatchLowResolution = this.refreshDecimator % LOW_RESOLUTION_TIMING_DECIMATOR === 0
		if (dispatchLowResolution) {
			this.dispatchLREvent(calmedDownNow)
		}

		const syncedEventTimeNow = Math.floor(now / 1000) * 1000
		const dispatchSynced = Math.abs(syncedEventTimeNow - this.lastSyncedTime) >= 1000
		if (dispatchSynced) {
			this.lastSyncedTime = syncedEventTimeNow
			this.dispatchSyncedEvent(syncedEventTimeNow)
		}

		this.refreshDecimator++
	}

	componentDidMount(): void {
		this.refreshTimer = Meteor.setInterval(this.onRefreshTimer, this.refreshTimerInterval)
		this.onRefreshTimer()
	}

	componentDidUpdate(prevProps: PropsWithChildren<IRundownTimingProviderProps>): void {
		// change refresh interval if needed
		if (this.refreshTimerInterval !== this.props.refreshInterval && this.refreshTimer) {
			this.refreshTimerInterval = this.props.refreshInterval || TIMING_DEFAULT_REFRESH_INTERVAL
			Meteor.clearInterval(this.refreshTimer)
			this.refreshTimer = Meteor.setInterval(this.onRefreshTimer, this.refreshTimerInterval)
		}
		// A take changes what every countdown is measured from, so push a tick out immediately rather
		// than letting the low-resolution consumers wait up to a quarter of a second for one
		if (
			prevProps.playlist?.nextPartInfo?.partInstanceId !== this.props.playlist?.nextPartInfo?.partInstanceId ||
			prevProps.playlist?.currentPartInfo?.partInstanceId !== this.props.playlist?.currentPartInfo?.partInstanceId
		) {
			this.refreshDecimator = 0 // Force LR update
			this.lastSyncedTime = 0 // Force synced update
			this.onRefreshTimer()
		}
	}

	componentWillUnmount(): void {
		if (this.refreshTimer !== undefined) Meteor.clearInterval(this.refreshTimer)
	}

	private dispatchHREvent(now: number) {
		const event = new CustomEvent<TimeEventArgs>(RundownTiming.Events.timeupdateHighResolution, {
			detail: {
				currentTime: now,
			},
			cancelable: false,
		})
		window.dispatchEvent(event)
	}

	private dispatchLREvent(now: number) {
		const event = new CustomEvent<TimeEventArgs>(RundownTiming.Events.timeupdateLowResolution, {
			detail: {
				currentTime: now,
			},
			cancelable: false,
		})
		window.dispatchEvent(event)
	}

	private dispatchSyncedEvent(now: number) {
		const event = new CustomEvent<TimeEventArgs>(RundownTiming.Events.timeupdateSynced, {
			detail: {
				currentTime: now,
			},
			cancelable: false,
		})
		window.dispatchEvent(event)
	}

	render(): React.ReactNode {
		return this.props.children
	}
}
