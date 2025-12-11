import os from 'os'
import type {
	JSONSchemaForWebApplicationManifestFiles,
	ManifestImageResource,
	ShortcutItem,
} from './typings/webmanifest'
import { logger } from './logging'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { RundownPlaylists, Rundowns, Studios } from './collections'
import { getLocale, getRootSubpath, Translations } from './lib'
import { generateTranslation } from '@sofie-automation/corelib/dist/lib'
import { ITranslatableMessage } from '@sofie-automation/blueprints-integration'
import { interpollateTranslation } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { getCoreSystemAsync } from './coreSystem/collection'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import { Meteor } from 'meteor/meteor'
import { bindKoaRouter } from './api/rest/koa'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

const appShortName = 'Sofie'

const t = generateTranslation

function translateMessage(locale: Translations, message: ITranslatableMessage): string {
	const localized = locale[message.key] || message.key
	return interpollateTranslation(localized, message.args)
}

function getShortcutsForStudio(
	locale: Translations,
	studio: Pick<DBStudio, '_id' | 'name'>,
	studioCount: number
): ShortcutItem[] {
	const SOFIE_DEFAULT_ICONS: ManifestImageResource[] = [
		{
			src: getRootSubpath() + '/icons/mstile-144x144.png',
			sizes: '144x144',
			purpose: 'monochrome',
			type: 'image/png',
		},
		{
			src: getRootSubpath() + '/icons/maskable-96x96.png',
			sizes: '96x96',
			purpose: 'maskable',
			type: 'image/png',
		},
	]

	const multiStudio = studioCount > 1
	return [
		{
			id: `${studio._id}_activeRundown`,
			name: translateMessage(
				locale,
				multiStudio
					? t('{{studioName}}: Active Rundown', {
							studioName: studio.name,
						})
					: t('Active Rundown')
			),
			icons: SOFIE_DEFAULT_ICONS,
			url: getRootSubpath() + `/activeRundown/${studio._id}`,
		},
		{
			id: `${studio._id}_prompter`,
			name: translateMessage(
				locale,
				multiStudio
					? t('{{studioName}}: Prompter', {
							studioName: studio.name,
						})
					: t('Prompter')
			),
			icons: SOFIE_DEFAULT_ICONS,
			url: getRootSubpath() + `/prompter/${studio._id}`,
		},
		{
			id: `${studio._id}_countdowns`,
			name: translateMessage(
				locale,
				multiStudio ? t('{{studioName}}: Presenter screen', { studioName: studio.name }) : t('Presenter screen')
			),
			icons: SOFIE_DEFAULT_ICONS,
			url: getRootSubpath() + `/countdowns/${studio._id}/presenter`,
		},
	]
}

async function getWebManifest(languageCode: string): Promise<JSONSchemaForWebApplicationManifestFiles> {
	const shortcuts: ShortcutItem[] = []

	const [core, studios, locale] = await Promise.all([
		getCoreSystemAsync(),
		Studios.findFetchAsync({}),
		getLocale(languageCode),
	])

	studios.forEach((studio) => {
		shortcuts.push(...getShortcutsForStudio(locale, studio, studios.length))
	})

	const csName = core?.name
	const coreId = core?._id || os.hostname()

	return {
		$schema: 'https://json.schemastore.org/web-manifest.json',
		id: `no.nrk.sofie-core.${coreId}`,
		name: csName ? `${appShortName} – ${csName}` : `${appShortName}`,
		short_name: appShortName,
		icons: [
			{
				src: getRootSubpath() + '/icons/android-chrome-192x192.png',
				sizes: '192x192',
				purpose: 'any',
				type: 'image/png',
			},
			{
				src: getRootSubpath() + '/icons/android-chrome-512x512.png',
				sizes: '512x512',
				purpose: 'any',
				type: 'image/png',
			},
			{
				src: getRootSubpath() + '/icons/mstile-144x144.png',
				sizes: '144x144',
				purpose: 'monochrome',
				type: 'image/png',
			},
			{
				src: getRootSubpath() + '/icons/maskable-96x96.png',
				sizes: '96x96',
				purpose: 'maskable',
				type: 'image/png',
			},
			{
				src: getRootSubpath() + '/icons/maskable-512x512.png',
				sizes: '512x512',
				purpose: 'maskable',
				type: 'image/png',
			},
		],
		theme_color: '#2d89ef',
		background_color: '#252627',
		display: 'fullscreen',
		start_url: getRootSubpath() + '/',
		scope: getRootSubpath() + '/',
		orientation: 'landscape',
		shortcuts: shortcuts.length > 0 ? shortcuts : undefined,
		protocol_handlers: [
			{
				protocol: 'web+nrcs',
				url: getRootSubpath() + '/url/nrcs?q=%s',
			},
		],
	}
}

