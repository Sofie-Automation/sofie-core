import { protectString, ProtectedString } from '../../protectedString.js'
import { MongoFieldSpecifier, MongoQuery } from '../../mongo.js'
import { ObserveView, ObserveViewShape, ObserveViewSink, fieldsFor } from '../observeView.js'
import type { ChangeStreamDocument } from 'mongodb'

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

type Transition =
	| { type: 'added'; id: string; doc: any }
	| { type: 'changed'; id: string; newDoc: any; oldDoc: any; fields: any }
	| { type: 'removed'; id: string; oldDoc: any }

function recordingSink(): { sink: ObserveViewSink<Thing>; transitions: Transition[] } {
	const transitions: Transition[] = []
	const sink: ObserveViewSink<Thing> = {
		added: (i, doc) => transitions.push({ type: 'added', id: i as any, doc }),
		changed: (i, newDoc, oldDoc, fields) =>
			transitions.push({ type: 'changed', id: i as any, newDoc, oldDoc, fields }),
		removed: (i, oldDoc) => transitions.push({ type: 'removed', id: i as any, oldDoc }),
	}
	return { sink, transitions }
}

const insertEv = (doc: Thing): ChangeStreamDocument<any> =>
	({ operationType: 'insert', documentKey: { _id: doc._id }, fullDocument: doc }) as any
const updateEv = (doc: Thing): ChangeStreamDocument<any> =>
	({ operationType: 'update', documentKey: { _id: doc._id }, fullDocument: doc }) as any
const replaceEv = (doc: Thing): ChangeStreamDocument<any> =>
	({ operationType: 'replace', documentKey: { _id: doc._id }, fullDocument: doc }) as any
const deleteEv = (docId: Thing['_id']): ChangeStreamDocument<any> =>
	({ operationType: 'delete', documentKey: { _id: docId } }) as any
const updateNullEv = (docId: Thing['_id']): ChangeStreamDocument<any> =>
	({ operationType: 'update', documentKey: { _id: docId }, fullDocument: null }) as any

function makeView(
	selector: MongoQuery<Thing> = {},
	projection?: MongoFieldSpecifier<Thing>,
	shape?: ObserveViewShape<Thing>
): { view: ObserveView<Thing>; transitions: Transition[] } {
	const { sink, transitions } = recordingSink()
	return { view: new ObserveView<Thing>(selector, projection, shape, sink), transitions }
}

describe('fieldsFor', () => {
	test('strips _id', () => {
		expect(fieldsFor({ _id: id('a'), name: 'x', rank: 2 })).toEqual({ name: 'x', rank: 2 })
	})
})

describe('ObserveView.applySnapshot', () => {
	test('initial snapshot emits added for each doc', () => {
		const { view, transitions } = makeView()
		view.applySnapshot([thing('a'), thing('b')])
		expect(transitions.map((t) => t.type)).toEqual(['added', 'added'])
		expect(view.publishedCount).toBe(2)
	})

	test('subsequent snapshot diffs added/changed/removed', () => {
		const { view, transitions } = makeView()
		view.applySnapshot([thing('a', { rank: 1 }), thing('b', { rank: 1 })])
		transitions.length = 0

		view.applySnapshot([thing('a', { rank: 1 }), thing('c', { rank: 1 }), { ...thing('b'), rank: 5 }])

		// a unchanged → nothing; b changed rank 1→5; c added; (nothing removed)
		const byType = transitions.reduce<Record<string, number>>((acc, t) => {
			acc[t.type] = (acc[t.type] ?? 0) + 1
			return acc
		}, {})
		expect(byType).toEqual({ changed: 1, added: 1 })
		const changed = transitions.find((t) => t.type === 'changed') as any
		expect(changed.id).toBe('b')
		expect(changed.fields).toEqual({ rank: 5 })
		expect(changed.oldDoc.rank).toBe(1)
	})

	test('removed when doc drops out of snapshot', () => {
		const { view, transitions } = makeView()
		view.applySnapshot([thing('a'), thing('b')])
		transitions.length = 0
		view.applySnapshot([thing('a')])
		expect(transitions).toHaveLength(1)
		expect(transitions[0]).toMatchObject({ type: 'removed', id: 'b' })
	})

	test('unchanged docs emit nothing', () => {
		const { view, transitions } = makeView()
		view.applySnapshot([thing('a', { rank: 3 })])
		transitions.length = 0
		view.applySnapshot([thing('a', { rank: 3 })])
		expect(transitions).toHaveLength(0)
	})

	test('projection applied so unrelated field changes do not emit', () => {
		const { view, transitions } = makeView({}, { _id: 1, name: 1 } as MongoFieldSpecifier<Thing>)
		view.applySnapshot([thing('a', { name: 'x', rank: 1 })])
		transitions.length = 0
		// rank changes but is not in the projection → no transition
		view.applySnapshot([thing('a', { name: 'x', rank: 999 })])
		expect(transitions).toHaveLength(0)
		// name changes → changed with only name in fields
		view.applySnapshot([thing('a', { name: 'y', rank: 999 })])
		expect(transitions).toHaveLength(1)
		expect((transitions[0] as any).fields).toEqual({ name: 'y' })
	})
})

