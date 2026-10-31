import {
	IPieceLifespan,
	LegacyPieceLifespan,
	PieceLifespanInfo,
	PieceLifespanInShadow,
	PieceLifespanPresence,
	PieceLifespanScope,
} from '@sofie-automation/shared-lib/dist/core/model/Rundown'

const SCOPE_HIERARCHY: Record<PieceLifespanScope, number> = {
	part: 0,
	segment: 1,
	rundown: 2,
	showstyle: 3,
	playlist: 4,
}

/** The lifespan of a regular, non-infinite piece */
export const DEFAULT_PIECE_LIFESPAN: Readonly<IPieceLifespan> = Object.freeze({
	scope: 'part',
	presence: 'forward-scope',
	inShadow: 'stop',
})

/** The new-style definition of each legacy preset */
export const LEGACY_PIECE_LIFESPAN_PRESETS: Readonly<Record<LegacyPieceLifespan, Readonly<IPieceLifespan>>> =
	Object.freeze({
		[LegacyPieceLifespan.WithinPart]: DEFAULT_PIECE_LIFESPAN,
		[LegacyPieceLifespan.OutOnSegmentChange]: Object.freeze({
			scope: 'segment',
			presence: 'follow-playhead',
			inShadow: 'stop',
		}),
		[LegacyPieceLifespan.OutOnRundownChange]: Object.freeze({
			scope: 'rundown',
			presence: 'follow-playhead',
			inShadow: 'stop',
		}),
		[LegacyPieceLifespan.OutOnSegmentEnd]: Object.freeze({
			scope: 'segment',
			presence: 'forward-scope',
			inShadow: 'legacy-persist',
		}),
		[LegacyPieceLifespan.OutOnRundownEnd]: Object.freeze({
			scope: 'rundown',
			presence: 'forward-scope',
			inShadow: 'legacy-persist',
		}),
		[LegacyPieceLifespan.OutOnShowStyleEnd]: Object.freeze({
			scope: 'showstyle',
			presence: 'forward-scope',
			inShadow: 'legacy-persist',
		}),
	})

export class PieceLifespan implements IPieceLifespan {
	readonly scope: PieceLifespanScope
	readonly presence: PieceLifespanPresence
	readonly inShadow: PieceLifespanInShadow

	/**
	 * @param input `undefined` and `null` are accepted, as pieces from blueprints or the database are not guaranteed to have a lifespan.
	 * They are treated as a regular, non-infinite piece.
	 */
	constructor(input?: PieceLifespanInfo) {
		// Already a PieceLifespan instance, just copy the values
		if (input instanceof PieceLifespan) {
			this.scope = input.scope
			this.presence = input.presence
			this.inShadow = input.inShadow
		}
		// Legacy preset
		else if (typeof input === 'string') {
			const { scope, presence, inShadow } = PieceLifespan.normalizePreset(input)
			this.scope = scope
			this.presence = presence
			this.inShadow = inShadow
		}
		// New-style definition and defaults
		else {
			this.scope = input?.scope ?? DEFAULT_PIECE_LIFESPAN.scope
			this.presence = input?.presence ?? DEFAULT_PIECE_LIFESPAN.presence
			this.inShadow = input?.inShadow ?? DEFAULT_PIECE_LIFESPAN.inShadow
		}
	}

	/** Returns a PieceLifespan instance from the given input. If it's already an instance, it returns the input. */
	static from(input?: PieceLifespanInfo): PieceLifespan {
		return input instanceof PieceLifespan ? input : new PieceLifespan(input)
	}

	/** Normalizes a legacy preset into a new-style definition */
	private static normalizePreset(preset: LegacyPieceLifespan): IPieceLifespan {
		const definition = LEGACY_PIECE_LIFESPAN_PRESETS[preset]
		if (!definition) throw new Error(`Unknown legacy piece lifespan preset: ${String(preset)}`)
		return definition
	}

	/** Resolves a new-style definition into a legacy preset if possible. Returns undefined if the behavior cannot be mapped to a legacy preset. */
	private static resolvePreset(lifespan: IPieceLifespan): LegacyPieceLifespan | undefined {
		const { scope, presence, inShadow } = lifespan

		const isChange = presence === 'follow-playhead' && inShadow === 'stop'
		const isEnd = presence === 'forward-scope' && (inShadow === 'persist' || inShadow === 'legacy-persist')

		if (scope === 'part' && inShadow === 'stop') return LegacyPieceLifespan.WithinPart

		if (scope === 'segment' && isChange) return LegacyPieceLifespan.OutOnSegmentChange
		if (scope === 'segment' && isEnd) return LegacyPieceLifespan.OutOnSegmentEnd

		if (scope === 'rundown' && isChange) return LegacyPieceLifespan.OutOnRundownChange
		if (scope === 'rundown' && isEnd) return LegacyPieceLifespan.OutOnRundownEnd

		if (scope === 'showstyle' && isEnd) return LegacyPieceLifespan.OutOnShowStyleEnd

		return undefined
	}

	/** Returns the legacy piece lifespan if it can be resolved. Falsy if the behavior cannot be mapped to a legacy preset. */
	get legacyLifespan(): LegacyPieceLifespan | undefined {
		return PieceLifespan.resolvePreset(this)
	}

	/** Returns true if the piece extends beyond its origin part */
	get isInfinite(): boolean {
		return this.scope !== 'part'
	}

	/** Returns true if the piece strictly follows the live playhead */
	get followsPlayhead(): boolean {
		return this.presence === 'follow-playhead'
	}

	/** Returns true if the piece is structurally projected across its scope */
	get isStatic(): boolean {
		return !this.followsPlayhead
	}

	/** Returns true if the piece enters a shadow state and pauses on conflict */
	get persistsInShadow(): boolean {
		return this.inShadow === 'persist' || this.inShadow === 'legacy-persist'
	}

	/** Returns true if a newer piece of the same scope ends the piece for good, instead of only covering it */
	get isEndedByNewerOfSameScope(): boolean {
		return this.inShadow === 'legacy-persist'
	}

	/**
	 * The timeline priority of the piece, relative to other pieces on the same layer.
	 * Pieces that persist in shadow are stacked by scope (broader scope = lower priority), so that a narrower one can
	 * temporarily cover a broader one. Every other piece shares the highest priority.
	 */
	get stackingPriority(): number {
		if (!this.persistsInShadow) return 5
		return 3 - SCOPE_HIERARCHY[this.scope]
	}

	/** Checks if this piece's scope is equal to or broader than another scope */
	inScope(requiredScope: PieceLifespanScope): boolean {
		return SCOPE_HIERARCHY[this.scope] >= SCOPE_HIERARCHY[requiredScope]
	}

	/** Equality check */
	equals(other: PieceLifespanInfo): boolean {
		const o = PieceLifespan.from(other)
		return this.scope === o.scope && this.presence === o.presence && this.inShadow === o.inShadow
	}

	/** Exports plain JSON definition for MongoDB / DDP serialization */
	definition(): IPieceLifespan {
		return {
			scope: this.scope,
			presence: this.presence,
			inShadow: this.inShadow,
		}
	}

	toJSON(): string {
		return JSON.stringify(this.definition())
	}
}

/** Whether a piece is a virtual shadow, which only obstructs its layer while active. See `IBlueprintPiece.virtualMode` */
export function isShadowPiece(piece: {
	readonly virtual?: boolean
	readonly virtualMode?: 'clear' | 'shadow'
}): boolean {
	return !!piece.virtual && piece.virtualMode === 'shadow'
}
