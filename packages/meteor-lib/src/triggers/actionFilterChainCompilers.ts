import {
	IAdLibFilterLink,
	IBlueprintActionManifestDisplayContent,
	IGUIContextFilterLink,
	IOutputLayer,
	IRundownPlaylistFilterLink,
	ISourceLayer,
	ITranslatableMessage,
	PieceLifespan,
} from '@sofie-automation/blueprints-integration'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { sortAdlibs } from '../adlibs'
import { ReactivePlaylistActionContext } from './actionFactory'
import { PartId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IWrappedAdLibBase } from '@sofie-automation/shared-lib/dist/input-gateway/deviceTriggerPreviews'
import { MountedAdLibTriggerType } from '../api/MountedTriggers'
import { assertNever, generateTranslation } from '@sofie-automation/corelib/dist/lib'
import { FindOptions } from '../collections/lib'
import { TriggersContext, TriggerTrackerComputation } from './triggersContext'

export type AdLibFilterChainLink = IRundownPlaylistFilterLink | IGUIContextFilterLink | IAdLibFilterLink

/** This is a compiled Filter type, targetting a particular MongoCollection */
type CompiledFilter<T> = {
	selector: MongoQuery<T>
	options: FindOptions<T>
	pick: number | undefined
	limit: number | undefined
	global: boolean | undefined
	segment: 'current' | 'next' | undefined
	part: 'current' | 'next' | undefined
	arguments?: {
		triggerMode: string
	}
	/**
	 * The query compiler has determined that this filter will always return an empty set,
	 * it's safe to skip it entirely.
	 */
	skip?: true
}

type SomeAdLib = RundownBaselineAdLibItem | RundownBaselineAdLibAction | AdLibPiece | AdLibAction

interface IWrappedAdLibType<T extends SomeAdLib, typeName extends MountedAdLibTriggerType> extends IWrappedAdLibBase {
	_id: T['_id']
	_rank: number
	partId: PartId | null
	type: typeName
	label: string | ITranslatableMessage
	sourceLayerId?: ISourceLayer['_id']
	outputLayerId?: IOutputLayer['_id']
	expectedDuration?: number | PieceLifespan
	currentPieceTags?: string[]
	item: T
}

/** What follows are utility functions to wrap various AdLib objects to IWrappedAdLib */

function wrapAdLibAction(adLib: AdLibAction, type: MountedAdLibTriggerType.adLibAction): IWrappedAdLib {
	return {
		_id: adLib._id,
		_rank: adLib.display?._rank || 0,
		partId: adLib.partId,
		type: type,
		label: adLib.display?.label,
		sourceLayerId: (adLib.display as IBlueprintActionManifestDisplayContent)?.sourceLayerId,
		outputLayerId: (adLib.display as IBlueprintActionManifestDisplayContent)?.outputLayerId,
		expectedDuration: undefined,
		currentPieceTags: adLib.display.currentPieceTags,
		item: adLib,
	}
}

function wrapRundownBaselineAdLibAction(
	adLib: RundownBaselineAdLibAction,
	type: MountedAdLibTriggerType.rundownBaselineAdLibAction
): IWrappedAdLib {
	return {
		_id: adLib._id,
		_rank: adLib.display?._rank ?? 0,
		partId: adLib.partId ?? null,
		type: type,
		label: adLib.display?.label,
		sourceLayerId: (adLib.display as IBlueprintActionManifestDisplayContent)?.sourceLayerId,
		outputLayerId: (adLib.display as IBlueprintActionManifestDisplayContent)?.outputLayerId,
		expectedDuration: undefined,
		currentPieceTags: adLib.display.currentPieceTags,
		item: adLib,
	}
}

function wrapAdLibPiece<T extends RundownBaselineAdLibItem | AdLibPiece>(
	adLib: T,
	type: MountedAdLibTriggerType.adLibPiece | MountedAdLibTriggerType.rundownBaselineAdLibItem
): IWrappedAdLib {
	return {
		_id: adLib._id,
		_rank: adLib._rank,
		partId: adLib.partId ?? null,
		type: type,
		label: adLib.name,
		sourceLayerId: adLib.sourceLayerId,
		outputLayerId: adLib.outputLayerId,
		expectedDuration: adLib.expectedDuration || adLib.lifespan,
		item: adLib,
	}
}

