import { protectString, ProtectedString } from '../../protectedString.js'
import { MongoFieldSpecifier } from '../../mongo.js'
import { ObserveCallbacks, ObserveChangesCallbacks } from '../../mongo.js'
import { InMemoryMongoCollection } from '../InMemoryMongoCollection.js'

interface Thing {
	_id: ProtectedString<'ThingId'>
	name: string
	rank: number
	group?: string
	tags?: string[]
}

const id = (s: string) => protectString<Thing['_id']>(s)
const thing = (s: string, props: Partial<Thing> = {}): Thing => ({
	_id: id(s),
	name: props.name ?? s,
	rank: props.rank ?? 0,
	...props,
})

function makeCollection(): InMemoryMongoCollection<Thing> {
	return new InMemoryMongoCollection<Thing>('things')
}

describe('CRUD basics', () => {
	test('insert generates an id when absent', () => {
		const c = new InMemoryMongoCollection<Thing>('things', { idGenerator: () => 'GEN' })
		const insertedId = c.insert({ name: 'a', rank: 1 } as Thing)
		expect(insertedId).toBe('GEN')
		expect(c.findOne('GEN' as any)?.name).toBe('a')
	})

	test('insert throws on duplicate key', () => {
		const c = makeCollection()
		c.insert(thing('a'))
		expect(() => c.insert(thing('a'))).toThrow(/Duplicate key/)
	})

	test('find by {} returns all', () => {
		const c = makeCollection()
		c.insert(thing('a'))
		c.insert(thing('b'))
		expect(c.findFetch().map((d) => d._id)).toEqual([id('a'), id('b')])
	})

	test('find by _id string', () => {
		const c = makeCollection()
		c.insert(thing('a'))
		c.insert(thing('b'))
		expect(c.findFetch('b' as any).map((d) => d._id)).toEqual([id('b')])
	})

	test('find by _id object', () => {
		const c = makeCollection()
		c.insert(thing('a'))
		c.insert(thing('b'))
		expect(c.findFetch({ _id: id('a') }).map((d) => d._id)).toEqual([id('a')])
	})

	test('find by field', () => {
		const c = makeCollection()
		c.insert(thing('a', { group: 'g1' }))
		c.insert(thing('b', { group: 'g2' }))
		c.insert(thing('c', { group: 'g1' }))
		expect(c.findFetch({ group: 'g1' }).map((d) => d._id)).toEqual([id('a'), id('c')])
	})

	test('sort / skip / limit', () => {
		const c = makeCollection()
		c.insert(thing('a', { rank: 3 }))
		c.insert(thing('b', { rank: 1 }))
		c.insert(thing('c', { rank: 2 }))
		expect(c.findFetch({}, { sort: { rank: 1 } }).map((d) => d._id)).toEqual([id('b'), id('c'), id('a')])
		expect(c.findFetch({}, { sort: { rank: 1 }, limit: 2 }).map((d) => d._id)).toEqual([id('b'), id('c')])
		expect(c.findFetch({}, { sort: { rank: 1 }, skip: 1 }).map((d) => d._id)).toEqual([id('c'), id('a')])
	})

	test('projection', () => {
		const c = makeCollection()
		c.insert(thing('a', { name: 'x', rank: 7 }))
		const [doc] = c.findFetch({}, { projection: { name: 1 } as MongoFieldSpecifier<Thing> })
		expect(doc).toEqual({ _id: id('a'), name: 'x' })
	})

	test('fields + projection together throws', () => {
		const c = makeCollection()
		c.insert(thing('a'))
		expect(() => c.findFetch({}, { fields: { name: 1 }, projection: { name: 1 } } as any)).toThrow(/Only one of/)
	})

	test('findOne returns a single doc or undefined', () => {
		const c = makeCollection()
		c.insert(thing('a'))
		expect(c.findOne('a' as any)?._id).toEqual(id('a'))
		expect(c.findOne('missing' as any)).toBeUndefined()
	})

	test('count', () => {
		const c = makeCollection()
		c.insert(thing('a', { group: 'g' }))
		c.insert(thing('b', { group: 'g' }))
		c.insert(thing('c'))
		expect(c.count()).toBe(3)
		expect(c.count({ group: 'g' })).toBe(2)
	})
})

