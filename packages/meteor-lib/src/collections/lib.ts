import { MongoFieldSpecifier, SortSpecifier } from '@sofie-automation/corelib/dist/mongo'

export interface UpdateOptions {
	/** True to modify all matching documents; false to only modify one of the matching documents (the default). */
	multi?: boolean
	/** True to insert a document if no matching documents are found. */
	upsert?: boolean
	/**
	 * Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to
	 * modify in an array field.
	 */
	arrayFilters?: { [identifier: string]: any }[]
}
export interface UpsertOptions {
	/** True to modify all matching documents; false to only modify one of the matching documents (the default). */
	multi?: boolean
}

export type IndexSpecifier<T> = {
	[P in keyof T]?: -1 | 1 | string
}

export interface MongoLiveQueryHandle {
	stop(): void
}

export interface FindOneOptions<TRawDoc> {
	/** Sort order (default: natural order) */
	sort?: SortSpecifier<TRawDoc>
	/** Number of results to skip at the beginning */
	skip?: number
	/** @deprecated Dictionary of fields to return or exclude. Use `projection` instead. (still used by the client minimongo) */
	fields?: MongoFieldSpecifier<TRawDoc>
	/** Dictionary of fields to return or exclude. */
	projection?: MongoFieldSpecifier<TRawDoc>
}
export interface FindOptions<DBInterface> extends FindOneOptions<DBInterface> {
	/** Maximum number of results to return */
	limit?: number
}

export type FieldNames<DBInterface> = (keyof DBInterface)[]
