import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'

export interface MongoAPI {
	insertDocument(collectionName: CollectionName, newDocument: any): Promise<ProtectedString<any>>
	updateDocument(collectionName: CollectionName, selector: any, modifier: any, options: any): Promise<number>
	removeDocument(collectionName: CollectionName, selector: any): Promise<any>
}

export enum MongoAPIMethods {
	'insertDocument' = 'mongo.insert',
	'updateDocument' = 'mongo.update',
	'removeDocument' = 'mongo.remove',
}
