const { MongoMemoryReplSet } = require('mongodb-memory-server')

/**
 * Jest globalSetup for the `integration` project: boot ONE in-memory MongoDB replica set, shared by every
 * `*.integration.test.ts` file in the run. A replica set (not a standalone) is required because the
 * change-stream observe engine relies on change streams.
 *
 * The instance handle is stashed on `globalThis` so {@link file://./integration-global-teardown.js} can stop
 * it, and the connection string is published via `process.env.MONGO_URL`. Env vars set here are inherited by
 * the forked jest workers, so both the test files' own `MongoClient`s and the production `getMongoDb()`
 * (see `server/collections/mongoConnection.ts`) resolve to this same instance.
 */
module.exports = async () => {
	process.env.TZ = 'UTC'

	// eslint-disable-next-line n/file-extension-in-import -- Node's dynamic import() of a local ESM file needs the explicit extension
	const { DEV_MONGO_VERSION } = await import('../scripts/dev-mongo.mjs')
	const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: DEV_MONGO_VERSION } })
	globalThis.__MONGO_REPLSET__ = replSet

	// `parseMongoConnectionString` wants the database name in the URL path.
	process.env.MONGO_URL = replSet.getUri('meteor-integration-test')
}
