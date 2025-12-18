import {
	TriggersAsyncCollection,
	TriggersContext,
	TriggerTrackerComputation,
} from '@sofie-automation/meteor-lib/dist/triggers/triggersContext'
import { SINGLE_USE_TOKEN_SALT } from '@sofie-automation/meteor-lib/dist/api/userActions'
import { assertNever, getHash } from '@sofie-automation/corelib/dist/lib'
import type { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { getCurrentTime } from '../../lib/lib'
import { MeteorCall } from '../methods'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { UserAction } from '@sofie-automation/meteor-lib/dist/userAction'
import { TFunction } from 'i18next'
import { logger } from '../../logging'
import { IBaseFilterLink, IRundownPlaylistFilterLink } from '@sofie-automation/blueprints-integration'
import { PartId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DummyReactiveVar } from '@sofie-automation/meteor-lib/dist/triggers/reactive-var'
import { ReactivePlaylistActionContext } from '@sofie-automation/meteor-lib/dist/triggers/actionFactory'
import { FindOneOptions, FindOptions, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { DBRundownPlaylist, SelectedPartInstance } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import {
	AdLibActions,
	AdLibPieces,
	PartInstances,
	Parts,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	RundownPlaylists,
	Rundowns,
	Segments,
} from '../../collections'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { AsyncOnlyReadOnlyMongoCollection } from '../../collections/collection'

export function hashSingleUseToken(token: string): string {
	return getHash(SINGLE_USE_TOKEN_SALT + token)
}

class MeteorTriggersCollectionWrapper<DBInterface extends { _id: ProtectedString<any> }>
	implements TriggersAsyncCollection<DBInterface>
{
	readonly #collection: AsyncOnlyReadOnlyMongoCollection<DBInterface>

	constructor(collection: AsyncOnlyReadOnlyMongoCollection<DBInterface>) {
		this.#collection = collection
	}

	async findFetchAsync(
		_computation: TriggerTrackerComputation | null,
		selector: MongoQuery<DBInterface>,
		options?: FindOptions<DBInterface>
	): Promise<Array<DBInterface>> {
		// Note: the _computation is not used, since we are not using Tracker server-side
		return this.#collection.findFetchAsync(selector, options)
	}

	async findOneAsync(
		_computation: TriggerTrackerComputation | null,
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOneOptions<DBInterface>
	): Promise<DBInterface | undefined> {
		// Note: the _computation is not used, since we are not using Tracker server-side
		return this.#collection.findOneAsync(selector, options)
	}
}

export const MeteorTriggersContext: TriggersContext = {
	MeteorCall,

	logger,

	isClient: false,

	AdLibActions: new MeteorTriggersCollectionWrapper(AdLibActions),
	AdLibPieces: new MeteorTriggersCollectionWrapper(AdLibPieces),
	Parts: new MeteorTriggersCollectionWrapper(Parts),
	RundownBaselineAdLibActions: new MeteorTriggersCollectionWrapper(RundownBaselineAdLibActions),
	RundownBaselineAdLibPieces: new MeteorTriggersCollectionWrapper(RundownBaselineAdLibPieces),
	RundownPlaylists: new MeteorTriggersCollectionWrapper(RundownPlaylists),
	Rundowns: new MeteorTriggersCollectionWrapper(Rundowns),
	Segments: new MeteorTriggersCollectionWrapper(Segments),

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
			// @ts-expect-error deep property
			'part._id': 1,
			segmentId: 1,
		},
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
						$regex: link.value as any,
					},
				})
				break
			default:
				assertNever(link)
				break
		}
	})

	return RundownPlaylists.findOneAsync(selector)
}