async function getRundownPlaylistFromExternalId(externalId: string): Promise<DBRundownPlaylist | undefined> {
	const rundown = await Rundowns.findOneAsync({ externalId })

	let rundownPlaylistSelector: MongoQuery<DBRundownPlaylist>
	if (rundown) {
		rundownPlaylistSelector = {
			_id: rundown.playlistId,
		}
	} else {
		rundownPlaylistSelector = {
			externalId,
		}
	}

	return RundownPlaylists.findOneAsync(rundownPlaylistSelector)
}

const webManifestRouter = new KoaRouter()

/**
 * Serve a localized version of the WebManifest. It will return an English version by default, one can specify a
 * supported locale using ?lng=XX URL query parameter. Uses the same localisation files as the Frontend app.
 */
webManifestRouter.get('/', async (ctx) => {
	logger.debug(`WebManifest: ${ctx.socket.remoteAddress} GET "${ctx.url}"`, {
		url: ctx.url,
		method: 'GET',
		remoteAddress: ctx.socket.remoteAddress,
		remotePort: ctx.socket.remotePort,
		headers: ctx.headers,
	})

	let lngCode = ctx.query['lng'] || 'en' // EN is the default locale
	lngCode = Array.isArray(lngCode) ? lngCode[0] : lngCode

	try {
		const manifest = await getWebManifest(lngCode)

		ctx.response.status = 200
		ctx.response.type = 'application/manifest+json;charset=utf-8'
		ctx.body = JSON.stringify(manifest)
	} catch (e) {
		logger.error(`Could not produce PWA WebManifest: ${stringifyError(e)}`)
		ctx.response.status = 500
		ctx.body = 'Internal Server Error'
	}
})

/**
 * Handle the web+nrcs://rundown/<NRCS-EXTERNAL-ID> URL scheme. This allows for external integrations to direct the User
 * to a Sofie Rundown View of a given Rundown or Rundown Playlist.
 */
const nrcsUrlRouter = new KoaRouter()
nrcsUrlRouter.get('/', async (ctx) => {
	logger.debug(`NRCS URL: ${ctx.socket.remoteAddress} GET "${ctx.url}"`, {
		url: ctx.url,
		method: 'GET',
		remoteAddress: ctx.socket.remoteAddress,
		remotePort: ctx.socket.remotePort,
		headers: ctx.headers,
	})

	const webNrcsUrl = ctx.query['q']
	if (!ctx.query['q'] || typeof webNrcsUrl !== 'string') {
		ctx.response.status = 400
		ctx.body = 'Needs query parameter "q"'
		return
	}

	try {
		// Unfortunately, URL interface can't handle custom URL schemes like web+something, so we need to use the
		// URL interface and trick it into parsing the URL-encoded externalId
		const parsedWebNrcsUrl = new URL(webNrcsUrl.replace(/^web\+nrcs:\/\//, 'http://'))
		if (parsedWebNrcsUrl.host === 'rundown') {
			await webNrcsRundownRoute(ctx, parsedWebNrcsUrl)
			return
		}

		ctx.response.status = 400
		ctx.body = `Unsupported namespace: "${parsedWebNrcsUrl.host}"`
		return
	} catch (e) {
		logger.error(`Unknown error in /url/nrcs: ${stringifyError(e)}`)
	}

	ctx.response.status = 500
	ctx.body = 'Internal Server Error'
})

async function webNrcsRundownRoute(ctx: Koa.ParameterizedContext, parsedUrl: URL) {
	// the "path" will contain the initial forward slash, so we need to strip that out
	const externalId = decodeURIComponent(parsedUrl.pathname.substring(1))
	if (externalId === null) {
		ctx.response.status = 400
		ctx.body = 'Needs an External ID to be provided'
		return
	}

	const rundownPlaylist = await getRundownPlaylistFromExternalId(externalId)

	if (!rundownPlaylist) {
		// we couldn't find the External ID for Rundown/Rundown Playlist
		logger.debug(`NRCS URL: External ID not found "${externalId}"`)
		ctx.body = `Could not find requested object: "${externalId}", see the full list`
		ctx.redirect(`${getRootSubpath()}/`)
		ctx.response.status = 303
		return
	}

	logger.debug(`NRCS URL: External ID found "${externalId}" in "${rundownPlaylist._id}"`)
	ctx.body = `Requested object found in Rundown Playlist "${rundownPlaylist._id}"`
	ctx.redirect(`${getRootSubpath()}/rundown/${rundownPlaylist._id}`)
}

Meteor.startup(() => {
	bindKoaRouter(webManifestRouter, '/site.webmanifest')
	bindKoaRouter(nrcsUrlRouter, '/url/nrcs')
})
