import KoaRouter from '@koa/router'
import { IngestPart, IngestRundown, IngestSegment } from '@sofie-automation/blueprints-integration'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import Koa from 'koa'
import koaBodyParser from 'koa-bodyparser'
import { Meteor } from 'meteor/meteor'
import { check } from '../../../../lib/check'
import { logger } from '../../../../lib/logging'
import {
	deletePart,
	deletePlaylist,
	deletePlaylists,
	deleteRundown,
	deleteRundowns,
	deleteSegment,
	deleteSegments,
	getPart,
	getParts,
	getPlaylist,
	getPlaylists,
	getRundown,
	getRundowns,
	getSegment,
	getSegments,
	putParts,
	putRundown,
	putSegments,
} from './httpIngestServices'

const router = new KoaRouter()
export const httpIngestRouter = router

const bodyParser = koaBodyParser({
	jsonLimit: '200mb',
})

const validateBodyMiddleware = async (ctx: Koa.DefaultContext, next: () => Promise<any>) => {
	const contentType = 'application/json'
	try {
		if (ctx.request.type !== contentType) {
			throw new Meteor.Error(
				400,
				`Upload rundown: Invalid content-type, received ${
					ctx.request.type || 'undefined'
				}, expected ${contentType}`
			)
		}
		await next()
	} catch (e) {
		handleError(e, ctx)
	}
}

const handle200 = (ctx: Koa.DefaultContext, data?: any) => {
	ctx.response.type = 'application/json'
	ctx.response.status = 200
	ctx.response.body = data || ''
}

const handle201 = (ctx: Koa.DefaultContext, data?: any) => {
	ctx.response.type = 'application/json'
	ctx.response.status = 201
	ctx.response.body = data || ''
}

const handleError = (e: unknown, ctx: Koa.DefaultContext) => {
	ctx.response.type = 'text/plain'
	ctx.response.status = e instanceof Meteor.Error && typeof e.error === 'number' ? e.error : 500
	ctx.response.body = 'Error: ' + stringifyError(e)

	if (ctx.response.status !== 404) {
		logger.error(stringifyError(e))
	}
}

// Playlists

router.get('/playlists', async (ctx) => {
	try {
		const playlists = await getPlaylists()
		handle200(ctx, playlists)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.delete('/playlists', async (ctx) => {
	try {
		await deletePlaylists()
		handle200(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.get('/playlists/:playlistId', async (ctx) => {
	const playlistId = ctx.params.playlistId
	check(playlistId, String)

	try {
		const playlist = await getPlaylist(playlistId)
		handle200(ctx, playlist)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.delete('/playlists/:playlistId', async (ctx) => {
	const playlistId = ctx.params.playlistId
	check(playlistId, String)

	try {
		await deletePlaylist(playlistId)
		handle200(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

// Rundowns

router.put('/playlists/:playlistId/rundowns', bodyParser, validateBodyMiddleware, async (ctx) => {
	const playlistId = ctx.params.playlistId
	check(playlistId, String)

	try {
		const ingestRundown = ctx.request.body as IngestRundown
		if (!ingestRundown) throw new Meteor.Error(400, 'Upload rundown: Missing request body')
		if (typeof ingestRundown !== 'object') throw new Meteor.Error(400, 'Upload rundown: Invalid request body')

		await putRundown(playlistId, ingestRundown)

		handle201(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.get('/playlists/:playlistId/rundowns', async (ctx) => {
	const playlistId = ctx.params.playlistId
	check(playlistId, String)

	try {
		const rundowns = await getRundowns(playlistId)
		handle200(ctx, rundowns)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.delete('/playlists/:playlistId/rundowns', async (ctx) => {
	const playlistId = ctx.params.playlistId
	check(playlistId, String)

	try {
		await deleteRundowns(playlistId)
		handle200(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.get('/playlists/:playlistId/rundowns/:rundownId', async (ctx) => {
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)

	try {
		const rundown = await getRundown(playlistId, rundownId)
		handle200(ctx, rundown)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.delete('/playlists/:playlistId/rundowns/:rundownId', async (ctx) => {
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)

	try {
		await deleteRundown(playlistId, rundownId)
		handle200(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

// Segments

router.get('/playlists/:playlistId/rundowns/:rundownId/segments', async (ctx) => {
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)

	try {
		const segments = await getSegments(playlistId, rundownId)
		handle200(ctx, segments)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.delete('/playlists/:playlistId/rundowns/:rundownId/segments', async (ctx) => {
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)

	try {
		await deleteSegments(playlistId, rundownId)
		handle200(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.get('/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId', async (ctx) => {
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)
	const segmentId = ctx.params.segmentId
	check(segmentId, String)

	try {
		const segment = await getSegment(playlistId, rundownId, segmentId)
		handle200(ctx, segment)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.delete('/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId', async (ctx) => {
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)
	const segmentId = ctx.params.segmentId
	check(segmentId, String)

	try {
		await deleteSegment(playlistId, rundownId, segmentId)
		handle200(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

// PUT on collection is an exception; it allows us to batch-update segments
router.put('/playlists/:playlistId/rundowns/:rundownId/segments', bodyParser, validateBodyMiddleware, async (ctx) => {
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)

	try {
		const ingestSegments = ctx.request.body as IngestSegment[]
		if (!ingestSegments) throw new Meteor.Error(400, 'Upload rundown: Missing request body')
		if (!Array.isArray(ingestSegments)) throw new Meteor.Error(400, 'Upload rundown: Invalid request body')

		await putSegments(playlistId, rundownId, ingestSegments)

		handle201(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

// Parts

router.get('/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts', async (ctx) => {
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)
	const segmentId = ctx.params.segmentId
	check(segmentId, String)

	try {
		const parts = await getParts(playlistId, rundownId, segmentId)
		handle200(ctx, parts)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.get('/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts/:partId', async (ctx) => {
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)
	const segmentId = ctx.params.segmentId
	check(segmentId, String)
	const partId = ctx.params.partId
	check(partId, String)

	try {
		const part = await getPart(playlistId, rundownId, segmentId, partId)
		handle200(ctx, part)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.put(
	'/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts',
	bodyParser,
	validateBodyMiddleware,
	async (ctx) => {
		const playlistId = ctx.params.playlistId
		check(playlistId, String)
		const rundownId = ctx.params.rundownId
		check(rundownId, String)
		const segmentId = ctx.params.segmentId
		check(segmentId, String)

		try {
			const ingestParts = ctx.request.body as IngestPart[]
			if (!ingestParts) throw new Meteor.Error(400, 'Upload rundown: Missing request body')
			if (!Array.isArray(ingestParts)) throw new Meteor.Error(400, 'Upload rundown: Invalid request body')

			await putParts(playlistId, rundownId, segmentId, ingestParts)

			handle201(ctx)
		} catch (e) {
			handleError(e, ctx)
		}
	}
)

router.delete('/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts/:partId', async (ctx) => {
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)
	const segmentId = ctx.params.segmentId
	check(segmentId, String)
	const partId = ctx.params.partId
	check(partId, String)

	try {
		const part = await deletePart(playlistId, rundownId, segmentId, partId)
		handle200(ctx, part)
	} catch (e) {
		handleError(e, ctx)
	}
})
