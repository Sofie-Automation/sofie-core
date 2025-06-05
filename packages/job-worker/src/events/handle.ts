import {
	NotifyCurrentlyPlayingPartProps,
	PartInstanceTimingsProps,
	RundownDataChangedProps,
} from '@sofie-automation/corelib/dist/worker/events'
import { getCurrentTime } from '../lib'
import { JobContext } from '../jobs'
import { logger } from '../logging'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ReadonlyDeep } from 'type-fest'
import { RundownDataChangedEventContext, RundownTimingEventContext } from '../blueprints/context'
import { IBlueprintExternalMessageQueueObj } from '@sofie-automation/blueprints-integration'
import { protectString, unDeepString } from '@sofie-automation/corelib/dist/protectedString'
import _ = require('underscore')
import { getRandomId, omit, removeNullyProperties } from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { ICollection, MongoModifier } from '../db'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ExternalMessageQueueObjId, PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { runWithRundownLock } from '../ingest/lock'
import {
	PeripheralDevice,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { MOS } from '@sofie-automation/corelib'
import { executePeripheralDeviceFunction } from '../peripheralDevice'
import { DEFAULT_MOS_TIMEOUT_TIME } from '@sofie-automation/shared-lib/dist/core/constants'

async function getBlueprintAndDependencies(context: JobContext, rundown: ReadonlyDeep<DBRundown>) {
	const pShowStyle = context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)

	const [showStyle, playlist, blueprint] = await Promise.all([
		pShowStyle,
		context.directCollections.RundownPlaylists.findOne(rundown.playlistId),
		pShowStyle.then(async (ss) => context.getShowStyleBlueprint(ss._id)),
	])

	if (!playlist || playlist.studioId !== context.studioId)
		throw new Error(`Playlist "${rundown.playlistId}" not found!`)

	return {
		rundown,
		showStyle,
		playlist,
		blueprint: blueprint.blueprint,
	}
}

