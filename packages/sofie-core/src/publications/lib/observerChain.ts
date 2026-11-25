import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Simplify } from 'type-fest'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../../logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { MinimalMongoCursor } from '../../collections/collection'
import { AbortScope, createChildAbort, runOnAbort } from '../../lib/observerLifetime'

/**
 * https://stackoverflow.com/a/66011942
 */
type StringLiteral<T> = T extends `${string & T}` ? T : never

/**
 * https://github.com/sindresorhus/type-fest/issues/417#issuecomment-1178753251
 */
type Not<Yes, Not> = Yes extends Not ? never : Yes

type Link<T> = {
	next: <L extends string, K extends { _id: ProtectedString<any> }>(
		key: Not<L, keyof T>,
		cursorChain: (state: T) => Promise<MinimalMongoCursor<K> | null>
	) => Link<Simplify<T & { [P in StringLiteral<L>]: K }>>

	end: (complete: (state: T | null) => void) => void
}

/**
 * Chain a series of cursors, where each one is opened from the document found by the previous.
 *
 * Each link runs its observer on a child of `signal`, scoped to one invocation: when the upstream
 * document changes or goes away, that scope is aborted before the next observer starts, and aborting
 * `signal` tears down the whole chain. Nothing can be left running by a failure partway along.
 *
 * @param signal The lifetime of the whole chain
 */
export function observerChain(signal: AbortSignal): Pick<Link<unknown>, 'next'> {
	function createNextLink(parentSignal: AbortSignal) {
		let mode: 'next' | 'end' | undefined
		let chainedCursor: (state: Record<string, any>) => Promise<MinimalMongoCursor<any> | null>
		let completeFunction: (state: Record<string, any> | null) => void
		let chainedKey: string | undefined = undefined

		/** The lifetime of the observer this link currently has running */
		let observerScope: AbortScope | undefined

		let nextChanged: (obj: Record<string, any>) => void = () => {
			if (mode === 'end') return
			throw new Error('nextChanged: Unfinished observer chain')
		}
		let nextStop: () => void = () => {
			if (mode === 'end') return
			throw new Error('nextChanged: Unfinished observer chain')
		}

		async function changedLink(collectorObject: Record<string, any>) {
			// Supersede whatever this link had running. The scope is created synchronously, before any
			// await, so that a later invocation always aborts the right one.
			observerScope?.abort()
			const scope = createChildAbort(parentSignal)
			observerScope = scope

			const cursorResult = await chainedCursor(collectorObject)

			// The chain may have moved on, or been torn down, while we were awaiting
			if (scope.signal.aborted) return

			if (cursorResult === null) {
				nextStop()
				return
			}

			await cursorResult.observeAsync(
				{
					added: (doc) => {
						if (!chainedKey) throw new Error('Chained key needs to be defined')
						const newCollectorObject: Record<string, any> = {
							...collectorObject,
							[chainedKey]: doc,
						}
						nextStop()
						nextChanged(newCollectorObject)
					},
					changed: (doc) => {
						if (!chainedKey) throw new Error('Chained key needs to be defined')
						const newCollectorObject = {
							...collectorObject,
							[chainedKey]: doc,
						}
						nextStop()
						nextChanged(newCollectorObject)
					},
					removed: () => {
						if (!chainedKey) throw new Error('Chained key needs to be defined')
						nextStop()
					},
				},
				{ signal: scope.signal }
			)
		}

		function changedEnd(obj: Record<string, any>) {
			completeFunction(obj)
		}

		function stopLink() {
			observerScope?.abort()
			observerScope = undefined

			nextStop()
		}

		function stopEnd() {
			completeFunction(null)
		}

		return {
			changed: async (obj: Record<string, any>) => {
				switch (mode) {
					case 'next':
						await changedLink(obj)
						break
					case 'end':
						changedEnd(obj)
						break
					case undefined:
						throw new Error('changed: mode: undefined, Unfinished observer chain')
					default:
						assertNever(mode)
				}
			},
			stop: () => {
				switch (mode) {
					case 'next':
						stopLink()
						break
					case 'end':
						stopEnd()
						break
					case undefined:
						break
					default:
						assertNever(mode)
				}
			},
			link: {
				next: (key: string, thisCursor: typeof chainedCursor) => {
					if (mode !== undefined) throw new Error('Cannot redefine chain after setup')
					if (!key) throw new Error('Key needs to be a defined, non-empty string')
					chainedKey = key
					chainedCursor = thisCursor
					mode = 'next'
					const { changed, stop, link } = createNextLink(parentSignal)
					nextChanged = changed
					nextStop = stop
					return link
				},
				end: (complete: typeof completeFunction) => {
					if (mode !== undefined) throw new Error('Cannot redefine chain after setup')
					mode = 'end'
					completeFunction = complete
				},
			},
		}
	}

	const { changed, stop, link } = createNextLink(signal)

	// Ending the chain's lifetime cascades down the links, so the consumer is told the state is gone
	runOnAbort(signal, stop)

	return {
		next: (key, cursorChain) => {
			const nextLink = link.next(key, cursorChain)
			setImmediate(() => {
				if (signal.aborted) return
				changed({}).catch((e) => {
					logger.error(`Error in observerChain: ${stringifyError(e)}`)
				})
			})
			return nextLink as any
		},
	}
}
