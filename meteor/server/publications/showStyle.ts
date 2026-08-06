import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { RundownLayoutBase } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownLayouts, ShowStyleBases, ShowStyleVariants, TriggeredActions } from '../collections'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { DBTriggeredActions } from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { ShowStyleBaseId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { check, zAnyArray } from '../lib/check'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import type { PublicationRegistry } from '../publicationRegistry'

export function registerShowStylePublications(registry: PublicationRegistry): void {
	registry.publish(
		CorelibPubSub.showStyleBases,
		async (_context, showStyleBaseIds: ShowStyleBaseId[] | null, _token: string | undefined) => {
			check(showStyleBaseIds, zAnyArray.nullish())

			triggerWriteAccessBecauseNoCheckNecessary()

			// If values were provided, they must have values
			if (showStyleBaseIds && showStyleBaseIds.length === 0) return null

			// Add the requested filter
			const selector: MongoQuery<DBShowStyleBase> = {}
			if (showStyleBaseIds) selector._id = { $in: showStyleBaseIds }

			return ShowStyleBases.findWithCursor(selector)
		}
	)

	registry.publish(
		CorelibPubSub.showStyleVariants,
		async (
			_context,
			showStyleBaseIds: ShowStyleBaseId[] | null,
			showStyleVariantIds: ShowStyleVariantId[] | null,
			_token: string | undefined
		) => {
			check(showStyleBaseIds, zAnyArray.nullish())
			check(showStyleVariantIds, zAnyArray.nullish())

			triggerWriteAccessBecauseNoCheckNecessary()

			// If values were provided, they must have values
			if (showStyleBaseIds && showStyleBaseIds.length === 0) return null
			if (showStyleVariantIds && showStyleVariantIds.length === 0) return null

			// Add the requested filter
			const selector: MongoQuery<DBShowStyleVariant> = {}
			if (showStyleBaseIds) selector.showStyleBaseId = { $in: showStyleBaseIds }
			if (showStyleVariantIds) selector._id = { $in: showStyleVariantIds }

			return ShowStyleVariants.findWithCursor(selector)
		}
	)

	registry.publish(
		MeteorPubSub.rundownLayouts,
		async (_context, showStyleBaseIds: ShowStyleBaseId[] | null, _token: string | undefined) => {
			check(showStyleBaseIds, zAnyArray.nullish())

			triggerWriteAccessBecauseNoCheckNecessary()

			// If values were provided, they must have values
			if (showStyleBaseIds && showStyleBaseIds.length === 0) return null

			const selector: MongoQuery<RundownLayoutBase> = {}
			if (showStyleBaseIds) selector.showStyleBaseId = { $in: showStyleBaseIds }

			return RundownLayouts.findWithCursor(selector)
		}
	)

	registry.publish(
		MeteorPubSub.triggeredActions,
		async (_context, showStyleBaseIds: ShowStyleBaseId[] | null, _token: string | undefined) => {
			check(showStyleBaseIds, zAnyArray.nullish())

			triggerWriteAccessBecauseNoCheckNecessary()

			const selector: MongoQuery<DBTriggeredActions> =
				showStyleBaseIds && showStyleBaseIds.length > 0
					? {
							$or: [
								{
									showStyleBaseId: null,
								},
								{
									showStyleBaseId: { $in: showStyleBaseIds },
								},
							],
						}
					: { showStyleBaseId: null }

			return TriggeredActions.findWithCursor(selector)
		}
	)
}
