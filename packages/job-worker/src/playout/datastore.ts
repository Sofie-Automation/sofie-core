import { DatastorePersistenceMode, TSR } from '@sofie-automation/blueprints-integration'
import { StudioId, TimelineDatastoreEntryId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { deserializeTimelineBlob } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { JobContext } from '../jobs/index.js'
import { PlayoutModel } from './model/PlayoutModel.js'

export function getDatastoreId(studioId: StudioId, key: string): TimelineDatastoreEntryId {
	return protectString<TimelineDatastoreEntryId>(`${studioId}_${key}`)
}

/** Remove documents in the TimelineDatastore collection where mode is temporary and has no references from the timeline */
export async function cleanTimelineDatastore(context: JobContext, playoutModel: PlayoutModel): Promise<void> {
	const timeline = playoutModel.timeline

	if (!timeline) {
		return
	}

	const timelineObjs = deserializeTimelineBlob(timeline.timelineBlob)

	// find all references currently on the timeline
	const timelineRefs = timelineObjs
		.filter((o) => o.content.$references)
		.flatMap((o) =>
			Object.values<TSR.TimelineDatastoreReferences[0]>(o.content.$references || {}).map((r) => r.datastoreKey)
		) // todo - this seems like it would be quite slow

	await context.directCollections.TimelineDatastores.remove({
		_id: {
			$nin: timelineRefs.map((r) => getDatastoreId(context.studioId, r)),
		},
		studioId: context.studioId,
		mode: DatastorePersistenceMode.Temporary,
	})
}

export async function setTimelineDatastoreValue(
	context: JobContext,
	key: string,
	value: unknown,
	mode: DatastorePersistenceMode
): Promise<void> {
	const studioId = context.studioId
	const id = protectString(`${studioId}_${key}`)
	const collection = context.directCollections.TimelineDatastores

	await collection.replace({
		_id: id,
		studioId: studioId,

		key,
		value,

		modified: Date.now(),
		mode,
	})
}

export async function removeTimelineDatastoreValue(context: JobContext, key: string): Promise<void> {
	const studioId = context.studioId
	const id = getDatastoreId(studioId, key)
	const collection = context.directCollections.TimelineDatastores

	await collection.remove({ _id: id })
}
