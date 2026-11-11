import { DatastorePersistenceMode, TSR } from '@sofie-automation/blueprints-integration'
import { StudioId, TimelineDatastoreEntryId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { deserializeTimelineBlob } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { BSON } from 'mongodb'
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

/**
 * Field names which MongoDB will store, but which the minimongo in the UI refuses to accept when they are
 * published to it. A single such document makes the UI's DDP client throw, dropping the rest of that batch of
 * updates (for every collection) for that client. See `packages/webui/src/meteor/__tests__/hostileFieldNames.test.ts`
 */
const INVALID_FIELD_NAME = /^\$|\.|\0/

function findInvalidFieldName(value: unknown, path: string[]): string[] | undefined {
	if (Array.isArray(value)) {
		for (let i = 0; i < value.length; i++) {
			const invalidPath = findInvalidFieldName(value[i], [...path, `${i}`])
			if (invalidPath) return invalidPath
		}
	} else if (value instanceof BSON.DBRef) {
		// Deserializing promotes `{ $ref, $id }` to a DBRef, which is stored with those field names
		return [...path, '$ref']
	} else if (value && typeof value === 'object') {
		for (const [fieldName, fieldValue] of Object.entries<unknown>(value as Record<string, unknown>)) {
			if (INVALID_FIELD_NAME.test(fieldName)) return [...path, fieldName]

			const invalidPath = findInvalidFieldName(fieldValue, [...path, fieldName])
			if (invalidPath) return invalidPath
		}
	}
	return undefined
}

/**
 * Convert a value to what MongoDB will store for it, as the BSON serializer stores the entries of a `Map` and
 * the result of `toBSON()` as plain fields, which aren't visible to `Object.entries`.
 * Matches the `ignoreUndefined` option of the MongoClient
 */
function toStoredValue(value: unknown): unknown {
	return BSON.deserialize(BSON.serialize({ value }, { ignoreUndefined: true })).value
}

/**
 * Check that a value can be stored in the TimelineDatastore and published to the UI.
 * Throws if any field name in the value, as MongoDB will store it, contains `.` or a null byte, or starts with `$`.
 * @returns The value as it will be stored, which is what was checked
 */
export function assertValidTimelineDatastoreValue(key: string, value: unknown): unknown {
	let storedValue: unknown
	try {
		storedValue = toStoredValue(value)
	} catch (e) {
		// eg null bytes in field names, or circular references
		throw new Error(`Timeline datastore value for key "${key}" can't be stored: ${stringifyError(e)}`)
	}

	const invalidPath = findInvalidFieldName(storedValue, [])
	if (invalidPath) {
		throw new Error(
			`Timeline datastore value for key "${key}" has an invalid field name "${invalidPath[invalidPath.length - 1]}" (at ${JSON.stringify(invalidPath)}): field names must not contain '.' or null bytes, or start with '$'`
		)
	}

	return storedValue
}

export async function setTimelineDatastoreValue(
	context: JobContext,
	key: string,
	value: unknown,
	mode: DatastorePersistenceMode
): Promise<void> {
	const storedValue = assertValidTimelineDatastoreValue(key, value)

	const studioId = context.studioId
	const id = protectString(`${studioId}_${key}`)
	const collection = context.directCollections.TimelineDatastores

	await collection.replace({
		_id: id,
		studioId: studioId,

		key,
		value: storedValue,

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
