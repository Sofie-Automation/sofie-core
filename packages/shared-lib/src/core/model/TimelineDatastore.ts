import { Time } from '../../lib/lib.js'
import { StudioId, TimelineDatastoreEntryId } from './Ids.js'

export enum DatastorePersistenceMode {
	Temporary = 'temporary',
	indefinite = 'indefinite',
}

export interface DBTimelineDatastoreEntry {
	_id: TimelineDatastoreEntryId
	studioId: StudioId

	/**
	 * The key is used to refer from timeline objects $reference object
	 */
	key: string
	/**
	 * A value with which a part of the content of the timeline object will be overwritten
	 */
	value: any

	modified: Time
	/**
	 * Mode temporary may be removed when there are no more references to this key/value from the timeline
	 */
	mode: DatastorePersistenceMode

	/** Todo: some sort of history for the UI? */
}
