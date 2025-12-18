import { equalSets, equivalentArrays } from '../lib.js'

test('equalSets', () => {
	expect(equalSets(new Set(['a', 'b', 'c']), new Set(['c', 'b', 'a']))).toBe(true)
	expect(equalSets(new Set(['a', 'b', 'c']), new Set(['d', 'b', 'a']))).toBe(false)
})
test('equivalentArrays', () => {
	expect(equivalentArrays(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true)
	expect(equivalentArrays(['a', 'b', 'c'], ['b', 'g', 'a'])).toBe(false)
})
