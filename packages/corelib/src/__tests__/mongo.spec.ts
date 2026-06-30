import { protectString, ProtectedString } from '../protectedString.js'
import {
	FindOptions,
	makeMongoSortComparator,
	mongoFindOptions,
	mongoModify,
	mongoProjectDocument,
	MongoQuery,
	mongoWhere,
} from '../mongo.js'

describe('mongoFindOptions', () => {
	const rawDocs = ['1', '2', '3', '4', '5', '6', '7'].map((s) => ({ _id: protectString(s) }))

	test('nothing', () => {
		expect(mongoFindOptions(rawDocs)).toEqual(rawDocs)
		expect(mongoFindOptions(rawDocs, {})).toEqual(rawDocs)
	})
	test('range', () => {
		expect(mongoFindOptions(rawDocs, { limit: 4 }).map((s) => s._id)).toEqual(['1', '2', '3', '4'])
		expect(mongoFindOptions(rawDocs, { skip: 4 }).map((s) => s._id)).toEqual(['5', '6', '7'])
		expect(mongoFindOptions(rawDocs, { skip: 2, limit: 3 }).map((s) => s._id)).toEqual(['3', '4', '5'])
	})

	interface SomeDoc {
		_id: ProtectedString<any>
		val: string
		val2: string
	}

	const rawDocs2: SomeDoc[] = [
		{
			_id: protectString('1'),
			val: 'a',
			val2: 'c',
		},
		{
			_id: protectString('2'),
			val: 'x',
			val2: 'c',
		},
		{
			_id: protectString('3'),
			val: 'n',
			val2: 'b',
		},
	]

	test('fields', () => {
		// those are covered by MongoFieldSpecifier type:
		// expect(() => mongoFindOptions(rawDocs, { fields: { val: 0, val2: 1 } })).toThrowError('options.fields cannot contain both include and exclude rules')
		// expect(() => mongoFindOptions(rawDocs, { fields: { _id: 0, val2: 1 } })).not.toThrowError()
		// expect(() => mongoFindOptions(rawDocs, { fields: { _id: '1', val: 0 } })).not.toThrowError()

		expect(mongoFindOptions(rawDocs2, { fields: { val: 0 } } as FindOptions<SomeDoc>)).toEqual([
			{
				_id: '1',
				val2: 'c',
			},
			{
				_id: '2',
				val2: 'c',
			},
			{
				_id: '3',
				val2: 'b',
			},
		])
		expect(mongoFindOptions(rawDocs2, { fields: { val: 0, _id: 0 } } as FindOptions<SomeDoc>)).toEqual([
			{
				val2: 'c',
			},
			{
				val2: 'c',
			},
			{
				val2: 'b',
			},
		])
		expect(mongoFindOptions(rawDocs2, { fields: { val: 1 } } as FindOptions<SomeDoc>)).toEqual([
			{
				_id: '1',
				val: 'a',
			},
			{
				_id: '2',
				val: 'x',
			},
			{
				_id: '3',
				val: 'n',
			},
		])
		// those are covered by MongoFieldSpecifier type:
		// expect(mongoFindOptions(rawDocs2, { fields: { val: 1, _id: 0 } })).toEqual([
		// 	{
		// 		val: 'a',
		// 	},
		// 	{
		// 		val: 'x',
		// 	},
		// 	{
		// 		val: 'n',
		// 	},
		// ])
	})

	test('fields2', () => {
		expect(mongoFindOptions(rawDocs2, { sort: { val: 1 } } as FindOptions<SomeDoc>)).toEqual([
			{
				_id: '1',
				val: 'a',
				val2: 'c',
			},
			{
				_id: '3',
				val: 'n',
				val2: 'b',
			},
			{
				_id: '2',
				val: 'x',
				val2: 'c',
			},
		])
		expect(mongoFindOptions(rawDocs2, { sort: { val: -1 } } as FindOptions<SomeDoc>)).toEqual([
			{
				_id: '2',
				val: 'x',
				val2: 'c',
			},
			{
				_id: '3',
				val: 'n',
				val2: 'b',
			},
			{
				_id: '1',
				val: 'a',
				val2: 'c',
			},
		])

		expect(mongoFindOptions(rawDocs2, { sort: { val2: 1, val: 1 } } as FindOptions<SomeDoc>)).toEqual([
			{
				_id: '3',
				val: 'n',
				val2: 'b',
			},
			{
				_id: '1',
				val: 'a',
				val2: 'c',
			},
			{
				_id: '2',
				val: 'x',
				val2: 'c',
			},
		])
		expect(mongoFindOptions(rawDocs2, { sort: { val2: 1, val: -1 } } as FindOptions<SomeDoc>)).toEqual([
			{
				_id: '3',
				val: 'n',
				val2: 'b',
			},
			{
				_id: '2',
				val: 'x',
				val2: 'c',
			},
			{
				_id: '1',
				val: 'a',
				val2: 'c',
			},
		])
	})
})

