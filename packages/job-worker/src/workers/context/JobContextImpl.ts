import { IDirectCollections } from '../../db/index.js'
import { JobContext, JobStudio } from '../../jobs/index.js'
import { WorkerDataCache } from '../caches.js'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getIngestQueueName, IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { ApmSpan, ApmTransaction } from '../../profiler.js'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { getStudioQueueName, StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'
import { LockBase, PlaylistLock, RundownLock } from '../../jobs/lock.js'
import { logger } from '../../logging.js'
import { BaseModel } from '../../modelBase.js'
import { LocksManager } from '../locks.js'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { EventsJobFunc, getEventsQueueName } from '@sofie-automation/corelib/dist/worker/events'
import { FastTrackTimelineFunc } from '../../main.js'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import type { QueueJobFunc } from './util.js'
import { StudioCacheContextImpl } from './StudioCacheContextImpl.js'
import { PlaylistLockImpl, RundownLockImpl } from './Locks.js'
import { StudioRouteSetUpdater } from './StudioRouteSetUpdater.js'
import type { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import type { ReadonlyDeep } from 'type-fest'

export class JobContextImpl extends StudioCacheContextImpl implements JobContext {
	private readonly locks: Array<LockBase> = []
	private readonly caches: Array<BaseModel> = []

	private readonly studioRouteSetUpdater: StudioRouteSetUpdater

	constructor(
		directCollections: Readonly<IDirectCollections>,
		cacheData: WorkerDataCache,
		private readonly locksManager: LocksManager,
		private readonly transaction: ApmTransaction | undefined,
		private readonly queueJob: QueueJobFunc,
		private readonly fastTrackTimeline: FastTrackTimelineFunc | null
	) {
		super(directCollections, cacheData)

		this.studioRouteSetUpdater = new StudioRouteSetUpdater(directCollections, cacheData)
	}

	get studio(): ReadonlyDeep<JobStudio> {
		return this.studioRouteSetUpdater.jobStudioWithChanges ?? super.studio
	}

	get rawStudio(): ReadonlyDeep<DBStudio> {
		return this.studioRouteSetUpdater.rawStudioWithChanges ?? super.rawStudio
	}

	trackCache(cache: BaseModel): void {
		this.caches.push(cache)
	}

	async lockPlaylist(playlistId: RundownPlaylistId): Promise<PlaylistLock> {
		const span = this.startSpan('lockPlaylist')
		if (span) span.setLabel('playlistId', unprotectString(playlistId))

		const lockId = getRandomString()
		logger.silly(`PlaylistLock: Locking "${playlistId}"`)

		const resourceId = `playlist:${playlistId}`
		await this.locksManager.aquire(lockId, resourceId)

		const doRelease = async () => {
			const span = this.startSpan('unlockPlaylist')
			if (span) span.setLabel('playlistId', unprotectString(playlistId))

			await this.locksManager.release(lockId, resourceId)

			if (span) span.end()
		}
		const lock = new PlaylistLockImpl(playlistId, doRelease)
		this.locks.push(lock)

		logger.silly(`PlaylistLock: Locked "${playlistId}"`)

		if (span) span.end()

		return lock
	}

	async lockRundown(rundownId: RundownId): Promise<RundownLock> {
		const span = this.startSpan('lockRundown')
		if (span) span.setLabel('rundownId', unprotectString(rundownId))

		const lockId = getRandomString()
		logger.silly(`RundownLock: Locking "${rundownId}"`)

		const resourceId = `rundown:${rundownId}`
		await this.locksManager.aquire(lockId, resourceId)

		const doRelease = async () => {
			const span = this.startSpan('unlockRundown')
			if (span) span.setLabel('rundownId', unprotectString(rundownId))

			await this.locksManager.release(lockId, resourceId)

			if (span) span.end()
		}
		const lock = new RundownLockImpl(rundownId, doRelease)
		this.locks.push(lock)

		logger.silly(`RundownLock: Locked "${rundownId}"`)

		if (span) span.end()

		return lock
	}

	/** Ensure resources are cleaned up after the job completes */
	async cleanupResources(): Promise<void> {
		// Ensure all locks are freed
		for (const lock of this.locks) {
			if (lock.isLocked) {
				logger.warn(`Lock never freed: ${lock}`)
				await lock.release().catch((e) => {
					logger.error(`Lock free failed: ${stringifyError(e)}`)
				})
			}
		}

		// Ensure all caches were saved/aborted
		for (const cache of this.caches) {
			try {
				cache.assertNoChanges()
			} catch (e) {
				logger.warn(`${cache.displayName} has unsaved changes: ${stringifyError(e)}`)
			}
		}
	}

	startSpan(spanName: string): ApmSpan | null {
		if (this.transaction) return this.transaction.startSpan(spanName)
		return null
	}

	async queueIngestJob<T extends keyof IngestJobFunc>(name: T, data: Parameters<IngestJobFunc[T]>[0]): Promise<void> {
		await this.queueJob(getIngestQueueName(this.studioId), name, data)
	}
	async queueStudioJob<T extends keyof StudioJobFunc>(name: T, data: Parameters<StudioJobFunc[T]>[0]): Promise<void> {
		await this.queueJob(getStudioQueueName(this.studioId), name, data)
	}
	async queueEventJob<T extends keyof EventsJobFunc>(name: T, data: Parameters<EventsJobFunc[T]>[0]): Promise<void> {
		await this.queueJob(getEventsQueueName(this.studioId), name, data)
	}

	hackPublishTimelineToFastTrack(newTimeline: TimelineComplete): void {
		if (this.fastTrackTimeline) {
			this.fastTrackTimeline(newTimeline).catch((e) => {
				logger.error(`Failed to publish timeline to fast track: ${stringifyError(e)}`)
			})
		}
	}

	setRouteSetActive(routeSetId: string, isActive: boolean | 'toggle'): boolean {
		return this.studioRouteSetUpdater.setRouteSetActive(routeSetId, isActive)
	}

	async saveRouteSetChanges(): Promise<void> {
		return this.studioRouteSetUpdater.saveRouteSetChanges()
	}

	discardRouteSetChanges(): void {
		return this.studioRouteSetUpdater.discardRouteSetChanges()
	}
}