export type IWrappedAdLib =
	| IWrappedAdLibType<RundownBaselineAdLibItem, MountedAdLibTriggerType.rundownBaselineAdLibItem>
	| IWrappedAdLibType<RundownBaselineAdLibAction, MountedAdLibTriggerType.rundownBaselineAdLibAction>
	| IWrappedAdLibType<AdLibPiece, MountedAdLibTriggerType.adLibPiece>
	| IWrappedAdLibType<AdLibAction, MountedAdLibTriggerType.adLibAction>
	| {
			_id: ISourceLayer['_id']
			_rank: number
			partId: PartId | null
			type: MountedAdLibTriggerType.clearSourceLayer
			label: string | ITranslatableMessage
			sourceLayerId: ISourceLayer['_id']
			outputLayerId: undefined
			expectedDuration: undefined
			item: ISourceLayer
	  }
	| {
			_id: ISourceLayer['_id']
			_rank: number
			partId: PartId | null
			type: MountedAdLibTriggerType.sticky
			label: string | ITranslatableMessage
			sourceLayerId: ISourceLayer['_id']
			outputLayerId: undefined
			expectedDuration: undefined
			item: ISourceLayer
	  }

/** What follows are methods to compile a filterChain to a CompiledFilter (a MongoQuery with options and some
 * additional flags, used for performance optimization ) */

function sharedSourceLayerFilterCompiler(
	filterChain: IAdLibFilterLink[],
	sourceLayers: SourceLayers,
	targetType: 'clear' | 'sticky'
): {
	global: boolean | undefined
	skip: true | undefined
	sourceLayerIds: string[] | undefined
} {
	let global: boolean | undefined = undefined
	let skip: true | undefined = undefined
	let sourceLayerIds: string[] | undefined = undefined

	filterChain.forEach((link) => {
		switch (link.field) {
			case 'global':
				global = link.value
				if (global === false) {
					skip = true
				}
				return
			case 'label':
				// skip this filter, we assume clear ad-libs have no labels for the purpose of the triggers
				skip = true
				return
			case 'outputLayerId':
				// skip this filter, we assume clear ad-libs have no output layers for the purpose of the triggers
				skip = true
				return
			case 'sourceLayerId':
				sourceLayerIds = link.value
				return
			case 'sourceLayerType':
				sourceLayerIds = Object.values<ISourceLayer | undefined>(sourceLayers)
					.map((sourceLayer) =>
						sourceLayer && link.value.includes(sourceLayer.type) ? sourceLayer._id : undefined
					)
					.filter(Boolean) as string[]
				return
			case 'segment':
				// skip this filter, clear adlibs are global
				skip = true
				return
			case 'part':
				// skip this filter, clear adlibs are global
				skip = true
				return
			case 'tag':
				// skip this filter, clear adlibs have no tags
				skip = true
				return
			case 'type':
				if (link.value !== targetType) {
					skip = true
				}
				return
			case 'limit':
				// we can skip the limit stage here, it's going to be done at the final step anyway and
				// it doesn't speed anything up
				return
			case 'pick':
				// we can skip the pick stage here, it's done later anyway
				return
			case 'pickEnd':
				// we can skip the pick stage here, it's done later anyway
				return
			default:
				assertNever(link)
				return
		}
	})

	return {
		global,
		skip,
		sourceLayerIds,
	}
}

function compileAndRunClearFilter(filterChain: IAdLibFilterLink[], sourceLayers: SourceLayers): IWrappedAdLib[] {
	const { skip, sourceLayerIds } = sharedSourceLayerFilterCompiler(filterChain, sourceLayers, 'clear')

	let result: IWrappedAdLib[] = []

	if (!skip) {
		result = Object.values<ISourceLayer | undefined>(sourceLayers)
			.filter(
				(sourceLayer): sourceLayer is ISourceLayer =>
					!!(
						sourceLayer &&
						(sourceLayerIds ? sourceLayerIds.includes(sourceLayer._id) : true) &&
						sourceLayer.isClearable
					)
			)
			.map((sourceLayer) => {
				return {
					_id: sourceLayer._id,
					_rank: sourceLayer._rank,
					item: sourceLayer,
					type: 'clearSourceLayer',
					sourceLayerId: sourceLayer._id,
					label: generateTranslation('Clear {{layerName}}', { layerName: sourceLayer.name }),
					expectedDuration: undefined,
					outputLayerId: undefined,
				} as IWrappedAdLib
			})
			.sort((a, b) => a._rank - b._rank)
	}

	return result
}