describe('makeMongoSortComparator', () => {
	interface D {
		_id: ProtectedString<any>
		a?: number
		b?: number
	}
	const d = (id: string, props: Partial<D> = {}): D => ({ _id: protectString(id), ...props })
	const sortedIds = (docs: D[], cmp: (x: D, y: D) => number) =>
		[...docs].sort(cmp).map((x) => x._id as unknown as string)

	test('sorts by a single key, ascending and descending', () => {
		const docs = [d('x', { a: 3 }), d('y', { a: 1 }), d('z', { a: 2 })]
		expect(sortedIds(docs, makeMongoSortComparator<D>({ a: 1 }))).toEqual(['y', 'z', 'x'])
		expect(sortedIds(docs, makeMongoSortComparator<D>({ a: -1 }))).toEqual(['x', 'z', 'y'])
	})

	test('applies sort keys in order (primary then secondary)', () => {
		const docs = [d('p', { a: 1, b: 2 }), d('q', { a: 1, b: 1 }), d('r', { a: 0, b: 9 })]
		// a asc → r first; p/q tie on a → b asc breaks it (q before p)
		expect(sortedIds(docs, makeMongoSortComparator<D>({ a: 1, b: 1 }))).toEqual(['r', 'q', 'p'])
	})

	test('breaks ties on _id ascending, regardless of input order', () => {
		const docs = [d('c', { a: 5 }), d('a', { a: 5 }), d('b', { a: 5 })]
		expect(sortedIds(docs, makeMongoSortComparator<D>({ a: 1 }))).toEqual(['a', 'b', 'c'])
	})

	test('with no sort spec, orders purely by _id ascending', () => {
		const docs = [d('c'), d('a'), d('b')]
		expect(sortedIds(docs, makeMongoSortComparator<D>(undefined))).toEqual(['a', 'b', 'c'])
		expect(sortedIds(docs, makeMongoSortComparator<D>({}))).toEqual(['a', 'b', 'c'])
	})

	test('missing/null values sort lowest (before present values)', () => {
		const docs = [d('x', { a: 2 }), d('y'), d('z', { a: 1 })] // y has no `a`
		expect(sortedIds(docs, makeMongoSortComparator<D>({ a: 1 }))).toEqual(['y', 'z', 'x'])
		// descending: present values sort high-to-low, missing still lowest → stays last
		expect(sortedIds(docs, makeMongoSortComparator<D>({ a: -1 }))).toEqual(['x', 'z', 'y'])
	})

	test('is a total order: result is independent of input order', () => {
		const base = [d('a', { a: 1 }), d('b', { a: 1 }), d('c', { a: 2 })]
		const cmp = makeMongoSortComparator<D>({ a: 1 })
		expect(sortedIds([...base].reverse(), cmp)).toEqual(sortedIds(base, cmp))
	})
})

