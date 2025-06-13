import {
	TriggersAsyncCollection,
	TriggersContext,
	TriggerTrackerComputation,
} from '@sofie-automation/meteor-lib/dist/triggers/triggersContext'
import { hashSingleUseToken } from '../lib.js'
import { MeteorCall } from '../meteorApi.js'
import { IBaseFilterLink } from '@sofie-automation/blueprints-integration'
import { doUserAction } from '../clientUserAction.js'
import { Tracker } from 'meteor/tracker'
import {
	AdLibActions,
	AdLibPieces,
	Parts,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	RundownPlaylists,
	Rundowns,
	Segments,
} from '../../collections/index.js'
import { logger } from '../logging.js'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReactivePlaylistActionContext } from '@sofie-automation/meteor-lib/dist/triggers/actionFactory'
import { FindOneOptions, MongoReadOnlyCollection } from '../../collections/lib.js'
import { ProtectedString } from '../tempLib.js'
import { ReactiveVar as MeteorReactiveVar } from 'meteor/reactive-var'
import { TriggerReactiveVar } from '@sofie-automation/meteor-lib/dist/triggers/reactive-var'
import { FindOptions, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { memoizedIsolatedAutorunAsync } from '../memoizedIsolatedAutorun.js'

class UiTriggersCollectionWrapper<DBInterface extends { _id: ProtectedString<any> }>
	implements TriggersAsyncCollection<DBInterface>
{
	readonly #collection: MongoReadOnlyCollection<DBInterface>

	constructor(collection: MongoReadOnlyCollection<DBInterface>) {
		this.#collection = collection
	}

	async findFetchAsync(
		computation: TriggerTrackerComputation | null,
		selector: MongoQuery<DBInterface>,
		options?: FindOptions<DBInterface>
	): Promise<Array<DBInterface>> {
		return Tracker.withComputation(computation as Tracker.Computation | null, async () => {
			return this.#collection.find(selector, options).fetch()
		})
	}

	async findOneAsync(
		computation: TriggerTrackerComputation | null,
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOneOptions<DBInterface>
	): Promise<DBInterface | undefined> {
		return Tracker.withComputation(computation as Tracker.Computation | null, async () => {
			return this.#collection.findOne(selector, options)
		})
	}
}

export const UiTriggersContext: TriggersContext = {
	MeteorCall,

	logger,

	isClient: true,

	AdLibActions: new UiTriggersCollectionWrapper(AdLibActions),
	AdLibPieces: new UiTriggersCollectionWrapper(AdLibPieces),
	Parts: new UiTriggersCollectionWrapper(Parts),
	RundownBaselineAdLibActions: new UiTriggersCollectionWrapper(RundownBaselineAdLibActions),
	RundownBaselineAdLibPieces: new UiTriggersCollectionWrapper(RundownBaselineAdLibPieces),
	RundownPlaylists: new UiTriggersCollectionWrapper(RundownPlaylists),
	Rundowns: new UiTriggersCollectionWrapper(Rundowns),
	Segments: new UiTriggersCollectionWrapper(Segments),

	hashSingleUseToken,

	doUserAction,

	withComputation: async (computation, func) => {
		return Tracker.withComputation(computation as Tracker.Computation | null, func)
	},

	memoizedIsolatedAutorun: async <TArgs extends any[], TRes>(
		computation: TriggerTrackerComputation | null,
		fnc: (computation: TriggerTrackerComputation | null, ...args: TArgs) => Promise<TRes>,
		functionName: string,
		...params: TArgs
	): Promise<TRes> => {
		return memoizedIsolatedAutorunAsync(
			computation as Tracker.Computation | null,
			async (innerComputation, ...params2) => fnc(toTriggersComputation(innerComputation), ...params2),
			functionName,
			...params
		)
	},

	async createContextForRundownPlaylistChain(
		_studioId: StudioId,
		_filterChain: IBaseFilterLink[]
	): Promise<ReactivePlaylistActionContext | undefined> {
		// Server only

		throw new Error('Invalid filter combination')
	},
}

export function toTriggersReactiveVar<T>(reactiveVar: MeteorReactiveVar<T>): TriggerReactiveVar<T> {
	return reactiveVar as any
}

export function toTriggersComputation(computation: Tracker.Computation): TriggerTrackerComputation {
	return computation as any
}