describe('update', () => {
	test('single vs multi', () => {
		const c = makeCollection()
		c.insert(thing('a', { group: 'g' }))
		c.insert(thing('b', { group: 'g' }))

		expect(c.update({ group: 'g' }, { $set: { rank: 1 } })).toBe(1)
		expect(c.findFetch({ rank: 1 })).toHaveLength(1)

		expect(c.update({ group: 'g' }, { $set: { rank: 5 } }, { multi: true })).toBe(2)
		expect(c.findFetch({ rank: 5 })).toHaveLength(2)
	})

	test('modifiers: $set/$unset/$push/$pull/$addToSet/$rename', () => {
		const c = makeCollection()
		c.insert(thing('a', { rank: 1, group: 'g', tags: ['x'] }))

		c.update('a' as any, { $set: { rank: 2 } })
		expect(c.findOne('a' as any)?.rank).toBe(2)

		c.update('a' as any, { $unset: { group: 1 } as any })
		expect(c.findOne('a' as any)?.group).toBeUndefined()

		c.update('a' as any, { $push: { tags: 'y' } as any })
		expect(c.findOne('a' as any)?.tags).toEqual(['x', 'y'])

		c.update('a' as any, { $pull: { tags: 'x' } as any })
		expect(c.findOne('a' as any)?.tags).toEqual(['y'])

		c.update('a' as any, { $addToSet: { tags: 'y' } as any })
		expect(c.findOne('a' as any)?.tags).toEqual(['y'])

		c.update('a' as any, { $rename: { name: 'label' } })
		expect((c.findOne('a' as any) as any)?.label).toBe('a')
	})
})

describe('replace', () => {
	test('replaces an existing doc', () => {
		const c = makeCollection()
		c.insert(thing('a', { name: 'x', rank: 1, group: 'g' }))
		const replaced = c.replace({ _id: id('a'), name: 'y', rank: 2 } as Thing)
		expect(replaced).toBe(true)
		const doc = c.findOne('a' as any)
		expect(doc).toEqual({ _id: id('a'), name: 'y', rank: 2 })
	})

	test('missing  → inserts', () => {
		const c = makeCollection()
		expect(c.replace({ _id: id('a'), name: 'y', rank: 2 } as Thing)).toBe(false)
		expect(c.findOne('a' as any)?.name).toBe('y')
	})
})

describe('remove', () => {
	test('single / multi / none', () => {
		const c = makeCollection()
		c.insert(thing('a', { group: 'g' }))
		c.insert(thing('b', { group: 'g' }))
		c.insert(thing('c'))

		expect(c.remove('c' as any)).toBe(1)
		expect(c.remove({ group: 'g' })).toBe(2)
		expect(c.remove('missing' as any)).toBe(0)
		expect(c.findFetch()).toHaveLength(0)
	})
})

describe('bulkWrite', () => {
	test('all arms', () => {
		const c = makeCollection()
		c.insert(thing('keep', { rank: 0 }))
		c.insert(thing('del1'))
		c.insert(thing('del2', { group: 'g' }))
		c.insert(thing('upd', { rank: 1 }))
		c.insert(thing('repl', { name: 'old', rank: 1 }))

		c.bulkWrite([
			{ insertOne: { document: thing('ins') } as any },
			{ updateOne: { filter: { _id: id('upd') }, update: { $set: { rank: 10 } } } as any },
			{ updateMany: { filter: { rank: 0 }, update: { $set: { name: 'zero' } } } as any },
			{ deleteOne: { filter: { _id: id('del1') } } as any },
			{ deleteMany: { filter: { group: 'g' } } as any },
			{
				replaceOne: {
					filter: { _id: id('repl') },
					replacement: { _id: id('repl'), name: 'new', rank: 2 },
				} as any,
			},
		])

		expect(c.findOne('ins' as any)).toBeTruthy()
		expect(c.findOne('upd' as any)?.rank).toBe(10)
		expect(c.findOne('keep' as any)?.name).toBe('zero')
		expect(c.findOne('del1' as any)).toBeUndefined()
		expect(c.findOne('del2' as any)).toBeUndefined()
		expect(c.findOne('repl' as any)).toEqual({ _id: id('repl'), name: 'new', rank: 2 })
	})
})

