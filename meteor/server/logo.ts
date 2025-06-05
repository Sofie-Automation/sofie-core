import * as fs from 'fs'
import { public_dir } from './lib'
import { getCoreSystemAsync } from './coreSystem/collection'
import { SofieLogo } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import KoaRouter from '@koa/router'
import { Meteor } from 'meteor/meteor'
import { bindKoaRouter } from './api/rest/koa'

export const logoRouter = new KoaRouter()

logoRouter.get('/', async (ctx) => {
	const core = await getCoreSystemAsync()
	const logo = core?.logo ?? SofieLogo.Default

	const paths: Record<SofieLogo, string> = {
		[SofieLogo.Default]: '/images/sofie-logo-default.svg',
		[SofieLogo.Pride]: '/images/sofie-logo-pride.svg',
		[SofieLogo.Norway]: '/images/sofie-logo-norway.svg',
		[SofieLogo.Christmas]: '/images/sofie-logo-christmas.svg',
	}

	const stream = fs.createReadStream(public_dir + paths[logo])

	ctx.set('Content-Type', 'image/svg+xml')
	ctx.set('Cache-Control', `public, maxage=600, immutable`)
	ctx.statusCode = 200
	ctx.body = stream
})

Meteor.startup(() => {
	bindKoaRouter(logoRouter, '/images/sofie-logo.svg')
})
