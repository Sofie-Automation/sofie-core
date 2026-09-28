import { vi } from 'vitest'
import type Koa from 'koa'
import type KoaRouter from '@koa/router'
import { createMockContext as createJestMockContext, Options as MockContextOptions } from '@shopify/jest-koa-mocks'

/**
 * Wrapper around `createMockContext` from `@shopify/jest-koa-mocks`.
 * That library creates its spies (the default `throw` and `redirect`, and the cookie mocks) with the global `jest`,
 * which does not exist under vitest. A minimal stand-in is provided for the duration of the call only.
 */
export function createMockContext(
	options: MockContextOptions<object, unknown> = {}
): ReturnType<typeof createJestMockContext> {
	const globalWithJest = globalThis as { jest?: unknown }
	const previousJest = globalWithJest.jest
	globalWithJest.jest = { fn: vi.fn }
	try {
		return createJestMockContext(options)
	} finally {
		globalWithJest.jest = previousJest
	}
}

export async function callKoaRoute(
	router: KoaRouter,
	options: MockContextOptions<object, unknown>
): Promise<Koa.ParameterizedContext> {
	const routes = router.routes()

	const ctx = createMockContext(options)

	await routes(ctx as any, async () => null)

	return ctx
}