describe('isolation / cloning', () => {
	test('mutating a returned doc does not affect the store', () => {
		const c = makeCollection()
		c.insert(thing('a', { tags: ['x'] }))
		const doc = c.findOne('a' as any)
		if (!doc) throw new Error('expected doc')
		doc.name = 'mutated'
		;(doc.tags as string[]).push('y')
		expect(c.findOne('a' as any)?.name).toBe('a')
		expect(c.findOne('a' as any)?.tags).toEqual(['x'])
	})

	test('mutating the inserted source object does not affect the store', () => {
		const c = makeCollection()
		const source = thing('a', { tags: ['x'] })
		c.insert(source)
		source.name = 'mutated'
		;(source.tags as string[]).push('y')
		expect(c.findOne('a' as any)?.name).toBe('a')
		expect(c.findOne('a' as any)?.tags).toEqual(['x'])
	})
})

describe('mockSetData / clear', () => {
	test('mockSetData (array) bulk-replaces and fires no events', () => {
		const c = makeCollection()
		const added = jest.fn()
		c.observe({ added })
		added.mockClear()

		c.mockSetData([thing('a'), thing('b')])
		expect(c.findFetch()).toHaveLength(2)
		expect(added).not.toHaveBeenCalled()
	})

	test('mockSetData (record) and clear', () => {
		const c = makeCollection()
		c.mockSetData({ a: thing('a'), b: thing('b') })
		expect(c.findFetch()).toHaveLength(2)
		c.clear()
		expect(c.findFetch()).toHaveLength(0)
	})
})

describe('onChange', () => {
	test('fires on writes, not on mockSetData/clear; stop() unsubscribes', () => {
		const c = makeCollection()
		const cb = jest.fn()
		const handle = c.onChange(cb)

		c.insert(thing('a'))
		expect(cb).toHaveBeenCalledTimes(1)

		c.update('a' as any, { $set: { rank: 2 } })
		c.remove('a' as any)
		expect(cb).toHaveBeenCalledTimes(3)

		cb.mockClear()
		c.mockSetData([thing('b')])
		c.clear()
		expect(cb).not.toHaveBeenCalled()

		handle.stop()
		c.insert(thing('d'))
		expect(cb).not.toHaveBeenCalled()
	})

	test('can be registered via constructor options', () => {
		const cb = jest.fn()
		const c = new InMemoryMongoCollection<Thing>('things', { onChange: cb })
		c.insert(thing('a'))
		expect(cb).toHaveBeenCalledTimes(1)
	})
})

