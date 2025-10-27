import { logger } from '../../../logging'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { Meteor } from 'meteor/meteor'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { IngestPart } from '@sofie-automation/blueprints-integration'
import { parseMosString } from './lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import _ from 'underscore'
import { TriggerReloadDataResponse } from '@sofie-automation/meteor-lib/dist/api/userActions'
import { generateRundownSource, getPeripheralDeviceFromRundown, runIngestOperation } from '../lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { DEFAULT_MOS_TIMEOUT_TIME } from '@sofie-automation/shared-lib/dist/core/constants'
import { executePeripheralDeviceFunctionWithCustomTimeout } from '../../peripheralDevice/executeFunction'
import { MOS } from '@sofie-automation/meteor-lib/dist/mos'

export namespace MOSDeviceActions {
	export async function reloadRundown(
		peripheralDevice: PeripheralDevice,
		rundown: Pick<Rundown, '_id' | 'studioId' | 'externalId'>
	): Promise<TriggerReloadDataResponse> {
		logger.info('reloadRundown ' + rundown._id)

		try {
			const mosRunningOrder: MOS.IMOSRunningOrder = await executePeripheralDeviceFunctionWithCustomTimeout(
				peripheralDevice._id,
				DEFAULT_MOS_TIMEOUT_TIME + 1000,
				{ functionName: 'triggerGetRunningOrder', args: [rundown.externalId] }
			)

			logger.info('triggerGetRunningOrder reply ' + mosRunningOrder.ID)
			logger.debug(mosRunningOrder)

			if (parseMosString(mosRunningOrder.ID) !== rundown.externalId) {
				throw new Meteor.Error(
					401,
					`Expected triggerGetRunningOrder reply for ${rundown.externalId} but got ${parseMosString(
						mosRunningOrder.ID
					)}`
				)
			}

			await runIngestOperation(rundown.studioId, IngestJobs.MosRundown, {
				rundownExternalId: rundown.externalId,
				mosRunningOrder: mosRunningOrder,
				isUpdateOperation: true,
				rundownSource: generateRundownSource(peripheralDevice),
			})

			// Since the Reload reply is asynchronously followed by ROFullStories, the reload is technically not completed at this point
			return TriggerReloadDataResponse.WORKING
		} catch (err) {
			if (_.isString(err) && err.match(/rundown does not exist/i)) {
				// Don't throw an error, instead return MISSING value
				return TriggerReloadDataResponse.MISSING
			} else {
				logger.error(`Error in MOSDeviceActions.reloadRundown: ${stringifyError(err)}`)
				throw err
			}
		}
	}

	export async function setPieceInOutPoint(
		rundown: Rundown,
		piece: Piece,
		partCache: IngestPart,
		inPoint: number,
		duration: number
	): Promise<void> {
		if (!partCache.payload) throw new Meteor.Error(500, `Part Cache for "${partCache.externalId}" missing payload!`)
		const mosPayload = partCache.payload as MOS.IMOSROFullStory
		if (!mosPayload.Body)
			throw new Meteor.Error(500, `Part Cache for "${partCache.externalId}" missing FullStory content!`)

		const mosTypes = MOS.getMosTypes(false)

		const story = mosPayload.Body.find(
			(item) =>
				item.itemType === 'storyItem' && mosTypes.mosString128.stringify(item.Content.ID) === piece.externalId
		)?.Content as MOS.IMOSItem | undefined

		if (!story) throw new Meteor.Error(404, `Story "${piece.externalId}" not found in mosPayload`)

		const timeBase = story.TimeBase || 1
		const modifiedFields = {
			EditorialStart: (inPoint * timeBase) as number | undefined,
			EditorialDuration: duration * timeBase,
			TimeBase: timeBase,
		}
		Object.assign(story, modifiedFields)

		// ENPS will doesn't send a 0-length EditorialStart, instead it just ommits it from the object
		if (modifiedFields.EditorialStart === 0) {
			modifiedFields.EditorialStart = undefined
		}

		const peripheralDevice = await getPeripheralDeviceFromRundown(rundown)

		const response = await executePeripheralDeviceFunctionWithCustomTimeout(
			peripheralDevice._id,
			// we need a very long timeout to make sure we receive notification from the device
			120 * 1000,
			{
				functionName: 'replaceStoryItem',
				args: [mosPayload.RunningOrderId, mosPayload.ID, story, modifiedFields],
			}
		)

		// If the response was a failed write, then reject
		if (response && response.mos && response.mos.roAck && response.mos.roAck.roStatus !== 'OK') throw response
	}
}