function compileAndRunStickyFilter(filterChain: IAdLibFilterLink[], sourceLayers: SourceLayers): IWrappedAdLib[] {
	const { skip, sourceLayerIds } = sharedSourceLayerFilterCompiler(filterChain, sourceLayers, 'sticky')

	let result: IWrappedAdLib[] = []

	if (!skip) {
		result = Object.values<ISourceLayer | undefined>(sourceLayers)
			.filter(
				(sourceLayer): sourceLayer is ISourceLayer =>
					!!(
						sourceLayer &&
						(sourceLayerIds ? sourceLayerIds.includes(sourceLayer._id) : true) &&
						sourceLayer.isSticky === true
					)
			)
			.map((sourceLayer) => {
				return {
					_id: sourceLayer._id,
					_rank: sourceLayer._rank,
					item: sourceLayer,
					type: 'sticky',
					sourceLayerId: sourceLayer._id,
					label: generateTranslation('Last {{layerName}}', { layerName: sourceLayer.name }),
					expectedDuration: undefined,
					outputLayerId: undefined,
				} as IWrappedAdLib
			})
			.sort((a, b) => a._rank - b._rank)
	}

	return result
}

type AdLibActionType = RundownBaselineAdLibAction | AdLibAction

function compileAdLibActionFilter(
	filterChain: IAdLibFilterLink[],
	sourceLayers: SourceLayers
): CompiledFilter<AdLibActionType> {
	const selector: MongoQuery<AdLibActionType> = {}
	const options: FindOptions<AdLibActionType> = {}
	let pick: number | undefined = undefined
	let limit: number | undefined = undefined
	let global: boolean | undefined = undefined
	let skip: true | undefined = undefined
	let segment: 'current' | 'next' | undefined = undefined
	let part: 'current' | 'next' | undefined = undefined

	filterChain.forEach((link) => {
		switch (link.field) {
			case 'global':
				selector['partId'] = {
					$exists: !link.value,
				}
				global = link.value
				return
			case 'label':
				selector['display.label.key'] = {
					$regex: Array.isArray(link.value) ? link.value.join('|') : link.value,
				}
				return
			case 'outputLayerId':
				selector['display.outputLayerId'] = {
					$in: link.value,
				}
				return
			case 'sourceLayerId':
				selector['display.sourceLayerId'] = {
					$in: link.value,
				}
				return
			case 'sourceLayerType':
				selector['display.sourceLayerId'] = {
					$in: Object.values<ISourceLayer | undefined>(sourceLayers)
						.map((sourceLayer) =>
							sourceLayer && link.value.includes(sourceLayer.type) ? sourceLayer._id : undefined
						)
						.filter(Boolean) as string[],
				}
				return
			case 'segment':
				if (global) {
					skip = true
				}
				segment = link.value
				return
			case 'part':
				if (global) {
					skip = true
				}
				part = link.value
				return
			case 'tag':
				selector['display.tags'] = {
					$all: link.value,
				}
				return
			case 'type':
				if (link.value !== 'adLibAction') {
					skip = true
				}
				return
			case 'limit':
				limit = link.value
				return
			case 'pick':
				pick = link.value
				return
			case 'pickEnd':
				pick = (link.value + 1) * -1
				return
			default:
				assertNever(link)
				return
		}
	})

	return {
		selector,
		options,
		global,
		segment,
		part,
		limit,
		pick,
		skip,
	}
}

type AdLibPieceType = RundownBaselineAdLibItem | AdLibPiece

