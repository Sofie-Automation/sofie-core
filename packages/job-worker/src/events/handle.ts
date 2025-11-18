import { PartInstanceTimingsProps, RundownDataChangedProps } from '@sofie-automation/corelib/dist/worker/events'
import { getCurrentTime } from '../lib/index.js'
import { JobContext } from '../jobs/index.js'
import { logger } from '../logging.js'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ReadonlyDeep } from 'type-fest'
import { RundownDataChangedEventContext, RundownTimingEventContext } from '../blueprints/context/index.js'
import { IBlueprintExternalMessageQueueObj } from '@sofie-automation/blueprints-integration'
import { protectString, unDeepString } from '@sofie-automation/corelib/dist/protectedString'
import _ from 'underscore'
import { getRandomId, omit, removeNullyProperties } from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { ICollection, MongoModifier } from '../db/index.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ExternalMessageQueueObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'

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
