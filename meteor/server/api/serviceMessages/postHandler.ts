import { logger } from '../../logging'
import { ServiceMessage, Criticality } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { writeMessage } from './serviceMessagesApi'
import moment from 'moment'
import Koa from 'koa'

export { postHandler }

const INPUT_MISSING_PARTIAL = 'Missing data in input: '

const validCriticalities: Criticality[] = Object.keys(Criticality)
	.filter((k) => typeof Criticality[k as any] === 'number')
	.map((k: any) => Criticality[k]) as any

/**
 * Create new or update existing service message.
 */
async function postHandler(ctx: Koa.ParameterizedContext): Promise<void> {
	const { body } = ctx.request
	if (!body) {
		ctx.response.status = 400
		ctx.body = 'No input data'
		return
	}

	const { id, criticality, message, sender, timestamp } = body as any

	if (!id || id.trim().length < 1) {
		ctx.response.status = 400
		ctx.body = `${INPUT_MISSING_PARTIAL}id`
		return
	}

	if (!criticality || (typeof criticality === 'string' && criticality.trim().length < 1)) {
		ctx.response.status = 400
		ctx.body = `${INPUT_MISSING_PARTIAL}criticality`
		return
	}
	if (isNaN(criticality) || validCriticalities.indexOf(Number(criticality)) < 0) {
		ctx.response.status = 400
		ctx.body = `Invalid value for criticality: ${criticality}, wanted one of ${validCriticalities.join(',')}`
		return
	}

	if (!message || message.trim().length < 1) {
		ctx.response.status = 400
		ctx.body = `${INPUT_MISSING_PARTIAL}message`
		return
	}

	if (!timestamp || !moment(new Date(timestamp)).isValid()) {
		ctx.response.status = 400
		ctx.body = `${INPUT_MISSING_PARTIAL}timestamp`
		return
	}

	const serviceMessage = {
		id,
		criticality: Number(criticality),
		message,
		sender,
		timestamp: new Date(timestamp).getTime(),
	} as ServiceMessage

	try {
		const status = await writeMessage(serviceMessage)
		ctx.response.status = status.isUpdate === true ? 200 : 201
		ctx.response.type = 'application/json;charset=utf8'
		ctx.body = JSON.stringify(serviceMessage)
	} catch (error) {
		logger.error(`Unable to store message`, { serviceMessage, error })
		ctx.response.status = 500
		ctx.body = 'System error, unable to store message'
	}
}
