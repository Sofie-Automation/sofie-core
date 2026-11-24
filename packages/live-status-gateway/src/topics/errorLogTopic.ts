import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { interpollateTranslation } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { DBErrorLogItem } from '@sofie-automation/corelib/dist/dataModel/ErrorLog'
import { ErrorLogEntry, ErrorLogEvent } from '@sofie-automation/live-status-gateway-api'
import { WebSocketTopicBase, WebSocketTopic } from '../wsHandler.js'
import { CollectionHandlers } from '../liveStatusServer.js'

const THROTTLE_PERIOD_MS = 100

export class ErrorLogTopic extends WebSocketTopicBase implements WebSocketTopic {
	private _errors: DBErrorLogItem[] = []

	constructor(logger: Logger, handlers: CollectionHandlers) {
		super(ErrorLogTopic.name, logger, THROTTLE_PERIOD_MS)

		handlers.errorLogHandler.subscribe(this.onErrorLogUpdate)
	}

	sendStatus(subscribers: Iterable<WebSocket>): void {
		const message = literal<ErrorLogEvent>({
			event: 'errorLog',
			errors: [...this._errors].sort((a, b) => b.timestamp - a.timestamp).map(toErrorLogEntry),
		})

		this.sendMessage(subscribers, message)
	}

	private onErrorLogUpdate = (errors: DBErrorLogItem[] | undefined): void => {
		this.logUpdateReceived('errorLog')
		this._errors = errors ?? []
		this.throttledSendStatusToAll()
	}
}

export function toErrorLogEntry(item: DBErrorLogItem): ErrorLogEntry {
	return literal<ErrorLogEntry>({
		id: unprotectString(item._id),
		timestamp: item.timestamp,
		studioId: item.studioId ? unprotectString(item.studioId) : undefined,
		playlistId: item.playlistId ? unprotectString(item.playlistId) : undefined,
		operation: item.operation,
		context: item.context,
		errorCode: item.errorCode,
		errorKey: item.error.key,
		// LSG clients can't translate, so send the message rendered in the default language
		message: interpollateTranslation(item.error.message.key, item.error.message.args),
	})
}
