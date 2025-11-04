import _ from 'underscore'
import { MigrationStepCore } from '@sofie-automation/blueprints-integration'
import { objectPathGet } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { logger } from '../logging'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { AsyncOnlyMongoCollection } from '../collections/collection'
import { Collections } from '../collections/lib'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'

/**
 * Returns a migration step that ensures the provided property is set in the collection
 */
export function ensureCollectionProperty<T = any>(
	collectionName: CollectionName,
	selector: MongoQuery<T>,
	property: string,
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	defaultValue: any,
	dependOnResultFrom?: string
): Omit<MigrationStepCore, 'version'> {
	const collection = Collections.get(collectionName)
	if (!collection) throw new Meteor.Error(404, `Collection ${collectionName} not found`)

	return {
		id: `${collectionName}.${property}`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await collection.findFetchAsync(selector)

			for (const obj of objects) {
				const objValue = objectPathGet(obj, property)
				if (!objValue && objValue !== defaultValue) {
					return `${property} is missing on ${obj._id}`
				}
			}

			return false
		},
		migrate: async () => {
			const objects = await collection.findFetchAsync(selector)
			for (const obj of objects) {
				if (obj && objectPathGet(obj, property) !== defaultValue) {
					const m: Record<string, any> = {}
					m[property] = defaultValue
					logger.info(
						`Migration: Setting ${collectionName} object "${obj._id}".${property} to ${defaultValue}`
					)
					await collection.mutableCollection.updateAsync(obj._id, { $set: m })
				}
			}
		},
		dependOnResultFrom: dependOnResultFrom,
	}
}

export function removeCollectionProperty<T = any>(
	collectionName: CollectionName,
	selector: MongoQuery<T>,
	property: string,
	dependOnResultFrom?: string
): Omit<MigrationStepCore, 'version'> {
	const collection = Collections.get(collectionName)
	if (!collection) throw new Meteor.Error(404, `Collection ${collectionName} not found`)

	return {
		id: `${collectionName}.${property}`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await collection.findFetchAsync(selector)

			for (const obj of objects) {
				const objValue = objectPathGet(obj, property)
				if (objValue !== undefined) {
					return `${property} is set ${obj._id}`
				}
			}

			return false
		},
		migrate: async () => {
			const objects = await collection.findFetchAsync(selector)
			for (const obj of objects) {
				if (obj && objectPathGet(obj, property) !== undefined) {
					const m: Record<string, any> = {}
					m[property] = 1
					logger.info(`Migration: Removing property ${collectionName}."${obj._id}".${property}`)
					await collection.mutableCollection.updateAsync(obj._id, { $unset: m })
				}
			}
		},
		dependOnResultFrom: dependOnResultFrom,
	}
}

interface RenameContent {
	content: { [newValue: string]: string }
}
export function renamePropertiesInCollection<DBInterface extends { _id: ProtectedString<any> }>(
	id: string,
	collection: AsyncOnlyMongoCollection<DBInterface>,
	collectionName: string,
	renames: Partial<{ [newAttr in keyof DBInterface]: string | RenameContent }>,
	dependOnResultFrom?: string
): Omit<MigrationStepCore, 'version'> {
	const m: any = {
		$or: [],
	}
	const oldNames: { [oldAttr: string]: string } = {}
	for (const newAttr of Object.keys(renames)) {
		const oldAttr = renames[newAttr as keyof DBInterface]
		if (typeof oldAttr === 'string') {
			oldNames[oldAttr] = newAttr
		}
	}

	for (const newAttr of Object.keys(renames)) {
		const oldAttr: string | RenameContent | undefined = renames[newAttr as keyof DBInterface]
		if (oldAttr) {
			if (typeof oldAttr === 'string') {
				const o: Record<string, any> = {}
				o[oldAttr] = { $exists: true }
				m.$or.push(o)
			} else {
				const oldAttrRenameContent: RenameContent = oldAttr // for some reason, tsc complains otherwise

				const oldAttrActual = oldNames[newAttr] || newAttr // If the attribute has been renamed, rename it here as well

				// Select where a value is of the old, to-be-replaced value:
				const o: Record<string, any> = {}
				o[oldAttrActual] = { $in: Object.values<string>(oldAttrRenameContent.content) }
				m.$or.push(o)
			}
		}
	}
	return {
		id: id,
		canBeRunAutomatically: true,
		dependOnResultFrom: dependOnResultFrom,
		validate: async () => {
			const objCount = await collection.countDocuments(m)
			if (objCount > 0) return `${objCount} documents in ${collectionName} needs to be updated`
			return false
		},
		migrate: async () => {
			const docs = await collection.findFetchAsync(m)

			for (const doc0 of docs) {
				const doc = doc0 as any
				// Rename properties:
				for (const newAttr of Object.keys(renames)) {
					const oldAttr: string | RenameContent | undefined = renames[newAttr as keyof DBInterface]
					if (newAttr && oldAttr && newAttr !== oldAttr) {
						if (typeof oldAttr === 'string') {
							if (_.has(doc, oldAttr) && !_.has(doc, newAttr)) {
								doc[newAttr] = doc[oldAttr]
							}
							delete doc[oldAttr]
						}
					}
				}
				// Translate property contents:
				for (const newAttr of Object.keys(renames)) {
					const oldAttr: string | RenameContent | undefined = renames[newAttr as keyof DBInterface]
					if (newAttr && oldAttr && newAttr !== oldAttr) {
						if (typeof oldAttr !== 'string') {
							_.each(oldAttr.content, (oldValue, newValue) => {
								if (doc[newAttr] === oldValue) {
									doc[newAttr] = newValue as any
								}
							})
						}
					}
				}

				await collection.updateAsync(doc._id, doc)
			}
		},
	}
}
