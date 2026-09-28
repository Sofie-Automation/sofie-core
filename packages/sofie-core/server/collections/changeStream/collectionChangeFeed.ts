import type { ChangeStreamDocument } from 'mongodb'
import {
	CollectionChangeFeed,
	createCollectionChangeStream,
	type ChangeStreamFactory,
	type ChangeStreamLike,
	type CollectionFeedHandle,
} from '@sofie-automation/corelib/dist/collectionChangeFeed'
import { getMongoClient, getMongoDb } from '../mongoConnection'
import { logger } from '../../logging'

// The change-stream feed primitive lives in corelib (so it can be reused, e.g. by the job-worker).
// This module is the meteor-side wiring: it supplies the mongo connection + logger and owns the
// process-global, ref-counted "one feed per collection" registry.
export {
	CollectionChangeFeed,
	createCollectionChangeStream,
	CHANGE_FEED_RESTART_BACKOFF_MS,
} from '@sofie-automation/corelib/dist/collectionChangeFeed'
export type {
	ChangeStreamFactory,
	ChangeStreamLike,
	CollectionFeedHandle,
} from '@sofie-automation/corelib/dist/collectionChangeFeed'

// --- Registry: one feed per collection -------------------------------------------------------------

const feeds = new Map<string, CollectionChangeFeed>()

function defaultCreateStream(collectionName: string): Promise<ChangeStreamLike> {
	return createCollectionChangeStream(getMongoClient(), getMongoDb(), collectionName)
}

/**
 * Subscribe to the (shared, ref-counted) change feed for a collection.
 * The feed is created on the first subscriber and torn down when the last one stops.
 * @param createStreamOverride Inject a custom change-stream factory (used by integration tests)
 */
export function subscribeToCollectionChangeFeed(
	collectionName: string,
	onChange: (change: ChangeStreamDocument<any>) => void,
	onResync: () => void,
	createStreamOverride?: ChangeStreamFactory
): CollectionFeedHandle {
	let feed = feeds.get(collectionName)
	if (!feed) {
		feed = new CollectionChangeFeed(
			collectionName,
			createStreamOverride ?? (() => defaultCreateStream(collectionName)),
			() => feeds.delete(collectionName),
			logger
		)
		feeds.set(collectionName, feed)
	}
	return feed.subscribe(onChange, onResync)
}

/** For tests/metrics: number of collections with an active feed */
export function getActiveChangeFeedCount(): number {
	return feeds.size
}
