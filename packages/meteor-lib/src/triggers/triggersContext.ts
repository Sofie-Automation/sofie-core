import { UserAction } from '../userAction.js'
import { IMeteorCall } from '../api/methods.js'
import { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import { ClientAPI } from '../api/client.js'
import { FindOneOptions, FindOptions } from '../collections/lib.js'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { LoggerInstanceFixed } from '@sofie-automation/corelib/dist/logging'
import { IBaseFilterLink } from '@sofie-automation/blueprints-integration'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReactivePlaylistActionContext } from './actionFactory.js'
import { TFunction } from 'i18next'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'

/**
 * A opaque type that is used in the meteor-lib api instead of implementation specific computations.
 * This should be treated as equivalent to the Meteor `Tracker.Computation` type.
 */
export type TriggerTrackerComputation = { __internal: true }

export interface TriggersAsyncCollection<DBInterface extends { _id: ProtectedString<any> }> {
	/**
	 * Find and return multiple documents
	 * @param selector A query describing the documents to find
	 * @param options Options for the operation
	 */
	findFetchAsync(
		computation: TriggerTrackerComputation | null,
		selector: MongoQuery<DBInterface>,
		options?: FindOptions<DBInterface>
	): Promise<Array<DBInterface>>

	/**
	 * Finds the first document that matches the selector, as ordered by sort and skip options. Returns `undefined` if no matching document is found.
	 * @param selector A query describing the documents to find
	 */
	findOneAsync(
		computation: TriggerTrackerComputation | null,
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOneOptions<DBInterface>
	): Promise<DBInterface | undefined>
}

/**
 * The document fields that the compiled trigger filter chains read, per collection.
 *
 * These are the contract between `actionFilterChainCompilers.ts` and whatever backs a `TriggersContext`. A
 * source that cannot supply one of them - a projection that omits it, say - is a compile error rather than a
 * trigger that quietly stops firing. Widen a set here when the compilers start reading a new field.
 */
export type TriggersAdLibActionFields = '_id' | 'actionId' | 'display' | 'partId' | 'rundownId' | 'userData'
export type TriggersAdLibPieceFields =
	| '_id'
	| '_rank'
	| 'name'
	| 'partId'
	| 'rundownId'
	| 'sourceLayerId'
	| 'outputLayerId'
	| 'expectedDuration'
	| 'lifespan'
	| 'tags'

export type TriggersAdLibAction = Pick<AdLibAction, TriggersAdLibActionFields>
export type TriggersRundownBaselineAdLibAction = Pick<RundownBaselineAdLibAction, TriggersAdLibActionFields>
export type TriggersAdLibPiece = Pick<AdLibPiece, TriggersAdLibPieceFields>
export type TriggersRundownBaselineAdLibItem = Pick<RundownBaselineAdLibItem, TriggersAdLibPieceFields>
export type TriggersPart = Pick<DBPart, '_id' | '_rank' | 'segmentId' | 'rundownId'>
export type TriggersSegment = Pick<DBSegment, '_id' | '_rank' | 'rundownId'>
export type TriggersRundownPlaylist = Pick<DBRundownPlaylist, '_id' | 'rundownIdsInOrder'>
export type TriggersRundown = Pick<DBRundown, '_id' | 'playlistId'>

export interface TriggersContext {
	readonly MeteorCall: IMeteorCall

	readonly logger: LoggerInstanceFixed

	readonly isClient: boolean

	readonly AdLibActions: TriggersAsyncCollection<TriggersAdLibAction>
	readonly AdLibPieces: TriggersAsyncCollection<TriggersAdLibPiece>
	readonly Parts: TriggersAsyncCollection<TriggersPart>
	readonly RundownBaselineAdLibActions: TriggersAsyncCollection<TriggersRundownBaselineAdLibAction>
	readonly RundownBaselineAdLibPieces: TriggersAsyncCollection<TriggersRundownBaselineAdLibItem>
	readonly RundownPlaylists: TriggersAsyncCollection<TriggersRundownPlaylist>
	readonly Rundowns: TriggersAsyncCollection<TriggersRundown>
	readonly Segments: TriggersAsyncCollection<TriggersSegment>

	hashSingleUseToken(token: string): string

	doUserAction<Result>(
		_t: TFunction,
		userEvent: string,
		_action: UserAction,
		fcn: (event: string, timeStamp: Time) => Promise<ClientAPI.ClientResponse<Result>>,
		callback?: (err: any, res?: Result) => void | boolean,
		_okMessage?: string
	): void

	/**
	 * Equivalent to the Meteor `Tracker.withComputation` function, but implementation specific.
	 * Use this to ensure that a function is run as part of the provided computation.
	 */
	withComputation<T>(computation: TriggerTrackerComputation | null, func: () => Promise<T>): Promise<T>

	/**
	 * Create a reactive computation that will be run independently of the outer one. If the same function (using the same
	 * name and parameters) will be used again, this computation will only be computed once on invalidation and it's
	 * result will be memoized and reused on every other call.
	 *
	 * This will be run as part of the provided computation, and passes the inner computation to the function.
	 */
	memoizedIsolatedAutorun<TArgs extends any[], TRes>(
		computation: TriggerTrackerComputation | null,
		fnc: (computation: TriggerTrackerComputation | null, ...args: TArgs) => Promise<TRes>,
		functionName: string,
		...params: TArgs
	): Promise<TRes>

	createContextForRundownPlaylistChain(
		_studioId: StudioId,
		_filterChain: IBaseFilterLink[]
	): Promise<ReactivePlaylistActionContext | undefined>
}
