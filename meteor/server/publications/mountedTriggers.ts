import { Meteor } from 'meteor/meteor'
import { CustomPublish, meteorCustomPublish } from '../lib/customPublication'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../logging'
import { DeviceTriggerMountedActionAdlibsPreview, DeviceTriggerMountedActions } from '../api/deviceTriggers/observer'
import { Mongo } from 'meteor/mongo'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import _ from 'underscore'
import { check } from 'meteor/check'
import {
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { checkAccessAndGetPeripheralDevice } from '../security/check'

const PUBLICATION_DEBOUNCE = 20

meteorCustomPublish(
	PeripheralDevicePubSub.mountedTriggersForDevice,
	PeripheralDevicePubSubCollectionsNames.mountedTriggers,
	async function (pub, deviceId: PeripheralDeviceId, deviceIds: string[], token: string | undefined) {
		check(deviceId, String)
		check(deviceIds, [String])

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, this)

		const studioId = peripheralDevice.studioAndConfigId?.studioId
		if (!studioId) throw new Meteor.Error(400, `Peripheral Device "${deviceId}" not attached to a studio`)

		cursorCustomPublish(
			pub,
			DeviceTriggerMountedActions.find({
				studioId,
				deviceId: {
					$in: deviceIds,
				},
			}),
			PeripheralDevicePubSub.mountedTriggersForDevice
		)
	}
)

meteorCustomPublish(
	PeripheralDevicePubSub.mountedTriggersForDevicePreview,
	PeripheralDevicePubSubCollectionsNames.mountedTriggersPreviews,
	async function (pub, deviceId: PeripheralDeviceId, token: string | undefined) {
		check(deviceId, String)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, this)

		const studioId = peripheralDevice.studioAndConfigId?.studioId
		if (!studioId) throw new Meteor.Error(400, `Peripheral Device "${deviceId}" not attached to a studio`)

		cursorCustomPublish(
			pub,
			DeviceTriggerMountedActionAdlibsPreview.find({
				studioId,
			}),
			PeripheralDevicePubSub.mountedTriggersForDevicePreview
		)
	}
)

interface CustomOptimizedPublishChanges<DBObj extends { _id: ProtectedString<any> }> {
	added: Map<DBObj['_id'], DBObj>
	changed: Map<DBObj['_id'], Pick<DBObj, '_id'> & Partial<DBObj>>
	removed: Set<DBObj['_id']>
}

function cursorCustomPublish<T extends { _id: ProtectedString<any> }>(
	pub: CustomPublish<T>,
	cursor: Mongo.Cursor<T>,
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

	const observer = cursor.observe({
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
	})

	pub.init(cursor.fetch())

	pub.onStop(() => {
		observer.stop()
		bufferChanged.cancel()
	})
}
