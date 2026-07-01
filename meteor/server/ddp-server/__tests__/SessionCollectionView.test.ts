import { SessionCollectionView, SessionCallbacks } from '../SessionCollectionView'

/** Records the (collection, id, fields) emitted to the client so tests can assert the merged output. */
function recorder() {
	const calls: Array<{ type: 'added' | 'changed' | 'removed'; id: string; fields?: Record<string, any> }> = []
	const callbacks: SessionCallbacks = {
		added: (_c, id, fields) => calls.push({ type: 'added', id, fields }),
		changed: (_c, id, fields) => calls.push({ type: 'changed', id, fields }),
		removed: (_c, id) => calls.push({ type: 'removed', id }),
	}
	return { calls, callbacks }
}

describe('SessionCollectionView (merge box)', () => {
	test('a single subscription added/changed/removed passes straight through', () => {
		const { calls, callbacks } = recorder()
		const view = new SessionCollectionView('C', callbacks)

		view.added('subA', 'x', { a: 1, b: 2 })
		view.changed('subA', 'x', { a: 5 })
		view.removed('subA', 'x')

		expect(calls).toEqual([
			{ type: 'added', id: 'x', fields: { a: 1, b: 2 } },
			{ type: 'changed', id: 'x', fields: { a: 5 } },
			{ type: 'removed', id: 'x' },
		])
		expect(view.isEmpty()).toBe(true)
	})

	test('two subscriptions on the same document produce a single added (the second is a no-op changed)', () => {
		const { calls, callbacks } = recorder()
		const view = new SessionCollectionView('C', callbacks)

		view.added('subA', 'x', { a: 1 })
		view.added('subB', 'x', { a: 1 })

		expect(calls).toEqual([
			{ type: 'added', id: 'x', fields: { a: 1 } },
			// subB doesn't change the visible (top-precedence) value, so it emits an empty changed
			{ type: 'changed', id: 'x', fields: {} },
		])
	})

	test('a change from a non-top subscription is not visible to the client', () => {
		const { calls, callbacks } = recorder()
		const view = new SessionCollectionView('C', callbacks)

		view.added('subA', 'x', { a: 1 }) // subA is top precedence for `a`
		view.added('subB', 'x', { a: 2 }) // subB is below subA
		calls.length = 0

		view.changed('subB', 'x', { a: 99 }) // changing the hidden value...
		expect(calls).toEqual([{ type: 'changed', id: 'x', fields: {} }]) // ...is not visible

		calls.length = 0
		view.changed('subA', 'x', { a: 7 }) // changing the top value...
		expect(calls).toEqual([{ type: 'changed', id: 'x', fields: { a: 7 } }]) // ...is visible
	})

	test('when the top subscription clears a field, the value falls back to the next subscription', () => {
		const { calls, callbacks } = recorder()
		const view = new SessionCollectionView('C', callbacks)

		view.added('subA', 'x', { a: 1, b: 2 }) // subA contributes a and b
		view.added('subB', 'x', { a: 9 }) // subB also contributes a (hidden under subA)
		calls.length = 0

		// subA unsubscribes: its fields are cleared. `a` must fall back to subB's value; `b` is gone.
		view.removed('subA', 'x')

		expect(calls).toEqual([{ type: 'changed', id: 'x', fields: { a: 9, b: undefined } }])
		expect(view.isEmpty()).toBe(false) // subB still has it
	})

	test('a document shared by two subscriptions is only removed once the last subscription leaves', () => {
		const { calls, callbacks } = recorder()
		const view = new SessionCollectionView('C', callbacks)

		view.added('subA', 'x', { a: 1 })
		view.added('subB', 'x', { a: 1 })
		calls.length = 0

		view.removed('subA', 'x') // still in subB -> a `changed` (no fields actually change here), not removed
		expect(calls.some((c) => c.type === 'removed')).toBe(false)

		view.removed('subB', 'x') // last one out -> removed
		expect(calls[calls.length - 1]).toEqual({ type: 'removed', id: 'x' })
		expect(view.isEmpty()).toBe(true)
	})

	test('clearing a field that was never set is a no-op (no throw)', () => {
		const { calls, callbacks } = recorder()
		const view = new SessionCollectionView('C', callbacks)

		view.added('subA', 'x', { a: 1 })
		calls.length = 0

		expect(() => view.changed('subA', 'x', { neverSet: undefined })).not.toThrow()
		expect(calls).toEqual([{ type: 'changed', id: 'x', fields: {} }])
	})

	test('removing a document that is not in the view is a no-op', () => {
		const { calls, callbacks } = recorder()
		const view = new SessionCollectionView('C', callbacks)

		expect(() => view.removed('subA', 'ghost')).not.toThrow()
		expect(calls).toHaveLength(0)
	})
})
