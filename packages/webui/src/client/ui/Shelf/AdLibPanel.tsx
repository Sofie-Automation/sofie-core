import { useState, useCallback, useEffect } from 'react'
import _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { useTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'
import { useTranslation } from 'react-i18next'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { IAdLibListItem } from './AdLibListItem.js'
import ClassNames from 'classnames'

import { Spinner } from '../../lib/Spinner.js'
import { OutputLayers, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import {
	ISourceLayer,
	PieceLifespan,
	IBlueprintActionTriggerMode,
	SomeContent,
} from '@sofie-automation/blueprints-integration'
import { doUserAction, UserAction } from '../../lib/clientUserAction.js'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications.js'
import {
	RundownLayoutFilter,
	RundownLayoutFilterBase,
	DashboardLayoutFilter,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { literal, unprotectString, protectString } from '../../lib/tempLib.js'
import { memoizedIsolatedAutorun } from '../../lib/memoizedIsolatedAutorun.js'
import {
	findPartInstanceOrWrapToTemporary,
	PartInstance,
} from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { MeteorCall } from '../../lib/meteorApi.js'
import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer.js'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { RundownUtils } from '../../lib/rundown.js'
import { ShelfTabs } from './Shelf.js'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { BucketAdLibActionUi, BucketAdLibUi } from './RundownViewBuckets.js'
import RundownViewEventBus, {
	RundownViewEvents,
	RevealInShelfEvent,
} from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { i18nTranslator } from '../i18n.js'
import { AdLibPieceUi, AdlibSegmentUi } from '../../lib/shelf.js'
import { getShelfFollowsOnAir } from '../../lib/localStorage.js'
import { sortAdlibs } from '@sofie-automation/meteor-lib/dist/adlibs'
import { AdLibPanelToolbar } from './AdLibPanelToolbar.js'
import { AdLibListView } from './AdLibListView.js'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { UIPartInstances, UIStudios } from '../Collections.js'
import { PartId, PartInstanceId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	AdLibActions,
	AdLibPieces,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
} from '../../collections/index.js'
import { RundownPlaylistCollectionUtil } from '../../collections/rundownPlaylistUtil.js'
import { RundownPlaylistClientUtil } from '../../lib/rundownPlaylistUtil.js'

export interface IAdLibPanelProps {
	// liveSegment: Segment | undefined
	visible: boolean
	playlist: DBRundownPlaylist
	studio: UIStudio
	showStyleBase: UIShowStyleBase
	studioMode: boolean
	filter?: RundownLayoutFilterBase
	includeGlobalAdLibs?: boolean
	selectedPiece: BucketAdLibUi | BucketAdLibActionUi | IAdLibListItem | PieceUi | undefined

	onSelectPiece?: (piece: AdLibPieceUi | PieceUi) => void
}

type MinimalRundown = Pick<
	Rundown,
	'_id' | 'name' | 'playlistId' | 'timing' | 'showStyleBaseId' | 'showStyleVariantId' | 'endOfRundownIsShowBreak'
>

export interface AdLibFetchAndFilterProps {
	uiSegments: Array<AdlibSegmentUi>
	uiSegmentMap: Map<SegmentId, AdlibSegmentUi>
	liveSegment: AdlibSegmentUi | undefined
	sourceLayerLookup: SourceLayers
	rundownBaselineAdLibs: Array<AdLibPieceUi>
}

function actionToAdLibPieceUi(
	action: AdLibAction | RundownBaselineAdLibAction,
	sourceLayers: SourceLayers,
	outputLayers: OutputLayers
): AdLibPieceUi {
	let sourceLayerId = ''
	let outputLayerId = ''
	let content: SomeContent = {}
	if (RundownUtils.isAdlibActionContent(action.display)) {
		sourceLayerId = action.display.sourceLayerId
		outputLayerId = action.display.outputLayerId
		content = {
			...action.display.content,
		}
	}

	return literal<AdLibPieceUi>({
		_id: protectString(`${action._id}`),
		name: translateMessage(action.display.label, i18nTranslator),
		isAction: true,
		expectedDuration: 0,
		externalId: unprotectString(action._id),
		rundownId: action.rundownId,
		partId: action.partId,
		sourceLayer: sourceLayers[sourceLayerId],
		outputLayer: outputLayers[outputLayerId],
		sourceLayerId,
		outputLayerId,
		_rank: action.display._rank || 0,
		content: content,
		adlibAction: action,
		tags: action.display.tags,
		currentPieceTags: action.display.currentPieceTags,
		nextPieceTags: action.display.nextPieceTags,
		uniquenessId: action.display.uniquenessId,
		lifespan: PieceLifespan.WithinPart, // value doesn't matter
		expectedPackages: action.expectedPackages,
	})
}

interface IFetchAndFilterProps {
	playlist: Pick<
		DBRundownPlaylist,
		'_id' | 'currentPartInfo' | 'nextPartInfo' | 'previousPartInfo' | 'rundownIdsInOrder'
	>
	showStyleBase: Pick<UIShowStyleBase, '_id' | 'sourceLayers' | 'outputLayers'>
	filter?: RundownLayoutFilterBase
	includeGlobalAdLibs?: boolean
}

export function useFetchAndFilter(
	playlist: DBRundownPlaylist | undefined,
	showStyleBase: UIShowStyleBase | undefined,
	filter: RundownLayoutFilterBase | undefined,
	includeGlobalAdLibs: boolean | undefined
): AdLibFetchAndFilterProps {
	return useTracker(
		() =>
			playlist && showStyleBase
				? fetchAndFilter({
						playlist: playlist as Pick<
							DBRundownPlaylist,
							'_id' | 'studioId' | 'currentPartInfo' | 'nextPartInfo' | 'previousPartInfo' | 'rundownIdsInOrder'
						>,
						showStyleBase: showStyleBase as Pick<UIShowStyleBase, '_id' | 'sourceLayers' | 'outputLayers'>,
						filter,
						includeGlobalAdLibs,
					})
				: {
						liveSegment: undefined,
						rundownBaselineAdLibs: [],
						sourceLayerLookup: {},
						uiSegments: [] as AdlibSegmentUi[],
						uiSegmentMap: new Map(),
					},
		[
			playlist?._id,
			playlist?.studioId,
			playlist?.currentPartInfo?.partInstanceId,
			playlist?.nextPartInfo?.partInstanceId,
			playlist?.previousPartInfo?.partInstanceId,
			playlist?.rundownIdsInOrder,
			showStyleBase?._id,
			showStyleBase?.sourceLayers,
			showStyleBase?.outputLayers,
			filter,
			includeGlobalAdLibs,
		],
		{
			liveSegment: undefined,
			rundownBaselineAdLibs: [],
			sourceLayerLookup: {},
			uiSegments: [] as AdlibSegmentUi[],
			uiSegmentMap: new Map(),
		}
	)
}

export function fetchAndFilter(props: IFetchAndFilterProps): AdLibFetchAndFilterProps {
	const sourceLayerLookup = props.showStyleBase && props.showStyleBase.sourceLayers
	const outputLayerLookup = props.showStyleBase && props.showStyleBase.outputLayers

	if (!props.playlist || !props.showStyleBase) {
		return {
			uiSegments: [],
			uiSegmentMap: new Map(),
			liveSegment: undefined,
			sourceLayerLookup,
			rundownBaselineAdLibs: [],
		}
	}

	const { segments, rundowns } = memoizedIsolatedAutorun(
		(playlist) => {
			const rundownsAndSegments = RundownPlaylistClientUtil.getRundownsAndSegments(playlist)
			const segments: DBSegment[] = []
			const rundowns: Record<string, MinimalRundown> = {}
			rundownsAndSegments.forEach((pair) => {
				segments.push(...pair.segments)
				rundowns[unprotectString(pair.rundown._id)] = pair.rundown
			})

			return {
				segments,
				rundowns,
			}
		},
		'rundownsAndSegments',
		props.playlist
	)

	const { uiSegments, liveSegment, uiPartSegmentMap, uiPartMap, uiSegmentMap } = memoizedIsolatedAutorun(
		(
			currentPartInstanceId: PartInstanceId | null,
			nextPartInstanceId: PartInstanceId | null,
			segments: DBSegment[],
			rundowns: Record<string, MinimalRundown>
		) => {
			const currentPartInstance =
				currentPartInstanceId &&
				(UIPartInstances.findOne(currentPartInstanceId, {
					projection: {
						_id: 1,
						segmentId: 1,
						rundownId: 1,
					},
				}) as Pick<PartInstance, '_id' | 'segmentId' | 'rundownId'> | undefined)
			const nextPartInstance =
				nextPartInstanceId &&
				(UIPartInstances.findOne(nextPartInstanceId, {
					projection: {
						_id: 1,
						segmentId: 1,
						rundownId: 1,
					},
				}) as Pick<PartInstance, '_id' | 'segmentId' | 'rundownId'> | undefined)

			// This is a map of partIds mapped onto segments they are part of
			const uiPartSegmentMap = new Map<PartId, AdlibSegmentUi>()
			const uiPartMap = new Map<PartId, DBPart>()

			if (!segments) {
				return {
					uiSegments: [],
					uiSegmentMap: new Map(),
					liveSegment: undefined,
					uiPartSegmentMap,
					uiPartMap,
				}
			}

			const partInstances = RundownPlaylistClientUtil.getActivePartInstancesMap(props.playlist)

			let liveSegment: AdlibSegmentUi | undefined
			const uiSegmentMap = new Map<SegmentId, AdlibSegmentUi>()
			const uiSegments: Array<AdlibSegmentUi> = segments.map((segment) => {
				const segmentUi = literal<AdlibSegmentUi>({
					...segment,
					parts: [],
					pieces: [],
					isLive: false,
					isNext: false,
					isCompatibleShowStyle: currentPartInstance?.rundownId
						? rundowns[unprotectString(currentPartInstance.rundownId)].showStyleVariantId ===
							rundowns[unprotectString(segment.rundownId)].showStyleVariantId
						: true,
				})

				uiSegmentMap.set(segmentUi._id, segmentUi)

				return segmentUi
			})

			RundownPlaylistClientUtil.getUnorderedParts(props.playlist, {
				segmentId: {
					$in: Array.from(uiSegmentMap.keys()),
				},
			}).forEach((part) => {
				const segment = uiSegmentMap.get(part.segmentId)
				if (segment) {
					const partInstance = findPartInstanceOrWrapToTemporary(partInstances, part)
					segment.parts.push(partInstance)

					uiPartSegmentMap.set(part._id, segment)
					uiPartMap.set(part._id, part)
				}
			})

			if (currentPartInstance) {
				const segment = uiSegmentMap.get(currentPartInstance.segmentId)
				if (segment) {
					liveSegment = segment
					segment.isLive = true
				}
			}

			if (nextPartInstance) {
				const segment = uiSegmentMap.get(nextPartInstance.segmentId)
				if (segment) {
					segment.isNext = true
				}
			}

			uiSegmentMap.forEach((segment) => {
				// Sort parts by rank
				segment.parts = segment.parts.sort((a, b) => a.part._rank - b.part._rank)
			})

			return {
				uiSegments,
				uiSegmentMap,
				liveSegment,
				uiPartSegmentMap,
				uiPartMap,
			}
		},
		`uiSegments_${props.filter?._id || 'no_filter'}`,
		props.playlist.currentPartInfo?.partInstanceId ?? null,
		props.playlist.nextPartInfo?.partInstanceId ?? null,
		segments,
		rundowns
	)

	uiSegments.forEach((segment) => (segment.pieces = []))

	if (props.filter === undefined || props.filter.rundownBaseline !== 'only') {
		const unorderedRundownIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(props.playlist)
		const partIds = Array.from(uiPartSegmentMap.keys())

		AdLibPieces.find(
			{
				rundownId: {
					$in: unorderedRundownIds,
				},
				partId: {
					$in: partIds,
				},
				hidden: {
					$ne: true,
				},
			},
			{
				sort: { _rank: 1 },
			}
		)
			.fetch()
			.forEach((piece) => {
				const segment = uiPartSegmentMap.get(piece.partId!)

				if (segment) {
					segment.pieces.push({
						...piece,
						disabled: !segment.isCompatibleShowStyle,
						sourceLayer: sourceLayerLookup[piece.sourceLayerId],
						outputLayer: outputLayerLookup[piece.outputLayerId],
						segmentId: segment._id,
					})
				}
			})

		const adlibActions = memoizedIsolatedAutorun(
			(unorderedRundownIds: RundownId[], partIds: PartId[]) =>
				_.compact(
					AdLibActions.find(
						{
							rundownId: {
								$in: unorderedRundownIds,
							},
							partId: {
								$in: partIds,
							},
						},
						{
							// @ts-expect-error deep-property
							sort: { 'display._rank': 1 },
						}
					).map<
						| {
								partId: PartId
								piece: AdLibPieceUi
						  }
						| undefined
					>((action) => {
						if (action.display.hidden) return undefined
						return {
							partId: action.partId,
							piece: actionToAdLibPieceUi(action, sourceLayerLookup, outputLayerLookup),
						}
					})
				),
			'adLibActions',
			unorderedRundownIds,
			partIds
		)

		adlibActions.forEach((action) => {
			const segment = uiPartSegmentMap.get(action.partId)
			if (segment) {
				action.piece.disabled = !segment.isCompatibleShowStyle
				segment.pieces.push({ ...action.piece, segmentId: segment._id })
			}
		})

		uiPartSegmentMap.forEach((segment) => {
			// Sort the pieces:
			segment.pieces = sortAdlibs(
				segment.pieces.map((piece) => ({
					adlib: piece,
					label: piece.adlibAction?.display?.label ?? piece.name,
					adlibRank: piece._rank,
					adlibId: piece._id,
					partRank: (piece.partId && uiPartMap.get(piece.partId))?._rank ?? null,
					segmentRank: segment._rank,
					rundownRank: 0, // not needed, because we are in just one rundown
				}))
			)
		})
	}

	let currentRundown: Rundown | undefined = undefined
	let rundownBaselineAdLibs: Array<AdLibPieceUi> = []
	if (
		props.filter &&
		props.includeGlobalAdLibs &&
		(props.filter.rundownBaseline === true || props.filter.rundownBaseline === 'only')
	) {
		const t = i18nTranslator

		const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(props.playlist, undefined, {
			fields: {
				_id: 1,
				name: 1,
			},
		})

		currentRundown = rundowns[0]
		const partInstanceId = props.playlist.currentPartInfo?.partInstanceId || props.playlist.nextPartInfo?.partInstanceId
		if (partInstanceId) {
			const partInstance = UIPartInstances.findOne(partInstanceId)
			if (partInstance) {
				currentRundown = rundowns.find((rd) => rd._id === partInstance.rundownId)
			}
		}

		if (currentRundown) {
			// memoizedIsolatedAutorun

			rundownBaselineAdLibs = memoizedIsolatedAutorun(
				(currentRundownId: RundownId, sourceLayerLookup: SourceLayers) => {
					const rundownAdLibItems: Array<Omit<RundownBaselineAdLibItem, 'timelineObjectsString'>> =
						RundownBaselineAdLibPieces.find(
							{
								rundownId: currentRundownId,
								hidden: {
									$ne: true,
								},
							},
							{
								sort: { sourceLayerId: 1, _rank: 1, name: 1 },
							}
						).fetch()
					rundownBaselineAdLibs = rundownAdLibItems.concat(
						Object.values<ISourceLayer | undefined>(sourceLayerLookup)
							.filter((i): i is ISourceLayer => !!(i && i.isSticky))
							.sort((a, b) => a._rank - b._rank)
							.map((layer) =>
								literal<AdLibPieceUi>({
									_id: protectString(`sticky_${layer._id}`),
									name: t('Last {{layerName}}', { layerName: layer.abbreviation || layer.name }),
									isSticky: true,
									isGlobal: true,
									expectedDuration: 0,
									lifespan: PieceLifespan.WithinPart,
									externalId: layer._id,
									rundownId: protectString(''),
									sourceLayer: layer,
									outputLayer: undefined,
									sourceLayerId: layer._id,
									outputLayerId: '',
									_rank: 0,
									content: {},
								})
							)
					)

					const globalAdLibActions = memoizedIsolatedAutorun(
						(currentRundownId: RundownId) =>
							_.compact(
								RundownBaselineAdLibActions.find(
									{
										rundownId: currentRundownId,
										partId: {
											$exists: false,
										},
									},
									{
										// @ts-expect-error deep-property
										sort: { 'display._rank': 1 },
									}
								).map((action) => {
									if (action.display.hidden) return undefined
									return actionToAdLibPieceUi(action, sourceLayerLookup, outputLayerLookup)
								})
							),
						'globalAdLibActions',
						currentRundownId
					)

					rundownBaselineAdLibs = rundownBaselineAdLibs
						.concat(globalAdLibActions)
						.sort((a, b) => a._rank - b._rank)
						.map((item) => {
							// automatically assign hotkeys based on adLibItem index
							const uiAdLib: AdLibPieceUi = _.clone(item)
							uiAdLib.isGlobal = true

							uiAdLib.outputLayer = (item.outputLayerId && outputLayerLookup[item.outputLayerId]) || undefined

							// always add them to the list
							return uiAdLib
						})

					return rundownBaselineAdLibs.sort((a, b) => a._rank - b._rank)
				},
				'rundownBaselineAdLibs',
				currentRundown._id,
				sourceLayerLookup
			)
		}

		if ((props.filter as DashboardLayoutFilter).includeClearInRundownBaseline) {
			const rundownBaselineClearAdLibs = memoizedIsolatedAutorun(
				(sourceLayers: SourceLayers) => {
					return Object.values<ISourceLayer | undefined>(sourceLayers)
						.filter((i): i is ISourceLayer => !!i && !!i.isClearable)
						.sort((a, b) => a._rank - b._rank)
						.map((layer) =>
							literal<AdLibPieceUi>({
								_id: protectString(`clear_${layer._id}`),
								name: t('Clear {{layerName}}', { layerName: layer.abbreviation || layer.name }),
								isSticky: false,
								isClearSourceLayer: true,
								isGlobal: true,
								expectedDuration: 0,
								lifespan: PieceLifespan.WithinPart,
								externalId: layer._id,
								rundownId: protectString(''),
								sourceLayer: layer,
								outputLayer: undefined,
								sourceLayerId: layer._id,
								outputLayerId: '',
								_rank: 0,
								content: {},
							})
						)
				},
				'rundownBaselineClearAdLibs',
				props.showStyleBase.sourceLayers
			)
			rundownBaselineAdLibs = rundownBaselineAdLibs.concat(rundownBaselineClearAdLibs)
		}
	}

	return {
		uiSegments: props.filter && props.filter.rundownBaseline === 'only' ? [] : uiSegments,
		uiSegmentMap: props.filter && props.filter.rundownBaseline === 'only' ? new Map() : uiSegmentMap,
		liveSegment,
		sourceLayerLookup,
		rundownBaselineAdLibs,
	}
}

export function AdLibPanel({
	visible,
	playlist,
	showStyleBase,
	filter,
	selectedPiece,
	includeGlobalAdLibs,
	onSelectPiece,
}: Readonly<IAdLibPanelProps>): JSX.Element | null {
	const { t } = useTranslation()
	const studio = useTracker(() => UIStudios.findOne(playlist.studioId), [playlist.studioId], undefined)

	const [searchFilter, setSearchFilter] = useState<string | undefined>(undefined)
	const [selectedSegment, setSelectedSegment] = useState<AdlibSegmentUi | undefined>(undefined)
	const shelfFollowsOnAir = getShelfFollowsOnAir()

	const { uiSegments, liveSegment, sourceLayerLookup, rundownBaselineAdLibs } = useFetchAndFilter(
		playlist,
		showStyleBase,
		filter,
		includeGlobalAdLibs
	)

	useEffect(() => {
		if (!shelfFollowsOnAir) return

		setSelectedSegment(liveSegment)
	}, [shelfFollowsOnAir, liveSegment])

	useEffect(() => {
		function onRevealInShelf(e: RevealInShelfEvent) {
			const { pieceId } = e
			let found = false
			if (pieceId) {
				const index = rundownBaselineAdLibs.findIndex((piece) => piece._id === pieceId)

				if (index >= 0) {
					found = true
				} else {
					uiSegments.forEach((segment) => {
						const index = segment.pieces.findIndex((piece) => piece._id === pieceId)
						if (index >= 0) {
							found = true
						}
					})
				}

				if (found) {
					RundownViewEventBus.emit(RundownViewEvents.SWITCH_SHELF_TAB, {
						tab: filter ? `${ShelfTabs.ADLIB_LAYOUT_FILTER}_${filter._id}` : ShelfTabs.ADLIB,
					})

					Meteor.setTimeout(() => {
						const el = document.querySelector(`.adlib-panel__list-view__list__segment__item[data-obj-id="${pieceId}"]`)
						if (el) {
							el.scrollIntoView({
								behavior: 'smooth',
							})
						}
					}, 100)
				}
			}
		}
		RundownViewEventBus.on(RundownViewEvents.REVEAL_IN_SHELF, onRevealInShelf)

		return () => {
			RundownViewEventBus.off(RundownViewEvents.REVEAL_IN_SHELF, onRevealInShelf)
		}
	}, [rundownBaselineAdLibs, uiSegments])

	const playlistId = playlist._id
	const currentPartInstanceId = playlist.currentPartInfo?.partInstanceId

	const onToggleAdLib = useCallback(
		(adlibPiece: IAdLibListItem, queue: boolean, e: KeyboardEvent, mode?: IBlueprintActionTriggerMode) => {
			if (adlibPiece.invalid) {
				NotificationCenter.push(
					new Notification(
						t('Invalid AdLib'),
						NoticeLevel.WARNING,
						t('Cannot play this AdLib because it is marked as Invalid'),
						'toggleAdLib'
					)
				)
				return
			}
			if (adlibPiece.floated) {
				NotificationCenter.push(
					new Notification(
						t('Floated AdLib'),
						NoticeLevel.WARNING,
						t('Cannot play this AdLib because it is marked as Floated'),
						'toggleAdLib'
					)
				)
				return
			}
			const lookup = sourceLayerLookup[adlibPiece.sourceLayerId]
			if (queue && sourceLayerLookup && lookup && !lookup.isQueueable) {
				console.log(`Item "${adlibPiece._id}" is on sourceLayer "${adlibPiece.sourceLayerId}" that is not queueable.`)
				return
			}
			if (currentPartInstanceId) {
				if (adlibPiece.isAction && adlibPiece.adlibAction) {
					const action = adlibPiece.adlibAction
					doUserAction(t, e, adlibPiece.isGlobal ? UserAction.START_GLOBAL_ADLIB : UserAction.START_ADLIB, (e, ts) =>
						MeteorCall.userAction.executeAction(
							e,
							ts,
							playlistId,
							action._id,
							action.actionId,
							action.userData,
							mode?.data
						)
					)
				} else if (!adlibPiece.isGlobal && !adlibPiece.isAction) {
					doUserAction(t, e, UserAction.START_ADLIB, (e, ts) =>
						MeteorCall.userAction.segmentAdLibPieceStart(
							e,
							ts,
							playlistId,
							currentPartInstanceId,
							adlibPiece._id,
							queue || false
						)
					)
				} else if (adlibPiece.isGlobal && !adlibPiece.isSticky) {
					doUserAction(t, e, UserAction.START_GLOBAL_ADLIB, (e, ts) =>
						MeteorCall.userAction.baselineAdLibPieceStart(
							e,
							ts,
							playlistId,
							currentPartInstanceId,
							adlibPiece._id,
							queue || false
						)
					)
				} else if (adlibPiece.isSticky) {
					doUserAction(t, e, UserAction.START_STICKY_PIECE, (e, ts) =>
						MeteorCall.userAction.sourceLayerStickyPieceStart(e, ts, playlistId, adlibPiece.sourceLayerId)
					)
				}
			}
		},
		[t, playlistId, currentPartInstanceId, sourceLayerLookup]
	)

	function renderSegmentList() {
		return uiSegments.map((segment) => {
			return !segment.isHidden || segment.pieces.length > 0 ? (
				<li
					className={ClassNames('adlib-panel__segments__segment', {
						live: segment.isLive,
						next: segment.isNext && !segment.isLive,
						past:
							segment.parts.reduce((memo, part) => {
								return part.timings?.plannedStartedPlayback && part.timings?.duration ? memo : false
							}, true) === true,
					})}
					onClick={() => setSelectedSegment(segment)}
					key={unprotectString(segment._id)}
					tabIndex={0}
				>
					{segment.name}
				</li>
			) : null
		})
	}

	if (!visible) {
		return null
	}
	if (!uiSegments || !playlist || !studio) {
		return <Spinner />
	}

	const withSegments = uiSegments.length > 30

	return (
		<div
			className="adlib-panel super-dark"
			data-tab-id={filter ? `${ShelfTabs.ADLIB_LAYOUT_FILTER}_${filter._id}` : ShelfTabs.ADLIB}
		>
			{withSegments && <ul className="adlib-panel__segments">{renderSegmentList()}</ul>}
			<AdLibPanelToolbar onFilterChange={setSearchFilter} noSegments={!withSegments} searchFilter={searchFilter} />
			<AdLibListView
				uiSegments={uiSegments}
				rundownAdLibs={rundownBaselineAdLibs}
				onSelectAdLib={onSelectPiece}
				onToggleAdLib={onToggleAdLib}
				selectedPiece={selectedPiece}
				selectedSegment={selectedSegment}
				showStyleBase={showStyleBase}
				searchFilter={searchFilter}
				filter={filter as RundownLayoutFilter}
				studio={studio}
				noSegments={!withSegments}
			/>
		</div>
	)
}