export async function handlePartInstanceTimings(context: JobContext, data: PartInstanceTimingsProps): Promise<void> {
	try {
		const timestamp = getCurrentTime()

		const partInstance = await context.directCollections.PartInstances.findOne(data.partInstanceId)
		if (!partInstance) throw new Error(`PartInstance "${data.partInstanceId}" not found!`)

		const rundown = await context.directCollections.Rundowns.findOne(partInstance.rundownId)
		if (!rundown || rundown.studioId !== context.studioId)
			throw new Error(`Rundown "${partInstance.rundownId}" not found!`)

		const { showStyle, playlist, blueprint } = await getBlueprintAndDependencies(context, rundown)

		if (playlist._id !== data.playlistId)
			throw new Error(
				`PartInstance "${data.partInstanceId}" does not belong to RundownPlaylist "${data.playlistId}"!`
			)

		if (blueprint.onRundownTimingEvent) {
			// The PartInstances(events) before and after the one we are processing
			const [previousPartInstance, nextPartInstance] = await Promise.all([
				context.directCollections.PartInstances.findOne(
					{
						rundownId: partInstance.rundownId,
						playlistActivationId: partInstance.playlistActivationId,
						takeCount: { $lt: partInstance.takeCount },
					},
					{
						sort: {
							takeCount: -1,
						},
					}
				),
				context.directCollections.PartInstances.findOne(
					{
						rundownId: partInstance.rundownId,
						playlistActivationId: partInstance.playlistActivationId,
						takeCount: { $gt: partInstance.takeCount },
					},
					{
						sort: {
							takeCount: 1,
						},
					}
				),
			])

			const context2 = new RundownTimingEventContext(
				context,
				{
					name: rundown.name,
					identifier: `rundownId=${rundown._id},timestamp=${timestamp}`,
				},
				showStyle,
				rundown,
				previousPartInstance,
				partInstance,
				nextPartInstance
			)

			try {
				const messages = await blueprint.onRundownTimingEvent(context2)
				await queueExternalMessages(context.directCollections.ExternalMessageQueue, rundown, playlist, messages)
			} catch (error) {
				logger.error(`Error in onRundownTimingEvent: ${stringifyError(error)}`)
			}
		}
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.onRundownTimingEvent: ${stringifyError(err)}`)
	}
}

export async function queueExternalMessages(
	// context: JobContext,
	collection: ICollection<ExternalMessageQueueObj>,
	rundown: ReadonlyDeep<DBRundown>,
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	messages: Array<IBlueprintExternalMessageQueueObj>
): Promise<void> {
	await Promise.allSettled(
		_.compact(messages).map(async (message) => {
			try {
				// check the output:
				if (!message.type) throw new Error('attribute .type missing!')
				if (!message.receiver) throw new Error('attribute .receiver missing!')
				if (!message.message) throw new Error('attribute .message missing!')

				// Save the output into the message queue, for later processing:
				if (message._id) {
					// Overwrite an existing message
					const messageId: ExternalMessageQueueObjId = protectString(message._id)

					const existingMessage = await collection.findOne(messageId)
					if (!existingMessage) throw new Error(`ExternalMessage ${message._id} not found!`)
					if (existingMessage.studioId !== rundown.studioId)
						throw new Error(`ExternalMessage ${message._id} is not in the right studio!`)
					if (existingMessage.rundownId !== rundown._id)
						throw new Error(`ExternalMessage ${message._id} is not in the right rundown!`)

					if (!playlist.rehearsal) {
						const m: MongoModifier<ExternalMessageQueueObj> = {
							$set: {
								...omit(message, '_id'),
							},
						}
						if (message.queueForLaterReason === undefined) {
							m.$unset = {
								queueForLaterReason: 1,
							}
						}
						await collection.update(existingMessage._id, m)
						// trigger sending message handled by watching the collection
					}
				} else {
					const now = getCurrentTime()
					let message2: ExternalMessageQueueObj = {
						_id: getRandomId(),

						...omit(message, '_id'),

						studioId: unDeepString(rundown.studioId),
						rundownId: rundown._id,

						created: now,
						tryCount: 0,
						expires: now + 35 * 24 * 3600 * 1000, // 35 days
						manualRetry: false,
					}
					message2 = removeNullyProperties(message2)
					if (!playlist.rehearsal) {
						// Don't save the message when running rehearsals
						await collection.insertOne(message2)
						// trigger sending message handled by watching the collection
					}
				}
			} catch (e) {
				logger.error(`Failed to save ExternalMessage: ${stringifyError(e)} (${JSON.stringify(message)})`)
			}
		})
	)
}

export async function handleRundownDataHasChanged(context: JobContext, data: RundownDataChangedProps): Promise<void> {
	try {
		const [rundown, playlist] = await Promise.all([
			context.directCollections.Rundowns.findOne({ _id: data.rundownId, studioId: context.studioId }),
			context.directCollections.RundownPlaylists.findOne({ _id: data.playlistId, studioId: context.studioId }),
		])

		// Called when the data in rundown is changed
		if (!rundown) {
			logger.error(`rundown missing in reportRundownDataHasChanged`)
		} else if (!playlist) {
			logger.error(`playlist missing in reportRundownDataHasChanged`)
		} else if (playlist._id !== rundown.playlistId) {
			logger.error(`rudnown does not belong to playlist in reportRundownDataHasChanged`)
		} else {
			const timestamp = getCurrentTime()
			const { showStyle, blueprint } = await getBlueprintAndDependencies(context, rundown)
			if (blueprint.onRundownDataChangedEvent) {
				const context2 = new RundownDataChangedEventContext(
					context,
					{
						name: rundown.name,
						identifier: `rundownId=${rundown._id},timestamp=${timestamp}`,
					},
					showStyle,
					rundown
				)

				const messages = await blueprint.onRundownDataChangedEvent(context2)
				await queueExternalMessages(context.directCollections.ExternalMessageQueue, rundown, playlist, messages)
			}
		}
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.onRundownDataChangedEvent: ${stringifyError(err)}`)
	}
}

