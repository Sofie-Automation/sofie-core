import type { DDPClientConnection } from '../ddp-server/types'
import { SofieError } from '@sofie-automation/corelib/dist/error'

export interface MethodContext {
	/**
	 * Access inside a method invocation. The connection that this method was received on. `null` if the method is not associated with a connection, eg. a server initiated method call. Calls
	 * to methods made from a server method which was in turn initiated from the client share the same `connection`. */
	connection: DDPClientConnection | null
	/** Call inside a method invocation. Allow subsequent method from this client to begin running in a new fiber. */
	unblock(): void
}

/** Abstarct class to be used when defining Mehod-classes */
export abstract class MethodContextAPI implements MethodContext {
	// These properties are added by Meteor to the `this` context when calling methods
	public unblock(): void {
		throw new SofieError(
			500,
			`This shoulc never be called, there's something wrong in with 'this' in the calling method`
		)
	}
	public connection!: DDPClientConnection | null
}
