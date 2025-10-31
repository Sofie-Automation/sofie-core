import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { PieceId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { JobContext } from '../../../jobs/index.js'
import { ExpectedPackagesStore } from './ExpectedPackagesStore.js'
import { IngestSegmentModelImpl } from './IngestSegmentModelImpl.js'
import { DocumentChangeTracker } from './DocumentChangeTracker.js'
import { logger } from '../../../logging.js'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'

export class SaveIngestModelHelper {
	#expectedPackages = new DocumentChangeTracker<ExpectedPackageDB>()
	#expectedPlayoutItems = new DocumentChangeTracker<ExpectedPlayoutItem>()

	#segments = new DocumentChangeTracker<DBSegment>()
	#parts = new DocumentChangeTracker<DBPart>()
	#pieces = new DocumentChangeTracker<Piece>()
	#adLibPieces = new DocumentChangeTracker<AdLibPiece>()
	#adLibActions = new DocumentChangeTracker<AdLibAction>()

	addExpectedPackagesStore(
		store: ExpectedPackagesStore<ExpectedPackageDB & { rundownId: RundownId }>,
		deleteAll?: boolean
	): void {
		this.#expectedPackages.addChanges(store.expectedPackagesChanges, deleteAll ?? false)
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
			expectedPackages: this.#expectedPackages.getDeletedIds(),
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
			context.directCollections.ExpectedPackages.bulkWrite(this.#expectedPackages.generateWriteOps()),
			context.directCollections.ExpectedPlayoutItems.bulkWrite(this.#expectedPlayoutItems.generateWriteOps()),

			context.directCollections.Segments.bulkWrite(this.#segments.generateWriteOps()),
			context.directCollections.Parts.bulkWrite(this.#parts.generateWriteOps()),
			context.directCollections.Pieces.bulkWrite(this.#pieces.generateWriteOps()),
			context.directCollections.AdLibPieces.bulkWrite(this.#adLibPieces.generateWriteOps()),
			context.directCollections.AdLibActions.bulkWrite(this.#adLibActions.generateWriteOps()),
		]
	}
}