describe('ObserveView.applyChange', () => {
	test('insert matching → added', () => {
		const { view, transitions } = makeView({ group: 'g' })
		view.applyChange(insertEv(thing('a', { group: 'g' })))
		expect(transitions).toHaveLength(1)
		expect(transitions[0].type).toBe('added')
	})

	test('insert not matching → nothing', () => {
		const { view, transitions } = makeView({ group: 'g' })
		view.applyChange(insertEv(thing('a', { group: 'other' })))
		expect(transitions).toHaveLength(0)
	})

	test('update with real field diff → changed', () => {
		const { view, transitions } = makeView()
		view.applyChange(insertEv(thing('a', { rank: 1 })))
		transitions.length = 0
		view.applyChange(updateEv(thing('a', { rank: 2 })))
		expect(transitions).toHaveLength(1)
		const t = transitions[0] as any
		expect(t.type).toBe('changed')
		expect(t.fields).toEqual({ rank: 2 })
		expect(t.oldDoc.rank).toBe(1)
		expect(t.newDoc.rank).toBe(2)
	})

	test('update with no real change → nothing', () => {
		const { view, transitions } = makeView()
		view.applyChange(insertEv(thing('a', { rank: 1 })))
		transitions.length = 0
		view.applyChange(updateEv(thing('a', { rank: 1 })))
		expect(transitions).toHaveLength(0)
	})

	test('document moving out of the selector window → removed', () => {
		const { view, transitions } = makeView({ group: 'g' })
		view.applyChange(insertEv(thing('a', { group: 'g' })))
		transitions.length = 0
		// now no longer matches the selector
		view.applyChange(updateEv(thing('a', { group: 'other' })))
		expect(transitions).toHaveLength(1)
		expect(transitions[0]).toMatchObject({ type: 'removed', id: 'a' })
	})

	test('document moving into the selector window → added', () => {
		const { view, transitions } = makeView({ group: 'g' })
		view.applyChange(insertEv(thing('a', { group: 'other' })))
		expect(transitions).toHaveLength(0)
		view.applyChange(updateEv(thing('a', { group: 'g' })))
		expect(transitions).toHaveLength(1)
		expect(transitions[0]).toMatchObject({ type: 'added', id: 'a' })
	})

	test('replace is treated like update', () => {
		const { view, transitions } = makeView()
		view.applyChange(insertEv(thing('a', { rank: 1 })))
		transitions.length = 0
		view.applyChange(replaceEv(thing('a', { rank: 9 })))
		expect((transitions[0] as any).fields).toEqual({ rank: 9 })
	})

	test('delete → removed', () => {
		const { view, transitions } = makeView()
		view.applyChange(insertEv(thing('a')))
		transitions.length = 0
		view.applyChange(deleteEv(id('a')))
		expect(transitions).toHaveLength(1)
		expect(transitions[0]).toMatchObject({ type: 'removed', id: 'a' })
	})

	test('delete of unknown doc → nothing', () => {
		const { view, transitions } = makeView()
		view.applyChange(deleteEv(id('nope')))
		expect(transitions).toHaveLength(0)
	})

	test('update with null fullDocument (gone) → removed', () => {
		const { view, transitions } = makeView()
		view.applyChange(insertEv(thing('a')))
		transitions.length = 0
		view.applyChange(updateNullEv(id('a')))
		expect(transitions).toHaveLength(1)
		expect(transitions[0]).toMatchObject({ type: 'removed', id: 'a' })
	})
})