test('mongoWhere', () => {
	const docs = [
		{
			_id: protectString('id0'),
			name: 'abc',
			rank: 0,
		},
		{
			_id: protectString('id1'),
			name: 'abc',
			rank: 1,
		},
		{
			_id: protectString('id2'),
			name: 'abcd',
			rank: 2,
		},
		{
			_id: protectString('id3'),
			name: 'abcd',
			rank: 3,
		},
		{
			_id: protectString('id4'),
			name: 'xyz',
			rank: 4,
		},
		{
			_id: protectString('id5'),
			name: 'xyz',
			rank: 5,
		},
	]

	function findFetch(query: MongoQuery<any>) {
		return docs.filter((doc) => mongoWhere(doc, query))
	}

	expect(findFetch({})).toHaveLength(6)

	expect(findFetch({ _id: protectString('id3') })).toHaveLength(1)
	expect(findFetch({ _id: protectString('id99') })).toHaveLength(0)

	expect(findFetch({ name: 'abcd' })).toHaveLength(2)
	expect(findFetch({ name: 'xyz' })).toHaveLength(2)
	expect(findFetch({ name: { $in: ['abc', 'xyz'] } })).toHaveLength(4)

	expect(findFetch({ rank: { $gt: 2 } })).toHaveLength(3)
	expect(findFetch({ rank: { $gte: 2 } })).toHaveLength(4)

	expect(findFetch({ rank: { $lt: 3 } })).toHaveLength(3)
	expect(findFetch({ rank: { $lte: 3 } })).toHaveLength(4)
})

