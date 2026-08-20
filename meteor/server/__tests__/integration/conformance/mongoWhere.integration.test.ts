/**
 * Conformance: `mongoWhere` (the in-memory query matcher) vs real MongoDB `find`.
 * Driven through {@link InMemoryMongoCollection} so it exercises the production mock read path.
 */
import { MongoClient } from 'mongodb'
import { connectSharedMongoClient } from '../_integrationDb'
import { ConformanceCase, runConformanceTable, SeedDoc } from './_harness'

const scalars: SeedDoc[] = [
	{ _id: 'a', name: 'abc', rank: 0 },
	{ _id: 'b', name: 'abc', rank: 1 },
	{ _id: 'c', name: 'abcd', rank: 2 },
	{ _id: 'd', name: 'xyz', rank: 3 },
]
const withArrays: SeedDoc[] = [
	{ _id: 'a', tags: ['x', 'y'] },
	{ _id: 'b', tags: ['y', 'z'] },
	{ _id: 'c', tags: [] },
	{ _id: 'd', tags: ['x'] },
]
const withObjects: SeedDoc[] = [
	{ _id: 'a', meta: { x: 1 }, nested: { a: 1 } },
	{ _id: 'b', meta: { x: 2 }, nested: { a: 2 } },
	{ _id: 'c', meta: { x: 1 }, nested: { a: 1 } },
]
const objArrays: SeedDoc[] = [
	{ _id: 'a', objs: [{ kind: 'apple' }, { kind: 'banana' }] },
	{ _id: 'b', objs: [{ kind: 'cherry' }] },
	{ _id: 'c', objs: [{ kind: 'apple' }] },
]
const withMissing: SeedDoc[] = [{ _id: 'a', val: 1 }, { _id: 'b' }, { _id: 'c', val: 3 }]

const cases: ConformanceCase[] = [
	{ kind: 'where', name: 'match-all {}', seed: scalars, query: {} },
	{ kind: 'where', name: 'implicit equality on string', seed: scalars, query: { name: 'abc' } },
	{ kind: 'where', name: 'equality by _id', seed: scalars, query: { _id: 'c' } },
	{ kind: 'where', name: '$eq on a scalar', seed: scalars, query: { rank: { $eq: 2 } } },
	{
		kind: 'where',
		name: '$eq on an embedded object (deep equality)',
		seed: withObjects,
		query: { meta: { $eq: { x: 1 } } },
	},
	{
		kind: 'where',
		name: '$ne on an embedded object (deep equality)',
		seed: withObjects,
		query: { meta: { $ne: { x: 1 } } },
	},
	{ kind: 'where', name: '$ne on a scalar', seed: scalars, query: { name: { $ne: 'abc' } } },
	{ kind: 'where', name: '$in on a scalar field', seed: scalars, query: { name: { $in: ['abc', 'xyz'] } } },
	{ kind: 'where', name: '$in matching an ARRAY field element', seed: withArrays, query: { tags: { $in: ['x'] } } },
	{ kind: 'where', name: '$nin against an ARRAY field', seed: withArrays, query: { tags: { $nin: ['x'] } } },
	{ kind: 'where', name: '$gt', seed: scalars, query: { rank: { $gt: 1 } } },
	{ kind: 'where', name: '$gte', seed: scalars, query: { rank: { $gte: 1 } } },
	{ kind: 'where', name: '$lt', seed: scalars, query: { rank: { $lt: 2 } } },
	{ kind: 'where', name: '$lte', seed: scalars, query: { rank: { $lte: 2 } } },
	// Multiple operators on one field must AND together (MongoDB applies them all).
	{ kind: 'where', name: 'range $gte + $lte on one field', seed: scalars, query: { rank: { $gte: 1, $lte: 2 } } },
	{ kind: 'where', name: 'range $gt + $lt on one field', seed: scalars, query: { rank: { $gt: 0, $lt: 3 } } },
	{
		kind: 'where',
		name: '$exists + $ne combined on one field',
		seed: withMissing,
		query: { val: { $exists: true, $ne: 1 } },
	},
	{ kind: 'where', name: '$exists: true', seed: withMissing, query: { val: { $exists: true } } },
	{ kind: 'where', name: '$exists: false', seed: withMissing, query: { val: { $exists: false } } },
	{
		kind: 'where',
		name: '$elemMatch on an array of objects',
		seed: objArrays,
		query: { objs: { $elemMatch: { kind: 'apple' } } },
	},
	{ kind: 'where', name: '$or', seed: scalars, query: { $or: [{ name: 'abc' }, { rank: 3 }] } },
	{ kind: 'where', name: '$and', seed: scalars, query: { $and: [{ name: 'abc' }, { rank: { $gte: 1 } }] } },
	{ kind: 'where', name: '$not wrapping $gt', seed: scalars, query: { rank: { $not: { $gt: 1 } } } },
	{ kind: 'where', name: 'dot-notation into nested object', seed: withObjects, query: { 'nested.a': 1 } },
	// Dot-notation whose path runs THROUGH an array matches when any element satisfies the remainder.
	{
		kind: 'where',
		name: 'dot-notation through an array (any element)',
		seed: objArrays,
		query: { 'objs.kind': 'apple' },
	},
	{
		kind: 'where',
		name: 'dot-notation through an array (no element matches)',
		seed: objArrays,
		query: { 'objs.kind': 'durian' },
	},

	// Operators the in-memory matcher deliberately does NOT implement: it must throw (loud), not silently
	// mis-match. Real mongo supports these, so we only assert the in-memory side throws.
	{
		kind: 'where',
		name: 'UNSUPPORTED $regex throws',
		seed: scalars,
		query: { name: { $regex: '^abc' } },
		expectation: { status: 'inMemoryThrows', reason: 'Operand "$regex" is not implemented' },
	},
	{
		kind: 'where',
		name: 'UNSUPPORTED $size throws',
		seed: withArrays,
		query: { tags: { $size: 2 } },
		expectation: { status: 'inMemoryThrows', reason: 'Operand "$size" is not implemented' },
	},
	{
		kind: 'where',
		name: 'UNSUPPORTED $type throws',
		seed: scalars,
		query: { rank: { $type: 'number' } },
		expectation: { status: 'inMemoryThrows', reason: 'Operand "$type" is not implemented' },
	},
	{
		kind: 'where',
		name: 'UNSUPPORTED $all throws',
		seed: withArrays,
		query: { tags: { $all: ['x', 'y'] } },
		expectation: { status: 'inMemoryThrows', reason: 'Operand "$all" is not implemented' },
	},
	{
		kind: 'where',
		name: 'UNSUPPORTED top-level $nor throws',
		seed: scalars,
		query: { $nor: [{ name: 'abc' }] },
		expectation: { status: 'inMemoryThrows', reason: 'Operand "$nor" is not implemented' },
	},
]

describe('conformance: mongoWhere vs real MongoDB', () => {
	let client: MongoClient
	beforeAll(async () => {
		client = await connectSharedMongoClient()
	}, 120000)
	afterAll(async () => {
		await client?.close()
	})

	runConformanceTable(() => client, cases)
})
