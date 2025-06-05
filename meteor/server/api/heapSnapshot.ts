import * as v8 from 'node:v8'
import { Readable } from 'stream'
import { Meteor } from 'meteor/meteor'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import { fixValidPath } from '../lib/lib'
import { sleep } from '../lib/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { logger } from '../logging'
import { assertConnectionHasOneOfPermissions, RequestCredentials } from '../security/auth'

async function retrieveHeapSnapshot(cred: RequestCredentials): Promise<Readable> {
	assertConnectionHasOneOfPermissions(cred, 'developer')

	logger.warn('Taking heap snapshot, expect system to be unresponsive for a few seconds..')
	await sleep(100) // Allow the logger to catch up before continuing..

	const stream = v8.getHeapSnapshot()
	return stream
}

export const heapSnapshotPrivateApiRouter = new KoaRouter()

// Setup endpoints:
async function handleKoaResponse(ctx: Koa.ParameterizedContext, snapshotFcn: () => Promise<Readable>) {
	if (ctx.query.areYouSure !== 'yes') {
		ctx.response.status = 403
		ctx.response.body = '?areYouSure=yes'
		return
	}

	try {
		const stream = await snapshotFcn()

		ctx.response.type = 'application/octet-stream'
		ctx.response.attachment(fixValidPath(`sofie-heap-snapshot-${new Date().toISOString()}.heapsnapshot`))
		ctx.response.status = 200
		ctx.body = stream
		// ctx.response.body = JSON.stringify(snapshot, null, 4)
	} catch (e) {
		ctx.response.type = 'text/plain'
		ctx.response.status = e instanceof Meteor.Error && typeof e.error === 'number' ? e.error : 500
		ctx.response.body = 'Error: ' + stringifyError(e)

		if (ctx.response.status !== 404) {
			logger.error(stringifyError(e))
		}
	}
}

// Retrieve heap snapshot:
heapSnapshotPrivateApiRouter.get('/retrieve', async (ctx) => {
	return handleKoaResponse(ctx, async () => {
		return retrieveHeapSnapshot(ctx)
	})
})
