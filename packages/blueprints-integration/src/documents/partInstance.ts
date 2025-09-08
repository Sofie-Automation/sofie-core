import type { Time } from '../common.js'
import type { IBlueprintPartDB } from './part.js'

export type PartEndState = unknown

/** The Part instance sent from Core */
export interface IBlueprintPartInstance<TPrivateData = unknown, TPublicData = unknown> {
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
}