function compileAdLibPieceFilter(
	filterChain: IAdLibFilterLink[],
	sourceLayers: SourceLayers
): CompiledFilter<AdLibPieceType> {
	const selector: MongoQuery<AdLibPieceType> = {}
	const options: FindOptions<AdLibPieceType> = {}
	let pick: number | undefined = undefined
	let limit: number | undefined = undefined
	let global: boolean | undefined = undefined
	let skip: true | undefined = undefined
	let segment: 'current' | 'next' | undefined = undefined
	let part: 'current' | 'next' | undefined = undefined

	filterChain.forEach((link) => {
		switch (link.field) {
			case 'global':
				selector['partId'] = {
					$exists: !link.value,
				}
				global = link.value
				return
			case 'label':
				selector['name'] = {
					$regex: Array.isArray(link.value) ? link.value.join('|') : link.value,
				}
				return
			case 'outputLayerId':
				selector['outputLayerId'] = {
					$in: link.value,
				}
				return
			case 'sourceLayerId':
				selector['sourceLayerId'] = {
					$in: link.value,
				}
				return
			case 'sourceLayerType':
				selector['sourceLayerId'] = {
					$in: Object.values<ISourceLayer | undefined>(sourceLayers)
						.map((sourceLayer) =>
							sourceLayer && link.value.includes(sourceLayer.type) ? sourceLayer._id : undefined
						)
						.filter(Boolean) as string[],
				}
				return
			case 'segment':
				if (global) {
					skip = true
				}
				segment = link.value
				return
			case 'part':
				if (global) {
					skip = true
				}
				part = link.value
				return
			case 'tag':
				selector['tags'] = {
					$all: link.value,
				}
				return
			case 'type':
				if (link.value !== 'adLib') {
					skip = true
				}
				return
			case 'limit':
				limit = link.value
				return
			case 'pick':
				pick = link.value
				return
			case 'pickEnd':
				pick = (link.value + 1) * -1
				return
			default:
				assertNever(link)
				return
		}
	})

	return {
		selector,
		options,
		global,
		segment,
		part,
		limit,
		pick,
		skip,
	}
}

/**
 * Compile the filter chain and return a reactive function that will return the result set for this adLib filter
 * @param filterChain
 * @param sourceLayers
 * @returns
 */
