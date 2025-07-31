import { IBlueprintPart, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { ITranslatableMessage } from '../TranslatableMessage.js'
import { PartId, RundownId, SegmentId } from './Ids.js'
import { PartNote } from './Notes.js'
import { ReadonlyDeep } from 'type-fest'
import { CoreUserEditingDefinition, CoreUserEditingProperties } from './UserEditingDefinitions.js'

export interface PartInvalidReason {
	message: ITranslatableMessage
	severity?: NoteSeverity
	color?: string
}

/** A "Line" in NRK Lingo. */
export interface DBPart extends Omit<IBlueprintPart, 'userEditOperations'> {
	_id: PartId
	/**
	 * Position inside the segment
	 * Parts always have a integer rank, spaced by one. This is defined during the core portion of ingest.
	 * When an orphaned PartInstance this can be a decimal value.
	 */
	_rank: number

	/** The rundown this line belongs to */
	rundownId: RundownId
	segmentId: SegmentId

	/** Holds notes (warnings / errors) thrown by the blueprints during creation */
	notes?: Array<PartNote>

	/** Holds the user-facing explanation for why the part is invalid */
	invalidReason?: PartInvalidReason

	/** Human readable unqiue identifier of the part */
	identifier?: string

	/** A modified expectedDuration with the piece/transition derived timings factored in */
	expectedDurationWithTransition: number | undefined

	/**
	 * User editing definitions for this part
	 */
	userEditOperations?: CoreUserEditingDefinition[]

	/**
	 * Properties that are user editable from the properties panel in the Sofie UI, if the user saves changes to these
	 * it will trigger a user edit operation of type DefaultUserOperationEditProperties
	 */
	userEditProperties?: CoreUserEditingProperties
}

export function isPartPlayable(part: Pick<ReadonlyDeep<DBPart>, 'invalid' | 'floated'>): boolean {
	return !part.invalid && !part.floated
}
