import { runOnAbort } from '../lib/observerLifetime'
import { logger } from '../logging'

export enum FastTrackObservers {
	TIMELINE = 'timeline',
}

/**
 * Sets up a fastTrackObserver, it basically calls onData whenever triggerFastTrackObserver() is called from somewhere else in the code.
 * The observer is removed when `signal` aborts.
 */
export function setupFastTrackObserver<T>(
	observerKey: FastTrackObservers,
	keyArgs: any[],
	onData: (data: T) => void,
	signal: AbortSignal
): void {
	if (signal.aborted) return

	const key = getKey(observerKey, keyArgs)

	if (!fastTrackObserver[key]) {
		fastTrackObserver[key] = {
			onDatas: [onData],
		}
	} else {
		fastTrackObserver[key].onDatas.push(onData)
	}

	runOnAbort(signal, () => {
		const index = fastTrackObserver[key].onDatas.findIndex((fcn) => fcn === onData)

		if (index !== -1) {
			fastTrackObserver[key].onDatas.splice(index, 1)
		}
		if (fastTrackObserver[key].onDatas.length === 0) {
			delete fastTrackObserver[key]
		}
	})
}

/** Trigger a FastTrackObserver, which was setup in setupFastTrackObserver(). */
export function triggerFastTrackObserver(
	observerKey: FastTrackObservers,
	keyArgs: any[],
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	data: any
): void {
	const key = getKey(observerKey, keyArgs)

	try {
		if (fastTrackObserver[key]) {
			for (const onData of fastTrackObserver[key].onDatas) {
				onData(data)
			}
		}
	} catch (e) {
		logger.error(e)
	}
}

/** A global store for the fast-track observers */
const fastTrackObserver: {
	[key: string]: {
		onDatas: ((data: any) => void)[]
	}
} = {}

/** Convenience function to generate a unique key for the key+args pair */
function getKey(key: FastTrackObservers, args: any[]): string {
	return key + args.join(',')
}
