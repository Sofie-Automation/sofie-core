import { Meteor } from 'meteor/meteor'
import { protectString } from '../../lib/tempLib'
import { checkAccessAndGetPeripheralDevice } from '../../security/check'
import { MethodContext } from '../methodContext'
import { MediaObject } from '@sofie-automation/shared-lib/dist/core/model/MediaObjects'
import { MediaObjId, PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MediaObjectRevision } from '@sofie-automation/shared-lib/dist/peripheralDevice/mediaManager'
import { MediaObjects } from '../../collections'
import { getStudioIdFromDevice } from '../studio/lib'

export namespace MediaScannerIntegration {
	export async function getMediaObjectRevisions(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		collectionId: string
	): Promise<MediaObjectRevision[]> {
		// logger.debug('getMediaObjectRevisions')
		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		const studioId = await getStudioIdFromDevice(peripheralDevice)

		if (studioId) {
			const rawObjs = (await MediaObjects.findFetchAsync(
				{
					studioId: studioId,
					collectionId: collectionId,
				},
				{
					projection: {
						_id: 1,
						objId: 1,
						_rev: 1,
					},
				}
			)) as Array<Pick<MediaObject, '_id' | 'objId' | '_rev'>>

			return rawObjs.map((mo) => {
				return {
					id: mo.objId,
					rev: mo._rev,
				}
			})
		} else {
			throw new Meteor.Error(400, 'getMediaObjectRevisions: Device "' + peripheralDevice._id + '" has no studio')
		}
	}
	export async function updateMediaObject(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		collectionId: string,
		objId: string,
		doc: MediaObject | null
	): Promise<void> {
		// logger.debug('updateMediaObject')
		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		const studioId = await getStudioIdFromDevice(peripheralDevice)

		const _id: MediaObjId = protectString(collectionId + '_' + objId)
		if (doc === null) {
			await MediaObjects.removeAsync(_id)
		} else if (doc) {
			if (doc.mediaId !== doc.mediaId.toUpperCase())
				throw new Meteor.Error(400, 'mediaId must only use uppercase characters')

			const doc2 = {
				...doc,
				studioId: studioId,
				collectionId: collectionId,
				objId: objId,
				_id: _id,
			}

			// logger.debug(doc2)
			await MediaObjects.upsertAsync(_id, { $set: doc2 })
		} else {
			throw new Meteor.Error(400, 'missing doc argument')
		}
	}
	export async function clearMediaObjectCollection(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		collectionId: string
	): Promise<void> {
		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, context)

		const studioId = await getStudioIdFromDevice(peripheralDevice)

		await MediaObjects.removeAsync({ collectionId, studioId })
	}
}
