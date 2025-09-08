import { meteorPublish } from './lib/lib'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { RundownLayoutBase } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownLayouts, ShowStyleBases, ShowStyleVariants, TriggeredActions } from '../collections'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { DBTriggeredActions } from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { ShowStyleBaseId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { check, Match } from '../lib/check'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'

meteorPublish(
	CorelibPubSub.showStyleBases,
	async function (showStyleBaseIds: ShowStyleBaseId[] | null, _token: string | undefined) {
		check(showStyleBaseIds, Match.Maybe(Array))

		triggerWriteAccessBecauseNoCheckNecessary()

		// If values were provided, they must have values
		if (showStyleBaseIds && showStyleBaseIds.length === 0) return null

		// Add the requested filter
		const selector: MongoQuery<DBShowStyleBase> = {}
		if (showStyleBaseIds) selector._id = { $in: showStyleBaseIds }

		return ShowStyleBases.findWithCursor(selector)
	}
)

meteorPublish(
	CorelibPubSub.showStyleVariants,
	async function (
		showStyleBaseIds: ShowStyleBaseId[] | null,
		showStyleVariantIds: ShowStyleVariantId[] | null,
		_token: string | undefined
	) {
		check(showStyleBaseIds, Match.Maybe(Array))
		check(showStyleVariantIds, Match.Maybe(Array))

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

meteorPublish(
	MeteorPubSub.rundownLayouts,
	async function (showStyleBaseIds: ShowStyleBaseId[] | null, _token: string | undefined) {
		check(showStyleBaseIds, Match.Maybe(Array))

		triggerWriteAccessBecauseNoCheckNecessary()

		// If values were provided, they must have values
		if (showStyleBaseIds && showStyleBaseIds.length === 0) return null

		const selector: MongoQuery<RundownLayoutBase> = {}
		if (showStyleBaseIds) selector.showStyleBaseId = { $in: showStyleBaseIds }

		return RundownLayouts.findWithCursor(selector)
	}
)

meteorPublish(
	MeteorPubSub.triggeredActions,
	async function (showStyleBaseIds: ShowStyleBaseId[] | null, _token: string | undefined) {
		check(showStyleBaseIds, Match.Maybe(Array))

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
