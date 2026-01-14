import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import {
	ExpectedPackageDB,
	ExpectedPackageDBType,
	isPackageReferencedByPlayout,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { PieceId, ExpectedPackageId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { JobContext } from '../../../jobs/index.js'
import { ExpectedPackagesStore } from './ExpectedPackagesStore.js'
import { IngestSegmentModelImpl } from './IngestSegmentModelImpl.js'
import { DocumentChangeTracker } from './DocumentChangeTracker.js'
import { logger } from '../../../logging.js'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { IngestExpectedPackage } from '../IngestExpectedPackage.js'
import { AnyBulkWriteOperation } from 'mongodb'
import { normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'

export class SaveIngestModelHelper {
	readonly #rundownId: RundownId

	#expectedPackages: IngestExpectedPackage<any>[] = []
	#expectedPlayoutItems = new DocumentChangeTracker<ExpectedPlayoutItem>()

	#segments = new DocumentChangeTracker<DBSegment>()
	#parts = new DocumentChangeTracker<DBPart>()
	#pieces = new DocumentChangeTracker<Piece>()
	#adLibPieces = new DocumentChangeTracker<AdLibPiece>()
	#adLibActions = new DocumentChangeTracker<AdLibAction>()

	constructor(rundownId: RundownId) {
		this.#rundownId = rundownId
	}

	addExpectedPackagesStore<TPackageSource extends { fromPieceType: ExpectedPackageDBType }>(
		store: ExpectedPackagesStore<TPackageSource>,
		deleteAll?: boolean
	): void {
		if (!deleteAll) this.#expectedPackages.push(...store.expectedPackages)
		this.#expectedPlayoutItems.addChanges(store.expectedPlayoutItemsChanges, deleteAll ?? false)
	}
	addSegment(segment: IngestSegmentModelImpl, segmentIsDeleted: boolean): void {
		if (segmentIsDeleted) {
			this.#segments.deleteDocument(segment.segment._id)
		} else {
			this.#segments.addDocument(segment.segmentImpl, segment.segmentHasChanges)
		}

		for (const part of segment.partsImpl.values()) {
			const partIsDeleted = segmentIsDeleted || part.deleted
			if (partIsDeleted) {
				this.#parts.deleteDocument(part.partModel.part._id)
			} else {
				this.#parts.addDocument(part.partModel.partImpl, part.partModel.partHasChanges)
			}

			this.addExpectedPackagesStore(part.partModel.expectedPackagesStore, partIsDeleted)

			this.#pieces.addChanges(part.partModel.piecesChanges, partIsDeleted)
			this.#adLibPieces.addChanges(part.partModel.adLibPiecesChanges, partIsDeleted)
			this.#adLibActions.addChanges(part.partModel.adLibActionsChanges, partIsDeleted)
		}
	}

	addChangedPieces(pieces: ReadonlyArray<Piece>, changedPieceIds: Set<PieceId>): void {
		for (const piece of pieces) {
			this.#pieces.addDocument(piece, changedPieceIds.has(piece._id))
		}

		const currentPieceIds = new Set(pieces.map((p) => p._id))
		for (const changedPieceId of changedPieceIds) {
			if (!currentPieceIds.has(changedPieceId)) {
				this.#pieces.deleteDocument(changedPieceId)
			}
		}
	}

	commit(context: JobContext): Array<Promise<unknown>> {
		// Log deleted ids:
		const deletedIds: { [key: string]: ProtectedString<any>[] } = {
			expectedPlayoutItems: this.#expectedPlayoutItems.getDeletedIds(),
			segments: this.#segments.getDeletedIds(),
			parts: this.#parts.getDeletedIds(),
			pieces: this.#pieces.getDeletedIds(),
			adLibPieces: this.#adLibPieces.getDeletedIds(),
			adLibActions: this.#adLibActions.getDeletedIds(),
		}
		for (const [key, ids] of Object.entries<ProtectedString<any>[]>(deletedIds)) {
			if (ids.length > 0) {
				logger.debug(`Deleted ${key}: ${JSON.stringify(ids)} `)
			}
		}

		return [
			writeExpectedPackagesChangesForRundown(context, this.#rundownId, this.#expectedPackages),
			context.directCollections.ExpectedPlayoutItems.bulkWrite(this.#expectedPlayoutItems.generateWriteOps()),

			context.directCollections.Segments.bulkWrite(this.#segments.generateWriteOps()),
			context.directCollections.Parts.bulkWrite(this.#parts.generateWriteOps()),
			context.directCollections.Pieces.bulkWrite(this.#pieces.generateWriteOps()),
			context.directCollections.AdLibPieces.bulkWrite(this.#adLibPieces.generateWriteOps()),
			context.directCollections.AdLibActions.bulkWrite(this.#adLibActions.generateWriteOps()),
		]
	}
}

export async function writeExpectedPackagesChangesForRundown(
	context: JobContext,
	rundownId: RundownId | null,
	documentsToSave: IngestExpectedPackage<any>[]
): Promise<void> {
	const existingDocs = (await context.directCollections.ExpectedPackages.findFetch(
		{
			studioId: context.studioId,
			rundownId: rundownId,
			bucketId: null,
		},
		{
			projection: {
				_id: 1,
				playoutSources: 1, // This feels a bit excessive, but the whole object is needed for `isPackageReferencedByPlayout`
			},
		}
	)) as Pick<ExpectedPackageDB, '_id' | 'created' | 'playoutSources'>[]
	const existingDocsMap = normalizeArrayToMap(existingDocs, '_id')

	const packagesToSave = new Map<ExpectedPackageId, Omit<ExpectedPackageDB, 'playoutSources'>>()
	for (const doc of documentsToSave) {
		const partialDoc = packagesToSave.get(doc.packageId)

		if (partialDoc) {
			// Add the source to the existing document
			partialDoc.ingestSources.push(doc.source)

			// Maybe this should check for duplicates, but the point where these documents are generated should be handling that.
		} else {
			// Add a new document
			// Future: omit 'playoutSources from this doc
			packagesToSave.set(doc.packageId, {
				_id: doc.packageId,
				studioId: context.studioId,
				rundownId: rundownId,
				bucketId: null,
				created: Date.now(),
				package: doc.package,
				ingestSources: [doc.source],
			})
		}
	}

	// Generate any insert and update operations
	const ops: AnyBulkWriteOperation<ExpectedPackageDB>[] = []
	for (const doc of packagesToSave.values()) {
		const existingDoc = existingDocsMap.get(doc._id)
		if (!existingDoc) {
			// Insert this new document
			ops.push({
				insertOne: {
					document: {
						...doc,
						playoutSources: {
							pieceInstanceIds: [],
						},
					},
				},
			})
		} else {
			// Document already exists, perform an update to preserve other fields
			// Future: would it be beneficial to perform some diffing to only update the field if it has changed?
			ops.push({
				updateOne: {
					filter: { _id: doc._id },
					update: {
						// Update every field that we want to define
						$set: {
							ingestSources: doc.ingestSources,
						},
					},
				},
			})
		}
	}

	// Look over the existing documents, and see is no longer referenced
	const idsToDelete: ExpectedPackageId[] = []
	const idsToClearSources: ExpectedPackageId[] = []

	for (const doc of existingDocs) {
		// Skip if this document is in the list of documents to save
		if (packagesToSave.has(doc._id)) continue

		if (isPackageReferencedByPlayout(doc)) {
			idsToClearSources.push(doc._id)
		} else {
			idsToDelete.push(doc._id)
		}
	}

	if (idsToDelete.length > 0) {
		ops.push({
			deleteMany: {
				filter: { _id: { $in: idsToDelete as any } },
			},
		})
	}
	if (idsToClearSources.length > 0) {
		ops.push({
			updateMany: {
				filter: { _id: { $in: idsToClearSources as any } },
				update: {
					$set: {
						ingestSources: [],
					},
				},
			},
		})
	}

	if (ops.length > 0) await context.directCollections.ExpectedPackages.bulkWrite(ops)
}
