import { protectString, type ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { OptimisedObserverGenericArray } from '../optimizedObserverArray'

interface Doc {
	_id: ProtectedString<'Doc'>
	value?: number
	nested?: { a: number; b?: number }
}

const ID = protectString<ProtectedString<'Doc'>>('doc1')

describe('OptimisedObserverGenericArray', () => {
	it('reports no change for a field that is undefined, against a copy that has left it out', () => {
		const converter = new OptimisedObserverGenericArray<Doc>()
		converter.updatedDocs([{ _id: ID, value: undefined, nested: { a: 1, b: undefined } }])

		const changes = converter.updatedDocs([{ _id: ID, value: undefined, nested: { a: 1, b: undefined } }])

		expect(changes).toEqual({ added: [], changed: [], removed: [] })
	})

	it('reports a field becoming undefined as removed', () => {
		const converter = new OptimisedObserverGenericArray<Doc>()
		converter.updatedDocs([{ _id: ID, value: 1 }])

		const changes = converter.updatedDocs([{ _id: ID, value: undefined }])

		expect(changes.changed).toEqual([{ _id: ID, value: undefined }])
		expect(Object.keys(converter.getDocs()[0])).toEqual(['_id'])
	})

	it('adds and keeps a document without its undefined fields', () => {
		const converter = new OptimisedObserverGenericArray<Doc>()

		const changes = converter.updatedDocs([{ _id: ID, value: undefined, nested: { a: 1, b: undefined } }])

		expect(changes.added).toHaveLength(1)
		expect(Object.keys(changes.added[0])).toEqual(['_id', 'nested'])
		expect(Object.keys(converter.getDocs()[0].nested ?? {})).toEqual(['a'])
	})

	it('does not change the documents it is given', () => {
		const converter = new OptimisedObserverGenericArray<Doc>()
		const doc: Doc = { _id: ID, value: undefined }

		converter.updatedDocs([doc])

		expect(Object.keys(doc)).toEqual(['_id', 'value'])
	})
})
