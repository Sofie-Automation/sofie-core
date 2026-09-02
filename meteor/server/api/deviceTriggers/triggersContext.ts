import {
	TriggersAdLibAction,
	TriggersAdLibPiece,
	TriggersAsyncCollection,
	TriggersContext,
	TriggersPart,
	TriggersRundown,
	TriggersRundownBaselineAdLibAction,
	TriggersRundownBaselineAdLibItem,
	TriggersRundownPlaylist,
	TriggersSegment,
	TriggerTrackerComputation,
} from '@sofie-automation/meteor-lib/dist/triggers/triggersContext'
import { SINGLE_USE_TOKEN_SALT } from '@sofie-automation/meteor-lib/dist/api/userActions'
import { assertNever, getHash } from '@sofie-automation/corelib/dist/lib'
import type { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import { ProtectedString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import { getCurrentTime } from '../../lib/lib'
import { IMeteorCall } from '@sofie-automation/meteor-lib/dist/api/methods'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { UserAction } from '@sofie-automation/meteor-lib/dist/userAction'
import { TFunction } from 'i18next'
import { logger } from '../../logging'
import { IBaseFilterLink, IRundownPlaylistFilterLink } from '@sofie-automation/blueprints-integration'
import { PartId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DummyReactiveVar } from '@sofie-automation/meteor-lib/dist/triggers/reactive-var'
import { ReactivePlaylistActionContext } from '@sofie-automation/meteor-lib/dist/triggers/actionFactory'
import { FindOneOptions, FindOptions, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import {
	DBRundownPlaylist,
	SelectedPartInstance,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { PartInstances, Parts, RundownPlaylists } from '../../collections'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { ContentCache } from './reactiveContentCache'

export function hashSingleUseToken(token: string): string {
	return getHash(SINGLE_USE_TOKEN_SALT + token)
}

/**
 * Reads one of the in-memory `ContentCache` collections that the device-trigger observers already maintain,
 * so that the compiled filter chains do not re-query the database for data that is held in memory.
 *
 * The collection is fetched on each call rather than held, because the cache is replaced whenever the set of
 * rundowns in the playlist changes.
 */
class InMemoryTriggersCollectionWrapper<
	DBInterface extends { _id: ProtectedString<any> },
> implements TriggersAsyncCollection<DBInterface> {
	readonly #getCollection: () => CachedCollection<DBInterface> | undefined

	constructor(getCollection: () => CachedCollection<DBInterface> | undefined) {
		this.#getCollection = getCollection
	}

	async findFetchAsync(
		_computation: TriggerTrackerComputation | null,
		selector: MongoQuery<DBInterface>,
		options?: FindOptions<DBInterface>
	): Promise<Array<DBInterface>> {
		// Note: the _computation is not used, since we are not using Tracker server-side
		return this.#getCollection()?.findFetch(selector, options) ?? []
	}

	async findOneAsync(
		_computation: TriggerTrackerComputation | null,
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOneOptions<DBInterface>
	): Promise<DBInterface | undefined> {
		// Note: the _computation is not used, since we are not using Tracker server-side
		return this.#getCollection()?.findOne(selector, options)
	}
}

/**
 * The read half of an `InMemoryMongoCollection`, declared as function properties rather than methods so that
 * Typescript checks the document type strictly. Methods are compared bivariantly, which would let a cache
 * collection that is *missing* one of the required fields through.
 */
interface CachedCollection<DBInterface extends { _id: ProtectedString<any> }> {
	readonly findFetch: (selector?: MongoQuery<DBInterface>, options?: FindOptions<DBInterface>) => DBInterface[]
	readonly findOne: (
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOneOptions<DBInterface>
	) => DBInterface | undefined
}

/**
 * Wrap a `ContentCache` collection as a `TriggersAsyncCollection`.
 *
 * The type argument is the set of fields the compiled filter chains read (see the `Triggers*` types in
 * meteor-lib's `triggersContext.ts`). Passing a cache collection whose projection does not cover them is a
 * compile error here, rather than a trigger that quietly stops firing.
 */
function wrapCachedCollection<DBInterface extends { _id: ProtectedString<any> }>(
	getCollection: () => CachedCollection<DBInterface> | undefined
): TriggersAsyncCollection<DBInterface> {
	return new InMemoryTriggersCollectionWrapper<DBInterface>(getCollection)
}

/** Builds the `TriggersContext` for one studio, reading through to that studio's `ContentCache`. */
export type TriggersContextFactory = (getCache: () => ContentCache | undefined) => TriggersContext

/**
 * Build the server-side `TriggersContext` used to compile and execute device-trigger actions.
 * `meteorCall` is injected (rather than imported as a global) so it dispatches through the process's
 * `MethodRegistry`.
 */
export function createMeteorTriggersContext(
	meteorCall: IMeteorCall,
	getCache: () => ContentCache | undefined
): TriggersContext {
	return {
		MeteorCall: meteorCall,

		logger,

		isClient: false,

		AdLibActions: wrapCachedCollection<TriggersAdLibAction>(() => getCache()?.AdLibActions),
		AdLibPieces: wrapCachedCollection<TriggersAdLibPiece>(() => getCache()?.AdLibPieces),
		Parts: wrapCachedCollection<TriggersPart>(() => getCache()?.Parts),
		RundownBaselineAdLibActions: wrapCachedCollection<TriggersRundownBaselineAdLibAction>(
			() => getCache()?.RundownBaselineAdLibActions
		),
		RundownBaselineAdLibPieces: wrapCachedCollection<TriggersRundownBaselineAdLibItem>(
			() => getCache()?.RundownBaselineAdLibPieces
		),
		RundownPlaylists: wrapCachedCollection<TriggersRundownPlaylist>(() => getCache()?.RundownPlaylists),
		Rundowns: wrapCachedCollection<TriggersRundown>(() => getCache()?.Rundowns),
		Segments: wrapCachedCollection<TriggersSegment>(() => getCache()?.Segments),

		hashSingleUseToken,

		doUserAction: <Result>(
			_t: TFunction,
			userEvent: string,
			_action: UserAction,
			fcn: (event: string, timeStamp: Time) => Promise<ClientAPI.ClientResponse<Result>>,
			callback?: (err: any, res?: Result) => void | boolean,
			_okMessage?: string
		): void => {
			fcn(userEvent, getCurrentTime()).then(
				(value) =>
					typeof callback === 'function' &&
					(ClientAPI.isClientResponseSuccess(value) ? callback(undefined, value.result) : callback(value)),
				(reason) => typeof callback === 'function' && callback(reason)
			)
		},

		withComputation: async (_computation, func) => {
			// Note: the _computation is not used, since we are not using Tracker server-side
			return func()
		},

		memoizedIsolatedAutorun: async <TArgs extends any[], TRes>(
			computation: TriggerTrackerComputation | null,
			fnc: (computation: TriggerTrackerComputation | null, ...args: TArgs) => Promise<TRes>,
			_functionName: string,
			...params: TArgs
		): Promise<TRes> => {
			return fnc(computation, ...params)
		},

		createContextForRundownPlaylistChain,
	}
}

async function createContextForRundownPlaylistChain(
	studioId: StudioId,
	filterChain: IBaseFilterLink[]
): Promise<ReactivePlaylistActionContext | undefined> {
	const playlist = await rundownPlaylistFilter(
		studioId,
		filterChain.filter((link) => link.object === 'rundownPlaylist') as IRundownPlaylistFilterLink[]
	)

	if (!playlist) return undefined

	const [currentPartInfo, nextPartInfo] = await Promise.all([
		fetchInfoForSelectedPart(playlist.currentPartInfo),
		fetchInfoForSelectedPart(playlist.nextPartInfo),
	])

	return {
		studioId: new DummyReactiveVar(studioId),
		rundownPlaylistId: new DummyReactiveVar(playlist?._id),
		rundownPlaylist: new DummyReactiveVar(playlist),
		currentRundownId: new DummyReactiveVar(
			playlist.currentPartInfo?.rundownId ?? playlist.rundownIdsInOrder[0] ?? null
		),
		currentPartId: new DummyReactiveVar(currentPartInfo?.partId ?? null),
		currentSegmentPartIds: new DummyReactiveVar(currentPartInfo?.segmentPartIds ?? []),
		nextPartId: new DummyReactiveVar(nextPartInfo?.partId ?? null),
		nextSegmentPartIds: new DummyReactiveVar(nextPartInfo?.segmentPartIds ?? []),
		currentPartInstanceId: new DummyReactiveVar(playlist.currentPartInfo?.partInstanceId ?? null),
	}
}

async function fetchInfoForSelectedPart(partInfo: SelectedPartInstance | null): Promise<{
	partId: PartId
	segmentPartIds: PartId[]
} | null> {
	if (!partInfo) return null

	const partInstance = (await PartInstances.findOneAsync(partInfo.partInstanceId, {
		projection: {
			'part._id': 1,
			segmentId: 1,
		} as any,
	})) as (Pick<DBPartInstance, 'segmentId'> & { part: Pick<DBPart, '_id'> }) | null

	if (!partInstance) return null

	const partId = partInstance.part._id
	const segmentPartIds = await Parts.findFetchAsync(
		{
			segmentId: partInstance.segmentId,
		},
		{
			projection: {
				_id: 1,
			},
		}
	).then((parts) => parts.map((part) => part._id))

	return {
		partId,
		segmentPartIds,
	}
}

async function rundownPlaylistFilter(
	studioId: StudioId,
	filterChain: IRundownPlaylistFilterLink[]
): Promise<DBRundownPlaylist | undefined> {
	const selector: MongoQuery<DBRundownPlaylist> = {
		$and: [
			{
				studioId,
			},
		],
	}

	filterChain.forEach((link) => {
		switch (link.field) {
			case 'activationId':
				selector['activationId'] = {
					$exists: link.value,
				}
				break
			case 'name':
				selector['name'] = {
					$regex: link.value,
				}
				break
			case 'studioId':
				selector['$and']?.push({
					studioId: {
						$eq: protectString(link.value),
					},
				})
				break
			case 'rehearsal':
				selector['rehearsal'] = link.value
				break
			default:
				assertNever(link)
				break
		}
	})

	return RundownPlaylists.findOneAsync(selector)
}