describe('ObserveView windowing (sort/skip/limit)', () => {
	const publishedIds = (view: ObserveView<Thing>) => view.publishedEntries().map(([i]) => i as unknown as string)

	test('snapshot publishes only the first N, ordered by _id when no sort given', () => {
		// Feed in a deliberately unsorted order; the window must be _id-ascending and capped at the limit.
		const { view } = makeView({}, undefined, { limit: 2 })
		view.applySnapshot([thing('c'), thing('a'), thing('b')])
		expect(publishedIds(view)).toEqual(['a', 'b'])
		expect(view.publishedCount).toBe(2)
	})

	test('sort spec orders the window, with _id as a stable final tie-break', () => {
		const { view } = makeView({}, undefined, { sort: { rank: 1 }, limit: 2 })
		// b and c tie on rank → _id breaks the tie deterministically (b before c)
		view.applySnapshot([thing('a', { rank: 5 }), thing('c', { rank: 1 }), thing('b', { rank: 1 })])
		expect(publishedIds(view)).toEqual(['b', 'c'])
	})

	test('skip offsets the window', () => {
		const { view } = makeView({}, undefined, { skip: 1, limit: 2 })
		view.applySnapshot([thing('a'), thing('b'), thing('c'), thing('d')])
		expect(publishedIds(view)).toEqual(['b', 'c'])
	})

	test('windowed sort uses full docs even when the projection drops the sort field (snapshot)', () => {
		// Projection excludes `rank`, but the window is ordered by `rank`: ordering must use the unprojected
		// docs, otherwise the sort key is gone and the wrong docs end up in the window.
		const { view } = makeView({}, { name: 1 } as MongoFieldSpecifier<Thing>, { sort: { rank: 1 }, limit: 2 })
		view.applySnapshot([thing('a', { rank: 3 }), thing('b', { rank: 1 }), thing('c', { rank: 2 })])
		// By rank asc the first two are b(1), c(2) — NOT the _id-order a,b you'd get if rank were projected away.
		expect(publishedIds(view)).toEqual(['b', 'c'])
		// Published docs are still projected (no `rank`).
		expect(view.publishedEntries().map(([, d]) => d)).toEqual([
			{ _id: id('b'), name: 'b' },
			{ _id: id('c'), name: 'c' },
		])
	})

	test('windowed sort uses full docs even when the projection drops the sort field (change)', () => {
		const { view } = makeView({}, { name: 1 } as MongoFieldSpecifier<Thing>, { sort: { rank: 1 }, limit: 2 })
		view.applySnapshot([thing('a', { rank: 3 }), thing('b', { rank: 2 })])
		expect(publishedIds(view)).toEqual(['b', 'a'])
		// A new doc with a lower rank must enter the window ahead of the others, proving rank survives to the sort.
		view.applyChange(insertEv(thing('c', { rank: 1 })))
		expect(publishedIds(view)).toEqual(['c', 'b'])
	})

	test('inserting inside the window evicts the boundary doc (added + removed)', () => {
		const { view, transitions } = makeView({}, undefined, { limit: 2 })
		view.applySnapshot([thing('b'), thing('d')])
		expect(publishedIds(view)).toEqual(['b', 'd'])
		transitions.length = 0

		// 'a' sorts before both → enters the window, pushing 'd' (the boundary) out
		view.applyChange(insertEv(thing('a')))
		expect(publishedIds(view)).toEqual(['a', 'b'])
		const byType = transitions.map((t) => `${t.type}:${t.id}`)
		expect(byType).toContain('added:a')
		expect(byType).toContain('removed:d')
		expect(transitions).toHaveLength(2)
	})

	test('inserting outside the window emits nothing', () => {
		const { view, transitions } = makeView({}, undefined, { limit: 2 })
		view.applySnapshot([thing('a'), thing('b')])
		transitions.length = 0
		// 'z' sorts after the window → not published
		view.applyChange(insertEv(thing('z')))
		expect(publishedIds(view)).toEqual(['a', 'b'])
		expect(transitions).toHaveLength(0)
	})

	test('removing a windowed doc backfills the next matching doc (removed + added)', () => {
		const { view, transitions } = makeView({}, undefined, { limit: 2 })
		view.applySnapshot([thing('a'), thing('b'), thing('c')])
		expect(publishedIds(view)).toEqual(['a', 'b'])
		transitions.length = 0

		view.applyChange(deleteEv(id('a')))
		expect(publishedIds(view)).toEqual(['b', 'c'])
		const byType = transitions.map((t) => `${t.type}:${t.id}`)
		expect(byType).toContain('removed:a')
		expect(byType).toContain('added:c')
		expect(transitions).toHaveLength(2)
	})

	test('change to a windowed doc still emits changed', () => {
		const { view, transitions } = makeView({}, undefined, { limit: 2 })
		view.applySnapshot([thing('a', { rank: 1 }), thing('b'), thing('c')])
		transitions.length = 0
		view.applyChange(updateEv(thing('a', { rank: 9 })))
		expect(transitions).toHaveLength(1)
		expect(transitions[0]).toMatchObject({ type: 'changed', id: 'a', fields: { rank: 9 } })
	})

	test('change to an out-of-window doc emits nothing', () => {
		const { view, transitions } = makeView({}, undefined, { limit: 2 })
		view.applySnapshot([thing('a'), thing('b'), thing('c', { rank: 1 })])
		transitions.length = 0
		view.applyChange(updateEv(thing('c', { rank: 9 })))
		expect(transitions).toHaveLength(0)
	})

	test('window order is independent of snapshot input order (resync stability)', () => {
		const { view } = makeView({}, undefined, { limit: 3 })
		view.applySnapshot([thing('a'), thing('b'), thing('c'), thing('d')])
		expect(publishedIds(view)).toEqual(['a', 'b', 'c'])
		// A resync delivering the same docs in a different order must not change the published window.
		view.applySnapshot([thing('d'), thing('c'), thing('b'), thing('a')])
		expect(publishedIds(view)).toEqual(['a', 'b', 'c'])
	})
})
