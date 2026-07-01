import { Meteor } from 'meteor/meteor'
import { IMeteorCall, MakeMeteorCall } from '@sofie-automation/meteor-lib/dist/api/methods'
import { MethodRegistry } from '../methodRegistry'
import { MethodContext } from './methodContext'

/** The MethodContext used for server-internal method calls: no client connection, matching the
 * historical behaviour of calling a method server-side via `Meteor.applyAsync`. */
function internalMethodContext(): MethodContext {
	return {
		connection: null,
		unblock: () => undefined,
	}
}

/**
 * Build an `IMeteorCall` that dispatches directly through the given `MethodRegistry`, for
 * server-internal callers that need to invoke registered methods without going over DDP.
 *
 * By default methods run with a null-connection context (as `Meteor.applyAsync` did server-side);
 * pass `getContext` to run them with a specific connection/permissions instead.
 */
export function makeMeteorCallForRegistry(
	registry: MethodRegistry,
	getContext: () => MethodContext = internalMethodContext
): IMeteorCall {
	return MakeMeteorCall(async (name, args) => {
		const handler = registry.get(name)
		if (!handler) throw new Meteor.Error(404, `Method '${name}' not found`)
		return handler.apply(getContext(), args)
	})
}
