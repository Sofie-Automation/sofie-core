import { IngestPart, IngestSegment } from '@sofie-automation/shared-lib/dist/peripheralDevice/ingest'
import { IBlueprintRundownDBData } from './documents/index.js'
import { ReadonlyDeep } from 'type-fest'
import { SofieIngestRundown } from './ingest-types.js'

export {
	IngestPart,
	IngestPlaylist,
	IngestRundown,
	IngestSegment,
	IngestAdlib,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/ingest'

/** The IngestRundown is extended with data from Core */
export interface ExtendedIngestRundown<
	TRundownPayload = unknown,
	TSegmentPayload = unknown,
	TPartPayload = unknown,
> extends SofieIngestRundown<TRundownPayload, TSegmentPayload, TPartPayload> {
	coreData: IBlueprintRundownDBData | undefined
}

/**
 * Describes the possible ingest changes that can have been made to a part by the NRCS
 */
export enum NrcsIngestPartChangeDetails {
	Inserted = 'inserted',
	Deleted = 'deleted',
	Updated = 'updated',
}

/**
 * Describes some of the possible ingest changes that can have been made to a segment by the NRCS
 */
export enum NrcsIngestSegmentChangeDetailsEnum {
	/**
	 * The segment has been inserted into the rundown, or the segment has changed sufficiently to require a full regeneration
	 */
	InsertedOrUpdated = 'inserted-or-updated',
	/**
	 * The segment has been removed from the rundown
	 */
	Deleted = 'deleted',
}

/**
 * Describes the possible ingest changes that can have been made to the rundown properties by the NRCS
 */
export enum NrcsIngestRundownChangeDetails {
	/**
	 * The payload or name of the rundown has changed.
	 */
	Payload = 'payload',

	/**
	 * A full regeneration of the rundown and all segments is required.
	 * This will typically remove all user driven changes.
	 */
	Regenerate = 'regenerate',
}

/**
 * Describes the possible ingest changes that can have been made to the contents of a segment by the NRCS
 */
export interface NrcsIngestSegmentChangeDetailsObject {
	/**
	 * True when the payload or name of the segment has changed.
	 */
	payloadChanged?: boolean

	/**
	 * True when the rank of any part in the segment has changed.
	 */
	partOrderChanged?: boolean

	/**
	 * Descibes the changes to the parts in the rundown
	 */
	partChanges?: Record<string, NrcsIngestPartChangeDetails>
}

export enum IngestChangeType {
	/** Indicate that this change is from ingest operations */
	Ingest = 'ingest',
	/** Indicate that this change is from user operations */
	User = 'user',
}

/**
 * Describes the possible ingest changes that can have been made to a segment by the NRCS
 */
export type NrcsIngestSegmentChangeDetails = NrcsIngestSegmentChangeDetailsEnum | NrcsIngestSegmentChangeDetailsObject

export interface NrcsIngestChangeDetails {
	/** Indicate that this change is from ingest operations */
	source: IngestChangeType.Ingest

	/**
	 * True when the rank of any segment in the rundown has changed.
	 * Expressing what exactly has changed non-trivial particularly how to represent that in this structure,
	 * so for now we just have a simple boolean.
	 * If this is false, no segments have been reordered, added or removed.
	 */
	segmentOrderChanged?: boolean

	/**
	 * Describes the changes to the rundown itself
	 */
	rundownChanges?: NrcsIngestRundownChangeDetails

	/**
	 * Describes the changes to the segments in the rundown
	 */
	segmentChanges?: Record<string, NrcsIngestSegmentChangeDetails>

	/**
	 * Describes any changes to segment external ids
	 * This is used to ensure that content belonging to a segment gets moved between segments correctly
	 * Note: this is not currently defined by Sofie, but is defined by `groupPartsInRundownAndChanges` and `groupMosPartsInRundownAndChangesWithSeparator`
	 */
	changedSegmentExternalIds?: Record<string, string>
}

export interface UserOperationTarget {
	segmentExternalId: string | undefined
	partExternalId: string | undefined
	pieceExternalId: string | undefined
}

export enum DefaultUserOperationsTypes {
	REVERT_SEGMENT = '__sofie-revert-segment',
	REVERT_PART = '__sofie-revert-part',
	REVERT_RUNDOWN = '__sofie-revert-rundown',
	UPDATE_PROPS = '__sofie-update-props',
	IMPORT_MOS_ITEM = '__sofie-import-mos',
	RETIME_PIECE = '__sofie-retime-piece',
}

export interface DefaultUserOperationRevertRundown {
	id: DefaultUserOperationsTypes.REVERT_RUNDOWN
	payload: Record<string, never>
}

export interface DefaultUserOperationRevertSegment {
	id: DefaultUserOperationsTypes.REVERT_SEGMENT
	payload: Record<string, never>
}

export interface DefaultUserOperationRevertPart {
	id: DefaultUserOperationsTypes.REVERT_PART
}

export interface DefaultUserOperationEditProperties {
	id: DefaultUserOperationsTypes.UPDATE_PROPS
	payload: {
		pieceTypeProperties: { type: string; value: Record<string, any> }
		globalProperties: Record<string, any>
	}
}

export type DefaultUserOperationImportMOSItem = {
	id: DefaultUserOperationsTypes.IMPORT_MOS_ITEM

	payloadType: string
	payload: any
}

export type DefaultUserOperationRetimePiece = {
	id: DefaultUserOperationsTypes.RETIME_PIECE
	payload: {
		segmentExternalId: string
		partExternalId: string

		inPoint: number
		// note - at some point this could also include an updated duration
	}
}

export type DefaultUserOperations =
	| DefaultUserOperationRevertRundown
	| DefaultUserOperationRevertSegment
	| DefaultUserOperationRevertPart
	| DefaultUserOperationEditProperties
	| DefaultUserOperationImportMOSItem
	| DefaultUserOperationRetimePiece

export interface UserOperationChange<TCustomBlueprintOperations extends { id: string } = never> {
	/** Indicate that this change is from user operations */
	source: IngestChangeType.User

	operationTarget: UserOperationTarget
	operation: DefaultUserOperations | TCustomBlueprintOperations
}
/**
 * The MutableIngestRundown is used to modify the contents of an IngestRundown during ingest.
 * The public properties and methods are used i blueprints to selectively apply incoming
 * or apply user operations to the SofieIngestRundown.
 */
export interface MutableIngestRundown<TRundownPayload = unknown, TSegmentPayload = unknown, TPartPayload = unknown> {
	/** Id of the rundown as reported by the ingest gateway. Must be unique for each rundown owned by the gateway */
	readonly externalId: string
	/** Name of the rundown */
	readonly name: string

	/** Something that identified the data source. eg "spreadsheet", "mos" */
	readonly type: string

	/** Payload of rundown metadata. For use by other blueprints methods */
	readonly payload: ReadonlyDeep<TRundownPayload> | undefined

	readonly userEditStates: Record<string, boolean>

	/** Array of segments in this rundown */
	readonly segments: ReadonlyArray<MutableIngestSegment<TSegmentPayload, TPartPayload>>

	/**
	 * Search for a Part through the whole IngestRundown
	 * @param partExternalId externalId of the Part
	 */
	findPart(partExternalId: string): MutableIngestPart<TPartPayload> | undefined

	/**
	 * Search for a Part through the whole IngestRundown
	 * @param partExternalId externalId of the Part
	 * @returns The part and segment that the part belongs to
	 */
	findPartAndSegment(partExternalId: string):
		| {
				part: MutableIngestPart<TPartPayload>
				segment: MutableIngestSegment<TSegmentPayload, TPartPayload>
		  }
		| undefined

	/**
	 * Returns a Segment with a certain externalId
	 * @param segmentExternalId
	 */
	getSegment(segmentExternalId: string): MutableIngestSegment<TSegmentPayload, TPartPayload> | undefined

	/**
	 * Move a segment to a new position in the rundown
	 * @param segmentExternalId externalId of the Segment to move
	 * @param beforeSegmentExternalId externalId of the Segment to position before. If null, position at the end
	 */
	moveSegmentBefore(segmentExternalId: string, beforeSegmentExternalId: string | null): void

	/**
	 * Move a segment to a new position in the rundown
	 * @param segmentExternalId externalId of the Segment to move
	 * @param afterSegmentExternalId externalId of the Segment to position after. If null, position at the beginning
	 */
	moveSegmentAfter(segmentExternalId: string, afterSegmentExternalId: string | null): void

	/**
	 * Replace a Segment in the Rundown with a new one. If the Segment does not already exist, it will be inserted.
	 * This will replace all of the Parts in the Segment as well, along with the payload and other properties of the Segment.
	 * @param segment the new IngestSegment to insert
	 * @param beforeSegmentExternalId externalId of the Segment to position before. If null, position at the end
	 * @returns the new MutableIngestSegment
	 */
	replaceSegment(
		segment: Omit<IngestSegment<TSegmentPayload, TPartPayload>, 'rank'>,
		beforeSegmentExternalId: string | null
	): MutableIngestSegment<TSegmentPayload, TPartPayload>

	/**
	 * Change the externalId of a Segment
	 * @param oldSegmentExternalId Id of the segment to change
	 * @param newSegmentExternalId New id for the segment
	 */
	changeSegmentExternalId(
		oldSegmentExternalId: string,
		newSegmentExternalId: string
	): MutableIngestSegment<TSegmentPayload, TPartPayload>

	/**
	 * Change the originalExternalId of a Segment
	 * This allows for tracking of segments that have been renamed, after a Segment has been added or replaced
	 * @param segmentExternalId Id of the segment to update
	 * @param originalSegmentExternalId Original id for the segment
	 */
	changeSegmentOriginalExternalId(
		segmentExternalId: string,
		originalSegmentExternalId: string
	): MutableIngestSegment<TSegmentPayload, TPartPayload>

	/**
	 * Remove a Segment from the Rundown
	 * @param segmentExternalId externalId of the Segment to remove
	 * @returns true if the segment was removed, false if it was not found
	 */
	removeSegment(segmentExternalId: string): boolean

	/**
	 * Remove all Segments from the Rundown
	 */
	removeAllSegments(): void

	/**
	 * Force the whole Rundown to be re-run through the ingest blueprints, even if there are no changes
	 */
	forceFullRegenerate(): void

	/**
	 * Set name of the Rundown
	 */
	setName(name: string): void

	/**
	 * Update the payload of the Rundown
	 * This will trigger the Rundown and RundownPlaylist to be updated, but not Segments
	 * @param payload the new payload
	 */
	replacePayload(payload: ReadonlyDeep<TRundownPayload> | TRundownPayload): void

	/**
	 * Update the portion of the payload of the Rundown
	 * This will trigger the Rundown and RundownPlaylist to be updated, but not Segments
	 * @param key the key of the payload to update
	 * @param value the new value
	 */
	setPayloadProperty<TKey extends keyof TRundownPayload>(
		key: TKey,
		value: ReadonlyDeep<TRundownPayload[TKey]> | TRundownPayload[TKey]
	): void

	/**
	 * Set a value in the userEditState
	 */
	setUserEditState(key: string, value: boolean): void
}

export interface MutableIngestSegment<TSegmentPayload = unknown, TPartPayload = unknown> {
	/** Id of the segment as reported by the ingest gateway. Must be unique for each segment in the rundown */
	readonly externalId: string
	/** Name of the segment */
	readonly name: string

	/** If the segment has had it's externalId changed, the id before the change */
	readonly originalExternalId: string | undefined

	/** Payload of segment metadata. For use by other blueprints methods */
	readonly payload: ReadonlyDeep<TSegmentPayload> | undefined

	readonly userEditStates: Record<string, boolean>

	/** Array of parts in this segment */
	readonly parts: ReadonlyArray<MutableIngestPart<TPartPayload>>

	/**
	 * Get a Part from the Segment
	 * @param partExternalId externalId of the Part
	 */
	getPart(partExternalId: string): MutableIngestPart<TPartPayload> | undefined

	/**
	 * Move a part to a new position in the segment
	 * @param partExternalId externalId of the Part to move
	 * @param beforePartExternalId externalId of the Part to position before. If null, position at the end
	 */
	movePartBefore(partExternalId: string, beforePartExternalId: string | null): void

	/**
	 * Move a part to a new position in the segment
	 * @param partExternalId externalId of the Part to move
	 * @param afterPartExternalId externalId of the Part to position after. If null, position at the beginning
	 */
	movePartAfter(partExternalId: string, afterPartExternalId: string | null): void

	/**
	 * Replace a Part in the Segment with a new one. If the Part does not already exist, it will be inserted.
	 * This will replace the payload and other properties of the Part.
	 * @param ingestPart the new IngestPart to insert
	 * @param beforePartExternalId externalId of the Part to position before. If null, position at the end
	 * @returns the new MutableIngestPart
	 */
	replacePart(
		ingestPart: Omit<IngestPart<TPartPayload>, 'rank'>,
		beforePartExternalId: string | null
	): MutableIngestPart<TPartPayload>

	/**
	 * Remove a Part from the Segment
	 * @param partExternalId externalId of the Part to remove
	 * @returns true if the part was removed, false if it was not found
	 */
	removePart(partExternalId: string): boolean

	/**
	 * Force this segment to be regenerated, even if there are no changes
	 */
	forceRegenerate(): void

	/**
	 * Set the name of the Segment
	 */
	setName(name: string): void

	/**
	 * Update the payload of the Segment
	 * This will trigger the Segment to be updated
	 * @param payload the new payload
	 */
	replacePayload(payload: ReadonlyDeep<TSegmentPayload> | TSegmentPayload): void

	/**
	 * Update the portion of the payload of the Segment
	 * This will trigger the Segment to be updated
	 * @param key the key of the payload to update
	 * @param value the new value
	 */
	setPayloadProperty<TKey extends keyof TSegmentPayload>(
		key: TKey,
		value: ReadonlyDeep<TSegmentPayload[TKey]> | TSegmentPayload[TKey]
	): void

	setUserEditState(key: string, value: boolean): void
}

export interface MutableIngestPart<TPartPayload = unknown> {
	/** Id of the part as reported by the ingest gateway. Must be unique for each part in the rundown */
	readonly externalId: string
	/** Name of the part */
	readonly name: string

	/** Payload of the part. For use by other blueprints methods */
	readonly payload: ReadonlyDeep<TPartPayload> | undefined

	readonly userEditStates: Record<string, boolean>

	/**
	 * Set the name of the Part
	 */
	setName(name: string): void

	/**
	 * Update the payload of the Part
	 * This will trigger the Segment to be updated
	 * @param payload the new payload
	 */
	replacePayload(payload: ReadonlyDeep<TPartPayload> | TPartPayload): void

	/**
	 * Update the portion of the payload of the Part
	 * This will trigger the Segment to be updated
	 * @param key the key of the payload to update
	 * @param value the new value
	 */
	setPayloadProperty<TKey extends keyof TPartPayload>(
		key: TKey,
		value: ReadonlyDeep<TPartPayload[TKey]> | TPartPayload[TKey]
	): void

	setUserEditState(key: string, value: boolean): void
}

export type TransformPayloadFunction<T> = (payload: any, oldPayload: ReadonlyDeep<T> | undefined) => T | ReadonlyDeep<T>

export interface IngestDefaultChangesOptions<
	TRundownPayload = unknown,
	TSegmentPayload = unknown,
	TPartPayload = unknown,
> {
	/**
	 * A custom transform for the payload of a Rundown.
	 * Typically this will translate from a NRCS native structure to a javascript friendly structure.
	 */
	transformRundownPayload: TransformPayloadFunction<TRundownPayload>
	/**
	 * A custom transform for the payload of a Segment.
	 * Typically this will translate from a NRCS native structure to a javascript friendly structure.
	 */
	transformSegmentPayload: TransformPayloadFunction<TSegmentPayload>
	/**
	 * A custom transform for the payload of a Part.
	 * Typically this will translate from a NRCS native structure to a javascript friendly structure.
	 */
	transformPartPayload: TransformPayloadFunction<TPartPayload>
}