describe('mongoModify', () => {
	interface Doc {
		_id: ProtectedString<any>
		name: string
		rank: number
		nested: { a: number; b?: number }
		values: number[]
		objs: Array<{ id: string; kind: string }>
	}
	const makeDoc = (): Doc => ({
		_id: protectString('id0'),
		name: 'original',
		rank: 1,
		nested: { a: 1, b: 2 },
		values: [1, 2, 3],
		objs: [
			{ id: 'x', kind: 'apple' },
			{ id: 'y', kind: 'banana' },
			{ id: 'z', kind: 'apple' },
		],
	})
	const selector: MongoQuery<Doc> = { _id: protectString('id0') }
	const modify = (doc: Doc, modifier: any): Doc => mongoModify<Doc>(selector, doc, modifier)

	describe('$set', () => {
		test('sets a top-level field', () => {
			const doc = makeDoc()
			modify(doc, { $set: { name: 'changed' } })
			expect(doc.name).toBe('changed')
		})
		test('sets a nested field via dotted path', () => {
			const doc = makeDoc()
			modify(doc, { $set: { 'nested.a': 99 } })
			expect(doc.nested).toEqual({ a: 99, b: 2 })
		})
		test('creates intermediate objects for a missing dotted path', () => {
			const doc: any = makeDoc()
			modify(doc, { $set: { 'deep.newly.created': 5 } })
			expect(doc.deep).toEqual({ newly: { created: 5 } })
		})
	})

	describe('$unset', () => {
		test('removes a top-level field', () => {
			const doc = makeDoc()
			modify(doc, { $unset: { name: 1 } })
			expect('name' in doc).toBe(false)
		})
		test('removes a nested field', () => {
			const doc = makeDoc()
			modify(doc, { $unset: { 'nested.b': 1 } })
			expect(doc.nested).toEqual({ a: 1 })
		})
	})

	describe('$push', () => {
		test('appends a value', () => {
			const doc = makeDoc()
			modify(doc, { $push: { values: 4 } })
			expect(doc.values).toEqual([1, 2, 3, 4])
		})
		test('appends a duplicate (unlike $addToSet)', () => {
			const doc = makeDoc()
			modify(doc, { $push: { values: 2 } })
			expect(doc.values).toEqual([1, 2, 3, 2])
		})
		test('appends multiple values with $each', () => {
			const doc = makeDoc()
			modify(doc, { $push: { values: { $each: [4, 5] } } })
			expect(doc.values).toEqual([1, 2, 3, 4, 5])
		})
		test('creates the array when missing', () => {
			const doc: any = makeDoc()
			modify(doc, { $push: { newArr: 1 } })
			expect(doc.newArr).toEqual([1])
		})
	})

	describe('$pull', () => {
		test('removes elements equal to a primitive value', () => {
			const doc = makeDoc()
			modify(doc, { $pull: { values: 2 } })
			expect(doc.values).toEqual([1, 3])
		})
		test('does not remove everything when pulling a primitive that is absent', () => {
			const doc = makeDoc()
			modify(doc, { $pull: { values: 99 } })
			expect(doc.values).toEqual([1, 2, 3])
		})
		test('removes elements matching a sub-document query', () => {
			const doc = makeDoc()
			modify(doc, { $pull: { objs: { kind: 'apple' } } })
			expect(doc.objs).toEqual([{ id: 'y', kind: 'banana' }])
		})
		test('removes elements via top-level $in', () => {
			const doc = makeDoc()
			modify(doc, { $pull: { values: { $in: [1, 3] } } })
			expect(doc.values).toEqual([2])
		})
		test('removes embedded documents via $in using deep equality', () => {
			const doc = makeDoc()
			modify(doc, {
				$pull: {
					objs: {
						$in: [
							{ id: 'x', kind: 'apple' },
							{ id: 'z', kind: 'apple' },
						],
					},
				},
			})
			expect(doc.objs).toEqual([{ id: 'y', kind: 'banana' }])
		})
		test('removes elements via a nested operator query', () => {
			const doc = makeDoc()
			modify(doc, { $pull: { objs: { id: { $in: ['x', 'z'] } } } })
			expect(doc.objs).toEqual([{ id: 'y', kind: 'banana' }])
		})
	})

	describe('$addToSet', () => {
		test('adds a new value', () => {
			const doc = makeDoc()
			modify(doc, { $addToSet: { values: 4 } })
			expect(doc.values).toEqual([1, 2, 3, 4])
		})
		test('does not add an existing primitive value', () => {
			const doc = makeDoc()
			modify(doc, { $addToSet: { values: 2 } })
			expect(doc.values).toEqual([1, 2, 3])
		})
		test('adds multiple values with $each, skipping duplicates', () => {
			const doc = makeDoc()
			modify(doc, { $addToSet: { values: { $each: [3, 4, 5] } } })
			expect(doc.values).toEqual([1, 2, 3, 4, 5])
		})
		test('uses deep equality for object members', () => {
			const doc = makeDoc()
			modify(doc, { $addToSet: { objs: { id: 'x', kind: 'apple' } } })
			expect(doc.objs).toHaveLength(3)

			modify(doc, { $addToSet: { objs: { id: 'w', kind: 'cherry' } } })
			expect(doc.objs).toContainEqual({ id: 'w', kind: 'cherry' })
		})
		test('creates the array when missing', () => {
			const doc: any = makeDoc()
			modify(doc, { $addToSet: { newArr: { $each: [1, 2] } } })
			expect(doc.newArr).toEqual([1, 2])
		})
	})

	describe('$rename', () => {
		test('renames a top-level field', () => {
			const doc: any = makeDoc()
			modify(doc, { $rename: { name: 'title' } })
			expect('name' in doc).toBe(false)
			expect(doc.title).toBe('original')
		})
	})

	describe('full-document replace', () => {
		test('throws when the modifier has no atomic operators (matches MongoDB; use replace instead)', () => {
			const doc = makeDoc()
			expect(() => mongoModify<Doc>(selector, doc, { name: 'fresh', rank: 5 } as any)).toThrow(/atomic operators/)
		})
	})

	describe('unsupported operators', () => {
		test('throws for an operator that is not implemented', () => {
			const doc = makeDoc()
			expect(() => modify(doc, { $inc: { rank: 1 } })).toThrow(/not implemented/)
		})
	})

	test('applies multiple operators in a single modifier', () => {
		const doc = makeDoc()
		modify(doc, { $set: { name: 'multi' }, $push: { values: 4 }, $unset: { rank: 1 } })
		expect(doc.name).toBe('multi')
		expect(doc.values).toEqual([1, 2, 3, 4])
		expect('rank' in doc).toBe(false)
	})
})

