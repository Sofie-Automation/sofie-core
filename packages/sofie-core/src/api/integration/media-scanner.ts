import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { checkAccessAndGetPeripheralDevice } from '../../security/check'
import { MethodContext } from '../methodContext'
import { MediaObject } from '@sofie-automation/shared-lib/dist/core/model/MediaObjects'
import { MediaObjId, PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MediaObjectRevision } from '@sofie-automation/shared-lib/dist/peripheralDevice/mediaManager'
import { MediaObjects } from '../../collections'
import { getStudioIdFromDevice } from '../studio/lib'
import { SofieError } from '@sofie-automation/corelib/dist/error'

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
			throw new SofieError(400, 'getMediaObjectRevisions: Device "' + peripheralDevice._id + '" has no studio')
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
		if (!studioId)
			throw new SofieError(400, 'updateMediaObject: Device "' + peripheralDevice._id + '" has no studio')

		const _id: MediaObjId = protectString(collectionId + '_' + objId)
		if (doc === null) {
			await MediaObjects.removeAsync(_id)
		} else if (doc) {
			if (doc.mediaId !== doc.mediaId.toUpperCase())
				throw new SofieError(400, 'mediaId must only use uppercase characters')

			// logger.debug(doc2)
			await MediaObjects.replaceAsync({
				...doc,
				studioId: studioId,
				collectionId: collectionId,
				objId: objId,
				_id: _id,
			})
		} else {
			throw new SofieError(400, 'missing doc argument')
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
