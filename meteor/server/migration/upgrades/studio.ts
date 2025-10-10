import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { BlueprintValidateConfigForStudioResult, StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { Meteor } from 'meteor/meteor'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { profiler } from '../../api/profiler'
import { Studios } from '../../collections'
import { logger } from '../../logging'
import { QueueStudioJob } from '../../worker/worker'
import { BlueprintFixUpConfigMessage } from '@sofie-automation/meteor-lib/dist/api/migration'

async function getStudio(studioId: StudioId): Promise<Pick<DBStudio, '_id'>> {
	const studio = (await Studios.findOneAsync(studioId, {
		projection: {
			_id: 1,
		},
	})) as Pick<DBStudio, '_id'> | undefined
	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found!`)

	return studio
}

export async function fixupConfigForStudio(studioId: StudioId): Promise<BlueprintFixUpConfigMessage[]> {
	await getStudio(studioId)

	const queuedJob = await QueueStudioJob(StudioJobs.BlueprintFixUpConfigForStudio, studioId, undefined)

	const span = profiler.startSpan('queued-job')
	try {
		const res = await queuedJob.complete
		// explicitly await before returning
		return res.messages
	} finally {
		span?.end()
	}
}

export async function ignoreFixupConfigForStudio(studioId: StudioId): Promise<void> {
	await getStudio(studioId)

	const queuedJob = await QueueStudioJob(StudioJobs.BlueprintIgnoreFixUpConfigForStudio, studioId, undefined)

	const span = profiler.startSpan('queued-job')
	try {
		const res = await queuedJob.complete
		// explicitly await before returning
		return res
	} finally {
		span?.end()
	}
}

export async function validateConfigForStudio(studioId: StudioId): Promise<BlueprintValidateConfigForStudioResult> {
	await getStudio(studioId)

	const queuedJob = await QueueStudioJob(StudioJobs.BlueprintValidateConfigForStudio, studioId, undefined)

	const span = profiler.startSpan('queued-job')
	try {
		const res = await queuedJob.complete
		// explicitly await before returning
		return res
	} finally {
		span?.end()
	}
}

export async function runUpgradeForStudio(studioId: StudioId): Promise<void> {
	logger.info(`Running upgrade for Studio "${studioId}"`)
	await getStudio(studioId)

	const queuedJob = await QueueStudioJob(StudioJobs.BlueprintUpgradeForStudio, studioId, undefined)

	const span = profiler.startSpan('queued-job')
	try {
		const res = await queuedJob.complete
		// explicitly await before returning
		return res
	} finally {
		span?.end()
	}
}

export async function updateStudioBaseline(studioId: StudioId): Promise<string | false> {
	logger.info(`Running baseline update for Studio "${studioId}"`)
	await getStudio(studioId)

	const queuedJob = await QueueStudioJob(StudioJobs.UpdateStudioBaseline, studioId, undefined)

	const span = profiler.startSpan('queued-job')
	try {
		const res = await queuedJob.complete
		// explicitly await before returning
		return res
	} finally {
		span?.end()
	}
}
