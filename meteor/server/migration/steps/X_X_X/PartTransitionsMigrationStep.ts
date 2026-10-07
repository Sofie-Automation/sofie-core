import { MigrationStepCore } from '@sofie-automation/meteor-lib/dist/migrations'
import {
	IBlueprintPartOutTransition,
	IBlueprintPartOutTransitionAdditive,
	IBlueprintPartOutTransitionExclusive,
} from '@sofie-automation/blueprints-integration'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { PartInstances, Parts } from '../../../collections'
import { logger } from '../../../logging'

/** The transition properties of a Part, as they may be stored from before they were changed */
interface StoredPartTransitionProps {
	/** Replaced by `autoNextOutTransition` */
	autoNextOverlap?: number
	/** Replaced by an `'exclusive'` outTransition, or `disableNextInTransition` on the additive outTransition */
	disableNextInTransition?: boolean
	autoNextOutTransition?: IBlueprintPartOutTransitionExclusive
	/** Before the `type` was added, it was always additive */
	outTransition?: IBlueprintPartOutTransition | Pick<IBlueprintPartOutTransitionAdditive, 'duration'>
}

interface ConvertedPartTransitionProps {
	outTransition: IBlueprintPartOutTransition | undefined
	autoNextOutTransition: IBlueprintPartOutTransitionExclusive | undefined
	/** Whether the conversion changes playout behaviour */
	behaviourChanged: boolean
}

/**
 * Convert the stored transition properties of a Part:
 * - `outTransition` without a `type` becomes additive
 * - `autoNextOverlap` becomes an `autoNextOutTransition`
 * - `disableNextInTransition` becomes an `'exclusive'` outTransition, or is moved onto the additive outTransition
 */
function convertPartTransitionProps(part: StoredPartTransitionProps): ConvertedPartTransitionProps {
	let outTransition: IBlueprintPartOutTransition | undefined
	if (part.outTransition) {
		outTransition = 'type' in part.outTransition ? part.outTransition : { ...part.outTransition, type: 'additive' }
	}

	if (part.disableNextInTransition) {
		if (!outTransition) {
			// A cut, which ignores the next inTransition
			outTransition = {
				type: 'exclusive',
				blockTakeDuration: 0,
				partKeepaliveDuration: 0,
				nextPartContentDelayDuration: 0,
			}
		} else if (outTransition.type === 'additive') {
			outTransition = { ...outTransition, disableNextInTransition: true }
		}
		// An exclusive outTransition already ignores the next inTransition
	}

	let autoNextOutTransition: IBlueprintPartOutTransitionExclusive | undefined
	let behaviourChanged = false
	if (part.autoNextOverlap && part.autoNextOverlap > 0 && !part.autoNextOutTransition) {
		autoNextOutTransition = {
			type: 'exclusive',
			blockTakeDuration: 0,
			partKeepaliveDuration: part.autoNextOverlap,
			nextPartContentDelayDuration: 0,
		}
		// Previously an additive outTransition was combined with the overlap, now the autoNextOutTransition replaces it
		behaviourChanged = outTransition?.type === 'additive'
	}

	return {
		outTransition: outTransition !== part.outTransition ? outTransition : undefined,
		autoNextOutTransition,
		behaviourChanged,
	}
}

export class PartTransitionsMigrationStep implements Omit<MigrationStepCore, 'version'> {
	public readonly id = `Part convert outTransition, autoNextOverlap and disableNextInTransition`
	public readonly canBeRunAutomatically = true

	public async validate(): Promise<boolean | string> {
		const partCount = await Parts.countDocuments(this.getSelector(''))
		const partInstanceCount = await PartInstances.countDocuments(this.getSelector('part.'))

		if (partCount || partInstanceCount) {
			return `There are ${partCount} Parts and ${partInstanceCount} PartInstances with transition properties that must be converted`
		}

		return false
	}

	public async migrate(): Promise<void> {
		const changedIds: string[] = []

		const parts = await Parts.findFetchAsync(this.getSelector(''))
		for (const part of parts) {
			const converted = convertPartTransitionProps(part as StoredPartTransitionProps)
			if (converted.behaviourChanged) changedIds.push(unprotectString(part._id))

			await Parts.mutableCollection.updateAsync(part._id, this.getModifier('', converted))
		}

		const partInstances = await PartInstances.findFetchAsync(this.getSelector('part.'))
		for (const partInstance of partInstances) {
			const converted = convertPartTransitionProps(partInstance.part as StoredPartTransitionProps)
			if (converted.behaviourChanged) changedIds.push(unprotectString(partInstance._id))

			await PartInstances.mutableCollection.updateAsync(partInstance._id, this.getModifier('part.', converted))
		}

		if (changedIds.length) {
			logger.warn(
				`Parts and PartInstances with both autoNextOverlap and an additive outTransition will no longer use the outTransition when autonexting: ${changedIds.join(', ')}`
			)
		}
	}

	private getSelector(prefix: '' | 'part.'): any {
		return {
			$or: [
				{ [`${prefix}autoNextOverlap`]: { $exists: true } },
				{ [`${prefix}disableNextInTransition`]: { $exists: true } },
				{ [`${prefix}outTransition`]: { $exists: true }, [`${prefix}outTransition.type`]: { $exists: false } },
			],
		}
	}

	private getModifier(prefix: '' | 'part.', converted: ConvertedPartTransitionProps): any {
		const $set: Partial<Record<string, DBPart['outTransition'] | DBPart['autoNextOutTransition']>> = {}
		if (converted.outTransition) $set[`${prefix}outTransition`] = converted.outTransition
		if (converted.autoNextOutTransition) $set[`${prefix}autoNextOutTransition`] = converted.autoNextOutTransition

		return {
			...(Object.keys($set).length ? { $set } : {}),
			$unset: {
				[`${prefix}autoNextOverlap`]: 1,
				[`${prefix}disableNextInTransition`]: 1,
			},
		}
	}
}
