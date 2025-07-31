import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { Blueprints, ShowStyleBases, ShowStyleVariants, Studios } from '../collections'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ObserveChangesHelper } from '../collections/lib'
import { Meteor } from 'meteor/meteor'

const ObserveChangeBufferTimeout = 100

/**
 * Setup some observers to ensure that the `blueprintConfigWithOverrides.defaults` is kept up to date whenever the `blueprintId` or `blueprintConfigPresetId` of the document changes.
 * Future: It would be nice to not do this through observers, but due to how data updates are done currently, it will be hard to reliably intercept the calls and perform this
 */

/**
 * Whenever the Studio changes the blueprint or config preset, ensure the config is synced across
 * We want it synced across, so that if the config-preset is removed, then there is some config that can be used
 */
Meteor.startup(async () => {
	const doUpdate = async (doc: DBStudio): Promise<void> => {
		const markUnlinked = async () => {
			await Studios.updateAsync(doc._id, {
				$set: {
					blueprintConfigPresetIdUnlinked: true,
				},
			})
		}

		if (!doc.blueprintId || !doc.blueprintConfigPresetId) {
			await markUnlinked()
			return
		}

		const blueprint = (await Blueprints.findOneAsync(
			{ _id: doc.blueprintId, blueprintType: BlueprintManifestType.STUDIO },
			{ projection: { _id: 1, studioConfigPresets: 1 } }
		)) as Pick<Blueprint, '_id' | 'studioConfigPresets'> | undefined

		if (!blueprint?.studioConfigPresets) {
			await markUnlinked()
			return
		}

		const configPreset = blueprint.studioConfigPresets[doc.blueprintConfigPresetId]
		if (!configPreset) {
			await markUnlinked()
			return
		}

		await Studios.updateAsync(doc._id, {
			$set: {
				blueprintConfigPresetIdUnlinked: false,
				'blueprintConfigWithOverrides.defaults': configPreset.config,
			},
		})
	}

	await ObserveChangesHelper(
		Studios,
		['blueprintConfigPresetId', 'blueprintId'],
		doUpdate,
		ObserveChangeBufferTimeout
	)
})

/**
 * Whenever the ShowStyleBase changes the blueprint or config preset, ensure the config is synced across
 * We want it synced across, so that if the config-preset is removed, then there is some config that can be used
 */
Meteor.startup(async () => {
	const doUpdate = async (doc: DBShowStyleBase): Promise<void> => {
		const markUnlinked = async () => {
			await Promise.all([
				ShowStyleBases.updateAsync(doc._id, {
					$set: {
						blueprintConfigPresetIdUnlinked: true,
					},
				}),

				ShowStyleVariants.updateAsync(
					{
						showStyleBaseId: doc._id,
					},
					{
						$set: {
							blueprintConfigPresetIdUnlinked: true,
						},
					},
					{ multi: true }
				),
			])
		}

		if (!doc.blueprintId || !doc.blueprintConfigPresetId) {
			await markUnlinked()
			return
		}

		const blueprint = (await Blueprints.findOneAsync(
			{ _id: doc.blueprintId, blueprintType: BlueprintManifestType.SHOWSTYLE },
			{ projection: { _id: 1, showStyleConfigPresets: 1 } }
		)) as Pick<Blueprint, '_id' | 'showStyleConfigPresets'> | undefined

		if (!blueprint?.showStyleConfigPresets) {
			await markUnlinked()
			return
		}

		const configPreset = blueprint.showStyleConfigPresets[doc.blueprintConfigPresetId]
		if (!configPreset) {
			await markUnlinked()
			return
		}

		const variants = (await ShowStyleVariants.findFetchAsync(
			{ showStyleBaseId: doc._id },
			{ projection: { blueprintConfigPresetId: 1 } }
		)) as Pick<DBShowStyleVariant, '_id' | 'blueprintConfigPresetId'>[]

		const ps: Promise<unknown>[] = [
			ShowStyleBases.updateAsync(doc._id, {
				$set: {
					blueprintConfigPresetIdUnlinked: false,
					'blueprintConfigWithOverrides.defaults': configPreset.config,
				},
			}),
		]

		for (const variant of variants) {
			const variantPreset = variant.blueprintConfigPresetId
				? configPreset.variants[variant.blueprintConfigPresetId]
				: undefined

			if (variantPreset) {
				ps.push(
					ShowStyleVariants.updateAsync(variant._id, {
						$set: {
							blueprintConfigPresetIdUnlinked: false,
							'blueprintConfigWithOverrides.defaults': variantPreset.config,
						},
					})
				)
			} else {
				ps.push(
					ShowStyleVariants.updateAsync(variant._id, {
						$set: {
							blueprintConfigPresetIdUnlinked: true,
						},
					})
				)
			}
		}

		await Promise.all(ps)
	}

	await ObserveChangesHelper(
		ShowStyleBases,
		['blueprintConfigPresetId', 'blueprintId'],
		doUpdate,
		ObserveChangeBufferTimeout
	)
})

/**
 * Whenever the ShowStyleVariant changes the config preset, ensure the config is synced across
 * We want it synced across, so that if the config-preset is removed, then there is some config that can be used
 */
Meteor.startup(async () => {
	const doUpdate = async (doc: DBShowStyleVariant): Promise<void> => {
		const markUnlinked = async () => {
			await ShowStyleVariants.updateAsync(doc._id, {
				$set: {
					blueprintConfigPresetIdUnlinked: true,
				},
			})
		}
		if (!doc.blueprintConfigPresetId) {
			return markUnlinked()
		}

		const showStyleBase = await ShowStyleBases.findOneAsync(doc.showStyleBaseId)
		if (!showStyleBase?.blueprintId || !showStyleBase.blueprintConfigPresetId) {
			return markUnlinked()
		}

		const blueprint = (await Blueprints.findOneAsync(
			{ _id: showStyleBase.blueprintId, blueprintType: BlueprintManifestType.SHOWSTYLE },
			{ projection: { _id: 1, showStyleConfigPresets: 1 } }
		)) as Pick<Blueprint, '_id' | 'showStyleConfigPresets'> | undefined

		if (!blueprint?.showStyleConfigPresets) {
			return markUnlinked()
		}

		const configPreset = blueprint.showStyleConfigPresets[showStyleBase.blueprintConfigPresetId]
		if (!configPreset) {
			return markUnlinked()
		}

		const variantPreset = configPreset.variants[doc.blueprintConfigPresetId]
		if (!variantPreset) {
			return markUnlinked()
		}

		await ShowStyleVariants.updateAsync(doc._id, {
			$set: {
				blueprintConfigPresetIdUnlinked: false,
				'blueprintConfigWithOverrides.defaults': variantPreset.config,
			},
		})
	}

	await ObserveChangesHelper(
		ShowStyleVariants,
		['blueprintConfigPresetId', 'showStyleBaseId'],
		doUpdate,
		ObserveChangeBufferTimeout
	)
})
