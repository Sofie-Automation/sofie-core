import { Meteor } from 'meteor/meteor'
import { logger } from './logging.js'
import { AllPubSubTypes } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { MakeMeteorCall } from '@sofie-automation/meteor-lib/dist/api/methods'
import { MeteorApply } from './MeteorApply.js'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

/**
 * Type safe wrapper around Meteor.subscribe()
 * @param name name of the subscription
 * @param args arguments to the subscription
 * @returns Meteor subscription handle
 */
export function meteorSubscribe<K extends keyof AllPubSubTypes>(
	name: K,
	...args: Parameters<AllPubSubTypes[K]>
): Meteor.SubscriptionHandle {
	const callbacks = {
		onError: (...errs: any[]) => {
			logger.error(
				`meteorSubscribe "${name}": ${JSON.stringify(args)}: ${errs.map((err) => stringifyError(err))}`
			)
		},
	}

	return Meteor.subscribe(name, ...args, callbacks)
}

export const MeteorCall = MakeMeteorCall(MeteorApply)
