import { Meteor } from 'meteor/meteor'
import { MakeMeteorCall } from '@sofie-automation/meteor-lib/dist/api/methods'
import type { IMeteorCall } from '@sofie-automation/meteor-lib/dist/api/methods'
import { AnyMethodApiRegistration, MethodRegistry } from '../../server/methodRegistry'
import { USER_PERMISSIONS_HEADER } from '../../server/security/auth'
import { MethodContext } from '../../server/api/methodContext'

/**
 * Test helper: build an `IMeteorCall` backed by a fresh `MethodRegistry` containing only the given
 * API registrations, dispatching each call straight through the registry (no DDP transport).
 *
 * Each suite passes the specific API(s) it exercises, so tests declare their method dependencies
 * explicitly and don't drag in the whole API graph. For example:
 *   const MeteorCall = makeMeteorCallForTest({ methods: ClientAPIMethods, class: ServerClientAPIClass })
 *
 * If a suite calls a method it hasn't registered, the call rejects with a 404 - add that API's
 * registration to the array.
 */
export function makeMeteorCallForTest(
	registrations: AnyMethodApiRegistration | AnyMethodApiRegistration[],
	context: MethodContext = getMethodContext()
): IMeteorCall {
	const registry = new MethodRegistry()
	for (const registration of [registrations].flat()) registry.registerApi(registration)

	return MakeMeteorCall(async (name, args) => {
		const handler = registry.get(name)
		if (!handler) throw new Meteor.Error(404, `Method '${name}' not found`)
		return handler.apply(context, args)
	})
}

export function getMethodContext(): MethodContext {
	return {
		connection: {
			id: 'connectionId',
			close: () => null,
			onClose: (_callback: () => void) => {
				// noop
			},
			clientAddress: '1.1.1.1',
			httpHeaders: {
				// Default to full permissions for tests
				[USER_PERMISSIONS_HEADER]: 'admin',
			},
		},
		unblock: () => {
			// noop
		},
	}
}
