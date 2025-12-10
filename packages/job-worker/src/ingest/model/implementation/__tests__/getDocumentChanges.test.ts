import { ProtectedString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import { getDocumentChanges } from '../utils.js'

interface Doc {
	_id: ProtectedString<any>
}

describe('getDocumentChanges', () => {
	const docOne: Doc = { _id: protectString('one') }
	const docTwo: Doc = { _id: protectString('two') }
	const docThree: Doc = { _id: protectString('three') }
	const docFour: Doc = { _id: protectString('four') }

	const allDocs = [docOne, docTwo, docThree, docFour]

	test('no changes', () => {
		const changes = getDocumentChanges<Doc>(new Set(), allDocs)
		expect(changes.changedDocuments).toHaveLength(0)
		expect(changes.currentIds).toHaveLength(4)
		expect(changes.deletedIds).toHaveLength(0)
	})

	test('with changes', () => {
		const changes = getDocumentChanges<Doc>(new Set([docThree._id]), allDocs)
		expect(changes.changedDocuments).toHaveLength(1)
		expect(changes.currentIds).toHaveLength(4)
		expect(changes.deletedIds).toHaveLength(0)
	})

	test('with deletions', () => {
		const changes = getDocumentChanges<Doc>(new Set([protectString('another')]), allDocs)
		expect(changes.changedDocuments).toHaveLength(0)
		expect(changes.currentIds).toHaveLength(4)
		expect(changes.deletedIds).toHaveLength(1)
	})

	test('with deletions and no docs', () => {
		const changes = getDocumentChanges<Doc>(new Set([protectString('another')]), [])
		expect(changes.changedDocuments).toHaveLength(0)
		expect(changes.currentIds).toHaveLength(0)
		expect(changes.deletedIds).toHaveLength(1)
	})

	test('with deletions and changed docs', () => {
		const changes = getDocumentChanges<Doc>(new Set([protectString('another'), docTwo._id]), allDocs)
		expect(changes.changedDocuments).toHaveLength(1)
		expect(changes.currentIds).toHaveLength(4)
		expect(changes.deletedIds).toHaveLength(1)
	})
})
