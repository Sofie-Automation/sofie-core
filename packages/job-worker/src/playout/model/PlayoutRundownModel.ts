import { PartId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ReadonlyDeep } from 'type-fest'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { PlayoutSegmentModel } from './PlayoutSegmentModel.js'

/**
 * Wrap a Rundown and its Segments in a readonly and simplified view for Playout operations
 */
export interface PlayoutRundownModel {
	/**
	 * The Rundown properties
	 */
	readonly rundown: ReadonlyDeep<DBRundown>
	/**
	 * All the Segments in the Rundown
	 * Sorted by their rank
	 */
	readonly segments: readonly PlayoutSegmentModel[]

	/**
	 * The RundownBaselineObjs for this Rundown
	 */
	readonly baselineObjects: ReadonlyDeep<RundownBaselineObj[]>

	/**
	 * Get a Segment which belongs to this Rundown
	 * @param id Id of the Segment
	 */
	getSegment(id: SegmentId): PlayoutSegmentModel | undefined

	/**
	 * Get all the SegmentIds in this Rundown
	 * Sorted by the Segment ranks
	 */
	getSegmentIds(): SegmentId[]

	/**
	 * Get all the PartIds in this Rundown
	 * Sorted by the Segment and Part ranks
	 */
	getAllPartIds(): PartId[]

	/**
	 * All the Parts in the Rundown
	 * Sorted by the Segment and Part ranks
	 */
	getAllOrderedParts(): ReadonlyDeep<DBPart>[]

	/**
	 * Insert the AdlibTesting Segment for this Rundown
	 * Throws if the segment already exists
	 */
	insertAdlibTestingSegment(): SegmentId
	/**
	 * Remove the AdlibTesting Segment for this Rundown
	 * @returns true if the Segment was found
	 */
	removeAdlibTestingSegment(): boolean
	/**
	 * Get the AdlibTesting Segment for this Rundown, if it exists
	 */
	getAdlibTestingSegment(): PlayoutSegmentModel | undefined
	/**
	 * Update the rank of the AdlibTesting Segment in this Rundown, if it exists
	 */
	updateAdlibTestingSegmentRank(): void
}
