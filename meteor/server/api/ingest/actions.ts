import { getPeripheralDeviceFromRundown, runIngestOperation } from './lib'
import { MOSDeviceActions } from './mosDevice/actions'
import { Meteor } from 'meteor/meteor'
import { TriggerReloadDataResponse } from '@sofie-automation/meteor-lib/dist/api/userActions'
import { GenericDeviceActions } from './genericDevice/actions'
import { PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { VerifiedRundownForUserAction } from '../../security/check'
import { fetch } from 'meteor/fetch'
import { logger } from '../../logging'

/*
This file contains actions that can be performed on an ingest-device
*/
export namespace IngestActions {
	/**
	 * Trigger a reload of a rundown
	 */
	export async function reloadRundown(rundown: VerifiedRundownForUserAction): Promise<TriggerReloadDataResponse> {
		const rundownSourceType = rundown.source.type
		switch (rundown.source.type) {
			case 'snapshot':
				throw new Meteor.Error(400, `Cannot reload a snapshot rundown`)
			case 'http': {
				await runIngestOperation(rundown.studioId, IngestJobs.RegenerateRundown, {
					rundownExternalId: rundown.externalId,
				})

				return TriggerReloadDataResponse.COMPLETED
			}
			case 'httpIngest': {
				const resyncUrl = rundown.source.resyncUrl
				fetch(resyncUrl, { method: 'POST' })
					.then(() => {
						logger.info(`Reload rundown: resync request sent to "${resyncUrl}"`)
					})
					.catch((error) => {
						if (error.errno === 'ECONNREFUSED') {
							logger.error(
								`Reload rundown: could not establish connection with "${resyncUrl}" (ECONNREFUSED)`
							)
							return
						}
						logger.error(
							`Reload rundown: error occured while sending resync request to "${resyncUrl}", error: "${JSON.stringify(
								error
							)}"`
						)
					})

				return TriggerReloadDataResponse.WORKING
			}
			case 'testing': {
				await runIngestOperation(rundown.studioId, IngestJobs.CreateAdlibTestingRundownForShowStyleVariant, {
					showStyleVariantId: rundown.showStyleVariantId,
				})

				return TriggerReloadDataResponse.COMPLETED
			}
			case 'nrcs': {
				const device = await getPeripheralDeviceFromRundown(rundown)

				// The Rundown.orphaned flag will be reset by the response update

				// TODO: refactor this into something nicer perhaps?
				if (device.type === PeripheralDeviceType.MOS) {
					return MOSDeviceActions.reloadRundown(device, rundown)
				} else if (
					device.type === PeripheralDeviceType.SPREADSHEET ||
					device.type === PeripheralDeviceType.INEWS
				) {
					return GenericDeviceActions.reloadRundown(device, rundown)
				} else {
					throw new Meteor.Error(400, `The device ${device._id} does not support the method "reloadRundown"`)
				}
			}
			default:
				assertNever(rundown.source)
				throw new Meteor.Error(400, `Cannot reload rundown from source "${rundownSourceType}"`)
		}
	}
}
