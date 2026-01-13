import { Meteor } from 'meteor/meteor'
import { getHash } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { getCurrentTime } from '../../lib/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { PeripheralDevice, PeripheralDeviceCategory } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { Rundown, RundownSourceNrcs } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { logger } from '../../logging'
import { profiler } from '../profiler'
import { IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { QueueIngestJob } from '../../worker/worker'
import { checkStudioExists } from '../../optimizations'
import {
	PartId,
	PeripheralDeviceId,
	RundownId,
	SegmentId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevices } from '../../collections'
import { getStudioIdFromDevice } from '../studio/lib'

/**
 * Run an ingest operation via the worker.
 * @param studioId Id of the studio
 * @param name The name/id of the operation
 * @param data Data for the operation
 * @returns Wrapped 'client safe' response. Includes translatable friendly error messages
 */
export async function runIngestOperation<T extends keyof IngestJobFunc>(
	studioId: StudioId,
	name: T,
	data: Parameters<IngestJobFunc[T]>[0]
): Promise<ReturnType<IngestJobFunc[T]>> {
	try {
		const job = await QueueIngestJob(name, studioId, data)

		const span = profiler.startSpan('queued-job')
		const res = await job.complete

		if (span) {
			// These timings may want tracking better, for when APM is not enabled
			try {
				const timings = await job.getTimings
				span.addLabels({
					startedTime: timings.startedTime ? timings.startedTime - timings.queueTime : '-',
					finishedTime: timings.finishedTime ? timings.finishedTime - timings.queueTime : '-',
					completedTime: timings.completedTime - timings.queueTime,
				})
			} catch (_e) {
				// Not worth handling
			}

			span.end()
		}

		return res
	} catch (e) {
		logger.warn(`Ingest operation "${name}" failed: ${stringifyError(e)}`)

		throw e
	}
}

export function getRundownId(studioId: StudioId, rundownExternalId: string): RundownId {
	if (!studioId) throw new Meteor.Error(500, 'getRundownId: studio not set!')
	if (!rundownExternalId) throw new Meteor.Error(401, 'getRundownId: rundownExternalId must be set!')
	return protectString<RundownId>(getHash(`${studioId}_${rundownExternalId}`))
}
export function getSegmentId(rundownId: RundownId, segmentExternalId: string): SegmentId {
	if (!rundownId) throw new Meteor.Error(401, 'getSegmentId: rundownId must be set!')
	if (!segmentExternalId) throw new Meteor.Error(401, 'getSegmentId: segmentExternalId must be set!')
	return protectString<SegmentId>(getHash(`${rundownId}_segment_${segmentExternalId}`))
}
export function getPartId(rundownId: RundownId, partExternalId: string): PartId {
	if (!rundownId) throw new Meteor.Error(401, 'getPartId: rundownId must be set!')
	if (!partExternalId) throw new Meteor.Error(401, 'getPartId: partExternalId must be set!')
	return protectString<PartId>(getHash(`${rundownId}_part_${partExternalId}`))
}

export async function fetchStudioIdFromDevice(peripheralDevice: PeripheralDevice): Promise<StudioId> {
	const span = profiler.startSpan('mosDevice.lib.getStudioIdFromDevice')

	const studioId = await getStudioIdFromDevice(peripheralDevice)
	if (!studioId) throw new Meteor.Error(500, 'PeripheralDevice "' + peripheralDevice._id + '" has no Studio')

	updateDeviceLastDataReceived(peripheralDevice._id)

	const studioExists = await checkStudioExists(studioId)
	if (!studioExists) throw new Meteor.Error(404, `Studio "${studioId}" of device "${peripheralDevice._id}" not found`)

	span?.end()
	return studioId
}
export async function getPeripheralDeviceFromRundown(
	rundown: Pick<Rundown, '_id' | 'source'>
): Promise<PeripheralDevice> {
	if (rundown.source.type !== 'nrcs' || !rundown.source.peripheralDeviceId)
		throw new Meteor.Error(404, `Rundown "${rundown._id}" is not from a NRCS`)

	const device = await PeripheralDevices.findOneAsync(rundown.source.peripheralDeviceId)
	if (!device)
		throw new Meteor.Error(
			404,
			`PeripheralDevice "${rundown.source.peripheralDeviceId}" of rundown "${rundown._id}" not found`
		)
	if (device.category !== PeripheralDeviceCategory.INGEST)
		throw new Meteor.Error(
			404,
			`PeripheralDevice "${rundown.source.peripheralDeviceId}" of rundown "${rundown._id}" is not an INGEST device!`
		)
	return device
}

function updateDeviceLastDataReceived(deviceId: PeripheralDeviceId) {
	PeripheralDevices.updateAsync(deviceId, {
		$set: {
			lastDataReceived: getCurrentTime(),
		},
	}).catch((err) => {
		logger.error(`Error in updateDeviceLastDataReceived "${deviceId}": ${stringifyError(err)}`)
	})
}

export function generateRundownSource(peripheralDevice: PeripheralDevice): RundownSourceNrcs {
	return {
		type: 'nrcs',
		peripheralDeviceId: peripheralDevice._id,
		nrcsName: peripheralDevice.category === PeripheralDeviceCategory.INGEST ? peripheralDevice.nrcsName : undefined,
	}
}