describe('observe (full document)', () => {
	function spyCallbacks(): ObserveCallbacks<Thing> & {
		added: jest.Mock
		changed: jest.Mock
		removed: jest.Mock
	} {
		return { added: jest.fn(), changed: jest.fn(), removed: jest.fn() } as any
	}

	test('initial snapshot delivered as added', () => {
		const c = makeCollection()
		c.insert(thing('a'))
		c.insert(thing('b'))
		const cb = spyCallbacks()
		c.observe(cb)
		expect(cb.added).toHaveBeenCalledTimes(2)
	})

	test('synchronous added on insert', () => {
		const c = makeCollection()
		const cb = spyCallbacks()
		c.observe(cb)
		c.insert(thing('a', { name: 'x' }))
		expect(cb.added).toHaveBeenCalledTimes(1)
		expect(cb.added.mock.calls[0][0]).toMatchObject({ _id: id('a'), name: 'x' })
	})

	test('changed carries a correct oldDoc and a real new doc', () => {
		const c = makeCollection()
		c.insert(thing('a', { rank: 1 }))
		const cb = spyCallbacks()
		c.observe(cb)
		c.update('a' as any, { $set: { rank: 2 } })
		expect(cb.changed).toHaveBeenCalledTimes(1)
		const [newDoc, oldDoc] = cb.changed.mock.calls[0]
		expect(newDoc.rank).toBe(2)
		expect(oldDoc.rank).toBe(1)
	})

	test('no changed callback when the update is a no-op', () => {
		const c = makeCollection()
		c.insert(thing('a', { rank: 1 }))
		const cb = spyCallbacks()
		c.observe(cb)
		c.update('a' as any, { $set: { rank: 1 } })
		expect(cb.changed).not.toHaveBeenCalled()
	})

	test('removed on delete', () => {
		const c = makeCollection()
		c.insert(thing('a'))
		const cb = spyCallbacks()
		c.observe(cb)
		c.remove('a' as any)
		expect(cb.removed).toHaveBeenCalledTimes(1)
		expect(cb.removed.mock.calls[0][0]).toMatchObject({ _id: id('a') })
	})

	test('selector-window transitions: added/removed as a doc enters/leaves', () => {
		const c = makeCollection()
		const cb = spyCallbacks()
		c.observe(cb, { group: 'g' })

		c.insert(thing('a', { group: 'other' }))
		expect(cb.added).not.toHaveBeenCalled()

		c.update('a' as any, { $set: { group: 'g' } })
		expect(cb.added).toHaveBeenCalledTimes(1)

		c.update('a' as any, { $set: { group: 'other' } })
		expect(cb.removed).toHaveBeenCalledTimes(1)
	})

	test('delivered docs are isolated clones', () => {
		const c = makeCollection()
		const cb = spyCallbacks()
		c.observe(cb)
		c.insert(thing('a', { tags: ['x'] }))
		const delivered = cb.added.mock.calls[0][0]
		delivered.tags.push('y')
		expect(c.findOne('a' as any)?.tags).toEqual(['x'])
	})

	test('stop() unregisters the observer and stops callbacks', () => {
		const c = makeCollection()
		const cb = spyCallbacks()
		const handle = c.observe(cb)
		expect(c.observers).toHaveLength(1)
		handle.stop()
		expect(c.observers).toHaveLength(0)
		c.insert(thing('a'))
		expect(cb.added).not.toHaveBeenCalled()
	})

	test('observer entry exposes the raw callbacks + query', () => {
		const c = makeCollection()
		const cb = spyCallbacks()
		c.observe(cb, { group: 'g' })
		expect(c.observers[0].query).toEqual({ group: 'g' })
		expect(c.observers[0].callbacksObserve).toBe(cb)
		expect(c.observers[0].callbacksChanges).toBeUndefined()
	})
})

describe('observeChanges', () => {
	function spyCallbacks(): ObserveChangesCallbacks<Thing> & {
		added: jest.Mock
		changed: jest.Mock
		removed: jest.Mock
	} {
		return { added: jest.fn(), changed: jest.fn(), removed: jest.fn() } as any
	}

	test('added delivers id + fields (minus _id)', () => {
		const c = makeCollection()
		const cb = spyCallbacks()
		c.observeChanges(cb)
		c.insert(thing('a', { name: 'x', rank: 3 }))
		expect(cb.added).toHaveBeenCalledTimes(1)
		const [deliveredId, fields] = cb.added.mock.calls[0]
		expect(deliveredId).toEqual(id('a'))
		expect(fields).toEqual({ name: 'x', rank: 3 })
	})

	test('changed delivers only the changed fields', () => {
		const c = makeCollection()
		c.insert(thing('a', { rank: 1 }))
		const cb = spyCallbacks()
		c.observeChanges(cb)
		c.update('a' as any, { $set: { rank: 2 } })
		expect(cb.changed).toHaveBeenCalledWith(id('a'), { rank: 2 })
	})

	test('removed delivers the id', () => {
		const c = makeCollection()
		c.insert(thing('a'))
		const cb = spyCallbacks()
		c.observeChanges(cb)
		c.remove('a' as any)
		expect(cb.removed).toHaveBeenCalledWith(id('a'))
	})
})

describe('observerDeliveryScheduler', () => {
	test('feed-driven deliveries are routed through the scheduler', () => {
		const scheduled: Array<() => void> = []
		const c = new InMemoryMongoCollection<Thing>('things', {
			observerDeliveryScheduler: (fn) => scheduled.push(fn),
		})
		const added = jest.fn()
		c.observe({ added })

		c.insert(thing('a'))
		// Not delivered synchronously...
		expect(added).not.toHaveBeenCalled()
		// ...until the scheduled task runs
		scheduled.forEach((fn) => fn())
		expect(added).toHaveBeenCalledTimes(1)
	})
})
