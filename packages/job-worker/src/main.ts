import { LeveledLogMethodFixed, LogEntry, logger } from './logging.js'
import { protectStringArray } from '@sofie-automation/corelib/dist/protectedString'
import { StudioId, WorkerId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { setupApmAgent } from './profiler.js'
import { createMongoConnection } from './db/index.js'
import { StudioWorkerSet } from './workers/worker-set.js'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { Db as MongoDb, MongoClient } from 'mongodb'
import { JobManager } from './manager.js'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { setupInfluxDb } from './influx.js'

setupApmAgent()
setupInfluxDb()

/** Specification for a Job, to be executed by a Workerthread */
export interface JobSpec {
	/** Unique identifier for the job */
	id: string
	/** Name of the function to be executed */
	name: string
	/** Parameter to the function to be executed */
	data: unknown
}

export type FastTrackTimelineFunc = (newTimeline: TimelineComplete) => Promise<void>
export type LogLineWithSourceFunc = (msg: LogEntry) => Promise<void>

async function defaultThreadLogger(msg: LogEntry) {
	const fcn = ((logger as any)[msg.level] as LeveledLogMethodFixed) || logger.info
	fcn(`${msg.source}: ${msg.message}`)
}

export abstract class JobWorkerBase {
	readonly #workerId: WorkerId
	readonly #workers = new Map<StudioId, StudioWorkerSet>()

	readonly #logLine: LogLineWithSourceFunc
	readonly #fastTrackTimeline: FastTrackTimelineFunc | null
	readonly #enableFreezeLimit: boolean

	#client: MongoClient | undefined

	#jobManager: JobManager

	constructor(
		workerId: WorkerId,
		jobManager: JobManager,
		logLine: LogLineWithSourceFunc | null,
		fastTrackTimeline: FastTrackTimelineFunc | null,
		enableFreezeLimit: boolean
	) {
		this.#workerId = workerId
		this.#jobManager = jobManager

		this.#logLine = logLine || defaultThreadLogger

		this.#fastTrackTimeline = fastTrackTimeline
		if (!this.#fastTrackTimeline) {
			logger.info(`Fast-track of timeline updates disabled`)
		}

		this.#enableFreezeLimit = enableFreezeLimit
	}

	public async run(mongoUri: string, mongoDbName: string): Promise<void> {
		if (this.#client) throw new Error('Already running')

		logger.info('Starting')

		this.#client = await createMongoConnection(mongoUri)

		this.#client.on('close', () => {
			logger.debug('Mongo connection closed. Forcing exit')
			// Note: This is terribele error handling, but it does the job.
			// If we start handling this more gracefully, then we will need to make sure to avoid/kill jobs being processed and flush all caches upon reconnection
			// eslint-disable-next-line n/no-process-exit
			process.exit(0)
		})

		const db = this.#client.db(mongoDbName)
		// Find the current studios
		const studioIds = await getStudioIdsToRun(db)
		for (const studioId of studioIds) {
			// Start up each studio, one at a time
			this.#workers.set(
				studioId,
				await StudioWorkerSet.create(
					this.#workerId,
					mongoUri,
					this.#client,
					mongoDbName,
					studioId,
					this.#jobManager,
					this.#logLine,
					this.#fastTrackTimeline,
					this.#enableFreezeLimit
				)
			)
		}
	}

	public async stop(): Promise<void> {
		// Terminate everything
		await Promise.allSettled(Array.from(this.#workers.values()).map(async (w) => w.terminate()))
		this.#workers.clear()

		if (this.#client) {
			// Ensures that the client will close when you finish/error
			await this.#client.close()
		}
	}

	public collectWorkerSetMetrics(): Promise<string>[] {
		const metrics: Promise<string>[] = []

		for (const workerSet of this.#workers.values()) {
			metrics.push(...workerSet.collectMetrics())
		}

		return metrics
	}
}

/** Get the ids of the studios to run for */
async function getStudioIdsToRun(db: MongoDb): Promise<Array<StudioId>> {
	if (process.env.STUDIO_IDS) {
		// either run for a dedicated list of studios
		const ids = protectStringArray(process.env.STUDIO_IDS.split(','))
		logger.info(`Running for specified studios: ${JSON.stringify(ids)}`)
		return ids
	} else {
		// Or find the current studios, and run for everything
		const studios: Pick<DBStudio, '_id'>[] = await db
			.collection<DBStudio>(CollectionName.Studios)
			.find({}, { projection: { _id: 1 } })
			.toArray()

		// Watch for creation/deletion of studios
		db.collection(CollectionName.Studios)
			.watch([], {
				batchSize: 1,
			})
			.on('change', (change) => {
				if (change.operationType === 'update' || change.operationType === 'replace') {
					// These are not important
					return
				} else {
					// Something about the list of studios that exist has changed, lets restart
					// The easiest thing to do is to restart the process. This will happen so rarely, its probably not worth trying to improve on

					// eslint-disable-next-line n/no-process-exit
					process.exit(1)
				}
			})
			.on('end', () => {
				logger.warn(`Changes stream for Studios ended`)
				// Note: This is terribele error handling, but it does the job.
				// eslint-disable-next-line n/no-process-exit
				process.exit(1)
			})

		const ids = studios.map((s) => s._id)
		logger.warn(`Running for all studios: ${JSON.stringify(ids)}. Make sure there is only one worker running!`)
		return ids
	}
}
