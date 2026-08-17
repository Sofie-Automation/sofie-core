import { MongoClient, Db } from 'mongodb'
import { Meteor } from 'meteor/meteor'
import { logger } from '../logging'

/**
 * Our own connection to MongoDB, using the native `mongodb` driver (rather than the one bundled with Meteor).
 *
 * Note: `MongoClient`/`Db`/`Collection` handles are created lazily and do not require an active connection.
 * Operations auto-connect on first use, so `getMongoDb().collection(name).collectionName` is safe to call
 * during module-load (e.g. from `registerIndex`), before {@link connectMongo} has run.
 */

let client: MongoClient | undefined
let db: Db | undefined

/**
 * Read and validate the MongoDB connection configuration from the environment, and split it into the
 * parts the native `mongodb` driver needs: the connection `uri` (with the database name removed from the
 * path) and the `dbName` (which the driver wants passed separately to `client.db()`).
 */
export function parseMongoConnectionString(): { uri: string; dbName: string } {
	if (!process.env.MONGO_URL) throw new Error('MONGO_URL must be defined to launch Sofie')

	// Meteor wants the dbname as the path of the mongo url, but the mongodb driver needs it separate
	const rawUrl = new URL(process.env.MONGO_URL)
	const dbName = rawUrl.pathname.substring(1) // Trim off first '/'
	if (!dbName) throw new Error('MONGO_URL must include a database name')
	rawUrl.pathname = ''

	return { uri: rawUrl.toString(), dbName }
}

/**
 * Whether we are running without a real MongoDB connection (unit tests). In this mode collections are
 * backed by the in-memory mock instead of the native driver / change-stream engine.
 */
export function isInMockMode(): boolean {
	return !!(Meteor.isTest || process.env.JEST_WORKER_ID)
}

export function getMongoClient(): MongoClient {
	if (!client) {
		const { uri } = parseMongoConnectionString()
		client = new MongoClient(uri, {
			ignoreUndefined: true,
		})
	}
	return client
}

export function getMongoDb(): Db {
	if (!db) {
		const { dbName } = parseMongoConnectionString()
		db = getMongoClient().db(dbName)
	}
	return db
}

/**
 * Establish the connection to MongoDB.
 * Called at startup so we fail fast if the database is unreachable, rather than on first query.
 */
export async function connectMongo(): Promise<void> {
	await getMongoClient().connect()
	logger.info('Connected to MongoDB using the native driver')
}

Meteor.startup(async () => {
	// Don't connect in tests
	if (isInMockMode()) return

	await connectMongo()
})
