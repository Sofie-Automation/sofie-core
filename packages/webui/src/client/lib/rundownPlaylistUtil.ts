import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { FindOptions, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { RundownPlaylistCollectionUtil } from '../collections/rundownPlaylistUtil.js'
import { UIPartInstances, UIParts } from '../ui/Collections.js'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { Pieces, Segments } from '../collections/index.js'
import { DBRundown, Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownId, PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { normalizeArrayFunc, groupByToMap } from '@sofie-automation/corelib/dist/lib'
import {
	sortSegmentsInRundowns,
	sortPartsInSegments,
	sortPartsInSortedSegments,
} from '@sofie-automation/corelib/dist/playout/playlist'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import _ from 'underscore'

export class RundownPlaylistClientUtil {
	/** Returns all segments joined with their rundowns in their correct order for this RundownPlaylist */
	static getRundownsAndSegments(
		playlist: Pick<DBRundownPlaylist, '_id' | 'rundownIdsInOrder'>,
		selector?: MongoQuery<DBSegment>,
		options?: FindOptions<DBSegment>
	): Array<{
		rundown: Pick<
			Rundown,
			| '_id'
			| 'name'
			| 'playlistId'
			| 'timing'
			| 'showStyleBaseId'
			| 'showStyleVariantId'
			| 'endOfRundownIsShowBreak'
		>
		segments: DBSegment[]
	}> {
		const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist, undefined, {
			fields: {
				name: 1,
				playlistId: 1,
				timing: 1,
				showStyleBaseId: 1,
				showStyleVariantId: 1,
				endOfRundownIsShowBreak: 1,
			},
		})
		const segments = Segments.find(
			{
				rundownId: {
					$in: rundowns.map((i) => i._id),
				},
				...selector,
			},
			{
				sort: {
					rundownId: 1,
					_rank: 1,
				},
				...options,
			}
		).fetch()
		return RundownPlaylistClientUtil._matchSegmentsAndRundowns(segments, rundowns)
	}
	/** Returns all segments in their correct order for this RundownPlaylist */
	static getSegments(
		playlist: Pick<DBRundownPlaylist, '_id' | 'rundownIdsInOrder'>,
		selector?: MongoQuery<DBSegment>,
		options?: FindOptions<DBSegment>
	): DBSegment[] {
		const rundownIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)
		const segments = Segments.find(
			{
				rundownId: {
					$in: rundownIds,
				},
				...selector,
			},
			{
				sort: {
					rundownId: 1,
					_rank: 1,
				},
				...options,
			}
		).fetch()
		return RundownPlaylistClientUtil._sortSegments(segments, playlist)
	}

	static getSelectedPartInstances(
		playlist: Pick<DBRundownPlaylist, '_id' | 'currentPartInfo' | 'previousPartInfo' | 'nextPartInfo'>,
		rundownIds0?: RundownId[]
	): {
		currentPartInstance: PartInstance | undefined
		nextPartInstance: PartInstance | undefined
		previousPartInstance: PartInstance | undefined
		firstTakenPartInstance: PartInstance | undefined
	} {
		let unorderedRundownIds = rundownIds0
		if (!unorderedRundownIds) {
			unorderedRundownIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)
		}

		const ids = _.compact([
			playlist.currentPartInfo?.partInstanceId,
			playlist.previousPartInfo?.partInstanceId,
			playlist.nextPartInfo?.partInstanceId,
		])
		const instances =
			ids.length > 0
				? UIPartInstances.find({
						rundownId: { $in: unorderedRundownIds },
						_id: { $in: ids },
						reset: { $ne: true },
					}).fetch()
				: []

		const firstTakenPartInstance = UIPartInstances.findOne(
			{
				rundownId: { $in: unorderedRundownIds },
				reset: { $ne: true },
				takeCount: { $exists: true },
			},
			{
				sort: { takeCount: 1 },
			}
		)

		return {
			currentPartInstance: instances.find((inst) => inst._id === playlist.currentPartInfo?.partInstanceId),
			nextPartInstance: instances.find((inst) => inst._id === playlist.nextPartInfo?.partInstanceId),
			previousPartInstance: instances.find((inst) => inst._id === playlist.previousPartInfo?.partInstanceId),
			firstTakenPartInstance,
		}
	}

	static getAllPartInstances(
		playlist: Pick<DBRundownPlaylist, '_id'>,
		selector?: MongoQuery<PartInstance>,
		options?: FindOptions<PartInstance>
	): PartInstance[] {
		const unorderedRundownIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)

		return UIPartInstances.find(
			{
				rundownId: { $in: unorderedRundownIds },
				...selector,
			},
			{
				sort: { takeCount: 1 },
				...options,
			}
		).fetch()
	}
	/** Return a list of PartInstances, omitting the reset ones (ie only the ones that are relevant) */
	static getActivePartInstances(
		playlist: Pick<DBRundownPlaylist, '_id'>,
		selector?: MongoQuery<PartInstance>,
		options?: FindOptions<PartInstance>
	): PartInstance[] {
		const newSelector: MongoQuery<PartInstance> = {
			...selector,
			reset: { $ne: true },
		}
		return RundownPlaylistClientUtil.getAllPartInstances(playlist, newSelector, options)
	}
	static getActivePartInstancesMap(
		playlist: Pick<DBRundownPlaylist, '_id'>,
		selector?: MongoQuery<PartInstance>,
		options?: FindOptions<PartInstance>
	): Record<string, PartInstance> {
		const instances = RundownPlaylistClientUtil.getActivePartInstances(playlist, selector, options)
		return normalizeArrayFunc(instances, (i) => unprotectString(i.part._id))
	}
	static getPiecesForParts(
		parts: Array<PartId>,
		piecesOptions?: Omit<FindOptions<Piece>, 'projection'> // We are mangling fields, so block projection
	): Map<PartId, Piece[]> {
		const allPieces = Pieces.find(
			{ startPartId: { $in: parts } },
			{
				...piecesOptions,
				//@ts-expect-error This is too clever for the compiler
				fields: piecesOptions?.fields
					? {
							...piecesOptions?.fields,
							startPartId: 1,
						}
					: undefined,
			}
		).fetch()
		return groupByToMap(allPieces, 'startPartId')
	}

	static _sortSegments<TSegment extends Pick<DBSegment, '_id' | 'rundownId' | '_rank'>>(
		segments: Array<TSegment>,
		playlist: Pick<DBRundownPlaylist, 'rundownIdsInOrder'>
	): TSegment[] {
		return sortSegmentsInRundowns(segments, playlist.rundownIdsInOrder)
	}
	static _matchSegmentsAndRundowns<T extends DBRundown, E extends DBSegment>(
		segments: E[],
		rundowns: T[]
	): Array<{ rundown: T; segments: E[] }> {
		const rundownsMap = new Map<
			RundownId,
			{
				rundown: T
				segments: E[]
			}
		>()
		rundowns.forEach((rundown) => {
			rundownsMap.set(rundown._id, {
				rundown,
				segments: [],
			})
		})
		segments.forEach((segment) => {
			rundownsMap.get(segment.rundownId)?.segments.push(segment)
		})
		return Array.from(rundownsMap.values())
	}
	static _sortParts(
		parts: DBPart[],
		playlist: Pick<DBRundownPlaylist, 'rundownIdsInOrder'>,
		segments: Array<Pick<DBSegment, '_id' | 'rundownId' | '_rank'>>
	): DBPart[] {
		return sortPartsInSegments(parts, playlist.rundownIdsInOrder, segments)
	}
	static _sortPartsInner<P extends Pick<DBPart, '_id' | 'segmentId' | '_rank'>>(
		parts: P[],
		sortedSegments: Array<Pick<DBSegment, '_id'>>
	): P[] {
		return sortPartsInSortedSegments(parts, sortedSegments)
	}

	static getUnorderedParts(
		playlist: Pick<DBRundownPlaylist, '_id'>,
		selector?: MongoQuery<DBPart>,
		options?: FindOptions<DBPart>
	): DBPart[] {
		const rundownIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)
		const parts = UIParts.find(
			{
				...selector,
				rundownId: {
					$in: rundownIds,
				},
			},
			{
				...options,
				sort: {
					rundownId: 1,
					_rank: 1,
				},
			}
		).fetch()
		return parts
	}
	/** Synchronous version of getSegmentsAndParts, to be used client-side */
	static getSegmentsAndPartsSync(
		playlist: Pick<DBRundownPlaylist, '_id' | 'rundownIdsInOrder'>,
		segmentsQuery?: MongoQuery<DBSegment>,
		partsQuery?: MongoQuery<DBPart>,
		segmentsOptions?: Omit<FindOptions<DBSegment>, 'projection'>, // We are mangling fields, so block projection
		partsOptions?: Omit<FindOptions<DBPart>, 'projection'> // We are mangling fields, so block projection
	): { segments: DBSegment[]; parts: DBPart[] } {
		const rundownIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)
		const segments = Segments.find(
			{
				rundownId: {
					$in: rundownIds,
				},
				...segmentsQuery,
			},
			{
				...segmentsOptions,
				//@ts-expect-error This is too clever for the compiler
				fields: segmentsOptions?.fields
					? {
							...segmentsOptions?.fields,
							_rank: 1,
							rundownId: 1,
						}
					: undefined,
				sort: {
					...segmentsOptions?.sort,
					rundownId: 1,
					_rank: 1,
				},
			}
		).fetch()

		const parts = UIParts.find(
			{
				rundownId: {
					$in: rundownIds,
				},
				...partsQuery,
			},
			{
				...partsOptions,
				//@ts-expect-error This is too clever for the compiler
				fields: partsOptions?.fields
					? {
							...partsOptions?.fields,
							rundownId: 1,
							segmentId: 1,
							_rank: 1,
						}
					: undefined,
				sort: {
					...segmentsOptions?.sort,
					rundownId: 1,
					_rank: 1,
				},
			}
		).fetch()

		const sortedSegments = RundownPlaylistClientUtil._sortSegments(segments, playlist)
		return {
			segments: sortedSegments,
			parts: RundownPlaylistClientUtil._sortPartsInner(parts, sortedSegments),
		}
	}
}
