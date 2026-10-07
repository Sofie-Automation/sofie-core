/**
 * Shared helpers for the `integration` jest project: connect to the single MongoDB replica set booted once
 * by `__mocks__/integration-global-setup.js` (published via `process.env.MONGO_URL`), and hand out a fresh,
 * uniquely-named collection per test so files don't need to reboot mongo or clean up after each other.
 */
import { MongoClient, Collection, Document } from 'mongodb'
import { randomBytes } from 'crypto'

/** Open a client against the shared replica set. Each test file should do this once in `beforeAll`. */
export async function connectSharedMongoClient(): Promise<MongoClient> {
	const url = process.env.MONGO_URL
	if (!url) {
		throw new Error('MONGO_URL is not set - the integration globalSetup (shared replset) did not run')
	}
	// Match the production driver options (see server/collections/mongoConnection.ts).
	const client = new MongoClient(url, { ignoreUndefined: true })
	await client.connect()
	return client
}

let collectionCounter = 0

/**
 * Create a fresh, uniquely-named collection (optionally seeded), for test isolation without rebooting mongo.
 * The name carries a random token so it is unique across all test files/workers sharing the one replset
 * (jest reuses worker processes, so a per-module counter alone would collide between files).
 */
export async function freshCollection<TDoc extends Document>(
	client: MongoClient,
	seed: TDoc[] = []
): Promise<Collection<TDoc>> {
	const name = `itest_${randomBytes(6).toString('hex')}_${collectionCounter++}`
	const collection = client.db().collection<TDoc>(name)
	if (seed.length) await collection.insertMany(seed as any[])
	return collection
}
