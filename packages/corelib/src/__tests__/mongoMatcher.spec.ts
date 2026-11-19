/* eslint-disable jest/expect-expect -- most assertions are made by `check()` */
import { deepEqual, MongoMatcher } from '../mongoMatcher.js'

/** [selector, document, expected match] */
type Case = [selector: any, doc: any, expected: boolean]

function check(cases: Case[]) {
	for (const [selector, doc, expected] of cases) {
		const matcher = new MongoMatcher(selector)
		expect({ selector, doc, result: matcher.documentMatches(doc).result }).toEqual({
			selector,
			doc,
			result: expected,
		})
		// The fast boolean path must always agree with the full one
		expect({ selector, doc, test: matcher.test(doc) }).toEqual({ selector, doc, test: expected })
	}
}

describe('MongoMatcher', () => {
	test('empty and id selectors', () => {
		check([
			[{}, {}, true],
			[{}, { a: 1 }, true],
			['abc', { _id: 'abc' }, true],
			['abc', { _id: 'abd' }, false],
			[{ _id: 'abc' }, { _id: 'abc' }, true],
			// Falsy selectors match nothing, as they are likely programmer errors
			[undefined, { _id: 'abc' }, false],
			[null, { _id: 'abc' }, false],
			[{ _id: undefined }, { _id: 'abc' }, false],
			[{ _id: '' }, { _id: '' }, false],
		])
		expect(() => new MongoMatcher([])).toThrow(/Invalid selector/)
		expect(() => new MongoMatcher(true)).toThrow(/Invalid selector/)
		expect(() => new MongoMatcher(() => true)).toThrow(/not supported/)
	})

	test('equality', () => {
		check([
			[{ a: 1 }, { a: 1 }, true],
			[{ a: 1 }, { a: 2 }, false],
			[{ a: 1 }, { a: '1' }, false],
			[{ a: 'x' }, { a: 'x' }, true],
			[{ a: true }, { a: true }, true],
			[{ a: true }, { a: 1 }, false],
			[{ a: NaN }, { a: NaN }, true],
			// A field holding an array matches when any element is equal, or the array itself is
			[{ a: 'x' }, { a: ['x', 'y'] }, true],
			[{ a: 'z' }, { a: ['x', 'y'] }, false],
			[{ a: ['x', 'y'] }, { a: ['x', 'y'] }, true],
			[{ a: ['x', 'y'] }, { a: ['y', 'x'] }, false],
			[{ a: ['x'] }, { a: [['x'], 'y'] }, true],
			// null matches a missing field, and undefined
			[{ a: null }, {}, true],
			[{ a: null }, { a: null }, true],
			[{ a: null }, { a: undefined }, true],
			[{ a: null }, { a: 0 }, false],
			// Embedded documents compare deeply, sensitive to key order (as MongoDB)
			[{ a: { b: 1, c: 2 } }, { a: { b: 1, c: 2 } }, true],
			[{ a: { b: 1, c: 2 } }, { a: { c: 2, b: 1 } }, false],
			[{ a: { b: 1 } }, { a: { b: 1, c: 2 } }, false],
			// Dates compare by time
			[{ a: new Date(5) }, { a: new Date(5) }, true],
			[{ a: new Date(5) }, { a: new Date(6) }, false],
			// Several fields must all match
			[{ a: 1, b: 2 }, { a: 1, b: 2 }, true],
			[{ a: 1, b: 2 }, { a: 1, b: 3 }, false],
		])
	})

	test('$eq / $ne', () => {
		check([
			[{ a: { $eq: 1 } }, { a: 1 }, true],
			[{ a: { $eq: 1 } }, { a: [1, 2] }, true],
			[{ a: { $eq: null } }, {}, true],
			[{ a: { $ne: 1 } }, { a: 2 }, true],
			[{ a: { $ne: 1 } }, { a: 1 }, false],
			// $ne must not match any element
			[{ a: { $ne: 1 } }, { a: [1, 2] }, false],
			[{ a: { $ne: 1 } }, {}, true],
			// A missing field equals null, so $ne: null requires the field to be set
			[{ a: { $ne: null } }, {}, false],
			[{ a: { $ne: null } }, { a: 0 }, true],
			[{ a: { $ne: true } }, {}, true],
			[{ a: { $ne: true } }, { a: false }, true],
			[{ a: { $ne: true } }, { a: true }, false],
		])
	})

	test('$in / $nin', () => {
		check([
			[{ a: { $in: [1, 2] } }, { a: 2 }, true],
			[{ a: { $in: [1, 2] } }, { a: 3 }, false],
			[{ a: { $in: [1, 2] } }, { a: '1' }, false],
			[{ a: { $in: ['x'] } }, { a: ['y', 'x'] }, true],
			[{ a: { $in: [] } }, { a: 1 }, false],
			// null in the list matches a missing field
			[{ a: { $in: [null] } }, {}, true],
			[{ a: { $in: [null, 1] } }, { a: null }, true],
			[{ a: { $in: [1] } }, {}, false],
			// Non-plain members compare deeply
			[{ a: { $in: [{ b: 1 }] } }, { a: { b: 1 } }, true],
			[{ a: { $in: [{ b: 1 }] } }, { a: { b: 2 } }, false],
			[{ a: { $in: [[1, 2]] } }, { a: [1, 2] }, true],
			// RegExp members
			[{ a: { $in: [/^x/, 'q'] } }, { a: 'xyz' }, true],
			[{ a: { $in: [/^x/, 'q'] } }, { a: 'q' }, true],
			[{ a: { $in: [/^x/, 'q'] } }, { a: 'yx' }, false],
			[{ a: { $nin: [1, 2] } }, { a: 3 }, true],
			[{ a: { $nin: [1, 2] } }, { a: 1 }, false],
			[{ a: { $nin: [1, 2] } }, {}, true],
			[{ a: { $nin: ['x'] } }, { a: ['y', 'x'] }, false],
			[{ a: { $nin: [null] } }, {}, false],
		])
		expect(() => new MongoMatcher({ a: { $in: 1 } })).toThrow(/\$in needs an array/)
		expect(() => new MongoMatcher({ a: { $in: [{ $gt: 1 }] } })).toThrow(/cannot nest/)
	})

	test('comparisons', () => {
		check([
			[{ a: { $gt: 1 } }, { a: 2 }, true],
			[{ a: { $gt: 1 } }, { a: 1 }, false],
			[{ a: { $gte: 1 } }, { a: 1 }, true],
			[{ a: { $lt: 1 } }, { a: 0 }, true],
			[{ a: { $lte: 1 } }, { a: 1 }, true],
			[{ a: { $gt: 1, $lt: 3 } }, { a: 2 }, true],
			[{ a: { $gt: 1, $lt: 3 } }, { a: 3 }, false],
			// Values of different types never compare
			[{ a: { $gt: 1 } }, { a: '5' }, false],
			[{ a: { $lt: 'b' } }, { a: 1 }, false],
			[{ a: { $gt: 1 } }, {}, false],
			[{ a: { $gte: null } }, {}, true],
			// Any element of an array field may match
			[{ a: { $gt: 5 } }, { a: [1, 6] }, true],
			[{ a: { $gt: 5 } }, { a: [1, 2] }, false],
			// But different conditions may match different elements
			[{ a: { $gt: 1, $lt: 3 } }, { a: [0, 5] }, true],
			[{ a: { $lt: 'b' } }, { a: 'a' }, true],
			[{ a: { $lt: new Date(5) } }, { a: new Date(4) }, true],
			[{ a: { $lt: new Date(5) } }, { a: 4 }, false],
			// Comparing with an array never matches
			[{ a: { $gt: [1] } }, { a: [2] }, false],
		])
	})

	test('$exists', () => {
		check([
			[{ a: { $exists: true } }, { a: 1 }, true],
			[{ a: { $exists: true } }, { a: null }, true],
			[{ a: { $exists: true } }, {}, false],
			[{ a: { $exists: false } }, {}, true],
			[{ a: { $exists: false } }, { a: 1 }, false],
			[{ 'a.b': { $exists: true } }, { a: [{ b: 1 }] }, true],
			[{ 'a.b': { $exists: true } }, { a: [{ c: 1 }] }, false],
			[{ a: { $exists: true, $ne: 1 } }, { a: 2 }, true],
			[{ a: { $exists: true, $ne: 1 } }, {}, false],
		])
	})

	test('$all / $size / $type / $mod', () => {
		check([
			[{ a: { $all: ['x', 'y'] } }, { a: ['y', 'z', 'x'] }, true],
			[{ a: { $all: ['x', 'y'] } }, { a: ['x'] }, false],
			[{ a: { $all: ['x'] } }, { a: 'x' }, true],
			[{ a: { $all: [] } }, { a: ['x'] }, false],
			[{ 'a.b': { $all: ['x'] } }, { a: { b: ['x', 'y'] } }, true],
			[{ a: { $size: 2 } }, { a: [1, 2] }, true],
			[{ a: { $size: 2 } }, { a: [1] }, false],
			[{ a: { $size: 1 } }, { a: [[1, 2]] }, true],
			[{ a: { $size: 0 } }, { a: [] }, true],
			[{ a: { $size: 0 } }, {}, false],
			[{ a: { $type: 'string' } }, { a: 'x' }, true],
			[{ a: { $type: 'string' } }, { a: 1 }, false],
			[{ a: { $type: 2 } }, { a: ['x'] }, true],
			[{ a: { $type: 'array' } }, { a: ['x'] }, false],
			[{ a: { $type: 'array' } }, { a: [['x']] }, true],
			[{ a: { $type: 'null' } }, { a: null }, true],
			[{ a: { $type: 'null' } }, {}, false],
			[{ a: { $type: 'number' } }, { a: 1.5 }, true],
			[{ a: { $type: 'number' } }, { a: '1' }, false],
			[{ a: { $mod: [3, 1] } }, { a: 4 }, true],
			[{ a: { $mod: [3, 1] } }, { a: 5 }, false],
		])
		expect(() => new MongoMatcher({ a: { $all: 'x' } })).toThrow(/\$all requires array/)
		expect(() => new MongoMatcher({ a: { $type: 'nope' } })).toThrow(/unknown string alias/)
		expect(() => new MongoMatcher({ a: { $mod: [1] } })).toThrow(/\$mod/)
	})

	test('$regex', () => {
		check([
			[{ a: /^ab/ }, { a: 'abc' }, true],
			[{ a: /^ab/ }, { a: 'cab' }, false],
			[{ a: /^ab/ }, { a: ['x', 'abc'] }, true],
			[{ a: /^1/ }, { a: 1 }, false],
			[{ a: /^ab/ }, {}, false],
			[{ a: { $regex: '^ab' } }, { a: 'abc' }, true],
			[{ a: { $regex: 'AB' } }, { a: 'abc' }, false],
			[{ a: { $regex: 'AB', $options: 'i' } }, { a: 'abc' }, true],
			[{ a: { $regex: /AB/, $options: 'i' } }, { a: 'abc' }, true],
			[{ a: { $regex: '^a.c$', $options: 's' } }, { a: 'a\nc' }, true],
			[{ a: { $regex: '^ a b c # comment', $options: 'x' } }, { a: 'abc' }, true],
			[{ a: { $regex: '^ab', $ne: 'abc' } }, { a: 'abd' }, true],
			[{ a: { $regex: '^ab', $ne: 'abc' } }, { a: 'abc' }, false],
			[{ a: { $not: /^ab/ } }, { a: 'xyz' }, true],
			[{ a: { $not: /^ab/ } }, { a: 'abc' }, false],
		])

		// The g flag must not make repeated matches alternate
		const matcher = new MongoMatcher({ a: /b/g })
		expect([1, 2, 3].map(() => matcher.documentMatches({ a: 'abc' }).result)).toEqual([true, true, true])

		expect(() => new MongoMatcher({ a: { $regex: /a/m, $options: 'i' } })).toThrow(/options set in both/)
		expect(() => new MongoMatcher({ a: { $regex: 'a', $options: 'g' } })).toThrow(
			/invalid flag in regex options: g/
		)
		expect(() => new MongoMatcher({ a: { $options: 'i' } })).toThrow(/requires a sibling "\$regex"/)
		expect(() => new MongoMatcher({ a: { $regex: 5 } })).toThrow(/\$regex has to be a string or RegExp/)
	})

	test('$not', () => {
		check([
			[{ a: { $not: { $gt: 1 } } }, { a: 0 }, true],
			[{ a: { $not: { $gt: 1 } } }, { a: 2 }, false],
			[{ a: { $not: { $gt: 1 } } }, {}, true],
			[{ a: { $not: { $in: [1, 2] } } }, { a: 3 }, true],
		])
	})

	test('logical operators', () => {
		check([
			[{ $or: [{ a: 1 }, { b: 2 }] }, { b: 2 }, true],
			[{ $or: [{ a: 1 }, { b: 2 }] }, { a: 2 }, false],
			[{ $or: [{ a: 1 }] }, { a: 1 }, true],
			[{ $and: [{ a: 1 }, { b: 2 }] }, { a: 1, b: 2 }, true],
			[{ $and: [{ a: 1 }, { b: 2 }] }, { a: 1 }, false],
			[{ $nor: [{ a: 1 }, { b: 2 }] }, { a: 2 }, true],
			[{ $nor: [{ a: 1 }, { b: 2 }] }, { a: 1 }, false],
			[{ a: 1, $or: [{ b: 1 }, { c: 1 }] }, { a: 1, c: 1 }, true],
			[{ a: 1, $or: [{ b: 1 }, { c: 1 }] }, { a: 2, c: 1 }, false],
			[{ $or: [{ $and: [{ a: 1 }, { b: 1 }] }, { c: 1 }] }, { a: 1, b: 1 }, true],
			[{ $comment: 'ignored', a: 1 }, { a: 1 }, true],
		])
		expect(() => new MongoMatcher({ $or: [] })).toThrow(/nonempty array/)
		expect(() => new MongoMatcher({ $or: {} })).toThrow(/nonempty array/)
		expect(() => new MongoMatcher({ $or: [1] })).toThrow(/full objects/)
	})

	test('dotted paths', () => {
		check([
			[{ 'a.b': 1 }, { a: { b: 1 } }, true],
			[{ 'a.b': 1 }, { a: { b: 2 } }, false],
			[{ 'a.b': null }, { a: {} }, true],
			[{ 'a.b': null }, {}, true],
			[{ 'a.b': null }, { a: 5 }, true],
			[{ 'a.b.c': 1 }, { a: { b: { c: 1 } } }, true],
			// Through an array: any element may match
			[{ 'a.b': 1 }, { a: [{ b: 2 }, { b: 1 }] }, true],
			[{ 'a.b': 1 }, { a: [{ b: 2 }, { b: 3 }] }, false],
			[{ 'a.b': 1 }, { a: [{ b: [0, 1] }] }, true],
			// Numeric parts index into arrays
			[{ 'a.0': 5 }, { a: [5, 6] }, true],
			[{ 'a.1': 5 }, { a: [5, 6] }, false],
			[{ 'a.0': 5 }, { a: [[5]] }, false],
			[{ 'a.0.b': 1 }, { a: [{ b: 1 }] }, true],
			[{ 'a.5': null }, { a: [1] }, false],
			// ... and also into the fields of objects in arrays
			[{ 'a.0': 5 }, { a: [{ 0: 5 }] }, true],
		])
	})

	test('$elemMatch', () => {
		check([
			[{ a: { $elemMatch: { b: 1, c: 2 } } }, { a: [{ b: 1, c: 2 }] }, true],
			// Both conditions must hold on the same element
			[{ a: { $elemMatch: { b: 1, c: 2 } } }, { a: [{ b: 1 }, { c: 2 }] }, false],
			[{ a: { $elemMatch: { $gt: 1, $lt: 3 } } }, { a: [0, 2] }, true],
			[{ a: { $elemMatch: { $gt: 1, $lt: 3 } } }, { a: [0, 5] }, false],
			[{ a: { $elemMatch: { $gt: 1 } } }, { a: [[5]] }, false],
			[{ a: { $elemMatch: { b: 1 } } }, { a: { b: 1 } }, false],
			[{ a: { $elemMatch: { b: 1 } } }, { a: [1, { b: 1 }] }, true],
			[{ a: { $elemMatch: { $or: [{ b: 1 }, { c: 1 }] } } }, { a: [{ c: 1 }] }, true],
		])
	})

	test('arrayIndices, for the positional $ update', () => {
		expect(new MongoMatcher({ 'a.b': 2 }).documentMatches({ a: [{ b: 1 }, { b: 2 }] })).toEqual({
			result: true,
			arrayIndices: [1],
		})
		expect(new MongoMatcher({ a: 'y' }).documentMatches({ a: ['x', 'y'] })).toEqual({
			result: true,
			arrayIndices: [1],
		})
		expect(new MongoMatcher({ a: { $elemMatch: { b: 2 } } }).documentMatches({ a: [{ b: 1 }, { b: 2 }] })).toEqual({
			result: true,
			arrayIndices: [1],
		})
		expect(new MongoMatcher({ a: 1 }).documentMatches({ a: 1 })).toEqual({ result: true })
		expect(new MongoMatcher({ a: 1 }).documentMatches({ a: 2 })).toEqual({ result: false })
	})

	test('unsupported operators throw when compiled', () => {
		expect(() => new MongoMatcher({ a: { $foo: 1 } })).toThrow('Operand "$foo" is not implemented')
		expect(() => new MongoMatcher({ $foo: [] })).toThrow('Operand "$foo" is not implemented')
		expect(() => new MongoMatcher({ $where: 'true' })).toThrow('Operand "$where" is not implemented')
		expect(() => new MongoMatcher({ a: { $near: [0, 0] } })).toThrow('Operand "$near" is not implemented')
		expect(() => new MongoMatcher({ a: { $gt: 1, b: 1 } })).toThrow(/Inconsistent operator/)
	})

	test('documentMatches requires a document', () => {
		expect(() => new MongoMatcher({}).documentMatches(1)).toThrow(/needs a document/)
	})

	test('records the paths used', () => {
		const matcher = new MongoMatcher({ a: 1, 'b.c': 2, $or: [{ d: 1 }, { e: { $elemMatch: { f: 1 } } }] })
		expect(matcher._getPaths().sort()).toEqual(['a', 'b.c', 'd', 'e'])
		expect(matcher.isSimple()).toBe(false)
		expect(new MongoMatcher({ a: 1, b: { $in: [1, 2] } }).isSimple()).toBe(true)
	})
})

describe('deepEqual', () => {
	test('values', () => {
		expect(deepEqual(1, 1)).toBe(true)
		expect(deepEqual(NaN, NaN)).toBe(true)
		expect(deepEqual(1, '1')).toBe(false)
		expect(deepEqual(null, undefined)).toBe(false)
		expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true)
		expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(false)
		expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false)
		expect(deepEqual(new Date(1), new Date(1))).toBe(true)
		expect(deepEqual(new Date(1), 1)).toBe(false)
		expect(deepEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true)
		expect(deepEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false)
	})
})
