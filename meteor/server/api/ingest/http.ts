import { z } from 'zod'
import { logger } from '../../logging'
import { check } from '../../lib/check'
import { Rundowns } from '../../collections'
import { getRundownId, runIngestOperation } from './lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { IngestRundown } from '@sofie-automation/blueprints-integration'
import { checkStudioExists } from '../../optimizations'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { getRundownNrcsName } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { SofieError } from '@sofie-automation/corelib/dist/error'

export const ingestRouter = new KoaRouter()

ingestRouter.post(
	'/:studioId',
	bodyParser({
		jsonLimit: '200mb',
	}),
	async (ctx) => {
		check(ctx.params.studioId, z.string())
		ctx.response.type = 'text/plain'

		try {
			if (ctx.request.type !== 'application/json')
				throw new SofieError(400, 'Upload rundown: Invalid content-type')

			const ingestRundown = ctx.request.body as IngestRundown
			if (!ingestRundown) throw new SofieError(400, 'Upload rundown: Missing request body')
			if (typeof ingestRundown !== 'object') throw new SofieError(400, 'Upload rundown: Invalid request body')

			await importIngestRundown(protectString<StudioId>(ctx.params.studioId), ingestRundown)

			ctx.response.status = 200
			ctx.response.body = ''
		} catch (e) {
			ctx.response.type = 'text/plain'
			ctx.response.status = e instanceof SofieError ? e.error : 500
			ctx.response.body = 'Error: ' + stringifyError(e)

			if (ctx.response.status !== 404) {
				logger.error(stringifyError(e))
			}
		}
	}
)

export async function importIngestRundown(studioId: StudioId, ingestRundown: IngestRundown): Promise<void> {
	const studioExists = await checkStudioExists(studioId)
	if (!studioExists) throw new SofieError(404, `Studio ${studioId} does not exist`)

	const rundownId = getRundownId(studioId, ingestRundown.externalId)

	const existingDbRundown = await Rundowns.findOneAsync(rundownId)
	// If the RO exists and is not from http then don't replace it. Otherwise, it is free to be replaced
	if (existingDbRundown && existingDbRundown.source.type !== 'http') {
		throw new SofieError(
			403,
			`Cannot replace existing rundown from '${getRundownNrcsName(existingDbRundown)}' with http data`
		)
	}

	await runIngestOperation(studioId, IngestJobs.UpdateRundown, {
		rundownExternalId: ingestRundown.externalId,
		ingestRundown: ingestRundown,
		isCreateAction: true,
		rundownSource: {
			type: 'http',
		},
	})
}
