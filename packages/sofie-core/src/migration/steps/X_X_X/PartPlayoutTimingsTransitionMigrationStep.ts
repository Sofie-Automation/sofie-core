import { MigrationStepCore } from '@sofie-automation/meteor-lib/dist/migrations'
import { PartTransitionSource } from '@sofie-automation/corelib/dist/playout/timings'
import { PartInstances } from '../../../collections'
import { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'

const SELECTOR: MongoQuery<PartInstance> = {
	partPlayoutTimings: { $exists: true },
	$or: [
		{ 'partPlayoutTimings.transitionSource': { $exists: false } },
		{ 'partPlayoutTimings.blockTakeDuration': { $exists: false } },
	],
}

export class PartPlayoutTimingsTransitionMigrationStep implements Omit<MigrationStepCore, 'version'> {
	public readonly id = `PartInstance add transitionSource and blockTakeDuration to partPlayoutTimings`
	public readonly canBeRunAutomatically = true

	public async validate(): Promise<boolean | string> {
		const count = await PartInstances.countDocuments(SELECTOR)

		if (count) {
			return `There are ${count} PartInstances with partPlayoutTimings missing the transitionSource or blockTakeDuration`
		}

		return false
	}

	public async migrate(): Promise<void> {
		const partInstances = await PartInstances.findFetchAsync(SELECTOR)

		for (const partInstance of partInstances) {
			const timings = partInstance.partPlayoutTimings
			if (!timings) continue

			// Infer the transition which was used from the stored timings.
			// Before this was stored, only an inTransition or an autoNextOverlap could have been used
			let transitionSource: PartTransitionSource
			let blockTakeDuration: number
			if (typeof timings.inTransitionStart === 'number') {
				transitionSource = 'inTransition'
				blockTakeDuration = partInstance.part.inTransition?.blockTakeDuration ?? 0
			} else if (timings.fromPartKeepalive > 0) {
				// An autoNextOverlap, which is now an autoNextOutTransition
				transitionSource = 'autoNextOutTransition'
				blockTakeDuration = 0
			} else {
				transitionSource = 'none'
				blockTakeDuration = 0
			}

			await PartInstances.mutableCollection.updateAsync(partInstance._id, {
				$set: {
					'partPlayoutTimings.transitionSource': transitionSource,
					'partPlayoutTimings.blockTakeDuration': blockTakeDuration,
				},
			})
		}
	}
}
