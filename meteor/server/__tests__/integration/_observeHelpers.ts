/**
 * Helpers shared by the change-stream integration tests (the moved engine test and the observe-parity test).
 * Extracted from the original `engine.integration.test.ts` so both can drive the real change-stream
 * multiplexer the same way.
 */
import { MongoClient, Collection, ChangeStreamDocument } from 'mongodb'
import { protectString, ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { MongoQuery, MongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { CollectionChangeFeed, createCollectionChangeStream } from '../../collections/changeStream/collectionChangeFeed'
import { ObserveMultiplexer, ObserveMultiplexerDeps } from '../../collections/changeStream/observeMultiplexer'
import type { ObserveViewShape } from '@sofie-automation/corelib/dist/memoryCollection/observeView'

export interface TestDoc {
	_id: ProtectedString<any>
	name?: string
	val?: number
	studioId?: string
}

export const id = (s: string): ProtectedString<any> => protectString<any>(s)

/**
 * Poll `predicate` until it is true or the timeout elapses (for awaiting async change-stream delivery).
 * Delivery is normally sub-second; the default allows for CI load while staying below the integration
 * project's default test timeout (see `__mocks__/_setupIntegrationTimeout.ts`), so that this - not jest -
 * reports a genuine hang, and can say what it was waiting for.
 */
export async function waitFor(
	predicate: () => boolean,
	timeoutMs = 15000,
	/** Describes what is being awaited, for the timeout message. Evaluated only on failure. */
	describe?: () => string
): Promise<void> {
	const start = Date.now()
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error(`waitFor timed out after ${timeoutMs}ms${describe ? `, waiting for ${describe()}` : ''}`)
		}
		await new Promise((r) => setTimeout(r, 20))
	}
}

export interface Sink {
	added: Array<[any, any]>
	changed: Array<[any, any]>
	removed: any[]
}

export function newSink(): Sink {
	return { added: [], changed: [], removed: [] }
}

/** Build an {@link ObserveMultiplexer} backed by a real change stream + snapshot against `collection`. */
export function makeMultiplexer(
	client: MongoClient,
	collection: Collection<any>,
	selector: MongoQuery<TestDoc>,
	projection: MongoFieldSpecifier<TestDoc> | undefined,
	shape?: ObserveViewShape<TestDoc>
): ObserveMultiplexer<TestDoc> {
	const feed = new CollectionChangeFeed(
		collection.collectionName,
		() => createCollectionChangeStream(client, client.db(), collection.collectionName),
		() => undefined
	)
	const deps: ObserveMultiplexerDeps<TestDoc> = {
		// Read in a session so the snapshot's cluster time can be reported, exactly as production does
		snapshot: async () => {
			const session = client.startSession()
			try {
				const docs = (await collection
					.find(selector as any, { session })
					.toArray()) as unknown as TestDoc[]
				return { docs, operationTime: session.operationTime }
			} finally {
				await session.endSession()
			}
		},
		subscribeFeed: (onChange, onReconnect) =>
			feed.subscribe(onChange as (c: ChangeStreamDocument<any>) => void, onReconnect),
	}
	return new ObserveMultiplexer<TestDoc>(selector, projection, shape, deps, () => undefined)
}

/** Subscribe an observeChanges sink to a multiplexer; teardown is driven by aborting `signal`. */
export async function subscribeChanges(m: ObserveMultiplexer<TestDoc>, sink: Sink, signal: AbortSignal): Promise<void> {
	await m.addObserveChangesSubscriber(
		{
			added: (i: any, f: any) => sink.added.push([i, f]),
			changed: (i: any, f: any) => sink.changed.push([i, f]),
			removed: (i: any) => sink.removed.push(i),
		} as any,
		signal,
		false
	)
}
