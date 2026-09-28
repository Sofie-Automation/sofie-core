import { IncomingWebhook, IncomingWebhookResult } from '@slack/webhook'

// Future: How can avoid this 'leaking'?
const webHookCache: { [webhookURL: string]: IncomingWebhook } = {}

/**
 * Send a message to a Slack webhook
 * @param message
 * @param webhookURL
 */
export async function sendSlackMessageToWebhook(message: string, webhookURL: string): Promise<IncomingWebhookResult> {
	let webhook: IncomingWebhook = webHookCache[webhookURL]
	if (!webhook) {
		webhook = new IncomingWebhook(webhookURL)
		webHookCache[webhookURL] = webhook
	}
	return webhook.send(message)
}
