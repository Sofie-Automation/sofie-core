import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { DEV_MONGO_VERSION } from '../../scripts/dev-mongo'

/**
 * vitest globalSetup for the `sofie-core-integration` project: boot ONE in-memory MongoDB replica set, shared by every
 * `*.integration.test.ts` file in the run. A replica set (not a standalone) is required because the
 * change-stream observe engine relies on change streams.
 *
 * The connection string is published via `process.env.MONGO_URL`. Env vars set here are inherited by the forked
 * test workers, so both the test files' own `MongoClient`s and the production `getMongoDb()`
 * (see `src/collections/mongoConnection.ts`) resolve to this same instance. The returned teardown stops it.
 */
export default async function setup() {
	process.env.TZ = 'UTC'

	const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: DEV_MONGO_VERSION } })

	// `parseMongoConnectionString` wants the database name in the URL path.
	process.env.MONGO_URL = replSet.getUri('meteor-integration-test')

	return async () => {
		await replSet.stop()
	}
}
