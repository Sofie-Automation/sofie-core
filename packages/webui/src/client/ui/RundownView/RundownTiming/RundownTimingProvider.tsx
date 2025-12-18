import React, { PropsWithChildren } from 'react'
import { Meteor } from 'meteor/meteor'
import { withTracker } from '../../../lib/ReactMeteorData/react-meteor-data.js'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PartInstance, wrapPartToTemporaryInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { RundownTiming, TimeEventArgs } from './RundownTiming.js'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import {
	MinimalPartInstance,
	RundownTimingCalculator,
	RundownTimingContext,
	TimingId,
	findPartInstancesInQuickLoop,
} from '../../../lib/rundownTiming.js'
import { PartId, PartInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylistCollectionUtil } from '../../../collections/rundownPlaylistUtil.js'
import { sortPartInstancesInSortedSegments } from '@sofie-automation/corelib/dist/playout/playlist'
import { RundownUtils } from '../../../lib/rundown.js'
import { RundownPlaylistClientUtil } from '../../../lib/rundownPlaylistUtil.js'
import { getCurrentTime } from '../../../lib/systemTime.js'
import { IRundownTimingProviderValues, RundownTimingProviderContext } from './withTiming.js'

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
	/** Fallback duration for Parts that have no as-played duration of their own. */
	defaultDuration?: number
}

interface IRundownTimingProviderState {}
interface IRundownTimingProviderTrackedProps {
	rundowns: Array<Rundown>
	currentRundown: Rundown | undefined
	partInstances: Array<MinimalPartInstance>
	partInstancesMap: Map<PartId, MinimalPartInstance>
	segments: DBSegment[]
	segmentsMap: Map<SegmentId, DBSegment>
	partsInQuickLoop: Record<TimingId, boolean>
}

/**
 * RundownTimingProvider is a container component that provides a timing context to all child elements.
 * It allows calculating a single
 * @class RundownTimingProvider
 * @extends React.Component<PropsWithChildren<IRundownTimingProviderProps>>
 */
export const RundownTimingProvider = withTracker<
	PropsWithChildren<IRundownTimingProviderProps>,
	IRundownTimingProviderState,
	IRundownTimingProviderTrackedProps