export function compileAdLibFilter(
	triggersContext: TriggersContext,
	filterChain: AdLibFilterChainLink[],
	sourceLayers: SourceLayers
): (context: ReactivePlaylistActionContext, computation: TriggerTrackerComputation | null) => Promise<IWrappedAdLib[]> {
	const onlyAdLibLinks = filterChain.filter((link) => link.object === 'adLib') as IAdLibFilterLink[]
	const adLibPieceTypeFilter = compileAdLibPieceFilter(onlyAdLibLinks, sourceLayers)
	const adLibActionTypeFilter = compileAdLibActionFilter(onlyAdLibLinks, sourceLayers)

	const clearAdLibs = compileAndRunClearFilter(onlyAdLibLinks, sourceLayers)
	const stickyAdLibs = compileAndRunStickyFilter(onlyAdLibLinks, sourceLayers)

	return async (context: ReactivePlaylistActionContext, computation: TriggerTrackerComputation | null) => {
		let rundownBaselineAdLibItems: IWrappedAdLib[] = []
		let adLibPieces: IWrappedAdLib[] = []
		let rundownBaselineAdLibActions: IWrappedAdLib[] = []
		let adLibActions: IWrappedAdLib[] = []
		const segmentPartIds =
			adLibPieceTypeFilter.segment === 'current'
				? context.currentSegmentPartIds.get(computation)
				: adLibPieceTypeFilter.segment === 'next'
				? context.nextSegmentPartIds.get(computation)
				: undefined

		const singlePartId =
			adLibPieceTypeFilter.part === 'current'
				? context.currentPartId.get(computation)
				: adLibPieceTypeFilter.part === 'next'
				? context.nextPartId.get(computation)
				: undefined

		/** Note: undefined means that all parts are to be considered */
		let partFilter: PartId[] | undefined = undefined

		// Figure out the intersection of the segment current/next filter
		// and the part current/next filter.
		// It is possible to say "only from current segment" & "only from next part"
		// with the result being empty, if the next part is in another segment
		if (segmentPartIds === undefined && singlePartId !== undefined) {
			if (singlePartId !== null) {
				partFilter = [singlePartId]
			} else {
				partFilter = []
			}
		} else if (segmentPartIds !== undefined && singlePartId === undefined) {
			partFilter = segmentPartIds
		} else if (segmentPartIds !== undefined && singlePartId !== undefined) {
			if (singlePartId !== null && segmentPartIds.includes(singlePartId)) {
				partFilter = [singlePartId]
			} else {
				partFilter = []
			}
		}

		{
			let skip = adLibPieceTypeFilter.skip
			const currentNextOverride: MongoQuery<AdLibPieceType> = {}

			if (partFilter) {
				if (partFilter.length === 0) {
					skip = true
				} else {
					currentNextOverride['partId'] = {
						$in: partFilter,
					}
				}
			}

			const currentRundownId = context.currentRundownId.get(computation)
			if (!skip && currentRundownId) {
				if (adLibPieceTypeFilter.global === undefined || adLibPieceTypeFilter.global === true)
					rundownBaselineAdLibItems = (
						await triggersContext.RundownBaselineAdLibPieces.findFetchAsync(
							computation,
							{
								...adLibPieceTypeFilter.selector,
								...currentNextOverride,
								rundownId: currentRundownId,
							} as MongoQuery<RundownBaselineAdLibItem>,
							adLibPieceTypeFilter.options
						)
					).map((item) => wrapAdLibPiece(item, MountedAdLibTriggerType.rundownBaselineAdLibItem))
				if (adLibPieceTypeFilter.global === undefined || adLibPieceTypeFilter.global === false)
					adLibPieces = (
						await triggersContext.AdLibPieces.findFetchAsync(
							computation,
							{
								...adLibPieceTypeFilter.selector,
								...currentNextOverride,
								rundownId: currentRundownId,
							} as MongoQuery<AdLibPiece>,
							adLibPieceTypeFilter.options
						)
					).map((item) => wrapAdLibPiece(item, MountedAdLibTriggerType.adLibPiece))
			}
		}

		{
			let skip = adLibActionTypeFilter.skip
			const currentNextOverride: MongoQuery<AdLibActionType> = {}

			if (partFilter) {
				if (partFilter.length === 0) {
					skip = true
				} else {
					currentNextOverride['partId'] = {
						$in: partFilter,
					}
				}
			}

			const currentRundownId = context.currentRundownId.get(computation)
			if (!skip && currentRundownId) {
				if (adLibActionTypeFilter.global === undefined || adLibActionTypeFilter.global === true)
					rundownBaselineAdLibActions = (
						await triggersContext.RundownBaselineAdLibActions.findFetchAsync(
							computation,
							{
								...adLibActionTypeFilter.selector,
								...currentNextOverride,
								rundownId: currentRundownId,
							} as MongoQuery<RundownBaselineAdLibAction>,
							adLibActionTypeFilter.options
						)
					).map((item) =>
						wrapRundownBaselineAdLibAction(item, MountedAdLibTriggerType.rundownBaselineAdLibAction)
					)
				if (adLibActionTypeFilter.global === undefined || adLibActionTypeFilter.global === false)
					adLibActions = (
						await triggersContext.AdLibActions.findFetchAsync(
							computation,
							{
								...adLibActionTypeFilter.selector,
								...currentNextOverride,
								rundownId: currentRundownId,
							} as MongoQuery<AdLibAction>,
							adLibActionTypeFilter.options
						)
					).map((item) => wrapAdLibAction(item, MountedAdLibTriggerType.adLibAction))
			}
		}

		const rundownRankMap = new Map<RundownId, number>()
		const segmentRankMap = new Map<SegmentId, number>()
		const partRankMap = new Map<PartId, { segmentId: SegmentId; _rank: number; rundownId: RundownId }>()
		{
			if (partFilter === undefined || partFilter.length > 0) {
				// Note: We need to return an array from within memoizedIsolatedAutorun,
				// because _.isEqual (used in memoizedIsolatedAutorun) doesn't work with Maps..

				const rundownPlaylistId = context.rundownPlaylistId.get(computation)
				const rundownRanks = await triggersContext.memoizedIsolatedAutorun(
					computation,
					async (computation) => {
						const playlist = (await triggersContext.RundownPlaylists.findOneAsync(
							computation,
							rundownPlaylistId,
							{
								projection: {
									rundownIdsInOrder: 1,
								},
							}
						)) as Pick<DBRundownPlaylist, 'rundownIdsInOrder'> | undefined

						if (playlist?.rundownIdsInOrder) {
							return playlist.rundownIdsInOrder
						} else {
							const rundowns = (await triggersContext.Rundowns.findFetchAsync(
								computation,
								{
									playlistId: rundownPlaylistId,
								},
								{
									fields: {
										_id: 1,
									},
								}
							)) as Pick<DBRundown, '_id'>[]

							return rundowns.map((r) => r._id)
						}
					},
					`rundownsRanksForPlaylist_${rundownPlaylistId}`
				)
				rundownRanks.forEach((id, index) => {
					rundownRankMap.set(id, index)
				})

				const segmentRanks = await triggersContext.memoizedIsolatedAutorun(
					computation,
					async (computation) =>
						(await triggersContext.Segments.findFetchAsync(
							computation,
							{
								rundownId: { $in: Array.from(rundownRankMap.keys()) },
							},
							{
								fields: {
									_id: 1,
									_rank: 1,
								},
							}
						)) as Pick<DBSegment, '_id' | '_rank'>[],
					`segmentRanksForRundowns_${Array.from(rundownRankMap.keys()).join(',')}`
				)
				segmentRanks.forEach((segment) => {
					segmentRankMap.set(segment._id, segment._rank)
				})

				const partRanks = await triggersContext.memoizedIsolatedAutorun(
					computation,
					async (computation) => {
						if (!partFilter) {
							return (await triggersContext.Parts.findFetchAsync(
								computation,
								{
									rundownId: { $in: Array.from(rundownRankMap.keys()) },
								},
								{
									fields: {
										_id: 1,
										segmentId: 1,
										rundownId: 1,
										_rank: 1,
									},
								}
							)) as Pick<DBPart, '_id' | '_rank' | 'segmentId' | 'rundownId'>[]
						} else {
							return (await triggersContext.Parts.findFetchAsync(
								computation,
								{ _id: { $in: partFilter } },
								{
									fields: {
										_id: 1,
										segmentId: 1,
										rundownId: 1,
										_rank: 1,
									},
								}
							)) as Pick<DBPart, '_id' | '_rank' | 'segmentId' | 'rundownId'>[]
						}
					},
					`partRanks_${JSON.stringify(partFilter ?? rundownRankMap.keys())}`
				)

				partRanks.forEach((part) => {
					partRankMap.set(part._id, part)
				})
			}
		}

		let resultingAdLibs: IWrappedAdLib[] = []

		{
			resultingAdLibs = [
				...rundownBaselineAdLibItems,
				...rundownBaselineAdLibActions,
				...adLibPieces,
				...adLibActions,
				...clearAdLibs,
				...stickyAdLibs,
			]

			// Sort the adliba:
			resultingAdLibs = sortAdlibs(
				resultingAdLibs.map((adlib) => {
					const part = adlib.partId && partRankMap.get(adlib.partId)
					const segmentRank = part?.segmentId && segmentRankMap.get(part.segmentId)
					const rundownRank = part?.rundownId && rundownRankMap.get(part.rundownId)

					return {
						adlib: adlib,
						label: adlib.label,
						adlibRank: adlib._rank,
						adlibId: adlib._id,
						partRank: part?._rank ?? null,
						segmentRank: segmentRank ?? null,
						rundownRank: rundownRank ?? null,
					}
				})
			)

			// finalize the process: apply limit and pick
			if (adLibPieceTypeFilter.limit !== undefined) {
				resultingAdLibs = resultingAdLibs.slice(0, adLibPieceTypeFilter.limit)
			}
			if (adLibPieceTypeFilter.pick !== undefined && adLibPieceTypeFilter.pick >= 0) {
				resultingAdLibs = [resultingAdLibs[adLibPieceTypeFilter.pick]]
			} else if (adLibPieceTypeFilter.pick !== undefined && adLibPieceTypeFilter.pick < 0) {
				resultingAdLibs = [resultingAdLibs[resultingAdLibs.length + adLibPieceTypeFilter.pick]]
			}
		}

		// remove any falsy values from the result set
		return resultingAdLibs.filter(Boolean)
	}
}
