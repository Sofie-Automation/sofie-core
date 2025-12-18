import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { Simplify } from 'type-fest'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../../logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { MinimalMongoCursor } from '../../collections/implementations/asyncCollection'

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

	end: (complete: (state: T | null) => void) => Meteor.LiveQueryHandle
}

export function observerChain(): Pick<Link<unknown>, 'next'> {
	function createNextLink(baseCollectorObject: Record<string, any>, liveQueryHandle: Meteor.LiveQueryHandle) {
		let mode: 'next' | 'end' | undefined
		let chainedCursor: (state: Record<string, any>) => Promise<MinimalMongoCursor<any> | null>
		let completeFunction: (state: Record<string, any> | null) => void
		let chainedKey: string | undefined = undefined
		let previousObserver: Meteor.LiveQueryHandle | null = null

		let nextChanged: (obj: Record<string, any>) => void = () => {
			if (mode === 'end') return
			throw new Error('nextChanged: Unfinished observer chain. This is a memory leak.')
		}
		let nextStop: () => void = () => {
			if (mode === 'end') return
			throw new Error('nextChanged: Unfinished observer chain. This is a memory leak.')
		}

		async function changedLink(collectorObject: Record<string, any>) {
			if (previousObserver) {
				previousObserver.stop()
				previousObserver = null
			}
			const cursorResult = await chainedCursor(collectorObject)
			if (cursorResult === null) {
				nextStop()
				return
			}

			previousObserver = await cursorResult.observeAsync({
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
			})
		}

		function changedEnd(obj: Record<string, any>) {
			completeFunction(obj)
		}

		function stopLink() {
			if (previousObserver) {
				previousObserver.stop()
				previousObserver = null
			}

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
						throw new Error('changed: mode: undefined, Unfinished observer chain. This is a memory leak.')
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
					const { changed, stop, link } = createNextLink(baseCollectorObject, liveQueryHandle)
					nextChanged = changed
					nextStop = stop
					return link
				},
				end: (complete: typeof completeFunction) => {
					if (mode !== undefined) throw new Error('Cannot redefine chain after setup')
					mode = 'end'
					completeFunction = complete
					return liveQueryHandle
				},
			},
		}
	}

	const initialStopObject = {
		stop: () => {
			void 0
		},
	}

	const { changed, stop, link } = createNextLink({}, initialStopObject)
	initialStopObject.stop = stop

	return {
		next: (key, cursorChain) => {
			const nextLink = link.next(key, cursorChain)
			setImmediate(
				Meteor.bindEnvironment(() => {
					changed({}).catch((e) => {
						logger.error(`Error in observerChain: ${stringifyError(e)}`)
					})
				})
			)
			return nextLink as any
		},
	}
}
