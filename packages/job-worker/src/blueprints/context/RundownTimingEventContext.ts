import {
	IBlueprintPartInstance,
	IBlueprintPieceInstance,
	IBlueprintSegmentDB,
	IRundownTimingEventContext,
} from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { protectString, protectStringArray, unDeepString } from '@sofie-automation/corelib/dist/protectedString'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs/index.js'
import { MongoQuery } from '../../db/index.js'
import { convertPartInstanceToBlueprints, convertPieceInstanceToBlueprints, convertSegmentToBlueprints } from './lib.js'
import { ContextInfo } from './CommonContext.js'
import { RundownDataChangedEventContext } from './RundownDataChangedEventContext.js'

export class RundownTimingEventContext extends RundownDataChangedEventContext implements IRundownTimingEventContext {
	readonly previousPart: Readonly<IBlueprintPartInstance<unknown>> | undefined
	private readonly _currentPart: DBPartInstance
	readonly nextPart: Readonly<IBlueprintPartInstance<unknown>> | undefined

	private readonly partInstanceCache = new Map<PartInstanceId, DBPartInstance>()

	public get currentPart(): Readonly<IBlueprintPartInstance<unknown>> {
		return convertPartInstanceToBlueprints(this._currentPart)
	}

	constructor(
		context: JobContext,
		contextInfo: ContextInfo,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		rundown: ReadonlyDeep<DBRundown>,
		previousPartInstance: DBPartInstance | undefined,
		partInstance: DBPartInstance,
		nextPartInstance: DBPartInstance | undefined
	) {
		super(context, contextInfo, showStyleCompound, rundown)

		if (previousPartInstance) this.partInstanceCache.set(previousPartInstance._id, previousPartInstance)
		if (partInstance) this.partInstanceCache.set(partInstance._id, partInstance)
		if (nextPartInstance) this.partInstanceCache.set(nextPartInstance._id, nextPartInstance)

		this.previousPart = previousPartInstance && convertPartInstanceToBlueprints(previousPartInstance)
		this._currentPart = partInstance
		this.nextPart = nextPartInstance && convertPartInstanceToBlueprints(nextPartInstance)
	}

	async getFirstPartInstanceInRundown(allowUntimed?: boolean): Promise<Readonly<IBlueprintPartInstance<unknown>>> {
		const query: MongoQuery<DBPartInstance> = {
			rundownId: this._rundown._id,
			playlistActivationId: this._currentPart.playlistActivationId,
			'part.untimed': { $ne: true },
		}

		if (allowUntimed) {
			// This is a weird way to define the query, but its necessary to make typings happy
			delete query['part.untimed']
		}

		const partInstance = await this.context.directCollections.PartInstances.findOne(query, {
			sort: {
				takeCount: 1,
			},
		})

		// If this doesn't find anything, then where did our reference PartInstance come from?
		if (!partInstance)
			throw new Error(
				`No PartInstances found for Rundown "${this._rundown._id}" (PlaylistActivationId "${this._currentPart.playlistActivationId}")`
			)

		this.partInstanceCache.set(partInstance._id, partInstance)

		return convertPartInstanceToBlueprints(partInstance)
	}

	async getPartInstancesInSegmentPlayoutId(
		refPartInstance: Readonly<Pick<IBlueprintPartInstance<unknown>, '_id'>>
	): Promise<Array<IBlueprintPartInstance<unknown>>> {
		// Pull the PartInstance from the cached list, so that we can access 'secret' values
		const refPartInstance2 = this.partInstanceCache.get(protectString(refPartInstance._id))
		if (!refPartInstance2?.segmentId || !refPartInstance2.segmentPlayoutId)
			throw new Error('Missing partInstance to use a reference for the segment')

		const partInstances = await this.context.directCollections.PartInstances.findFetch(
			{
				rundownId: this._rundown._id,
				playlistActivationId: this._currentPart.playlistActivationId,
				segmentId: unDeepString(refPartInstance2.segmentId),
				segmentPlayoutId: unDeepString(refPartInstance2.segmentPlayoutId),
			},
			{
				sort: {
					takeCount: 1,
				},
			}
		)

		const res: Array<IBlueprintPartInstance<unknown>> = []
		for (const partInstance of partInstances) {
			this.partInstanceCache.set(partInstance._id, partInstance)
			res.push(convertPartInstanceToBlueprints(partInstance))
		}

		return res
	}

	async getPieceInstances(...partInstanceIds: string[]): Promise<Array<IBlueprintPieceInstance<unknown>>> {
		if (partInstanceIds.length === 0) return []

		const pieceInstances = await this.context.directCollections.PieceInstances.findFetch({
			rundownId: this._rundown._id,
			playlistActivationId: this._currentPart.playlistActivationId,
			partInstanceId: { $in: protectStringArray(partInstanceIds) },
		})

		return pieceInstances.map(convertPieceInstanceToBlueprints)
	}

	async getSegment(segmentId: string): Promise<Readonly<IBlueprintSegmentDB<unknown>> | undefined> {
		if (!segmentId) return undefined

		const segment = await this.context.directCollections.Segments.findOne({
			_id: protectString(segmentId),
			rundownId: this._rundown._id,
		})

		return segment && convertSegmentToBlueprints(segment)
	}
}
