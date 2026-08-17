/**
 * Conformance: `mongoModify` (the in-memory update applier) vs real MongoDB `updateOne`/`updateMany`.
 * Each case applies the modifier then compares the WHOLE collection state afterwards.
 */
import { MongoClient } from 'mongodb'
import { connectSharedMongoClient } from '../_integrationDb'
import { ConformanceCase, runConformanceTable, SeedDoc } from './_harness'

const one = (): SeedDoc[] => [
	{
		_id: 'a',
		name: 'original',
		rank: 1,
		nested: { x: 1, y: 2 },
		values: [1, 2, 3],
		objs: [
			{ id: 'x', kind: 'apple' },
			{ id: 'y', kind: 'banana' },
			{ id: 'z', kind: 'apple' },
		],
	},
]
const many = (): SeedDoc[] => [
	{ _id: 'a', g: 1, v: 0 },
	{ _id: 'b', g: 1, v: 0 },
	{ _id: 'c', g: 2, v: 0 },
]

const sel = { _id: 'a' }

const cases: ConformanceCase[] = [
	{ kind: 'modify', name: '$set top-level', seed: one(), selector: sel, modifier: { $set: { name: 'changed' } } },
	{
		kind: 'modify',
		name: '$set nested via dotted path',
		seed: one(),
		selector: sel,
		modifier: { $set: { 'nested.x': 99 } },
	},
	{
		kind: 'modify',
		name: '$set creates intermediate objects',
		seed: one(),
		selector: sel,
		modifier: { $set: { 'deep.newly.created': 5 } } as any,
	},
	{ kind: 'modify', name: '$unset top-level', seed: one(), selector: sel, modifier: { $unset: { name: 1 } } },
	{
		kind: 'modify',
		name: '$unset nested',
		seed: one(),
		selector: sel,
		modifier: { $unset: { 'nested.y': 1 } } as any,
	},
	{ kind: 'modify', name: '$push a value', seed: one(), selector: sel, modifier: { $push: { values: 4 } } },
	{
		kind: 'modify',
		name: '$push with $each',
		seed: one(),
		selector: sel,
		modifier: { $push: { values: { $each: [4, 5] } } },
	},
	{ kind: 'modify', name: '$pull a primitive', seed: one(), selector: sel, modifier: { $pull: { values: 2 } } },
	{
		kind: 'modify',
		name: '$pull by sub-document query',
		seed: one(),
		selector: sel,
		modifier: { $pull: { objs: { kind: 'apple' } } } as any,
	},
	{
		kind: 'modify',
		name: '$pull via $in',
		seed: one(),
		selector: sel,
		modifier: { $pull: { values: { $in: [1, 3] } } } as any,
	},
	{
		kind: 'modify',
		name: '$addToSet a new value',
		seed: one(),
		selector: sel,
		modifier: { $addToSet: { values: 4 } },
	},
	{
		kind: 'modify',
		name: '$addToSet an existing value (no-op)',
		seed: one(),
		selector: sel,
		modifier: { $addToSet: { values: 2 } },
	},
	{
		kind: 'modify',
		name: '$addToSet with $each skipping dups',
		seed: one(),
		selector: sel,
		modifier: { $addToSet: { values: { $each: [3, 4, 5] } } },
	},
	{ kind: 'modify', name: '$rename a field', seed: one(), selector: sel, modifier: { $rename: { name: 'title' } } },
	{
		kind: 'modify',
		name: 'multiple operators at once',
		seed: one(),
		selector: sel,
		modifier: { $set: { name: 'm' }, $push: { values: 4 }, $unset: { rank: 1 } } as any,
	},
	{
		kind: 'modify',
		name: 'multi update',
		seed: many(),
		selector: { g: 1 },
		modifier: { $set: { v: 9 } },
		multi: true,
	},
	{
		// multi:false with a selector matching exactly one doc (it must not touch the non-matching 'b').
		// Which doc updateOne picks among MANY matches is non-deterministic in real mongo, so that is covered
		// by corelib's in-memory unit spec rather than this parity table.
		kind: 'modify',
		name: 'single update (multi:false) touches only the match',
		seed: [
			{ _id: 'a', g: 1 },
			{ _id: 'b', g: 2 },
		],
		selector: { g: 1 },
		modifier: { $set: { v: 1 } },
		multi: false,
	},

	// Real mongo rejects a non-operator update document ("update document requires atomic operators"); the
	// in-memory applier must throw too (production does full replacements via `replaceAsync`, not update).
	{
		kind: 'modify',
		name: 'full-document update (no operators) is rejected',
		seed: one(),
		selector: sel,
		modifier: { name: 'fresh', rank: 5 } as any,
		expectation: { status: 'bothThrow', reason: 'requires atomic operators' },
	},
	// $push to a non-array field errors on both sides.
	{
		kind: 'modify',
		name: '$push to a non-array field is rejected',
		seed: one(),
		selector: sel,
		modifier: { $push: { rank: 5 } } as any,
		expectation: { status: 'bothThrow', reason: 'is not an array' },
	},

	// Update operators the in-memory applier deliberately does not implement → must throw (loud).
	{
		kind: 'modify',
		name: 'UNSUPPORTED $inc throws',
		seed: one(),
		selector: sel,
		modifier: { $inc: { rank: 1 } } as any,
		expectation: { status: 'inMemoryThrows', reason: 'Update method "$inc" not implemented yet' },
	},
	{
		kind: 'modify',
		name: 'UNSUPPORTED $pop throws',
		seed: one(),
		selector: sel,
		modifier: { $pop: { values: 1 } } as any,
		expectation: { status: 'inMemoryThrows', reason: 'Update method "$pop" not implemented yet' },
	},
]

describe('conformance: mongoModify vs real MongoDB', () => {
	let client: MongoClient
	beforeAll(async () => {
		client = await connectSharedMongoClient()
	}, 120000)
	afterAll(async () => {
		await client?.close()
	})

	runConformanceTable(() => client, cases)
})
