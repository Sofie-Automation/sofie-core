import _ from 'underscore'

export interface TimeSyncOptions {
	syncPeriod: number // time between syncs
	minSyncQuality: number // ms
	minTryCount: number
	maxTryCount: number
	retryWaitTime: number
	serverDelayTime: number
}
export interface TimeSyncOptionsOptional {
	syncPeriod?: number // time between syncs
	minSyncQuality?: number // ms
	minTryCount?: number
	maxTryCount?: number
	retryWaitTime?: number
	serverDelayTime?: number
}
interface SyncResult {
	diff: number
	quality: number | null
}

export class TimeSync {
	// public serverDelayTime: number 	= 0.0008 // the minimum time we think the server needs to process our request

	private _options: TimeSyncOptions

	private _invalidationCallback?: () => void
	private _timeSource: () => Promise<number>

	private _syncDiff: number // difference local time vs server time
	private _syncQuality: number | null // how good the synced time probably is (in ms)
	private _lastSyncTime: number // timestamp (in local time)
	private _timeInterval: NodeJS.Timeout | undefined = undefined
	constructor(
		options: TimeSyncOptionsOptional,
		timeSource: () => Promise<number>,
		invalidationCallback?: () => void
	) {
		this._timeSource = timeSource

		this._options = {
			syncPeriod: options.syncPeriod || 1000 * 60 * 10,
			minSyncQuality: options.minSyncQuality || 1000 / 50,
			minTryCount: options.minTryCount || 3,
			maxTryCount: options.maxTryCount || 10,
			retryWaitTime: options.retryWaitTime || 300,
			serverDelayTime: options.serverDelayTime || 0,
		}

		this._syncDiff = 0
		this._lastSyncTime = 0
		this._syncQuality = null
		this._invalidationCallback = invalidationCallback
	}
	public localTime(): number {
		return Date.now()
	}
	public currentTime(): number {
		return this.localTime() + this._syncDiff
	}
	get quality(): number | null {
		return this._syncQuality
	}
	get diff(): number {
		return this._syncDiff
	}
	public isGood(): boolean {
		return !!(this.quality && this.quality < this._options.minSyncQuality)
	}
	public async init(): Promise<boolean> {
		this._timeInterval = setInterval(() => {
			this.maybeTriggerSync()
		}, this._options.syncPeriod / 2)

		return this.syncTime()
	}
	public stop(): void {
		if (this._timeInterval) {
			clearInterval(this._timeInterval)
		}
	}
	public maybeTriggerSync(): void {
		if (this.localTime() - this._lastSyncTime > this._options.syncPeriod) {
			// It's time to do a sync
			// log.verbose('triggerSync ' + (this.localTime() - this._lastSyncTime))
			this._lastSyncTime = this.localTime()

			setTimeout(() => {
				this.syncTime().catch((err) => {
					console.log(err)
				})
			}, 1)
		}
	}
	private async syncTime(): Promise<boolean> {
		const syncResults: Array<SyncResult> = []
		let selectedSyncResult: SyncResult | null = null
		let haveGoodSyncResult = false

		const doSync = async (): Promise<SyncResult> => {
			const startTime: number = this.localTime() // Local time at the start of the query
			const serverTime = await this._timeSource() // Server time at some point during the query
			if (serverTime) {
				const endTime: number = this.localTime() // Local time at the end of the query
				const transportDuration: number = endTime - startTime
				const calcLocalTime: number = startTime + transportDuration / 2 + this._options.serverDelayTime // Our best guess of the point in time the server probably calculated serverTime
				const quality: number = transportDuration / 2 // The estimated quality of our estimate
				const diff: number = serverTime - calcLocalTime

				return {
					diff: diff,
					quality: quality,
				}
			}
			return {
				diff: 0,
				quality: null,
			}
		}

		for (let tryCount = 0; tryCount < this._options.maxTryCount; tryCount++) {
			const syncResult = await doSync()
			if (!_.isNull(syncResult.quality)) {
				syncResults.push(syncResult)
			}

			if (tryCount >= this._options.minTryCount) {
				// Evaluate our progress:

				// The best result is the one earliest in time, since the best quality is
				// caused by the lowest delay:
				let bestResult: any = _.min(syncResults, (r: SyncResult) => {
					return !_.isNull(r.quality) ? r.quality : 999999
				})
				if (!bestResult) bestResult = { diff: 0, quality: null }

				if (!_.isNull(bestResult.quality) && bestResult.quality < this._options.minSyncQuality) {
					// Our result is good enough
					selectedSyncResult = bestResult
					haveGoodSyncResult = true
					break
				}
			}
		}

		if (!selectedSyncResult) {
			// We don't have a good sync result.

			const bestResult: any = _.min(syncResults, (r: SyncResult) => {
				return !_.isNull(r.quality) ? r.quality : 999999
			})
			if (!_.isNull(bestResult.quality) && bestResult.quality < (this._syncQuality || 99990)) {
				// It's not a good result, but it's better than what we currently have
				selectedSyncResult = bestResult
			}
		}

		if (selectedSyncResult) {
			// we've got a sync result

			this._syncDiff = selectedSyncResult.diff
			this._syncQuality = selectedSyncResult.quality
			this._lastSyncTime = this.localTime()

			if (this._invalidationCallback) this._invalidationCallback()

			return haveGoodSyncResult
		} else {
			// we never got a result that was good enough
			return false
		}
	}
}
