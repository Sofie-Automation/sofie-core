import { hashObj } from '../hash.js'

describe('hashObj', () => {
	describe('primitive types', () => {
		test('string values', () => {
			expect(hashObj('hello')).toBe(hashObj('hello'))
			expect(hashObj('hello')).not.toBe(hashObj('world'))
		})

		test('number values', () => {
			expect(hashObj(123)).toBe(hashObj(123))
			expect(hashObj(123)).not.toBe(hashObj(456))
			expect(hashObj(0)).toBe(hashObj(0))
		})

		test('boolean values', () => {
			expect(hashObj(true)).toBe(hashObj(true))
			expect(hashObj(false)).toBe(hashObj(false))
			expect(hashObj(true)).not.toBe(hashObj(false))
		})

		test('undefined should produce consistent hash', () => {
			expect(hashObj(undefined)).toBe(hashObj(undefined))
		})

		test('null should produce consistent hash', () => {
			const hash1 = hashObj(null)
			const hash2 = hashObj(null)
			expect(hash1).toBe(hash2)
		})

		test('null and undefined should produce different hashes', () => {
			expect(hashObj(null)).not.toBe(hashObj(undefined))
		})
	})

	describe('object stability', () => {
		test('same properties in different order should produce same hash', () => {
			const obj1 = { a: 1, b: 2, c: 3 }
			const obj2 = { c: 3, a: 1, b: 2 }
			const obj3 = { b: 2, c: 3, a: 1 }

			expect(hashObj(obj1)).toBe(hashObj(obj2))
			expect(hashObj(obj1)).toBe(hashObj(obj3))
			expect(hashObj(obj2)).toBe(hashObj(obj3))
		})

		test('different property values should produce different hashes', () => {
			const obj1 = { a: 1, b: 2 }
			const obj2 = { a: 1, b: 3 }

			expect(hashObj(obj1)).not.toBe(hashObj(obj2))
		})

		test('different properties should produce different hashes', () => {
			const obj1 = { a: 1, b: 2 }
			const obj2 = { a: 1, c: 2 }

			expect(hashObj(obj1)).not.toBe(hashObj(obj2))
		})
	})

	describe('nested objects', () => {
		test('nested objects with same structure should produce same hash', () => {
			const obj1 = { a: 1, b: { c: 2, d: 3 } }
			const obj2 = { b: { d: 3, c: 2 }, a: 1 }

			expect(hashObj(obj1)).toBe(hashObj(obj2))
		})

		test('deeply nested objects should be stable', () => {
			const obj1 = {
				level1: {
					level2: {
						level3: {
							value: 'deep',
						},
					},
				},
			}
			const obj2 = {
				level1: {
					level2: {
						level3: {
							value: 'deep',
						},
					},
				},
			}

			expect(hashObj(obj1)).toBe(hashObj(obj2))
		})

		test('objects with null values should work', () => {
			const obj1 = { a: 1, b: null }
			const obj2 = { b: null, a: 1 }

			expect(() => hashObj(obj1)).not.toThrow()
			expect(hashObj(obj1)).toBe(hashObj(obj2))
		})

		test('objects with undefined values should work', () => {
			const obj1 = { a: 1, b: undefined }
			const obj2 = { b: undefined, a: 1 }

			expect(() => hashObj(obj1)).not.toThrow()
			expect(hashObj(obj1)).toBe(hashObj(obj2))
		})
	})

	describe('arrays', () => {
		test('arrays should produce consistent hashes', () => {
			const arr1 = [1, 2, 3]
			const arr2 = [1, 2, 3]

			expect(hashObj(arr1)).toBe(hashObj(arr2))
		})

		test('arrays with different order should produce different hashes', () => {
			const arr1 = [1, 2, 3]
			const arr2 = [3, 2, 1]

			// Arrays maintain order, so different order = different hash
			expect(hashObj(arr1)).not.toBe(hashObj(arr2))
		})

		test('empty arrays should produce consistent hash', () => {
			expect(hashObj([])).toBe(hashObj([]))
		})

		test('nested arrays should work', () => {
			const arr1 = [1, [2, 3], 4]
			const arr2 = [1, [2, 3], 4]

			expect(hashObj(arr1)).toBe(hashObj(arr2))
		})

		test('arrays with null should work', () => {
			const arr1 = [1, null, 3]
			const arr2 = [1, null, 3]

			expect(() => hashObj(arr1)).not.toThrow()
			expect(hashObj(arr1)).toBe(hashObj(arr2))
		})
	})

	describe('edge cases', () => {
		test('empty object should produce consistent hash', () => {
			expect(hashObj({})).toBe(hashObj({}))
		})

		test('object with empty string key should work', () => {
			const obj = { '': 'value' }
			expect(() => hashObj(obj)).not.toThrow()
			expect(hashObj(obj)).toBe(hashObj({ '': 'value' }))
		})

		test('object with numeric string keys should be stable', () => {
			const obj1 = { '1': 'a', '2': 'b' }
			const obj2 = { '2': 'b', '1': 'a' }

			expect(hashObj(obj1)).toBe(hashObj(obj2))
		})

		test('objects with mixed types should work', () => {
			const obj = {
				string: 'value',
				number: 42,
				boolean: true,
				null: null,
				undefined: undefined,
				nested: { a: 1 },
				array: [1, 2, 3],
			}

			expect(() => hashObj(obj)).not.toThrow()
			expect(hashObj(obj)).toBe(hashObj(obj))
		})
	})

	describe('consistency with simple values', () => {
		test('string should be consistent', () => {
			const str = 'test'
			const hash1 = hashObj(str)
			const hash2 = hashObj(str)
			expect(hash1).toBe(hash2)
		})

		test('number zero should be different from empty string', () => {
			expect(hashObj(0)).not.toBe(hashObj(''))
		})

		test('false should be different from 0', () => {
			// This might fail - need to check if conversion is correct
			expect(hashObj(false)).not.toBe(hashObj(0))
		})
	})

	describe('undefined property equivalence', () => {
		test('object with undefined property should equal empty object', () => {
			const obj1 = { a: undefined }
			const obj2 = {}

			expect(hashObj(obj1)).toBe(hashObj(obj2))
		})

		test('multiple undefined properties should equal empty object', () => {
			const obj1 = { a: undefined, b: undefined }
			const obj2 = {}

			expect(hashObj(obj1)).toBe(hashObj(obj2))
		})

		test('mixed undefined and defined properties', () => {
			const obj1 = { a: 1, b: undefined, c: 2 }
			const obj2 = { a: 1, c: 2 }

			expect(hashObj(obj1)).toBe(hashObj(obj2))
		})

		test('nested objects with undefined properties', () => {
			const obj1 = { a: 1, b: { c: undefined } }
			const obj2 = { a: 1, b: {} }

			expect(hashObj(obj1)).toBe(hashObj(obj2))
		})
	})
})