export async function handleNotifyCurrentlyPlayingPart(
	context: JobContext,
	data: NotifyCurrentlyPlayingPartProps
): Promise<void> {
	const rundown = await context.directCollections.Rundowns.findOne(data.rundownId)
	if (!rundown) {
		logger.warn(`Rundown "${data.rundownId} is missing. Skipping notifyCurrentPlayingPart`)
		return
	}

	if (rundown.source.type !== 'nrcs') {
		logger.warn(`Rundown "${rundown._id} has no peripheralDevice. Skipping notifyCurrentPlayingPart`)
		return
	}

	const device = await context.directCollections.PeripheralDevices.findOne({
		_id: rundown.source.peripheralDeviceId,
		// Future: we really should be constraining this to the studio, but that is often only defined on the parent of this device
		// studioId: context.studioId,
		parentDeviceId: { $exists: true },
	})
	if (!device || !device.parentDeviceId) {
		logger.warn(
			`PeripheralDevice "${rundown.source.peripheralDeviceId}" for Rundown "${rundown._id} not found. Skipping notifyCurrentPlayingPart`
		)
		return
	}
	const parentDevice = await context.directCollections.PeripheralDevices.findOne({
		_id: device.parentDeviceId,
		'studioAndConfigId.studioId': context.studioId,
		parentDeviceId: { $exists: false },
	})
	if (!parentDevice) {
		logger.warn(
			`PeripheralDevice "${rundown.source.peripheralDeviceId}" for Rundown "${rundown._id} not found. Skipping notifyCurrentPlayingPart`
		)
		return
	}

	const previousPlayingPartExternalId: string | null = rundown.notifiedCurrentPlayingPartExternalId || null
	const currentPlayingPartExternalId: string | null = data.isRehearsal ? null : data.partExternalId

	// Lock the rundown so that we are allowed to write to it
	// This is technically a bit of a race condition, but is really low risk and low impact if it does
	await runWithRundownLock(context, rundown._id, async (rundown0) => {
		if (rundown0) {
			if (currentPlayingPartExternalId) {
				await context.directCollections.Rundowns.update(rundown._id, {
					$set: {
						notifiedCurrentPlayingPartExternalId: currentPlayingPartExternalId,
					},
				})
			} else {
				await context.directCollections.Rundowns.update(rundown._id, {
					$unset: {
						notifiedCurrentPlayingPartExternalId: 1,
					},
				})
			}
		}
	})

	// TODO: refactor this to be non-mos centric
	if (device.category === PeripheralDeviceCategory.INGEST && device.type === PeripheralDeviceType.MOS) {
		// Note: rundown may not be up to date anymore
		await notifyCurrentPlayingPartMOS(
			context,
			device,
			rundown.externalId,
			previousPlayingPartExternalId,
			currentPlayingPartExternalId
		)
	}
}

async function notifyCurrentPlayingPartMOS(
	context: JobContext,
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	oldPlayingPartExternalId: string | null,
	newPlayingPartExternalId: string | null
): Promise<void> {
	if (oldPlayingPartExternalId !== newPlayingPartExternalId) {
		// New implementation 2022 only sends PLAY, never stop, after getting advice from AP
		// Reason 1: NRK ENPS "sendt tid" (elapsed time) stopped working in ENPS 8/9 when doing STOP prior to PLAY
		// Reason 2: there's a delay between the STOP (yellow line disappears) and PLAY (yellow line re-appears), which annoys the users
		if (newPlayingPartExternalId) {
			try {
				await setStoryStatusMOS(
					context,
					peripheralDevice._id,
					rundownExternalId,
					newPlayingPartExternalId,
					MOS.IMOSObjectStatus.PLAY
				)
			} catch (error) {
				logger.error(`Error in setStoryStatus PLAY: ${stringifyError(error)}`)
			}
		}
	}
}

async function setStoryStatusMOS(
	context: JobContext,
	deviceId: PeripheralDeviceId,
	rundownExternalId: string,
	storyId: string,
	status: MOS.IMOSObjectStatus
): Promise<void> {
	logger.debug('setStoryStatus', { deviceId, externalId: rundownExternalId, storyId, status })
	return executePeripheralDeviceFunction(context, deviceId, DEFAULT_MOS_TIMEOUT_TIME + 1000, 'setStoryStatus', [
		rundownExternalId,
		storyId,
		status,
	])
}
