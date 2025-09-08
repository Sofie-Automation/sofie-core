import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { IngestPartModel, IngestPartModelReadonly } from './IngestPartModel.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'

export interface IngestSegmentModelReadonly {
	/**
	 * The Segment properties
	 */
	readonly segment: ReadonlyDeep<DBSegment>

	/**
	 * All the Parts in the Segment
	 * Sorted by their rank
	 */
	readonly parts: IngestPartModelReadonly[]

	/**
	 * Get the internal `_id` of a Part from the `externalId`
	 * @param externalId External id of the Part
	 */
	getPartIdFromExternalId(externalId: string): PartId

	/**
	 * Get a Part which belongs to this Segment
	 * @param id Id of the Part
	 */
	getPart(id: PartId): IngestPartModelReadonly | undefined

	/**
	 * Get all the PartIds in this Segment
	 * Sorted by the Part ranks
	 */
	getPartIds(): PartId[]
}

/**
 * Wrap a Segment and its Parts in a view for Ingest operations
 */
export interface IngestSegmentModel extends IngestSegmentModelReadonly {
	/**
	 * All the Parts in the Segment
	 * Sorted by their rank
	 */
	readonly parts: IngestPartModel[]

	/**
	 * Get a Part which belongs to this Segment
	 * @param id Id of the Part
	 */
	getPart(id: PartId): IngestPartModel | undefined

	/**
	 * Set the rank of this Segment
	 * @param rank New rank
	 */
	setRank(rank: number): boolean

	/**
	 * Mark this Segment as being orphaned
	 * @param orphaned New orphaned state
	 */
	setOrphaned(orphaned: SegmentOrphanedReason | undefined): void

	/**
	 * Mark this Segment as being hidden
	 * @param hidden New hidden state
	 */
	setHidden(hidden: boolean): void

	/**
	 * Remove all the Parts in this Segment
	 */
	removeAllParts(): PartId[]

	/**
	 * Replace or insert a Part into this Segment
	 * @param part New part data
	 * @param pieces Pieces to add to the Part
	 * @param adLibPiece AdLib Pieces to add to the Part
	 * @param adLibActions AdLib Actions to add to the Part
	 */
	replacePart(
		part: IngestReplacePartType,
		pieces: Piece[],
		adLibPiece: AdLibPiece[],
		adLibActions: AdLibAction[]
	): IngestPartModel
}

export type IngestReplacePartType = Omit<DBPart, '_id' | 'rundownId' | 'segmentId' | 'expectedDurationWithTransition'>
