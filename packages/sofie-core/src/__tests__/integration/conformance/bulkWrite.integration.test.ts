/**
 * Conformance: the in-memory collection's hand-rolled `bulkWrite` arms vs real MongoDB `bulkWrite`
 * (`ordered: true`, matching the in-memory sequential semantics). This is the highest-risk write path.
 */
import { MongoClient } from 'mongodb'
import { connectSharedMongoClient } from '../_integrationDb'
import { ConformanceCase, runConformanceTable, SeedDoc } from './_harness'

const seed = (): SeedDoc[] => [
	{ _id: 'keep', rank: 0 },
	{ _id: 'del1', group: 'g' },
	{ _id: 'upd', rank: 1 },
	{ _id: 'repl', name: 'old', rank: 1 },
]

const cases: ConformanceCase[] = [
	{ kind: 'bulk', name: 'insertOne', seed: seed(), ops: [{ insertOne: { document: { _id: 'ins', n: 1 } } }] as any },
	{
		kind: 'bulk',
		name: 'updateOne',
		seed: seed(),
		ops: [{ updateOne: { filter: { _id: 'upd' }, update: { $set: { rank: 10 } } } }] as any,
	},
	{
		kind: 'bulk',
		name: 'updateMany',
		seed: seed(),
		ops: [{ updateMany: { filter: { rank: 1 }, update: { $set: { tag: 'one' } } } }] as any,
	},
	{ kind: 'bulk', name: 'deleteOne', seed: seed(), ops: [{ deleteOne: { filter: { _id: 'del1' } } }] as any },
	{ kind: 'bulk', name: 'deleteMany', seed: seed(), ops: [{ deleteMany: { filter: { rank: 1 } } }] as any },
	{
		kind: 'bulk',
		name: 'replaceOne on an existing doc',
		seed: seed(),
		ops: [{ replaceOne: { filter: { _id: 'repl' }, replacement: { name: 'new', rank: 2 } } }] as any,
	},
	// replaceOne against an absent doc WITHOUT upsert is a no-op on both sides (the in-memory arm must
	// respect the upsert flag rather than always inserting).
	{
		kind: 'bulk',
		name: 'replaceOne absent without upsert is a no-op',
		seed: seed(),
		ops: [{ replaceOne: { filter: { _id: 'nope' }, replacement: { name: 'z' } } }] as any,
	},
	// replaceOne against an absent doc WITH upsert inserts on both sides.
	{
		kind: 'bulk',
		name: 'replaceOne absent with upsert inserts',
		seed: seed(),
		ops: [{ replaceOne: { filter: { _id: 'nope' }, replacement: { name: 'z' }, upsert: true } }] as any,
	},
	{
		kind: 'bulk',
		name: 'all arms in one ordered batch',
		seed: seed(),
		ops: [
			{ insertOne: { document: { _id: 'ins', n: 1 } } },
			{ updateOne: { filter: { _id: 'upd' }, update: { $set: { rank: 10 } } } },
			{ updateMany: { filter: { rank: 0 }, update: { $set: { name: 'zero' } } } },
			{ deleteOne: { filter: { _id: 'del1' } } },
			{ replaceOne: { filter: { _id: 'repl' }, replacement: { name: 'new', rank: 2 } } },
		] as any,
	},
]

describe('conformance: in-memory bulkWrite vs real MongoDB', () => {
	let client: MongoClient
	beforeAll(async () => {
		client = await connectSharedMongoClient()
	}, 120000)
	afterAll(async () => {
		await client?.close()
	})

	runConformanceTable(() => client, cases)
})
