import type { Time } from '../common.js'
import type { IBlueprintPartDB } from './part.js'
import type { ITranslatableMessage } from '../translations.js'

export type PartEndState = unknown

/**
 * Properties of a PartInstance that can be modified at runtime by blueprints.
 * These are runtime state properties, distinct from the planned Part properties.
 */
export interface IBlueprintMutatablePartInstance {
	/**
	 * If set, this PartInstance exists and is valid as being next, but it cannot be taken in its current state.
	 * This can be used to block taking a PartInstance that requires user action to resolve.
	 * This is a runtime validation issue, distinct from the planned `invalidReason` on the Part itself.
	 */
	invalidReason?: ITranslatableMessage
}

/** The Part instance sent from Core */
export interface IBlueprintPartInstance<
	TPrivateData = unknown,
	TPublicData = unknown,
> extends IBlueprintMutatablePartInstance {
	_id: string
	/** The segment ("Title") this line belongs to */
	segmentId: string

	part: IBlueprintPartDB<TPrivateData, TPublicData>

	/** If the playlist was in rehearsal mode when the PartInstance was created */
	rehearsal: boolean
	/** Playout timings, in here we log times when playout happens */
	timings?: IBlueprintPartInstanceTimings

	/** The end state of the previous part, to allow for bits of this to part to be based on what the previous did/was */
	previousPartEndState?: PartEndState

	/** Whether the PartInstance is an orphan (the Part referenced does not exist). Indicates the reason it is orphaned */
	orphaned?: 'adlib-part' | 'deleted'

	/** If taking out of the current part is blocked, this is the time it is blocked until */
	blockTakeUntil?: number
}

export interface IBlueprintPartInstanceTimings {
	/** Point in time the Part started playing (ie the time of the playout) */
	reportedStartedPlayback?: Time
	/** Point in time the Part stopped playing (ie the time of the playout) */
	reportedStoppedPlayback?: Time

	/**
	 * Point in time where the Part is planned to start playing.
	 * This gets set when the part is taken
	 * It may get set to a point in the past, if an offset is chosen when starting to play the part
	 */
	plannedStartedPlayback?: Time
	/**
	 * Point in time where the Part is planned to stop playing
	 * This gets set when the plannedStartedPlayback of the following part is set
	 */
	plannedStoppedPlayback?: Time
}
