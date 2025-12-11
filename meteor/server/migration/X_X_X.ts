import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { MongoInternals } from 'meteor/mongo'
import { Studios } from '../collections'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */

export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	{
		id: `Drop media manager collections`,
		canBeRunAutomatically: true,
		validate: async () => {
			// If MongoInternals is not available, we are in a test environment
			if (!MongoInternals) return false

			const existingCollections = await MongoInternals.defaultRemoteCollectionDriver()
				.mongo.db.listCollections()
				.toArray()
			const collectionsToDrop = existingCollections.filter((c) =>
				['expectedMediaItems', 'mediaWorkFlows', 'mediaWorkFlowSteps'].includes(c.name)
			)
			if (collectionsToDrop.length > 0) {
				return `There are ${collectionsToDrop.length} obsolete collections to be removed: ${collectionsToDrop.map((c) => c.name).join(', ')}`
			}

			return false
		},
		migrate: async () => {
			const existingCollections = await MongoInternals.defaultRemoteCollectionDriver()
				.mongo.db.listCollections()
				.toArray()
			const collectionsToDrop = existingCollections.filter((c) =>
				['expectedMediaItems', 'mediaWorkFlows', 'mediaWorkFlowSteps'].includes(c.name)
			)
			for (const c of collectionsToDrop) {
				await MongoInternals.defaultRemoteCollectionDriver().mongo.db.dropCollection(c.name)
			}
		},
	},

	{
		id: 'Ensure a single studio',
		canBeRunAutomatically: true,
		validate: async () => {
			const studioCount = await Studios.countDocuments()
			if (studioCount === 0) return `No studios found`
			if (studioCount > 1) return `There are ${studioCount} studios, but only one is supported`
			return false
		},
		migrate: async () => {
			// Do nothing, the user will have to resolve this manually
		},
	},
])