describe('mongoProjectDocument', () => {
	interface NestedDoc {
		_id: ProtectedString<any>
		name: string
		val: number
		meta: { a: number; b: number }
		items: Array<{ name: string; value: number }>
	}
	const doc: NestedDoc = {
		_id: protectString('1'),
		name: 'foo',
		val: 5,
		meta: { a: 1, b: 2 },
		items: [
			{ name: 'x', value: 10 },
			{ name: 'y', value: 20 },
		],
	}

	test('no projection returns the same document', () => {
		expect(mongoProjectDocument(doc, undefined)).toBe(doc)
	})

	test('include projection keeps only listed fields (plus _id)', () => {
		expect(mongoProjectDocument(doc, { name: 1 } as any)).toEqual({ _id: '1', name: 'foo' })
	})

	test('include projection can exclude _id', () => {
		expect(mongoProjectDocument(doc, { name: 1, _id: 0 } as any)).toEqual({ name: 'foo' })
	})

	test('exclude projection drops listed fields, keeps the rest (incl _id)', () => {
		expect(mongoProjectDocument(doc, { meta: 0, items: 0 } as any)).toEqual({
			_id: '1',
			name: 'foo',
			val: 5,
		})
	})

	test('exclude projection can also drop _id', () => {
		expect(mongoProjectDocument(doc, { meta: 0, items: 0, _id: 0 } as any)).toEqual({
			name: 'foo',
			val: 5,
		})
	})

	test('dotted include path projects nested fields', () => {
		expect(mongoProjectDocument(doc, { 'meta.a': 1, _id: 0 } as any)).toEqual({ meta: { a: 1 } })
	})

	test('dotted include path projects fields out of array elements', () => {
		expect(mongoProjectDocument(doc, { 'items.name': 1, _id: 0 } as any)).toEqual({
			items: [{ name: 'x' }, { name: 'y' }],
		})
	})

	test('nested-object include form behaves like dotted notation', () => {
		// `{ meta: { a: 1 } }` is equivalent to `{ 'meta.a': 1 }` in MongoDB
		expect(mongoProjectDocument(doc, { meta: { a: 1 }, _id: 0 } as any)).toEqual({ meta: { a: 1 } })
	})

	test('nested-object include form does not over-include sibling fields', () => {
		expect(mongoProjectDocument(doc, { name: 1, meta: { a: 1 } } as any)).toEqual({
			_id: '1',
			name: 'foo',
			meta: { a: 1 },
		})
	})

	test('nested-object include form projects out of array elements', () => {
		expect(mongoProjectDocument(doc, { items: { name: 1 }, _id: 0 } as any)).toEqual({
			items: [{ name: 'x' }, { name: 'y' }],
		})
	})

	test('nested-object exclude form drops only the nested field', () => {
		// `{ meta: { a: 0 } }` is equivalent to `{ 'meta.a': 0 }` and must NOT be treated as an include
		expect(mongoProjectDocument(doc, { meta: { a: 0 } } as any)).toEqual({
			_id: '1',
			name: 'foo',
			val: 5,
			meta: { b: 2 },
			items: [
				{ name: 'x', value: 10 },
				{ name: 'y', value: 20 },
			],
		})
	})

	test('mixing nested include and exclude rules throws', () => {
		expect(() => mongoProjectDocument(doc, { meta: { a: 1 }, val: 0 } as any)).toThrow()
	})

	test('mixing include and exclude rules throws', () => {
		expect(() => mongoProjectDocument(doc, { name: 1, val: 0 } as any)).toThrow()
	})

	test('does not mutate the source document', () => {
		const before = JSON.parse(JSON.stringify(doc))
		mongoProjectDocument(doc, { meta: 0 } as any)
		expect(doc).toEqual(before)
	})
})
