import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { Evaluation } from '@sofie-automation/meteor-lib/dist/collections/Evaluations'
import { SnapshotItem } from '@sofie-automation/meteor-lib/dist/collections/Snapshots'
import { UserActionsLogItem } from '@sofie-automation/meteor-lib/dist/collections/UserActionsLog'
import { Blueprints, Evaluations, Snapshots, UserActionsLog } from '../collections'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { check, zAnyArray } from '../lib/check'
import { getCurrentTime } from '../lib/lib'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import { assertConnectionHasOneOfPermissions } from '../security/auth'
import type { PublicationRegistry } from '../publicationRegistry'

export function registerOrganizationPublications(registry: PublicationRegistry): void {
	registry.publish(
		CorelibPubSub.blueprints,
		async (context, blueprintIds: BlueprintId[] | null, _token: string | undefined) => {
			assertConnectionHasOneOfPermissions(context.connection, 'configure')

			check(blueprintIds, zAnyArray.nullish())

			// If values were provided, they must have values
			if (blueprintIds && blueprintIds.length === 0) return null

			// Add the requested filter
			const selector: MongoQuery<Blueprint> = {}
			if (blueprintIds) selector._id = { $in: blueprintIds }

			return Blueprints.findWithCursor(selector, {
				projection: {
					code: 0,
				},
			})
		}
	)
	registry.publish(
		MeteorPubSub.evaluations,
		async (_context, dateFrom: number, dateTo: number, _token: string | undefined) => {
			triggerWriteAccessBecauseNoCheckNecessary()

			const selector: MongoQuery<Evaluation> = {
				timestamp: {
					$gte: dateFrom,
					$lt: dateTo,
				},
			}

			return Evaluations.findWithCursor(selector)
		}
	)
	registry.publish(MeteorPubSub.snapshots, async (context, _token: string | undefined) => {
		assertConnectionHasOneOfPermissions(context.connection, 'configure')

		const selector: MongoQuery<SnapshotItem> = {
			created: {
				$gt: getCurrentTime() - 30 * 24 * 3600 * 1000, // last 30 days
			},
		}

		return Snapshots.findWithCursor(selector)
	})
	registry.publish(
		MeteorPubSub.userActionsLog,
		async (_context, dateFrom: number, dateTo: number, _token: string | undefined) => {
			triggerWriteAccessBecauseNoCheckNecessary()

			const selector: MongoQuery<UserActionsLogItem> = {
				timestamp: {
					$gte: dateFrom,
					$lt: dateTo,
				},
			}

			return UserActionsLog.findWithCursor(selector, {
				limit: 10_000, // this is to prevent having a publication that produces a very large array
			})
		}
	)
}
