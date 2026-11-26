import {
	IPieceLifespan,
	LegacyPieceLifespan,
	PieceLifespanInfo,
	PieceLifespanWhenCovered,
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

export class PieceLifespan implements IPieceLifespan {
	readonly scope: PieceLifespanScope
	readonly presence: PieceLifespanPresence
	readonly whenCovered: PieceLifespanWhenCovered

	constructor(input: PieceLifespanInfo) {
		if (input instanceof PieceLifespan) {
			// Already a PieceLifespan instance, just copy the values
			this.scope = input.scope
			this.presence = input.presence
			this.whenCovered = input.whenCovered
		} else if (typeof input === 'object' && input !== null) {
			// New-style definition
			this.scope = input.scope ?? 'part'
			this.presence = input.presence ?? 'forward-scope'
			this.whenCovered = input.whenCovered ?? 'stop'
			return
		} else {
			// Legacy presets and default finite piece
			const { scope, presence, whenCovered } = input ? PieceLifespan.normalizePreset(input) : {}
			this.scope = scope ?? 'part'
			this.presence = presence ?? 'forward-scope'
			this.whenCovered = whenCovered ?? 'stop'
		}
	}

	/** Creates a new PieceLifespan instance from the given input */
	static from(input: PieceLifespanInfo): PieceLifespan {
		return input instanceof PieceLifespan ? input : new PieceLifespan(input)
	}

	/** Normalizes a legacy preset into a new-style definition */
	private static normalizePreset(preset: LegacyPieceLifespan): IPieceLifespan {
		switch (preset) {
			case LegacyPieceLifespan.WithinPart:
				return { scope: 'part', presence: 'forward-scope', whenCovered: 'stop' }
			case LegacyPieceLifespan.OutOnSegmentChange:
				return { scope: 'segment', presence: 'follow-playhead', whenCovered: 'stop' }
			case LegacyPieceLifespan.OutOnRundownChange:
				return { scope: 'rundown', presence: 'follow-playhead', whenCovered: 'stop' }
			case LegacyPieceLifespan.OutOnSegmentEnd:
				return { scope: 'segment', presence: 'forward-scope', whenCovered: 'legacy-persist' }
			case LegacyPieceLifespan.OutOnRundownEnd:
				return { scope: 'rundown', presence: 'forward-scope', whenCovered: 'legacy-persist' }
			case LegacyPieceLifespan.OutOnShowStyleEnd:
				return { scope: 'showstyle', presence: 'forward-scope', whenCovered: 'legacy-persist' }
			default:
				throw new Error(`Unknown legacy piece lifespan preset: ${String(preset)}`)
		}
	}

	/** Resolves a new-style definition into a legacy preset if possible. Returns undefined if the behavior cannot be mapped to a legacy preset. */
	private static resolvePreset(lifespan: IPieceLifespan): LegacyPieceLifespan | undefined {
		switch (`${lifespan.scope}:${lifespan.presence}:${lifespan.whenCovered}`) {
			case 'part:forward-scope:stop':
			case 'part:follow-playhead:stop':
				return LegacyPieceLifespan.WithinPart
			case 'segment:follow-playhead:stop':
				return LegacyPieceLifespan.OutOnSegmentChange
			case 'rundown:follow-playhead:stop':
				return LegacyPieceLifespan.OutOnRundownChange
			case 'segment:forward-scope:persist':
			case 'segment:forward-scope:legacy-persist':
				return LegacyPieceLifespan.OutOnSegmentEnd
			case 'rundown:forward-scope:persist':
			case 'rundown:forward-scope:legacy-persist':
				return LegacyPieceLifespan.OutOnRundownEnd
			case 'showstyle:forward-scope:persist':
			case 'showstyle:forward-scope:legacy-persist':
				return LegacyPieceLifespan.OutOnShowStyleEnd
			default:
				return undefined
		}
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
	get tracksPlayhead(): boolean {
		return this.presence === 'follow-playhead'
	}

	/** Returns true if the piece is structurally projected across its scope */
	get isStatic(): boolean {
		return !this.tracksPlayhead
	}

	/** Returns true if the piece is only hidden while a newer piece covers it, and resumes after it */
	get persistsWhenCovered(): boolean {
		return this.whenCovered === 'persist' || this.whenCovered === 'legacy-persist'
	}

	/** Returns true if a newer piece of the same scope ends the piece for good, instead of only covering it */
	get isEndedByNewerOfSameScope(): boolean {
		return this.whenCovered === 'legacy-persist'
	}

	/**
	 * The timeline priority of the piece, relative to other pieces on the same layer.
	 * Pieces that persist when covered are stacked by scope (broader scope = lower priority), so that a narrower one can
	 * temporarily cover a broader one. Every other piece shares the highest priority.
	 */
	get stackingPriority(): number {
		if (!this.persistsWhenCovered) return 5
		return 3 - SCOPE_HIERARCHY[this.scope]
	}

	/** Checks if this piece's scope is equal to or broader than another scope */
	inScope(requiredScope: PieceLifespanScope): boolean {
		return SCOPE_HIERARCHY[this.scope] >= SCOPE_HIERARCHY[requiredScope]
	}

	/** Equality check */
	equals(other: PieceLifespanInfo): boolean {
		const o = PieceLifespan.from(other)
		return this.scope === o.scope && this.presence === o.presence && this.whenCovered === o.whenCovered
	}

	/** Exports plain JSON definition for MongoDB / DDP serialization */
	definition(): IPieceLifespan {
		return {
			scope: this.scope,
			presence: this.presence,
			whenCovered: this.whenCovered,
		}
	}

	toJSON(): string {
		return JSON.stringify(this.definition())
	}
}

/** Whether a piece only hides the pieces it covers while active, stopping none of them. See `IBlueprintPiece.persistCoveredPieces` */
export function persistsCoveredPieces(piece: {
	readonly virtual?: boolean
	readonly persistCoveredPieces?: boolean
}): boolean {
	return !!piece.virtual && !!piece.persistCoveredPieces
}
