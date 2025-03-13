import {
	IBlueprintPieceGeneric,
	IBlueprintPieceDB,
	IBlueprintPieceType,
	TimelineObjectCoreExt,
	SomeContent,
} from '@sofie-automation/blueprints-integration'
import { ProtectedString, protectString, unprotectString } from '../protectedString.js'
import { PieceId, RundownId, SegmentId, PartId } from './Ids.js'
import { CoreUserEditingDefinition, CoreUserEditingProperties } from './UserEditingDefinitions.js'

/** A generic list of playback availability statuses for a Piece */
export enum PieceStatusCode {
	// Note: Higher is worse

	/** No status has been determined (yet) */
	UNKNOWN = -1,

	/** No fault with piece, can be played */
	OK = 0,

	/** The source exists but can't be played for a non-technical reason. E.G. A placeholder clip with no content. */
	SOURCE_NOT_READY = 5,

	/** The source can be played, but some issues have been detected with it. It can be played fine from a technical standpoint, but the user should be notified. */
	SOURCE_HAS_ISSUES = 10,

	/** The source is present, but should not be played due to a technical malfunction (file is broken, camera robotics failed, REMOTE input is just bars, etc.) */
	SOURCE_BROKEN = 20,

	/** The source (file, live input) is missing and cannot be played, as it would result in BTA */
	SOURCE_MISSING = 30,

	/** The source is in a reported, but unrecognized state */
	SOURCE_UNKNOWN_STATE = 35,

	/** Source not set - the source object is not set to an actual source */
	SOURCE_NOT_SET = 40,
}

/** A Single item in a Part: script, VT, cameras */
export interface PieceGeneric extends Omit<IBlueprintPieceGeneric, 'content'> {
	_id: PieceId // TODO - this should be moved to the implementation types

	content: SomeContent

	/** A flag to signal that a given Piece has no content, and exists only as a marker on the timeline */
	virtual?: boolean

	/** Stringified timelineObjects */
	timelineObjectsString: PieceTimelineObjectsBlob
}
export interface Piece
	extends PieceGeneric,
		Omit<IBlueprintPieceDB, '_id' | 'content' | 'userEditOperations' | 'userEditProperties'> {
	/** Timeline enabler. When the piece should be active on the timeline. */
	enable: {
		start: number | 'now' // TODO - now will be removed from this eventually, but as it is not an acceptable value 99% of the time, that is not really breaking
		duration?: number

		// Pieces owned by the Rundown should always be absolute
		isAbsolute?: boolean
	}

	/**
	 * This is the id of the rundown this piece starts playing in.
	 * Currently this is the only rundown the piece could be playing in
	 */
	startRundownId: RundownId
	/**
	 * This is the id of the segment this piece starts playing in.
	 * It is the only segment the piece could be playing in, unless the piece has a lifespan which spans beyond the segment
	 */
	startSegmentId: SegmentId | null
	/**
	 * This is the id of the part this piece starts playing in.
	 * If the lifespan is WithinPart, it is the only part the piece could be playing in.
	 */
	startPartId: PartId | null

	/** Whether this piece is a special piece */
	pieceType: IBlueprintPieceType

	/** This is set when the part is invalid and these pieces should be ignored */
	invalid: boolean

	/**
	 * User editing definitions for this piece
	 */
	userEditOperations?: CoreUserEditingDefinition[]

	/**
	 * Properties that are user editable from the properties panel in the Sofie UI, if the user saves changes to these
	 * it will trigger a user edit operation of type DefaultUserOperationEditProperties
	 */
	userEditProperties?: CoreUserEditingProperties
}

export type PieceTimelineObjectsBlob = ProtectedString<'PieceTimelineObjectsBlob'>

export function deserializePieceTimelineObjectsBlob(
	timelineBlob: PieceTimelineObjectsBlob
): TimelineObjectCoreExt<any>[] {
	const str = unprotectString(timelineBlob) + ''
	try {
		return JSON.parse(str) as Array<TimelineObjectCoreExt<any>>
	} catch (err) {
		;(err as Error).message += ` Blob: ${str.slice(0, 100)}`
		throw err
	}
}
export function serializePieceTimelineObjectsBlob(timeline: TimelineObjectCoreExt<any>[]): PieceTimelineObjectsBlob {
	return protectString(JSON.stringify(timeline))
}
export const EmptyPieceTimelineObjectsBlob = serializePieceTimelineObjectsBlob([])
