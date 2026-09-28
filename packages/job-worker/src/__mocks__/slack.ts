import { vi } from 'vitest'
import { IncomingWebhookResult } from '@slack/webhook'

export async function sendSlackMessageToWebhook(message: string, _webhookURL: string): Promise<IncomingWebhookResult> {
	return new Promise((resolve, reject) => {
		const result: IncomingWebhookResult = { text: message }
		// Use setImmediate, as unlike jest vitest is unable to fake process.nextTick
		setImmediate(() => {
			if (message.match(/error/)) {
				reject(new Error('Failed to send slack message'))
			} else {
				resolve(result)
			}
		})
	})
}

const mockSender = vi.fn(sendSlackMessageToWebhook)

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function setup() {
	return {
		sendSlackMessageToWebhook: mockSender,
	}
}
