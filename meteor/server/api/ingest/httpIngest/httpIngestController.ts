import KoaRouter from '@koa/router'
import { IngestPart, IngestSegment } from '@sofie-automation/blueprints-integration'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import Koa from 'koa'
import koaBodyParser from 'koa-bodyparser'
import { Meteor } from 'meteor/meteor'
import { check } from '../../../../lib/check'
import { logger } from '../../../../lib/logging'
import {
	deletePart,
	deleteParts,
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
	postPart,
	postRundown,
	postSegment,
	putPart,
	putParts,
	putRundown,
	putRundowns,
	putSegment,
	putSegments,
} from './httpIngestServices'
import { HttpIngestRundown } from './httpIngestTypes'

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

/**
 * OK.
 */
const handle200 = (ctx: Koa.DefaultContext, data?: any) => {
	ctx.response.type = 'application/json'
	ctx.response.status = 200
	ctx.response.body = data || ''
}

/**
 * Request accepted.
 */
const handle202 = (ctx: Koa.DefaultContext, data?: any) => {
	ctx.response.type = 'application/json'
	ctx.response.status = 202
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

router.get('/:studioId/playlists', async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)

	try {
		const playlists = await getPlaylists(studioId)
		handle200(ctx, playlists)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.delete('/:studioId/playlists', async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)

	try {
		await deletePlaylists(studioId)
		handle202(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.get('/:studioId/playlists/:playlistId', async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)

	try {
		const playlist = await getPlaylist(studioId, playlistId)
		handle200(ctx, playlist)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.delete('/:studioId/playlists/:playlistId', async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)

	try {
		await deletePlaylist(studioId, playlistId)
		handle202(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

// Rundowns

// Get rundown
router.get('/:studioId/playlists/:playlistId/rundowns/:rundownId', async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)

	try {
		const rundown = await getRundown(studioId, playlistId, rundownId)
		handle200(ctx, rundown)
	} catch (e) {
		handleError(e, ctx)
	}
})

// Get rundowns
router.get('/:studioId/playlists/:playlistId/rundowns', async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)

	try {
		const rundowns = await getRundowns(studioId, playlistId)
		handle200(ctx, rundowns)
	} catch (e) {
		handleError(e, ctx)
	}
})

// Create rundown
router.post('/:studioId/playlists/:playlistId/rundowns', bodyParser, validateBodyMiddleware, async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)

	try {
		const ingestRundown = ctx.request.body as HttpIngestRundown
		if (!ingestRundown) throw new Meteor.Error(400, 'Upload rundown: Missing request body')
		if (typeof ingestRundown !== 'object') throw new Meteor.Error(400, 'Upload rundown: Invalid request body')

		await postRundown(studioId, playlistId, ingestRundown)

		handle202(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

// Update rundown
router.put('/:studioId/playlists/:playlistId/rundowns/:rundownId', bodyParser, validateBodyMiddleware, async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)

	try {
		const ingestRundown = ctx.request.body as HttpIngestRundown
		if (!ingestRundown) throw new Meteor.Error(400, 'Upload rundown: Missing request body')
		if (typeof ingestRundown !== 'object') throw new Meteor.Error(400, 'Upload rundown: Invalid request body')

		await putRundown(studioId, playlistId, rundownId, ingestRundown)

		handle202(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

// Update rundowns
router.put('/:studioId/playlists/:playlistId/rundowns', bodyParser, validateBodyMiddleware, async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)

	try {
		const ingestRundown = ctx.request.body as HttpIngestRundown[]
		if (!ingestRundown) throw new Meteor.Error(400, 'Upload rundown: Missing request body')
		if (typeof ingestRundown !== 'object') throw new Meteor.Error(400, 'Upload rundown: Invalid request body')

		await putRundowns(studioId, playlistId, ingestRundown)

		handle202(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

// Delete rundown
router.delete('/:studioId/playlists/:playlistId/rundowns/:rundownId', async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)

	try {
		await deleteRundown(studioId, playlistId, rundownId)
		handle202(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

// Delete rundowns
router.delete('/:studioId/playlists/:playlistId/rundowns', async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)

	try {
		await deleteRundowns(studioId, playlistId)
		handle202(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

// Segments

router.get('/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId', async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)
	const segmentId = ctx.params.segmentId
	check(segmentId, String)

	try {
		const segment = await getSegment(studioId, playlistId, rundownId, segmentId)
		handle200(ctx, segment)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.get('/:studioId/playlists/:playlistId/rundowns/:rundownId/segments', async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)

	try {
		const segments = await getSegments(studioId, playlistId, rundownId)
		handle200(ctx, segments)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.post(
	'/:studioId/playlists/:playlistId/rundowns/:rundownId/segments',
	bodyParser,
	validateBodyMiddleware,
	async (ctx) => {
		const studioId = ctx.params.studioId
		check(studioId, String)
		const playlistId = ctx.params.playlistId
		check(playlistId, String)
		const rundownId = ctx.params.rundownId
		check(rundownId, String)

		try {
			const ingestSegment = ctx.request.body as IngestSegment
			if (!ingestSegment) throw new Meteor.Error(400, 'Upload rundown: Missing request body')

			await postSegment(studioId, playlistId, rundownId, ingestSegment)

			handle202(ctx)
		} catch (e) {
			handleError(e, ctx)
		}
	}
)

router.put(
	'/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId',
	bodyParser,
	validateBodyMiddleware,
	async (ctx) => {
		const studioId = ctx.params.studioId
		check(studioId, String)
		const playlistId = ctx.params.playlistId
		check(playlistId, String)
		const rundownId = ctx.params.rundownId
		check(rundownId, String)
		const segmentId = ctx.params.segmentId
		check(segmentId, String)

		try {
			const ingestSegment = ctx.request.body as IngestSegment
			if (!ingestSegment) throw new Meteor.Error(400, 'Upload rundown: Missing request body')

			await putSegment(studioId, playlistId, rundownId, segmentId, ingestSegment)

			handle202(ctx)
		} catch (e) {
			handleError(e, ctx)
		}
	}
)

router.put(
	'/:studioId/playlists/:playlistId/rundowns/:rundownId/segments',
	bodyParser,
	validateBodyMiddleware,
	async (ctx) => {
		const studioId = ctx.params.studioId
		check(studioId, String)
		const playlistId = ctx.params.playlistId
		check(playlistId, String)
		const rundownId = ctx.params.rundownId
		check(rundownId, String)

		try {
			const ingestSegments = ctx.request.body as IngestSegment[]
			if (!ingestSegments) throw new Meteor.Error(400, 'Upload rundown: Missing request body')
			if (!Array.isArray(ingestSegments)) throw new Meteor.Error(400, 'Upload rundown: Invalid request body')

			await putSegments(studioId, playlistId, rundownId, ingestSegments)

			handle202(ctx)
		} catch (e) {
			handleError(e, ctx)
		}
	}
)

router.delete('/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId', async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)
	const segmentId = ctx.params.segmentId
	check(segmentId, String)

	try {
		await deleteSegment(studioId, playlistId, rundownId, segmentId)
		handle202(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.delete('/:studioId/playlists/:playlistId/rundowns/:rundownId/segments', async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)

	try {
		await deleteSegments(studioId, playlistId, rundownId)
		handle202(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

// Parts

router.get('/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts/:partId', async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)
	const segmentId = ctx.params.segmentId
	check(segmentId, String)
	const partId = ctx.params.partId
	check(partId, String)

	try {
		const part = await getPart(studioId, playlistId, rundownId, segmentId, partId)
		handle200(ctx, part)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.get('/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts', async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)
	const segmentId = ctx.params.segmentId
	check(segmentId, String)

	try {
		const parts = await getParts(studioId, playlistId, rundownId, segmentId)
		handle200(ctx, parts)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.post(
	'/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts',
	bodyParser,
	validateBodyMiddleware,
	async (ctx) => {
		const studioId = ctx.params.studioId
		check(studioId, String)
		const playlistId = ctx.params.playlistId
		check(playlistId, String)
		const rundownId = ctx.params.rundownId
		check(rundownId, String)
		const segmentId = ctx.params.segmentId
		check(segmentId, String)

		try {
			const ingestPart = ctx.request.body as IngestPart
			if (!ingestPart) throw new Meteor.Error(400, 'Upload rundown: Missing request body')

			await postPart(studioId, playlistId, rundownId, segmentId, ingestPart)

			handle202(ctx)
		} catch (e) {
			handleError(e, ctx)
		}
	}
)

router.put(
	'/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts/:partId',
	bodyParser,
	validateBodyMiddleware,
	async (ctx) => {
		const studioId = ctx.params.studioId
		check(studioId, String)
		const playlistId = ctx.params.playlistId
		check(playlistId, String)
		const rundownId = ctx.params.rundownId
		check(rundownId, String)
		const segmentId = ctx.params.segmentId
		check(segmentId, String)
		const partId = ctx.params.partId
		check(partId, String)

		try {
			const ingestPart = ctx.request.body as IngestPart
			if (!ingestPart) throw new Meteor.Error(400, 'Upload rundown: Missing request body')

			await putPart(studioId, playlistId, rundownId, segmentId, partId, ingestPart)

			handle202(ctx)
		} catch (e) {
			handleError(e, ctx)
		}
	}
)

router.put(
	'/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts',
	bodyParser,
	validateBodyMiddleware,
	async (ctx) => {
		const studioId = ctx.params.studioId
		check(studioId, String)
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

			await putParts(studioId, playlistId, rundownId, segmentId, ingestParts)

			handle202(ctx)
		} catch (e) {
			handleError(e, ctx)
		}
	}
)

router.delete('/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts/:partId', async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)
	const segmentId = ctx.params.segmentId
	check(segmentId, String)
	const partId = ctx.params.partId
	check(partId, String)

	try {
		await deletePart(studioId, playlistId, rundownId, segmentId, partId)
		handle202(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})

router.delete('/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts', async (ctx) => {
	const studioId = ctx.params.studioId
	check(studioId, String)
	const playlistId = ctx.params.playlistId
	check(playlistId, String)
	const rundownId = ctx.params.rundownId
	check(rundownId, String)
	const segmentId = ctx.params.segmentId
	check(segmentId, String)

	try {
		await deleteParts(studioId, playlistId, rundownId, segmentId)
		handle202(ctx)
	} catch (e) {
		handleError(e, ctx)
	}
})
