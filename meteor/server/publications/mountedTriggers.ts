import { Meteor } from 'meteor/meteor'
import { z } from 'zod'
import { CustomPublish } from '../lib/customPublication'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../logging'
import { DeviceTriggerMountedActionAdlibsPreview, DeviceTriggerMountedActions } from '../api/deviceTriggers/observer'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import _ from 'underscore'
import { check } from '../lib/check'
import {
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { checkAccessAndGetPeripheralDevice } from '../security/check'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import type { PublicationRegistry } from '../publicationRegistry'

const PUBLICATION_DEBOUNCE = 20

export function registerMountedTriggersPublications(registry: PublicationRegistry): void {
	registry.customPublish(
		PeripheralDevicePubSub.mountedTriggersForDevice,
		PeripheralDevicePubSubCollectionsNames.mountedTriggers,
		async (context, pub, deviceId: PeripheralDeviceId, deviceIds: string[], token: string | undefined) => {
			check(deviceId, z.string())
			check(deviceIds, z.array(z.string()))

			const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, context)

			const studioId = peripheralDevice.studioAndConfigId?.studioId
			if (!studioId) throw new Meteor.Error(400, `Peripheral Device "${deviceId}" not attached to a studio`)

			cursorCustomPublish(
				pub,
				DeviceTriggerMountedActions,
				{
					studioId,
					deviceId: {
						$in: deviceIds,
					},
				},
				PeripheralDevicePubSub.mountedTriggersForDevice
			)
		}
	)

	registry.customPublish(
		PeripheralDevicePubSub.mountedTriggersForDevicePreview,
		PeripheralDevicePubSubCollectionsNames.mountedTriggersPreviews,
		async (context, pub, deviceId: PeripheralDeviceId, token: string | undefined) => {
			check(deviceId, z.string())

			const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, context)

			const studioId = peripheralDevice.studioAndConfigId?.studioId
			if (!studioId) throw new Meteor.Error(400, `Peripheral Device "${deviceId}" not attached to a studio`)

			cursorCustomPublish(
				pub,
				DeviceTriggerMountedActionAdlibsPreview,
				{
					studioId,
				},
				PeripheralDevicePubSub.mountedTriggersForDevicePreview
			)
		}
	)
}

interface CustomOptimizedPublishChanges<DBObj extends { _id: ProtectedString<any> }> {
	added: Map<DBObj['_id'], DBObj>
	changed: Map<DBObj['_id'], Pick<DBObj, '_id'> & Partial<DBObj>>
	removed: Set<DBObj['_id']>
}

function cursorCustomPublish<T extends { _id: ProtectedString<any> }>(
	pub: CustomPublish<T>,
	collection: InMemoryMongoCollection<T>,
	query: MongoQuery<T>,
	publicationName: PeripheralDevicePubSub
) {
	function createEmptyBuffer(): CustomOptimizedPublishChanges<T> {
		return {
			added: new Map(),
			changed: new Map(),
			removed: new Set(),
		}
	}

	let buffer: CustomOptimizedPublishChanges<T> = createEmptyBuffer()

	const bufferChanged = _.debounce(function bufferChanged() {
		const bufferToSend = buffer
		buffer = createEmptyBuffer()
		try {
			// this can now be async
			pub.changed({
				added: Array.from(bufferToSend.added.values()),
				changed: Array.from(bufferToSend.changed.values()),
				removed: Array.from(bufferToSend.removed.values()),
			})
		} catch (e) {
			logger.error(`Error while updating publication ${publicationName}: ${stringifyError(e)}`)
		}
	}, PUBLICATION_DEBOUNCE)

	const observer = collection.observe(
		{
			added: (doc) => {
				if (!pub.isReady) return
				const id = doc._id
				buffer.added.set(id, doc)
				// if the document with the same id has been marked as removed before, clear the removal
				buffer.removed.delete(id)
				buffer.changed.delete(id)
				bufferChanged()
			},
			changed: (doc) => {
				if (!pub.isReady) return
				const id = doc._id
				if (buffer.added.has(id)) {
					buffer.added.set(id, doc)
				} else {
					buffer.changed.set(id, doc)
				}
				bufferChanged()
			},
			removed: (doc) => {
				if (!pub.isReady) return
				const id = doc._id
				if (buffer.added.has(id)) {
					// if the document with the same id has been added before, clear the addition
					buffer.added.delete(id)
				} else {
					// if not, mark the deletion and clear any possible changes
					buffer.removed.add(id)
					buffer.changed.delete(id)
				}
				bufferChanged()
			},
		},
		query
	)

	pub.init(collection.findFetch(query))

	pub.onStop(() => {
		observer.stop()
		bufferChanged.cancel()
	})
}
