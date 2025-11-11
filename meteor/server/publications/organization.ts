import { meteorPublish } from './lib/lib'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { Evaluation } from '@sofie-automation/meteor-lib/dist/collections/Evaluations'
import { SnapshotItem } from '@sofie-automation/meteor-lib/dist/collections/Snapshots'
import { UserActionsLogItem } from '@sofie-automation/meteor-lib/dist/collections/UserActionsLog'
import { FindOptions } from '@sofie-automation/meteor-lib/dist/collections/lib'
import { DBOrganization } from '@sofie-automation/meteor-lib/dist/collections/Organization'
import { Blueprints, Evaluations, Organizations, Snapshots, UserActionsLog } from '../collections'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { BlueprintId, OrganizationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { check, Match } from '../lib/check'
import { getCurrentTime } from '../lib/lib'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import { assertConnectionHasOneOfPermissions } from '../security/auth'

meteorPublish(
	MeteorPubSub.organization,
	async function (organizationId: OrganizationId | null, _token: string | undefined) {
		triggerWriteAccessBecauseNoCheckNecessary()

		if (!organizationId) return null

		const selector: MongoQuery<DBOrganization> = { _id: organizationId }

		const modifier: FindOptions<DBOrganization> = {
			projection: {
				name: 1,
				applications: 1,
				broadcastMediums: 1,
				userRoles: 1, // to not expose too much information consider [`userRoles.${this.userId}`]: 1, and a method/publication for getting all the roles, or limiting the returned roles based on requesting user's role
			},
		}

		return Organizations.findWithCursor({ _id: selector.organizationId }, modifier)
	}
)

meteorPublish(
	CorelibPubSub.blueprints,
	async function (blueprintIds: BlueprintId[] | null, _token: string | undefined) {
		assertConnectionHasOneOfPermissions(this.connection, 'configure')

		check(blueprintIds, Match.Maybe(Array))

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
meteorPublish(MeteorPubSub.evaluations, async function (dateFrom: number, dateTo: number, _token: string | undefined) {
	triggerWriteAccessBecauseNoCheckNecessary()

	const selector: MongoQuery<Evaluation> = {
		timestamp: {
			$gte: dateFrom,
			$lt: dateTo,
		},
	}

	return Evaluations.findWithCursor(selector)
})
meteorPublish(MeteorPubSub.snapshots, async function (_token: string | undefined) {
	assertConnectionHasOneOfPermissions(this.connection, 'configure')

	const selector: MongoQuery<SnapshotItem> = {
		created: {
			$gt: getCurrentTime() - 30 * 24 * 3600 * 1000, // last 30 days
		},
	}

	return Snapshots.findWithCursor(selector)
})
meteorPublish(
	MeteorPubSub.userActionsLog,
	async function (dateFrom: number, dateTo: number, _token: string | undefined) {
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
