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

export class PieceLifespan implements IPieceLifespan {
	readonly scope: PieceLifespanScope
	readonly presence: PieceLifespanPresence
	readonly inShadow: PieceLifespanInShadow

	constructor(input: PieceLifespanInfo) {
		if (input instanceof PieceLifespan) {
			// Already a PieceLifespan instance, just copy the values
			this.scope = input.scope
			this.presence = input.presence
			this.inShadow = input.inShadow
		} else if (typeof input === 'object' && input !== null) {
			// New-style definition
			this.scope = input.scope ?? 'part'
			this.presence = input.presence ?? 'forward-scope'
			this.inShadow = input.inShadow ?? 'stop'
			return
		} else {
			// Legacy presets and default finite piece
			const { scope, presence, inShadow } = input ? PieceLifespan.normalizePreset(input) : {}
			this.scope = scope ?? 'part'
			this.presence = presence ?? 'forward-scope'
			this.inShadow = inShadow ?? 'stop'
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
				return { scope: 'part', presence: 'forward-scope', inShadow: 'stop' }
			case LegacyPieceLifespan.OutOnSegmentChange:
				return { scope: 'segment', presence: 'follow-playhead', inShadow: 'stop' }
			case LegacyPieceLifespan.OutOnRundownChange:
				return { scope: 'rundown', presence: 'follow-playhead', inShadow: 'stop' }
			case LegacyPieceLifespan.OutOnSegmentEnd:
				return { scope: 'segment', presence: 'forward-scope', inShadow: 'persist' }
			case LegacyPieceLifespan.OutOnRundownEnd:
				return { scope: 'rundown', presence: 'forward-scope', inShadow: 'persist' }
			case LegacyPieceLifespan.OutOnShowStyleEnd:
				return { scope: 'showstyle', presence: 'forward-scope', inShadow: 'persist' }
			default:
				throw new Error(`Unknown legacy piece lifespan preset: ${String(preset)}`)
		}
	}

	/** Resolves a new-style definition into a legacy preset if possible. Returns undefined if the behavior cannot be mapped to a legacy preset. */
	private static resolvePreset(lifespan: IPieceLifespan): LegacyPieceLifespan | undefined {
		switch (`${lifespan.scope}:${lifespan.presence}:${lifespan.inShadow}`) {
			case 'part:forward-scope:stop':
			case 'part:follow-playhead:stop':
				return LegacyPieceLifespan.WithinPart
			case 'segment:follow-playhead:stop':
				return LegacyPieceLifespan.OutOnSegmentChange
			case 'rundown:follow-playhead:stop':
				return LegacyPieceLifespan.OutOnRundownChange
			case 'segment:forward-scope:persist':
				return LegacyPieceLifespan.OutOnSegmentEnd
			case 'rundown:forward-scope:persist':
				return LegacyPieceLifespan.OutOnRundownEnd
			case 'showstyle:forward-scope:persist':
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

	/** Returns true if the piece enters a shadow state and pauses on conflict */
	get persistsInShadow(): boolean {
		return this.inShadow === 'persist'
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
