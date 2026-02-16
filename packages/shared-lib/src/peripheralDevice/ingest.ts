export interface IngestPlaylist<TRundownPayload = unknown, TSegmentPayload = unknown, TPartPayload = unknown> {
	/** Id of the playlist. */
	externalId: string
	/** Ingest cache of rundowns in this playlist. */
	rundowns: IngestRundown<TRundownPayload, TSegmentPayload, TPartPayload>[]
}
export interface IngestRundown<TRundownPayload = unknown, TSegmentPayload = unknown, TPartPayload = unknown> {
	/** Id of the rundown as reported by the ingest gateway. Must be unique for each rundown owned by the gateway */
	externalId: string
	/** Name of the rundown */
	name: string

	/** Something that identified the data source. eg "spreadsheet", "mos" */
	type: string

	/** Raw payload of rundown metadata. Only used by the blueprints */
	payload: TRundownPayload

	/** Array of segments in this rundown */
	segments: IngestSegment<TSegmentPayload, TPartPayload>[]

	/** Id of the playlist this rundown belongs to */
	playlistExternalId?: string
}
export interface IngestSegment<TSegmentPayload = unknown, TPartPayload = unknown> {
	/** Id of the segment as reported by the ingest gateway. Must be unique for each segment in the rundown */
	externalId: string
	/** Name of the segment */
	name: string
	/** Rank of the segment within the rundown */
	rank: number

	/** Raw payload of segment metadata. Only used by the blueprints */
	payload: TSegmentPayload

	/** Array of parts in this segment */
	parts: IngestPart<TPartPayload>[]
}
export interface IngestPart<TPartPayload = unknown> {
	/** Id of the part as reported by the ingest gateway. Must be unique for each part in the rundown */
	externalId: string
	/** Name of the part */
	name: string
	/** Rank of the part within the segment */
	rank: number

	/** Raw payload of the part. Only used by the blueprints */
	payload: TPartPayload
}

export interface IngestAdlib<TPayload = unknown> {
	/** Id of the adlib as reported by the ingest source. Must be unique for each adlib */
	externalId: string
	/** Name of the adlib */
	name: string

	/** Type of the raw payload. Only used by the blueprints */
	payloadType: string
	/** Raw payload of the adlib. Only used by the blueprints */
	payload: TPayload
}
