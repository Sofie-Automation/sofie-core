/**
 * Wrapper-veneer parity (Part 2): assert the test mock wrapper ({@link WrappedMockCollection}) and the
 * production driver wrapper ({@link WrappedAsyncMongoCollection}) behave identically at the public
 * `AsyncOnlyMongoCollection` boundary.
 *
 * This deliberately does NOT re-run the query/update/bulkWrite semantics matrix (that is covered by the
 * Part 1 conformance suite against `InMemoryMongoCollection`). It only exercises what lives in the wrapper
 * layer above both backends: option translation, selector normalization, update `multi` routing, replace
 * upsert semantics, return-value shapes and reject-on-error behaviour.
 */
import { MongoClient } from 'mongodb'
import { randomBytes } from 'crypto'
import { createMockCollection } from '../../../collections/implementations/mock'
import { WrappedAsyncMongoCollection } from '../../../collections/implementations/asyncCollection'
import { AsyncOnlyMongoCollection } from '../../../collections/collection'
import { getMongoClient } from '../../../collections/mongoConnection'
import { connectSharedMongoClient } from '../_integrationDb'
import { waitFor } from '../_observeHelpers'

interface Doc {
	_id: string
	[key: string]: unknown
}

const uniqueName = () => `wrap_${randomBytes(6).toString('hex')}`

type Col = AsyncOnlyMongoCollection<any>

function makePair(): { mock: Col; real: Col } {
	const mock = createMockCollection<any>(uniqueName())
	;(mock as any).asyncBulkWriteDelay = 0 // keep the suite fast; the delay only exists to surface races
	const real = new WrappedAsyncMongoCollection<any>(uniqueName())
	return { mock, real }
}

async function seedBoth(pair: { mock: Col; real: Col }, docs: Doc[]): Promise<void> {
	await pair.mock.insertManyAsync(docs as any)
	await pair.real.insertManyAsync(docs as any)
}

// Sort by _id (the two backends can emit object keys in different orders, so a JSON-string sort would be
// unstable; toEqual itself ignores key order).
const sortDocs = (docs: any[]) => [...docs].sort((a, b) => String(a._id).localeCompare(String(b._id)))

async function expectSameState(pair: { mock: Col; real: Col }): Promise<void> {
	const a = sortDocs(await pair.mock.findFetchAsync({}))
	const b = sortDocs(await pair.real.findFetchAsync({}))
	expect(a).toEqual(b)
}

