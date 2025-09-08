import { registerClassToMeteorMethods } from '../methods'
import { MethodContextAPI } from './methodContext'
import { MongoAPI, MongoAPIMethods } from '@sofie-automation/meteor-lib/dist/api/mongo'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { ProtectedString } from '../lib/tempLib'
import { logger } from '../logging'
import { collectionsAllowDenyCache, collectionsCache } from '../collections/collection'
import { Meteor } from 'meteor/meteor'
import { checkHasOneOfPermissions, parseConnectionPermissions } from '../security/auth'
import { triggerWriteAccess } from '../security/securityVerify'

const hasOwn = Object.prototype.hasOwnProperty
const ALLOWED_UPDATE_OPERATIONS = {
	$inc: 1,
	$set: 1,
	$unset: 1,
	$addToSet: 1,
	$pop: 1,
	$pullAll: 1,
	$pull: 1,
	$pushAll: 1,
	$push: 1,
	$bit: 1,
}

class MongoAPIClass extends MethodContextAPI implements MongoAPI {
	async insertDocument(collectionName: CollectionName, _newDocument: any): Promise<ProtectedString<any>> {
		triggerWriteAccess()

		logger.error(`MongoAPI.insertDocument for "${collectionName}"`)
		throw new Error('Not supported')
	}

	async updateDocument(collectionName: CollectionName, selector: any, modifier: any, _options: any): Promise<number> {
		triggerWriteAccess()

		if (!this.connection) throw new Meteor.Error(403, 'Only supported from the client')

		const validator = collectionsAllowDenyCache.get(collectionName)
		if (!validator) throw new Meteor.Error(403, `Not allowed to update collection: "${collectionName}`)

		const collection = collectionsCache.get(collectionName)
		if (!collection) throw new Meteor.Error(403, `Unknown collection: "${collectionName}`)

		const permissions = parseConnectionPermissions(this.connection)
		if (!checkHasOneOfPermissions(permissions, collectionName, ...validator.requiredPermissions))
			throw new Meteor.Error(403, `Not allowed to update collection: "${collectionName}"`)

		let documentId: string | null = null
		if (typeof selector === 'string') {
			documentId = selector
		} else if (selector && typeof selector === 'object') {
			documentId = selector._id
		}
		if (!documentId || typeof documentId !== 'string') {
			throw new Meteor.Error(403, `Update operations can only do so by id: "${collectionName}"`)
		}

		const mutatorKeys = Object.keys(modifier)
		if (mutatorKeys.length === 0) {
			throw new Meteor.Error(403, 'Update modifier is not valid.')
		}

		// compute modified fields
		const modifiedFields = new Set<string>()
		mutatorKeys.forEach((op) => {
			const params = modifier[op]
			if (op.charAt(0) !== '$') {
				throw new Meteor.Error(403, 'Update modifier is not valid.')
			} else if (!hasOwn.call(ALLOWED_UPDATE_OPERATIONS, op)) {
				throw new Meteor.Error(403, `Access denied. Operator ${op} not allowed in a restricted collection.`)
			} else {
				Object.keys(params).forEach((field) => {
					// treat dotted fields as if they are replacing their
					// top-level part
					if (field.indexOf('.') !== -1) field = field.substring(0, field.indexOf('.'))

					// record the field we are trying to change
					modifiedFields.add(field)
				})
			}
		})

		const currentDocument = await collection.findOneAsync(selector)
		if (!currentDocument) throw new Meteor.Error(404, `Document not found`)

		// Perform check
		const isAllowed = await validator.update(permissions, currentDocument, Array.from(modifiedFields), modifier)
		if (!isAllowed) throw new Meteor.Error(403, `Not allowed to update collection: "${collectionName}"`)

		// Perform update
		return collection.updateAsync(currentDocument._id, modifier)
	}

	async removeDocument(collectionName: CollectionName, _selector: any): Promise<any> {
		triggerWriteAccess()

		logger.error(`MongoAPI.insertDocument for "${collectionName}"`)
		throw new Meteor.Error(500, 'Not supported')
	}
}
registerClassToMeteorMethods(MongoAPIMethods, MongoAPIClass, true)
