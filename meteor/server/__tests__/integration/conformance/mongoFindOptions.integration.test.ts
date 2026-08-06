/**
 * Conformance: `mongoFindOptions` (sort/skip/limit) and `mongoProjectDocument` (projection) vs real MongoDB.
 * Sort cases are compared positionally (order is the thing under test); the rest are compared as a set.
 */
import { MongoClient } from 'mongodb'
import { connectSharedMongoClient } from '../_integrationDb'
import { ConformanceCase, runConformanceTable, SeedDoc } from './_harness'

// Distinct sort-key values (no ties) so order is unambiguous between the two implementations.
const sortable: SeedDoc[] = [
	{ _id: 'a', val: 3, val2: 'c' },
	{ _id: 'b', val: 1, val2: 'a' },
	{ _id: 'c', val: 2, val2: 'a' },
]
const withMissing: SeedDoc[] = [
	{ _id: 'a', val: 2 },
	{ _id: 'b' }, // missing `val` → MongoDB sorts it lowest (first ascending)
	{ _id: 'c', val: 1 },
]
const ranked: SeedDoc[] = ['1', '2', '3', '4', '5', '6', '7'].map((s, i) => ({ _id: s, n: i }))
const nested: SeedDoc[] = [
	{
		_id: 'a',
		name: 'foo',
		val: 5,
		meta: { x: 1, y: 2 },
		items: [
			{ name: 'p', value: 10 },
			{ name: 'q', value: 20 },
		],
	},
]

const cases: ConformanceCase[] = [
	{ kind: 'find', name: 'sort asc', seed: sortable, options: { sort: { val: 1 } }, ordered: true },
	{ kind: 'find', name: 'sort desc', seed: sortable, options: { sort: { val: -1 } }, ordered: true },
	{
		kind: 'find',
		name: 'sort multi-key (val2 asc, val asc)',
		seed: sortable,
		options: { sort: { val2: 1, val: 1 } },
		ordered: true,
	},
	{
		kind: 'find',
		name: 'sort with a missing field (asc)',
		seed: withMissing,
		options: { sort: { val: 1 } },
		ordered: true,
	},

	{ kind: 'find', name: 'limit', seed: ranked, options: { sort: { n: 1 }, limit: 4 }, ordered: true },
	{ kind: 'find', name: 'skip', seed: ranked, options: { sort: { n: 1 }, skip: 4 }, ordered: true },
	{ kind: 'find', name: 'skip + limit', seed: ranked, options: { sort: { n: 1 }, skip: 2, limit: 3 }, ordered: true },

	{ kind: 'find', name: 'projection include', seed: nested, options: { projection: { name: 1 } } },
	{
		kind: 'find',
		name: 'projection include without _id',
		seed: nested,
		options: { projection: { name: 1, _id: 0 } },
	},
	{ kind: 'find', name: 'projection exclude', seed: nested, options: { projection: { meta: 0, items: 0 } } },
	// A bare `{ _id: 0 }` (no other keys) must still exclude _id, not fall through to the unprojected doc.
	{ kind: 'find', name: 'projection exclude only _id', seed: nested, options: { projection: { _id: 0 } } },
	{
		kind: 'find',
		name: 'projection exclude _id too',
		seed: nested,
		options: { projection: { meta: 0, items: 0, _id: 0 } },
	},
	{
		kind: 'find',
		name: 'projection nested dotted include',
		seed: nested,
		options: { projection: { 'meta.x': 1, _id: 0 } } as any,
	},
	{
		kind: 'find',
		name: 'projection into array elements',
		seed: nested,
		options: { projection: { 'items.name': 1, _id: 0 } } as any,
	},
	{
		kind: 'find',
		name: 'deprecated `fields` is treated like `projection`',
		seed: nested,
		options: { fields: { name: 1 } },
	},

	// Mixed include + exclude is rejected by both implementations.
	{
		kind: 'find',
		name: 'mixed include/exclude projection is rejected',
		seed: nested,
		options: { projection: { name: 1, val: 0 } } as any,
		expectation: { status: 'bothThrow', reason: 'cannot contain both include and exclude' },
	},
]

describe('conformance: mongoFindOptions vs real MongoDB', () => {
	let client: MongoClient
	beforeAll(async () => {
		client = await connectSharedMongoClient()
	}, 120000)
	afterAll(async () => {
		await client?.close()
	})

	runConformanceTable(() => client, cases)
})
