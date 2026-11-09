export enum LegacyPieceLifespan {
	/** The Piece will only exist in it's designated Part. As soon as the playhead leaves the Part, the Piece will stop */
	WithinPart = 'part-only',
	/** The Piece will only exist in it's designated Segment. It will begin playing when taken and will stop when the
	 * playhead leaves the Segment */
	OutOnSegmentChange = 'segment-change',
	/** The Piece will only exist in it's designated Segment. It will begin playing when taken and will stop when the
	 * playhead leaves the Segment or the playhead moves before the beginning of the Piece */
	OutOnSegmentEnd = 'segment-end',
	/** The Piece will only exist in it's designated Rundown. It will begin playing when taken and will stop when the
	 * playhead leaves the Rundown */
	OutOnRundownChange = 'rundown-change',
	/** The Piece will only exist in it's designated Rundown. It will begin playing when taken and will stop when the
	 * playhead leaves the Rundown or the playhead moves before the beginning of the Piece */
	OutOnRundownEnd = 'rundown-end',
	/** The Piece will only exist while the ShowStyle doesn't change. It will begin playing when taken and will stop
	 * when the playhead leaves the Rundown into a new Rundown with a different ShowStyle */
	OutOnShowStyleEnd = 'showstyle-end',
}

/** How far a piece continues past the part where it starts */
export type PieceLifespanScope =
	/** Stops when its part stops. This is a normal piece, not an infinite */
	| 'part'
	/** Stops when the playhead leaves the segment */
	| 'segment'
	/** Stops when the playhead leaves the rundown */
	| 'rundown'
	/**
	 * Stops when the playhead goes into a rundown with a different ShowStyleBase.
	 * All the rundowns between the starting rundown and the current one must share the ShowStyleBase
	 * (the ShowStyleVariant is ignored)
	 */
	| 'showstyle'
	/** Stops when the playlist stops. A change of ShowStyleBase does not stop it */
	| 'playlist'

/** How an infinite moves through the rundown */
export type PieceLifespanPresence =
	/**
	 * Follows the playhead. It only becomes an infinite once it has played, and then continues from the on-air part
	 * in the order that the parts are played. Skipped parts do not affect it, and it is only shown in subsequent
	 * parts after it has played
	 */
	| 'follow-playhead'
	/**
	 * Part of the plan. Continues into all the subsequent parts in its scope, in rundown order, also when parts are
	 * skipped (pieces in a skipped part still affect it). It is shown in subsequent parts before they play.
	 * An adlibbed `forward-scope` infinite is removed if the playhead moves backwards
	 */
	| 'forward-scope'

/**
 * How a piece behaves while a newer piece covers it on its source layer:
 * - `stop`: it ends, and does not come back
 * - `persist`: it is hidden, and resumes once the pieces covering it end
 * - `legacy-persist`: as `persist`, except that a newer piece of the same scope ends it for good, as the legacy
 *   `OutOnSegmentEnd`, `OutOnRundownEnd` and `OutOnShowStyleEnd` presets do
 *
 * Note: `legacy-persist` is deprecated, it only exists to keep the behaviour of the legacy presets and will be removed.
 * Use `persist`, and end an infinite with a newer one of the same or a broader scope instead
 */
export type PieceLifespanInShadow = 'persist' | 'stop' | 'legacy-persist'

export interface IPieceLifespan {
	/** The structural hierarchy boundary past which this piece naturally expires */
	scope: PieceLifespanScope

	/** How the piece establishes and propagates its presence across parts */
	presence: PieceLifespanPresence

	/** Behavior when occluded by a higher-priority piece on the same source layer */
	inShadow: PieceLifespanInShadow
}

export type PieceLifespanInfo = LegacyPieceLifespan | IPieceLifespan
