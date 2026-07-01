import { Meteor } from 'meteor/meteor'
import { MethodContext, MethodContextAPI } from './api/methodContext'
import { extractFunctionSignature } from './lib'
import { logger } from './logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import {
	MeteorMethod,
	MeteorDebugMethod,
	ReplaceOptionalWithNullInMethodArguments,
	wrapMethodForExecution,
} from './methods'
import { assertConnectionHasOneOfPermissions } from './security/auth'

export type MethodWrapper = (
	methodContext: MethodContext,
	methodName: string,
	args: any[],
	fcn: (...args: any[]) => any
) => any

/**
 * A registration of one API class against its method-name map.
 *
 * The generic `TApi` is the interface the client wrappers are built from (a member of `IMeteorCall`),
 * which ties three things together at compile-time when used via the `satisfies` check on the
 * registration map:
 *  - `methods` must have an entry for every method name of `TApi`
 *  - `class` instances must implement `TApi` — either directly, or via the DDP null-arg replacement
 *    (`ReplaceOptionalWithNullInMethodArguments`) that some of the classes apply. The union accepts
 *    both conventions without forcing every class to adopt the same one.
 *
 * TODO (follow-up): argument validation should move here. Today it is ~670 inline `check()` calls at the top
 * of handler bodies (see ./lib/check.ts), which means nothing guarantees a method validates its arguments at
 * all — `handleMethodMessage` passes the raw DDP `params` straight through, and the `securityVerify` audit
 * only covers access control. A sibling `schemas: Record<keyof TApi, z.ZodTuple>` would be completeness-checked
 * by the same `satisfies` that already covers `methods`, be validated centrally in `registerApi`, let the
 * handler parameter types be derived with `z.infer`, and give the `null`→`undefined` coercion that
 * `ReplaceOptionalWithNullInMethodArguments` currently only models in the type system somewhere real to
 * happen. `z.toJSONSchema()` would additionally let the REST v1 schemas generate `packages/openapi/api/*.yaml`
 * rather than being hand-kept in sync with it.
 */
export interface MethodApiRegistration<TApi> {
	methods: Record<keyof TApi, string>
	class: new () => MethodContextAPI & (TApi | ReplaceOptionalWithNullInMethodArguments<TApi>)
	secret?: boolean
	wrapper?: MethodWrapper
}

/** The type-erased shape consumed at runtime (the per-`TApi` guarantee lives in the map's `satisfies`). */
export interface AnyMethodApiRegistration {
	methods: Record<string, string>
	class: typeof MethodContextAPI
	secret?: boolean
	wrapper?: MethodWrapper
}

interface RegisteredMethod {
	/** The method wrapped for execution (running-method tracking, unblock, error logging). */
	wrapped: MeteorMethod
	/** The original, unwrapped function — used for signature extraction. */
	original: (...args: any[]) => any
	secret: boolean
	/** Developer-only debug method, gated behind the 'developer' permission. */
	debug: boolean
}

/**
 * Holds all registered methods on an instance instead of mutating global state at import time.
 */
export class MethodRegistry {
	private readonly methods = new Map<string, RegisteredMethod>()

	/** Register all methods of an API class, mapping each class method to its wire name via `methods`. */
	registerApi(registration: AnyMethodApiRegistration): void {
		const { methods: methodEnum, class: orgClass, secret = false, wrapper } = registration

		for (const classMethodName of getAllClassMethods(orgClass)) {
			try {
				const wireName = methodEnum[classMethodName]
				if (!wireName) {
					throw new Meteor.Error(
						500,
						`MethodRegistry.registerApi: The method "${classMethodName}" is not set in the methods map.`
					)
				}

				const original = (orgClass.prototype as any)[classMethodName] as MeteorMethod
				const inner: MeteorMethod = wrapper
					? function (this: MethodContext, ...args: any[]) {
							return wrapper(this, wireName, args, original)
						}
					: original

				this.add(wireName, inner, original, secret)
			} catch (e) {
				// A missing wire name or duplicate registration is a programming error. Log it and rethrow
				// to abort registration of the whole API class
				logger.error(`MethodRegistry: failed to register method "${classMethodName}": ${stringifyError(e)}`)
				throw e
			}
		}
	}

	/** Register a single ad-hoc method (e.g. methods not backed by an API class). */
	registerMethod(name: string, fn: MeteorMethod, opts?: { secret?: boolean }): void {
		this.add(name, fn, fn, opts?.secret ?? false)
	}

	/**
	 * Register a map of developer-only debug methods. Each is gated behind the 'developer' permission
	 * (matching the historical `MeteorDebugMethods` behaviour), but registered on this registry so it
	 * is served by every transport the registry is applied to — not only Meteor's DDP server.
	 */
	registerDebugMethods(methods: { [key: string]: MeteorDebugMethod }): void {
		for (const [name, fn] of Object.entries<MeteorDebugMethod>(methods)) {
			if (!name || !fn) continue
			const guarded: MeteorMethod = function (this: MethodContext, ...args: any[]) {
				assertConnectionHasOneOfPermissions(this.connection, 'developer')
				return (fn as (...a: any[]) => any).apply(this, args)
			}
			this.add(name, guarded, fn, false, true)
		}
	}

	private add(
		name: string,
		wrappedInner: MeteorMethod,
		original: (...args: any[]) => any,
		secret: boolean,
		debug = false
	): void {
		if (this.methods.has(name)) {
			throw new Meteor.Error(500, `MethodRegistry: A method called "${name}" is already registered.`)
		}
		this.methods.set(name, {
			wrapped: wrapMethodForExecution(name, wrappedInner),
			original,
			secret,
			debug,
		})
	}

	/** Look up a wrapped method by wire name (for the standalone DDP server's method dispatch). */
	get(name: string): MeteorMethod | undefined {
		return this.methods.get(name)?.wrapped
	}

	getAllMethodNames(): string[] {
		return Array.from(this.methods.keys())
	}

	/** Whether the given wire name is a developer-only debug method (gated behind the 'developer' permission). */
	isDebugMethod(name: string): boolean {
		return this.methods.get(name)?.debug ?? false
	}

	/**
	 * Param-name signatures of all non-secret methods, keyed by wire name.
	 * Used by the legacy REST API to build its routes.
	 */
	getSignatures(): { [methodName: string]: string[] } {
		const signatures: { [methodName: string]: string[] } = {}
		for (const [name, method] of this.methods) {
			if (method.secret) continue
			const signature = extractFunctionSignature(method.original)
			if (signature) signatures[name] = signature
		}
		return signatures
	}
}

/** Reflect the (own, non-Object) method names of a class. */
function getAllClassMethods(myClass: any): string[] {
	const objectProtProps = Object.getOwnPropertyNames(Object.prototype)
	const classProps = Object.getOwnPropertyNames(myClass.prototype)

	return classProps
		.filter((name) => objectProtProps.indexOf(name) < 0)
		.filter((name) => typeof myClass.prototype[name] === 'function')
}
