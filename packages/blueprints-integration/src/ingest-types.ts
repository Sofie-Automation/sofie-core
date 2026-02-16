import { IngestPart, IngestPlaylist, IngestRundown, IngestSegment } from './ingest.js'

export interface SofieIngestPlaylist extends IngestPlaylist {
	/** Ingest cache of rundowns in this playlist. */
	rundowns: SofieIngestRundown[]
}
export interface SofieIngestRundown<
	TRundownPayload = unknown,
	TSegmentPayload = unknown,
	TPartPayload = unknown,
> extends IngestRundown<TRundownPayload, TSegmentPayload, TPartPayload> {
	/** Array of segments in this rundown */
	segments: SofieIngestSegment<TSegmentPayload, TPartPayload>[]

	/**
	 * The userEditStates is a key-value store where Blueprints can store persistent data.
	 *
	 * Examples of use cases;
	 * - locks from NRCS updates
	 * - locks from user changes
	 * - removedByUser flags
	 */
	userEditStates: Record<string, boolean>
}
export interface SofieIngestSegment<TSegmentPayload = unknown, TPartPayload = unknown> extends IngestSegment<
	TSegmentPayload,
	TPartPayload
> {
	/** Array of parts in this segment */
	parts: SofieIngestPart<TPartPayload>[]

	/**
	 * The userEditStates is a key-value store where Blueprints can store persistent data.
	 *
	 * Examples of use cases;
	 * - locks from NRCS updates
	 * - locks from user changes
	 * - removedByUser flags
	 */
	userEditStates: Record<string, boolean>
}
export interface SofieIngestPart<TPayload = unknown> extends IngestPart<TPayload> {
	/**
	 * The userEditStates is a key-value store where Blueprints can store persistent data.
	 *
	 * Examples of use cases;
	 * - locks from NRCS updates
	 * - locks from user changes
	 * - removedByUser flags
	 */
	userEditStates: Record<string, boolean>
}