>(({ playlist }) => {
	if (!playlist) {
		return {
			rundowns: [],
			currentRundown: undefined,
			partInstances: [],
			partInstancesMap: new Map(),
			segments: [],
			segmentsMap: new Map(),
			partsInQuickLoop: {},
		}
	}

	const partInstancesMap = new Map<PartId, MinimalPartInstance>()

	const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)
	const segments = RundownPlaylistClientUtil.getSegments(playlist)
	const segmentsMap = new Map<SegmentId, DBSegment>(segments.map((segment) => [segment._id, segment]))
	const unorderedParts = RundownPlaylistClientUtil.getUnorderedParts(playlist)
	const activePartInstances = RundownPlaylistClientUtil.getActivePartInstances(playlist, undefined, {
		projection: {
			_id: 1,
			rundownId: 1,
			segmentId: 1,
			isTemporary: 1,
			segmentPlayoutId: 1,
			takeCount: 1,
			part: 1,
			timings: 1,
			orphaned: 1,
		},
	}) as Array<
		Pick<
			PartInstance,
			| '_id'
			| 'rundownId'
			| 'segmentId'
			| 'isTemporary'
			| 'segmentPlayoutId'
			| 'takeCount'
			| 'part'
			| 'timings'
			| 'orphaned'
		>
	>

	const { currentPartInstance } = findCurrentAndPreviousPartInstance(
		activePartInstances,
		playlist.currentPartInfo?.partInstanceId,
		playlist.previousPartInfo?.partInstanceId
	)

	const currentRundown = currentPartInstance
		? rundowns.find((r) => r._id === currentPartInstance.rundownId)
		: rundowns[0]

	let partInstances: MinimalPartInstance[] = []

	const allPartIds: Set<PartId> = new Set()

	for (const partInstance of activePartInstances) {
		allPartIds.add(partInstance.part._id)
	}

	partInstances = activePartInstances

	for (const part of unorderedParts) {
		if (allPartIds.has(part._id)) continue
		partInstances.push(wrapPartToTemporaryInstance(playlist.activationId ?? protectString(''), part))
	}

	partInstances = sortPartInstancesInSortedSegments(partInstances, segments)

	partInstances = RundownUtils.deduplicatePartInstancesForQuickLoop(playlist, partInstances, currentPartInstance)

	const partsInQuickLoop = findPartInstancesInQuickLoop(playlist, partInstances)

	return {
		rundowns,
		currentRundown,
		partInstances,
		partInstancesMap,
		segments,
		segmentsMap,
		partsInQuickLoop,
	}
})(
	class RundownTimingProvider extends React.Component<
		PropsWithChildren<IRundownTimingProviderProps> & IRundownTimingProviderTrackedProps,
		IRundownTimingProviderState
	> {
		private durations: RundownTimingContext = {
			isLowResolution: false,
		}
		private syncedDurations: RundownTimingContext = {
			isLowResolution: true,
		}
		/**
		 * This context works in an unusual way.
		 * It contains a constant value which gets mutated in place, with the consumer expected to setup a timer to poll for changes.
		 */
		private childContextValue: IRundownTimingProviderValues = {
			durations: this.durations,
			syncedDurations: this.syncedDurations,
		}

		private refreshTimer: number | undefined
		private refreshTimerInterval: number
		private refreshDecimator: number

		private timingCalculator: RundownTimingCalculator = new RundownTimingCalculator()
		/** last time (ms rounded down to full seconds) for which the timeupdateSynced event was dispatched */
		private lastSyncedTime = 0

		constructor(props: IRundownTimingProviderProps & IRundownTimingProviderTrackedProps) {
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
			this.updateDurations(calmedDownNow, false)
			this.dispatchHREvent(calmedDownNow)

			const dispatchLowResolution = this.refreshDecimator % LOW_RESOLUTION_TIMING_DECIMATOR === 0
			if (dispatchLowResolution) {
				this.dispatchLREvent(calmedDownNow)
			}

			const syncedEventTimeNow = Math.floor(now / 1000) * 1000
			const dispatchSynced = Math.abs(syncedEventTimeNow - this.lastSyncedTime) >= 1000
			if (dispatchSynced) {
				this.lastSyncedTime = syncedEventTimeNow
				this.updateDurations(syncedEventTimeNow, true)
				this.dispatchSyncedEvent(syncedEventTimeNow)
			}

			this.refreshDecimator++
		}

		componentDidMount(): void {
			this.refreshTimer = Meteor.setInterval(this.onRefreshTimer, this.refreshTimerInterval)
			this.onRefreshTimer()
			;(window as any)['rundownTimingContext'] = this.durations
		}

		componentDidUpdate(prevProps: IRundownTimingProviderProps & IRundownTimingProviderTrackedProps) {
			// change refresh interval if needed
			if (this.refreshTimerInterval !== this.props.refreshInterval && this.refreshTimer) {
				this.refreshTimerInterval = this.props.refreshInterval || TIMING_DEFAULT_REFRESH_INTERVAL
				Meteor.clearInterval(this.refreshTimer)
				this.refreshTimer = Meteor.setInterval(this.onRefreshTimer, this.refreshTimerInterval)
			}
			if (
				prevProps.partInstances !== this.props.partInstances ||
				prevProps.playlist?.nextPartInfo?.partInstanceId !== this.props.playlist?.nextPartInfo?.partInstanceId ||
				prevProps.playlist?.currentPartInfo?.partInstanceId !== this.props.playlist?.currentPartInfo?.partInstanceId
			) {
				this.refreshDecimator = 0 // Force LR update
				this.lastSyncedTime = 0 // Force synced update
				this.onRefreshTimer()
			}
		}

		componentWillUnmount(): void {
			delete (window as any)['rundownTimingContext']
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

		private updateDurations(now: number, isSynced: boolean) {
			const { playlist, rundowns, currentRundown, partInstances, partInstancesMap, segmentsMap } = this.props

			const updatedDurations = this.timingCalculator.updateDurations(
				now,
				isSynced,
				playlist,
				rundowns,
				currentRundown,
				partInstances,
				partInstancesMap,
				segmentsMap,
				this.props.defaultDuration,
				this.props.partsInQuickLoop
			)
			if (!isSynced) {
				this.durations = Object.assign(this.durations, updatedDurations)
			} else {
				this.syncedDurations = Object.assign(this.syncedDurations, updatedDurations)
			}
		}

		render(): React.ReactNode {
			return (
				<RundownTimingProviderContext.Provider value={this.childContextValue}>
					{this.props.children}
				</RundownTimingProviderContext.Provider>
			)
		}
	}
)

function findCurrentAndPreviousPartInstance(
	activePartInstances: MinimalPartInstance[],
	currentPartInstanceId: PartInstanceId | undefined,
	previousPartInstanceId: PartInstanceId | undefined
) {
	let currentPartInstance: MinimalPartInstance | undefined
	let previousPartInstance: MinimalPartInstance | undefined
	// the activePartInstances are usually sorted ascending by takeCount, so it makes sense to start
	// at the end of the array, since that's where the latest PartInstances generally will be
	for (let i = activePartInstances.length - 1; i >= 0; i--) {
		const partInstance = activePartInstances[i]
		if (partInstance._id === currentPartInstanceId) currentPartInstance = partInstance
		if (partInstance._id === previousPartInstanceId) previousPartInstance = partInstance
		// we've found what we were looking for, we can stop
		if (
			(currentPartInstance || currentPartInstanceId === undefined) &&
			(previousPartInstance || previousPartInstanceId === undefined)
		)
			break
	}

	return {
		currentPartInstance,
		previousPartInstance,
	}
}
