import { ProtectedString, protectString, unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { DDPConnector } from './ddpConnector.js'

export type SubscriptionId = ProtectedString<'SubscriptionId'>

export type ParametersOfFunctionOrNever<T> = T extends (...args: any[]) => any ? Parameters<T> : never

export class SubscriptionsHelper<PubSubTypes> {
	readonly #ddp: DDPConnector
	readonly #deviceToken: string

	readonly #autoSubscriptions = new Map<
		SubscriptionId,
		{
			publicationName: string
			params: Array<any>
		}
	>()
	readonly #otherSubscriptions = new Set<SubscriptionId>()

	constructor(
		private readonly emitError: (err: string) => void,
		ddp: DDPConnector,
		deviceToken: string
	) {
		this.#ddp = ddp
		this.#deviceToken = deviceToken
	}

	public async subscribeOnce<Key extends keyof PubSubTypes>(
		publicationName: Key,
		...params: ParametersOfFunctionOrNever<PubSubTypes[Key]>
	): Promise<SubscriptionId> {
		const subscriptionId = await this.subscribeWithId(undefined, String(publicationName), ...params)
		this.#otherSubscriptions.add(subscriptionId)
		return subscriptionId
	}

	private async subscribeWithId(
		existingSubscriptionId: SubscriptionId | undefined,
		publicationName: string,
		...params: any[]
	): Promise<SubscriptionId> {
		const orgError = new Error()
		return new Promise((resolve, reject) => {
			if (!this.#ddp.ddpClient) {
				reject(new Error('subscribe: DDP client is not initialized'))
				return
			}
			try {
				const subscriptionId = this.#ddp.ddpClient.subscribe(
					publicationName, // name of Meteor Publish function to subscribe to
					params.concat([this.#deviceToken]), // parameters used by the Publish function
					(error) => {
						if (error) {
							const newError = new Error(
								`Error from publication: ${error.errorType} [${error.error}] ${error.reason} ${error.message}`
							)
							newError.stack = `${newError.stack}\nOriginal stack:\n${orgError.stack}`

							reject(newError)
						} else {
							// callback when the subscription is complete
							resolve(protectString(subscriptionId))
						}
					},
					unprotectString(existingSubscriptionId)
				)
			} catch (e) {
				reject(e instanceof Error ? e : new Error('subscribe failed: ' + e))
			}
		})
	}

	async autoSubscribe<Key extends keyof PubSubTypes>(
		publicationName: Key,
		...params: ParametersOfFunctionOrNever<PubSubTypes[Key]>
	): Promise<SubscriptionId> {
		const subscriptionId = await this.subscribeWithId(undefined, String(publicationName), ...params)
		this.#autoSubscriptions.set(subscriptionId, {
			publicationName: String(publicationName),
			params: params,
		})
		return subscriptionId
	}

	public unsubscribe(subscriptionId: SubscriptionId): void {
		this.#ddp.ddpClient?.unsubscribe(unprotectString(subscriptionId))
		this.#autoSubscriptions.delete(subscriptionId)
		this.#otherSubscriptions.delete(subscriptionId)
	}

	public renewAutoSubscriptions(): void {
		// Forget the other presumed dead subscriptions
		this.#otherSubscriptions.clear()

		for (const [subId, sub] of this.#autoSubscriptions.entries()) {
			this.subscribeWithId(subId, sub.publicationName, ...sub.params).catch((e) =>
				this.emitError('renewSubscr ' + sub.publicationName + ': ' + e)
			)
		}
	}

	public unsubscribeAll(): void {
		for (const subId of this.#otherSubscriptions) {
			this.unsubscribe(subId)
		}
		this.#otherSubscriptions.clear()

		for (const subId of this.#autoSubscriptions.keys()) {
			this.unsubscribe(subId)
		}
		this.#autoSubscriptions.clear()
	}
}
