import { postHandler } from './postHandler'
import { deleteMessage, readAllMessages } from './serviceMessagesApi'
import KoaRouter from '@koa/router'
import { Meteor } from 'meteor/meteor'
import { bindKoaRouter } from '../rest/koa'
import bodyParser from 'koa-bodyparser'

const serviceMessagesRouter = new KoaRouter()

serviceMessagesRouter.post('/', bodyParser(), postHandler)

/**
 * List all current messages stored on this instance
 */
serviceMessagesRouter.get('/', async function getHandler(ctx) {
	try {
		const valuesArray = await readAllMessages()
		ctx.response.type = 'application/json;charset=utf8'
		ctx.body = JSON.stringify(valuesArray)
	} catch (_error) {
		ctx.response.status = 500
		ctx.body = 'Unable to list service messages'
	}
})

/**
 * Delete a message
 */
serviceMessagesRouter.delete('/:id', async function deleteHandler(ctx) {
	const { id } = ctx.params
	try {
		const allMessages = await readAllMessages()
		if (allMessages.find((m) => m.id === id)) {
			const deleted = await deleteMessage(id)
			ctx.response.type = 'application/json;charset=utf8'
			ctx.body = JSON.stringify(deleted)
		} else {
			ctx.response.status = 404
			ctx.body = `Message with id ${id} can not be found`
		}
	} catch (_error) {
		ctx.response.status = 500
		ctx.body = `Unable to delete service message ${id}`
	}
})

/**
 * Retrieves a single message based on a given id
 */
serviceMessagesRouter.delete('/:id', async function getMessageHandler(ctx) {
	const { id } = ctx.params
	try {
		const allMessages = await readAllMessages()
		const message = allMessages.find((m) => m.id === id)
		if (message) {
			ctx.response.type = 'application/json;charset=utf8'
			ctx.body = JSON.stringify(message)
		} else {
			ctx.response.status = 404
			ctx.body = `Message with id ${id} can not be found`
		}
	} catch (_error) {
		ctx.response.status = 500
		ctx.body = `Unable to retrieve service message ${id}`
	}
})

Meteor.startup(() => {
	bindKoaRouter(serviceMessagesRouter, '/serviceMessages')
})
