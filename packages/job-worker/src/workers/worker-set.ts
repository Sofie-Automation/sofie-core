import { StudioId, WorkerId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ChangeStream, ChangeStreamDocument, Document, MongoClient } from 'mongodb'
import { LocksManager } from '../locks.js'
import { IngestWorkerParent } from './ingest/parent.js'
import { StudioWorkerParent } from './studio/parent.js'
import { EventsWorkerParent } from './events/parent.js'
import { JobManager } from '../manager.js'
import { FastTrackTimelineFunc, LogLineWithSourceFunc } from '../main.js'
import { WorkerParentBase, WorkerParentOptions } from './parent-base.js'
import { logger } from '../logging.js'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { InvalidateWorkerDataCache } from './caches.js'

export class StudioWorkerSet {
	readonly #threads: WorkerParentBase[]
	readonly #locksManager: LocksManager

	readonly #studioId: StudioId
	readonly #mongoClient: MongoClient
	readonly #streams: Array<ChangeStream<any>> = []

	constructor(studioId: StudioId, mongoClient: MongoClient) {
		this.#threads = []
		this.#locksManager = new LocksManager(async (threadId, lockId, locked) => {
			// Check each thread in turn, to find the one that should be informed
			for (const thread of this.#threads) {
				if (thread.threadId === threadId) {
					await thread.workerLockChange(lockId, locked)
					return true
				}
			}

			// Unhandled lock event
			return false
		})

		this.#studioId = studioId
		this.#mongoClient = mongoClient
	}

	public static async create(
		workerId: WorkerId,
		mongoUri: string,
		mongoClient: MongoClient,
		mongoDbName: string,
		studioId: StudioId,
		jobManager: JobManager,
		logLine: LogLineWithSourceFunc,
		fastTrackTimeline: FastTrackTimelineFunc | null,
		enableFreezeLimit: boolean
	): Promise<StudioWorkerSet> {
		const result = new StudioWorkerSet(studioId, mongoClient)

		let failed = 0
		const ps: Array<Promise<void>> = []

		const tryAddThread = (thread: Promise<WorkerParentBase>): void => {
			ps.push(
				thread.then(
					(th) => {
						result.#threads.push(th)
					},
					() => {
						failed++
					}
				)
			)
		}

		const baseOptions: WorkerParentOptions = {
			workerId,
			mongoClient,
			mongoDbName,
			locksManager: result.#locksManager,
			studioId,
			jobManager,
			enableFreezeLimit,
		}

		tryAddThread(StudioWorkerParent.start(baseOptions, mongoUri, logLine, fastTrackTimeline))

		tryAddThread(EventsWorkerParent.start(baseOptions, mongoUri, logLine, fastTrackTimeline))

		tryAddThread(IngestWorkerParent.start(baseOptions, mongoUri, logLine, fastTrackTimeline))

		logger.info(`Starting threads for ${studioId}`)
		await Promise.allSettled(ps)
		logger.info(`Started threads for ${studioId}`)

		if (failed > 0) {
			// terminate all the successful threads
			await result.terminate()
			throw new Error(`Failed to initialise ${failed} threads`)
		}

		result.subscribeToCommonCacheInvalidations(mongoDbName)

		return result
	}

	/**
	 * Subscribe to core changes in the db for cache invalidation.
	 * Can be extended if move collections are watched for a thread type
	 */
	private subscribeToCommonCacheInvalidations(dbName: string): void {
		const attachChangesStream = <T extends Document>(
			stream: ChangeStream<T>,
			name: string,
			fcn: (invalidations: InvalidateWorkerDataCache, change: ChangeStreamDocument<T>) => void
		): void => {
			this.#streams.push(stream)
			stream.on('change', (change) => {
				// we have a change to flag
				for (const thread of this.#threads) {
					thread.queueCacheInvalidation((invalidations) => fcn(invalidations, change))
				}
			})
			stream.on('end', () => {
				logger.warn(`Changes stream for ${name} ended`)
				this.terminate().catch((e) => {
					logger.error(`Terminate of threads failed: ${stringifyError(e)}`)
				})
			})
		}

		const database = this.#mongoClient.db(dbName)
		attachChangesStream<DBStudio>(
			database.collection(CollectionName.Studios).watch([{ $match: { [`documentKey._id`]: this.#studioId } }], {
				batchSize: 1,
			}),
			`Studio "${this.#studioId}"`,
			(invalidations) => {
				invalidations.studio = true
			}
		)
		attachChangesStream<Blueprint>(
			// Detect changes to other docs, the invalidate will filter out irrelevant values
			database.collection(CollectionName.Blueprints).watch(
				[
					// Future: this should be scoped down when we have multiple studios in an installation
				],
				{
					batchSize: 1,
				}
			),
			`Blueprints`,
			(invalidations, change) => {
				if ('documentKey' in change) {
					invalidations.blueprints.push(change.documentKey._id)
				}
			}
		)
		attachChangesStream<DBShowStyleBase>(
			// Detect changes to other docs, the invalidate will filter out irrelevant values
			database.collection(CollectionName.ShowStyleBases).watch(
				[
					// Future: this should be scoped down when we have multiple studios in an installation
				],
				{
					batchSize: 1,
				}
			),
			`ShowStyleBases`,
			(invalidations, change) => {
				if ('documentKey' in change) {
					invalidations.showStyleBases.push(change.documentKey._id)
				}
			}
		)
		attachChangesStream<DBShowStyleVariant>(
			// Detect changes to other docs, the invalidate will filter out irrelevant values
			database.collection(CollectionName.ShowStyleVariants).watch(
				[
					// Future: this should be scoped down when we have multiple studios in an installation
				],
				{
					batchSize: 1,
				}
			),
			`ShowStyleVariants"`,
			(invalidations, change) => {
				if ('documentKey' in change) {
					invalidations.showStyleVariants.push(change.documentKey._id)
				}
			}
		)
	}

	public collectMetrics(): Promise<string>[] {
		return this.#threads.map(async (t) => t.collectMetrics())
	}

	public async terminate(): Promise<void> {
		await Promise.allSettled(this.#threads.map(async (t) => t.terminate()))

		await Promise.allSettled(this.#streams.map(async (s) => s.close()))
	}
}
