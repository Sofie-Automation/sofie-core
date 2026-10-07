import type {
	IBlueprintPartOutTransition,
	IBlueprintPartOutTransitionAdditive,
	IBlueprintPartOutTransitionExclusive,
} from '@sofie-automation/blueprints-integration'
import type { ReadonlyDeep } from 'type-fest'

/**
 * Part properties which have been removed, but may still exist in stored documents or snapshots
 */
export interface LegacyPartTransitionProps {
	/** Replaced by `autoNextOutTransition` */
	autoNextOverlap?: number
	/** Replaced by an `'exclusive'` outTransition, or `disableNextInTransition` on the additive outTransition */
	disableNextInTransition?: boolean
}

/** An outTransition as it may be stored. Before the `type` was added, it was always additive */
export type StoredOutTransition =
	| IBlueprintPartOutTransition
	| Omit<IBlueprintPartOutTransitionAdditive, 'type' | 'disableNextInTransition'>

export interface PartWithLegacyTransitionProps extends LegacyPartTransitionProps {
	autoNextOutTransition?: IBlueprintPartOutTransitionExclusive
	outTransition?: StoredOutTransition
}

/**
 * Convert a stored outTransition without a `type` to an additive outTransition
 * @returns The new outTransition to set, if any
 */
export function convertLegacyOutTransitionType(
	part: ReadonlyDeep<PartWithLegacyTransitionProps>
): IBlueprintPartOutTransitionAdditive | undefined {
	if (!part.outTransition || 'type' in part.outTransition) return undefined

	return { ...part.outTransition, type: 'additive' }
}

/**
 * Convert the removed `autoNextOverlap` property to an `autoNextOutTransition`
 * @returns The new autoNextOutTransition to set, if any, and whether the conversion changes playout behaviour
 */
export function convertLegacyAutoNextOverlap(part: ReadonlyDeep<PartWithLegacyTransitionProps>): {
	autoNextOutTransition: IBlueprintPartOutTransitionExclusive | undefined
	behaviourChanged: boolean
} {
	if (!part.autoNextOverlap || part.autoNextOverlap <= 0 || part.autoNextOutTransition) {
		return { autoNextOutTransition: undefined, behaviourChanged: false }
	}

	return {
		autoNextOutTransition: {
			type: 'exclusive',
			blockTakeDuration: 0,
			partKeepaliveDuration: part.autoNextOverlap,
			nextPartContentDelayDuration: 0,
		},
		// Previously an additive outTransition was combined with the overlap, now the autoNextOutTransition replaces it
		behaviourChanged:
			!!part.outTransition && (!('type' in part.outTransition) || part.outTransition.type === 'additive'),
	}
}

/**
 * Convert the removed root-level `disableNextInTransition` property to an outTransition
 * @returns The new outTransition to set, if any
 */
export function convertLegacyDisableNextInTransition(
	part: ReadonlyDeep<PartWithLegacyTransitionProps>
): IBlueprintPartOutTransition | undefined {
	if (!part.disableNextInTransition) return undefined

	if (!part.outTransition) {
		// A cut, which ignores the next inTransition
		return {
			type: 'exclusive',
			blockTakeDuration: 0,
			partKeepaliveDuration: 0,
			nextPartContentDelayDuration: 0,
		}
	} else if (!('type' in part.outTransition) || part.outTransition.type === 'additive') {
		return {
			...part.outTransition,
			type: 'additive',
			disableNextInTransition: true,
		}
	} else {
		// An exclusive outTransition already ignores the next inTransition
		return undefined
	}
}

/**
 * Convert the removed transition properties of a Part in place, removing them from the object.
 * Also adds the `type` to an outTransition which doesn't have one
 * @returns Whether the conversion changes playout behaviour
 */
export function convertLegacyPartTransitionPropsInPlace(part: PartWithLegacyTransitionProps): boolean {
	const { autoNextOutTransition, behaviourChanged } = convertLegacyAutoNextOverlap(part)
	if (autoNextOutTransition) part.autoNextOutTransition = autoNextOutTransition

	const outTransition = convertLegacyDisableNextInTransition(part) ?? convertLegacyOutTransitionType(part)
	if (outTransition) part.outTransition = outTransition

	delete part.autoNextOverlap
	delete part.disableNextInTransition

	return behaviourChanged
}
