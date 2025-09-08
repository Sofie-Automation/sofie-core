import { literal } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import { AnyBulkWriteOperation } from 'mongodb'
import { DocumentChangeTracker } from '../DocumentChangeTracker.js'
import { DocumentChanges } from '../utils.js'

interface Doc {
	_id: ProtectedString<any>
}

describe('DocumentChangeTracker', () => {
	const docOne: Doc = { _id: protectString('one') }
	const docTwo: Doc = { _id: protectString('two') }
	const docThree: Doc = { _id: protectString('three') }
	const docFour: Doc = { _id: protectString('four') }

	function createReplaceOp(doc: { _id: ProtectedString<any> }): AnyBulkWriteOperation {
		return {
			replaceOne: {
				filter: { _id: doc._id },
				replacement: doc,
				upsert: true,
			},
		}
	}
	function createDeleteOp(ids: ProtectedString<any>[]): AnyBulkWriteOperation {
		return {
			deleteMany: {
				filter: {
					_id: { $in: ids as any },
				},
			},
		}
	}

	test('documents with no changes', () => {
		const tracker = new DocumentChangeTracker()

		tracker.addDocument(docOne, false)
		tracker.addDocument(docTwo, false)

		expect(tracker.generateWriteOps()).toHaveLength(0)
	})
	test('documents with basic changes', () => {
		const tracker = new DocumentChangeTracker()

		tracker.addDocument(docOne, false)
		tracker.addDocument(docTwo, false)
		tracker.addDocument(docThree, true)

		tracker.deleteDocument(docFour._id)

		expect(tracker.generateWriteOps()).toEqual(
			literal<AnyBulkWriteOperation[]>([createReplaceOp(docThree), createDeleteOp([docFour._id])])
		)
	})

	test('documents with conflicting changes', () => {
		const tracker = new DocumentChangeTracker()

		// Delete then add with no changes
		tracker.deleteDocument(docOne._id)
		tracker.addDocument(docOne, false)

		// Delete then add with changes
		tracker.deleteDocument(docTwo._id)
		tracker.addDocument(docTwo, true)

		// Just delete
		tracker.deleteDocument(docFour._id)

		expect(tracker.generateWriteOps()).toEqual(
			literal<AnyBulkWriteOperation[]>([createReplaceOp(docTwo), createDeleteOp([docFour._id])])
		)
	})

	test('documents added multiple times', () => {
		const tracker = new DocumentChangeTracker()

		// Add twice
		tracker.addDocument(docOne, false)
		tracker.addDocument(docOne, true)

		tracker.addDocument(docTwo, false)
		tracker.addDocument(docTwo, false)

		tracker.addDocument(docThree, true)
		tracker.addDocument(docThree, false)

		expect(tracker.generateWriteOps()).toEqual(
			literal<AnyBulkWriteOperation[]>([createReplaceOp(docOne), createReplaceOp(docThree)])
		)
	})

	test('bulk changes doing nothing', () => {
		const tracker = new DocumentChangeTracker()

		const changes: DocumentChanges<Doc> = {
			currentIds: [],
			deletedIds: [],
			changedDocuments: [],
		}

		tracker.addChanges(changes, false)

		expect(tracker.generateWriteOps()).toHaveLength(0)
	})

	test('bulk changes no changes', () => {
		const tracker = new DocumentChangeTracker()

		const changes: DocumentChanges<Doc> = {
			currentIds: [docOne._id, docTwo._id],
			deletedIds: [],
			changedDocuments: [],
		}

		tracker.addChanges(changes, false)

		expect(tracker.generateWriteOps()).toHaveLength(0)
	})

	test('bulk changes with changes', () => {
		const tracker = new DocumentChangeTracker()

		const changes: DocumentChanges<Doc> = {
			currentIds: [docOne._id, docTwo._id],
			deletedIds: [],
			changedDocuments: [docTwo],
		}

		tracker.addChanges(changes, false)

		expect(tracker.generateWriteOps()).toEqual(literal<AnyBulkWriteOperation[]>([createReplaceOp(docTwo)]))
	})

	test('bulk changes with deletion', () => {
		const tracker = new DocumentChangeTracker()

		const changes: DocumentChanges<Doc> = {
			currentIds: [],
			deletedIds: [docTwo._id],
			changedDocuments: [],
		}

		tracker.addChanges(changes, false)

		expect(tracker.generateWriteOps()).toEqual(literal<AnyBulkWriteOperation[]>([createDeleteOp([docTwo._id])]))
	})

	test('bulk changes with many', () => {
		const tracker = new DocumentChangeTracker()

		const changes: DocumentChanges<Doc> = {
			currentIds: [docOne._id, docTwo._id, docThree._id, docFour._id],
			deletedIds: [protectString('first'), protectString('another')],
			changedDocuments: [docOne, docTwo],
		}

		tracker.addChanges(changes, false)

		expect(tracker.generateWriteOps()).toEqual(
			literal<AnyBulkWriteOperation[]>([
				createReplaceOp(docOne),
				createReplaceOp(docTwo),
				createDeleteOp([protectString('first'), protectString('another')]),
			])
		)
	})

	test('bulk changes multiple groups', () => {
		const tracker = new DocumentChangeTracker()

		const changes1: DocumentChanges<Doc> = {
			currentIds: [docOne._id, docTwo._id],
			deletedIds: [protectString('another')],
			changedDocuments: [docOne],
		}

		const changes2: DocumentChanges<Doc> = {
			currentIds: [docThree._id, docFour._id],
			deletedIds: [protectString('first'), docTwo._id], // Deletion of docTwo is overruled by it being added elsewhere
			changedDocuments: [docThree],
		}

		tracker.addChanges(changes1, false)
		tracker.addChanges(changes2, false)

		expect(tracker.generateWriteOps()).toEqual(
			literal<AnyBulkWriteOperation[]>([
				createReplaceOp(docOne),
				createReplaceOp(docThree),
				createDeleteOp([protectString('another'), protectString('first')]),
			])
		)
	})

	test('bulk changes deleteParent', () => {
		const tracker = new DocumentChangeTracker()

		const changes: DocumentChanges<Doc> = {
			currentIds: [docOne._id, docTwo._id, docThree._id, docFour._id],
			deletedIds: [protectString('first')],
			changedDocuments: [docOne, docTwo],
		}

		tracker.addChanges(changes, true)

		expect(tracker.generateWriteOps()).toEqual(
			literal<AnyBulkWriteOperation[]>([
				createDeleteOp([protectString('first'), docOne._id, docTwo._id, docThree._id, docFour._id]),
			])
		)
	})
})