describe('wrapper parity: mock vs real driver', () => {
	let client: MongoClient
	beforeAll(async () => {
		client = await connectSharedMongoClient()
	}, 120000)
	afterAll(async () => {
		await client?.close()
		// The real wrapper opens a module-level client via getMongoClient(); close it so jest can exit cleanly.
		await getMongoClient().close()
	})

	const nested: Doc[] = [
		{ _id: 'a', name: 'foo', val: 1, meta: { x: 1 } },
		{ _id: 'b', name: 'bar', val: 2, meta: { x: 2 } },
	]

	describe('option translation', () => {
		test('`fields` (deprecated) is translated to `projection`', async () => {
			const pair = makePair()
			await seedBoth(pair, nested)
			const mock = await pair.mock.findFetchAsync({}, { fields: { name: 1 } } as any)
			const real = await pair.real.findFetchAsync({}, { fields: { name: 1 } } as any)
			expect(sortDocs(mock)).toEqual(sortDocs(real))
		})

		test('sort / skip / limit reach the driver', async () => {
			const pair = makePair()
			await seedBoth(pair, [
				{ _id: 'a', n: 3 },
				{ _id: 'b', n: 1 },
				{ _id: 'c', n: 2 },
			])
			const opts = { sort: { n: 1 }, skip: 1, limit: 1 }
			const mock = await pair.mock.findFetchAsync({}, opts as any)
			const real = await pair.real.findFetchAsync({}, opts as any)
			expect(mock).toEqual(real) // order matters here, so compare positionally
			expect(mock).toHaveLength(1)
		})

		test('findOneAsync honours projection', async () => {
			const pair = makePair()
			await seedBoth(pair, nested)
			const mock = await pair.mock.findOneAsync('a', { projection: { name: 1, _id: 0 } } as any)
			const real = await pair.real.findOneAsync('a', { projection: { name: 1, _id: 0 } } as any)
			expect(mock).toEqual(real)
			expect(mock).toEqual({ name: 'foo' })
		})
	})

	describe('selector normalization', () => {
		test('a string selector is treated as an _id lookup', async () => {
			const pair = makePair()
			await seedBoth(pair, nested)
			const mock = await pair.mock.findOneAsync('b')
			const real = await pair.real.findOneAsync('b')
			expect(mock).toEqual(real)
			expect((mock as Doc)?._id).toBe('b')
		})

		test('an undefined selector matches everything', async () => {
			const pair = makePair()
			await seedBoth(pair, nested)
			expect(await pair.mock.findFetchAsync(undefined as any)).toHaveLength(2)
			expect(await pair.real.findFetchAsync(undefined as any)).toHaveLength(2)
		})
	})

	describe('updateAsync', () => {
		test('multi: true updates all matches and returns matchedCount', async () => {
			const pair = makePair()
			const seed: Doc[] = [
				{ _id: 'a', g: 1 },
				{ _id: 'b', g: 1 },
				{ _id: 'c', g: 2 },
			]
			await seedBoth(pair, seed)
			const mockN = await pair.mock.updateAsync({ g: 1 }, { $set: { tag: 'y' } }, { multi: true })
			const realN = await pair.real.updateAsync({ g: 1 }, { $set: { tag: 'y' } }, { multi: true })
			expect(mockN).toBe(2)
			expect(realN).toBe(2)
			await expectSameState(pair)
		})

		test('multi: false (updateOne) routing returns matchedCount and touches only the match', async () => {
			// Selector matches exactly one doc: which doc updateOne picks among MANY matches is not deterministic
			// in real mongo, so that "stops at one of many" behaviour is asserted in corelib's unit spec instead.
			const pair = makePair()
			const seed: Doc[] = [
				{ _id: 'a', g: 1 },
				{ _id: 'b', g: 2 },
			]
			await seedBoth(pair, seed)
			const mockN = await pair.mock.updateAsync({ g: 1 }, { $set: { tag: 'y' } })
			const realN = await pair.real.updateAsync({ g: 1 }, { $set: { tag: 'y' } })
			expect(mockN).toBe(1)
			expect(realN).toBe(1)
			await expectSameState(pair)
		})
	})

	describe('replaceAsync (upsert semantics)', () => {
		test('replacing an existing doc returns true', async () => {
			const pair = makePair()
			await seedBoth(pair, [{ _id: 'a', name: 'old' }])
			expect(await pair.mock.replaceAsync({ _id: 'a', name: 'new' } as any)).toBe(true)
			expect(await pair.real.replaceAsync({ _id: 'a', name: 'new' } as any)).toBe(true)
			await expectSameState(pair)
		})

		test('replacing an absent doc inserts it and returns false', async () => {
			const pair = makePair()
			expect(await pair.mock.replaceAsync({ _id: 'z', name: 'new' } as any)).toBe(false)
			expect(await pair.real.replaceAsync({ _id: 'z', name: 'new' } as any)).toBe(false)
			await expectSameState(pair)
		})
	})

	describe('removeAsync / countDocuments', () => {
		test('removeAsync returns the deleted count', async () => {
			const pair = makePair()
			await seedBoth(pair, [
				{ _id: 'a', g: 1 },
				{ _id: 'b', g: 1 },
				{ _id: 'c', g: 2 },
			])
			expect(await pair.mock.removeAsync({ g: 1 })).toBe(2)
			expect(await pair.real.removeAsync({ g: 1 })).toBe(2)
			await expectSameState(pair)
		})

		test('countDocuments agrees', async () => {
			const pair = makePair()
			await seedBoth(pair, nested)
			expect(await pair.mock.countDocuments({ val: { $gte: 2 } })).toBe(1)
			expect(await pair.real.countDocuments({ val: { $gte: 2 } })).toBe(1)
		})
	})

	describe('findWithCursor', () => {
		// The cursor returned by findWithCursor only exposes observe(Changes)Async (it feeds publications).
		test('observeChangesAsync delivers the same initial window (sort+limit) on both wrappers', async () => {
			const pair = makePair()
			await seedBoth(pair, [
				{ _id: 'a', n: 3 },
				{ _id: 'b', n: 1 },
				{ _id: 'c', n: 2 },
				{ _id: 'd', n: 4 },
			])

			const collectWindow = async (col: Col): Promise<string[]> => {
				const added: string[] = []
				const cursor = await col.findWithCursor({}, { sort: { n: 1 }, limit: 2 })
				const handle = await cursor.observeChangesAsync({
					added: (docId) => {
						added.push(String(docId))
					},
				})
				await waitFor(() => added.length >= 2) // throws if the window never fills
				await new Promise((r) => setTimeout(r, 30)) // let any (erroneous) extra events surface
				handle.stop()
				return added.sort()
			}

			const realWindow = await collectWindow(pair.real)
			const mockWindow = await collectWindow(pair.mock)
			// The `limit: 2` window (ordered by n asc) publishes only the two lowest-n docs: b (1), c (2).
			expect(realWindow).toEqual(['b', 'c'])
			expect(mockWindow).toEqual(realWindow)
		})
	})

	describe('bulkWriteAsync', () => {
		test('a mixed batch produces the same state on both wrappers (smoke)', async () => {
			const pair = makePair()
			await seedBoth(pair, [
				{ _id: 'keep', rank: 0 },
				{ _id: 'upd', rank: 1 },
			])
			const ops = [
				{ insertOne: { document: { _id: 'ins', n: 1 } } },
				{ updateOne: { filter: { _id: 'upd' }, update: { $set: { rank: 9 } } } },
			]
			await pair.mock.bulkWriteAsync(ops as any)
			await pair.real.bulkWriteAsync(ops as any)
			expect(await pair.mock.countDocuments({})).toBe(await pair.real.countDocuments({}))
			await expectSameState(pair)
		})
	})

	describe('error handling', () => {
		test('inserting a duplicate _id rejects on both wrappers', async () => {
			const pair = makePair()
			await seedBoth(pair, [{ _id: 'a' }])

			const didThrow = async (op: Promise<unknown>): Promise<boolean> => {
				try {
					await op
					return false
				} catch {
					return true
				}
			}
			// Both must reject; the error shape differs by design (mock throws a raw Error, the real wrapper a
			// Meteor.Error from wrapMongoError), so we assert on "rejected", not on the message.
			expect(await didThrow(pair.mock.insertAsync({ _id: 'a' } as any))).toBe(true)
			expect(await didThrow(pair.real.insertAsync({ _id: 'a' } as any))).toBe(true)
		})
	})
})
