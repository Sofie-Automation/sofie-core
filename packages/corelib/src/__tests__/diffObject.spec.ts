import { protectString, ProtectedString } from '../protectedString.js'
import { diffObject } from '../diffObject.js'

interface Thing {
	_id: ProtectedString<'ThingId'>
	name: string
	rank: number
	group?: string
}

const id = (s: string) => protectString<Thing['_id']>(s)
const thing = (s: string, props: Partial<Thing> = {}): Thing => ({
	_id: id(s),
	name: props.name ?? s,
	rank: props.rank ?? 0,
	...props,
})

describe('diffObject', () => {
	test('no change returns null', () => {
		expect(diffObject(thing('a', { rank: 1 }), thing('a', { rank: 1 }))).toBeNull()
	})
	test('changed field is reported', () => {
		expect(diffObject(thing('a', { rank: 1 }), thing('a', { rank: 2 }))).toEqual({ rank: 2 })
	})
	test('removed field reported as undefined', () => {
		expect(diffObject(thing('a', { group: 'g' }), thing('a'))).toEqual({ group: undefined })
	})
	test('added field reported', () => {
		expect(diffObject(thing('a'), thing('a', { group: 'g' }))).toEqual({ group: 'g' })
	})
	test('deep equality via EJSON (no spurious change)', () => {
		const a = { _id: id('a'), name: 'a', rank: 0, nested: { x: [1, 2, 3] } } as any
		const b = { _id: id('a'), name: 'a', rank: 0, nested: { x: [1, 2, 3] } } as any
		expect(diffObject(a, b)).toBeNull()
	})
	test('only the changed fields appear', () => {
		const a = thing('a', { name: 'x', rank: 1, group: 'g' })
		const b = thing('a', { name: 'x', rank: 2, group: 'g' })
		expect(diffObject(a, b)).toEqual({ rank: 2 })
	})
})
