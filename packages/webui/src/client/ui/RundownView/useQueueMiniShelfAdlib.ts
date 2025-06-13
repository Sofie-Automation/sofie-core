import { useCallback, useEffect, useMemo, useRef } from 'react'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { NotificationCenter, NoticeLevel, Notification } from '../../lib/notifications/notifications'
import { doUserAction, UserAction } from '../../lib/clientUserAction'
import { MeteorCall } from '../../lib/meteorApi'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { AdLibPieceUi, AdlibSegmentUi } from '../../lib/shelf'
import { ExecuteActionResult } from '@sofie-automation/corelib/dist/worker/studio'
import { PartInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTranslation } from 'react-i18next'
import {
	RundownLayoutFilterBase,
	RundownLayoutShelfBase,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import {
	MiniShelfQueueAdLibEvent,
	RundownViewEvents,
} from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { useRundownViewEventBusListener } from '../../lib/lib'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts'
import { matchFilter } from '../Shelf/AdLibListView'
import { useFetchAndFilter } from '../Shelf/AdLibPanel'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'

export type QueueMiniShelfAdlibFunction = (e: any, forward: boolean) => void

export function useMiniShelfAdlibsData(
	playlist: DBRundownPlaylist | undefined,
	showStyleBase: UIShowStyleBase | undefined,
	selectedMiniShelfLayout: RundownLayoutShelfBase | undefined,
	currentPartInstance: PartInstance | undefined
): {
	uiSegmentMap: Map<SegmentId, AdlibSegmentUi>
	miniShelfFilter: RundownLayoutFilterBase | undefined
} {
	// Only allow 1 filter for now
	const possibleMiniShelfFilter = selectedMiniShelfLayout?.filters?.[0]
	let miniShelfFilter: RundownLayoutFilterBase | undefined
	if (possibleMiniShelfFilter && RundownLayoutsAPI.isFilter(possibleMiniShelfFilter)) {
		miniShelfFilter = possibleMiniShelfFilter
	}

	const filteredSegments = useFetchAndFilter(playlist, showStyleBase, miniShelfFilter, false)
	const queueMiniShelfProps = useMemo(() => {
		const filteredUiSegmentMap: Map<SegmentId, AdlibSegmentUi> = new Map()
		const filteredUiSegments: AdlibSegmentUi[] = []
		const liveSegment = filteredSegments.uiSegments.find((i) => i.isLive === true)

		for (const segment of filteredSegments.uiSegmentMap.values()) {
			const uniquenessIds = new Set<string>()
			const filteredPieces = segment.pieces.filter((piece) =>
				matchFilter(
					piece,
					filteredSegments.sourceLayerLookup,
					liveSegment,
					miniShelfFilter
						? {
								...miniShelfFilter,
								currentSegment:
									!(segment.isHidden && segment.showShelf) && miniShelfFilter.currentSegment,
							}
						: undefined,
					undefined,
					uniquenessIds
				)
			)
			const filteredSegment = {
				...segment,
				pieces: filteredPieces,
			}

			filteredUiSegmentMap.set(segment._id, filteredSegment)
			filteredUiSegments.push(filteredSegment)
		}

		return {
			// currentRundown,
			uiSegmentMap: filteredUiSegmentMap,
			uiSegments: filteredUiSegments,
		}
	}, [filteredSegments, miniShelfFilter])

	// Handle queueMiniShelfAdlib
	const queueMiniShelfAdLib = useQueueMiniShelfAdlib({
		...queueMiniShelfProps,
		sourceLayerLookup: filteredSegments.sourceLayerLookup,

		playlist: playlist,
		currentPartInstance: currentPartInstance,
	})
	const queueMiniShelfAdLibEvent = useCallback(
		(e: MiniShelfQueueAdLibEvent) => queueMiniShelfAdLib(e.context, e.forward),
		[queueMiniShelfAdLib]
	)
	useRundownViewEventBusListener(RundownViewEvents.MINI_SHELF_QUEUE_ADLIB, queueMiniShelfAdLibEvent)

	return {
		uiSegmentMap: queueMiniShelfProps.uiSegmentMap,
		miniShelfFilter: miniShelfFilter,
	}
}

interface QueueMiniShelfAdlibInput {
	uiSegmentMap: Map<SegmentId, AdlibSegmentUi>
	uiSegments: AdlibSegmentUi[]
	sourceLayerLookup: SourceLayers

	playlist: DBRundownPlaylist | undefined
	currentPartInstance: PartInstance | undefined
}

export function useQueueMiniShelfAdlib(input0: QueueMiniShelfAdlibInput): QueueMiniShelfAdlibFunction {
	const { t } = useTranslation()

	// Store the input in a ref to avoid unnecessary re-renders
	const viewState = useRef<QueueMiniShelfAdlibInput>(input0)
	useEffect(() => {
		const newState = { ...input0 }
		const oldState = viewState.current

		// Ensure the internal state is still value when the component updates
		if (newState.currentPartInstance?.segmentId !== oldState.currentPartInstance?.segmentId) {
			internalState.current.keyboardQueuedPiece = undefined
		} else if (newState.playlist && oldState.playlist && internalState.current.keyboardQueuedPartInstanceId) {
			if (
				hasCurrentPartChanged(oldState.playlist, newState.playlist) &&
				isCurrentPartKeyboardQueuedPart(newState.playlist, internalState.current.keyboardQueuedPartInstanceId)
			) {
				internalState.current.keyboardQueuedPartInstanceId = undefined
			} else if (
				!internalState.current.isKeyboardQueuePending &&
				!hasCurrentPartChanged(oldState.playlist, newState.playlist) &&
				hasNextPartChanged(oldState.playlist, newState.playlist) &&
				isNextPartDifferentFromKeyboardQueuedPart(
					newState.playlist,
					internalState.current.keyboardQueuedPartInstanceId
				)
			) {
				internalState.current.shouldKeyboardRequeue = true
				internalState.current.keyboardQueuedPartInstanceId = undefined
			}
		}

		viewState.current = newState
	}, [...Object.values<any>(input0)])

	const internalState = useRef<{
		keyboardQueuedPiece: AdLibPieceUi | undefined
		keyboardQueuedPartInstanceId: PartInstanceId | undefined
		shouldKeyboardRequeue: boolean
		isKeyboardQueuePending: boolean
	}>({
		keyboardQueuedPiece: undefined,
		keyboardQueuedPartInstanceId: undefined,
		shouldKeyboardRequeue: false,
		isKeyboardQueuePending: false,
	})

	return useMemo(() => {
		const onPieceQueued = (err: any, res: ExecuteActionResult | void) => {
			if (!err && res) {
				if (res.taken) {
					internalState.current.keyboardQueuedPartInstanceId = undefined
				} else {
					internalState.current.keyboardQueuedPartInstanceId = res.queuedPartInstanceId
				}
			}
			internalState.current.isKeyboardQueuePending = false
		}

		const queueAdLibPiece = (adlibPiece: AdLibPieceUi, e: any) => {
			// TODO: Refactor this code to reduce code duplication

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
						t('Floated Adlib'),
						NoticeLevel.WARNING,
						t('Cannot play this AdLib because it is marked as Floated'),
						'toggleAdLib'
					)
				)
				return
			}

			const sourceLayer = viewState.current.sourceLayerLookup[adlibPiece.sourceLayerId]

			if (!adlibPiece.isAction && sourceLayer && !sourceLayer.isQueueable) {
				NotificationCenter.push(
					new Notification(
						t('Not queueable'),
						NoticeLevel.WARNING,
						t('Cannot play this adlib because source layer is not queueable'),
						'toggleAdLib'
					)
				)
				return
			}

			const { playlist } = viewState.current
			if (!playlist || !playlist.currentPartInfo) return

			const currentPartInstanceId = playlist.currentPartInfo.partInstanceId
			if (!(sourceLayer && sourceLayer.isClearable)) {
				if (adlibPiece.isAction && adlibPiece.adlibAction) {
					const action = adlibPiece.adlibAction
					doUserAction(
						t,
						e,
						adlibPiece.isGlobal ? UserAction.START_GLOBAL_ADLIB : UserAction.START_ADLIB,
						async (e, ts) =>
							MeteorCall.userAction.executeAction(
								e,
								ts,
								playlist._id,
								action._id,
								action.actionId,
								action.userData
							),
						onPieceQueued
					)
				} else if (!adlibPiece.isGlobal && !adlibPiece.isAction) {
					doUserAction(
						t,
						e,
						UserAction.START_ADLIB,
						async (e, ts) =>
							MeteorCall.userAction.segmentAdLibPieceStart(
								e,
								ts,
								playlist._id,
								currentPartInstanceId,
								adlibPiece._id,
								true
							),
						onPieceQueued
					)
				} else if (adlibPiece.isGlobal && !adlibPiece.isSticky) {
					doUserAction(
						t,
						e,
						UserAction.START_GLOBAL_ADLIB,
						async (e, ts) =>
							MeteorCall.userAction.baselineAdLibPieceStart(
								e,
								ts,
								playlist._id,
								currentPartInstanceId,
								adlibPiece._id,
								true
							),
						onPieceQueued
					)
				} else {
					return
				}
				internalState.current.isKeyboardQueuePending = true
			}
		}

		function findPieceToQueueInCurrentSegment(
			uiSegmentMap: Map<SegmentId, AdlibSegmentUi>,
			pieceToQueue: AdLibPieceUi | undefined,
			forward: boolean
		) {
			const uiSegment = internalState.current.keyboardQueuedPiece!.segmentId
				? uiSegmentMap.get(internalState.current.keyboardQueuedPiece!.segmentId)
				: undefined
			if (uiSegment) {
				const pieces = uiSegment.pieces.filter(isAdLibQueueable)
				if (internalState.current.shouldKeyboardRequeue) {
					pieceToQueue = pieces.find((piece) => piece._id === internalState.current.keyboardQueuedPiece!._id)
				} else {
					const nextPieceInd =
						pieces.findIndex((piece) => piece._id === internalState.current.keyboardQueuedPiece!._id) +
						(forward ? 1 : -1)
					if (nextPieceInd >= 0 && nextPieceInd < pieces.length) {
						pieceToQueue = pieces[nextPieceInd]
					}
				}
			}
			return pieceToQueue
		}

		return (e: any, forward: boolean) => {
			const { uiSegments, uiSegmentMap, currentPartInstance } = viewState.current

			let pieceToQueue: AdLibPieceUi | undefined
			let currentSegmentId: SegmentId | undefined
			if (internalState.current.keyboardQueuedPiece) {
				currentSegmentId = internalState.current.keyboardQueuedPiece.segmentId
				pieceToQueue = findPieceToQueueInCurrentSegment(uiSegmentMap, pieceToQueue, forward)
			}
			if (!currentSegmentId) {
				currentSegmentId = currentPartInstance?.segmentId
			}
			if (!pieceToQueue && currentSegmentId) {
				pieceToQueue = findPieceToQueueInOtherSegments(uiSegments, currentSegmentId, forward, pieceToQueue)
			}
			if (pieceToQueue) {
				queueAdLibPiece(pieceToQueue, e)
				internalState.current.keyboardQueuedPiece = pieceToQueue
				internalState.current.shouldKeyboardRequeue = false
			}
		}
	}, [t])
}

function findPieceToQueueInOtherSegments(
	uiSegments: AdlibSegmentUi[],
	currentSegmentId: SegmentId | undefined,
	forward: boolean,
	pieceToQueue: AdLibPieceUi | undefined
) {
	const currentSegmentInd = uiSegments.findIndex((segment) => segment._id === currentSegmentId)
	if (currentSegmentInd >= 0) {
		const nextShelfOnlySegment = forward
			? findShelfOnlySegment(uiSegments, currentSegmentInd + 1, uiSegments.length) ||
				findShelfOnlySegment(uiSegments, 0, currentSegmentInd)
			: findShelfOnlySegment(uiSegments, currentSegmentInd - 1, -1) ||
				findShelfOnlySegment(uiSegments, uiSegments.length - 1, currentSegmentInd)
		if (nextShelfOnlySegment && nextShelfOnlySegment.queueablePieces.length) {
			pieceToQueue =
				nextShelfOnlySegment.queueablePieces[forward ? 0 : nextShelfOnlySegment.queueablePieces.length - 1]
		}
	}
	return pieceToQueue
}

function findShelfOnlySegment(uiSegments: AdlibSegmentUi[], begin: number, end: number) {
	for (let i = begin; begin > end ? i > end : i < end; begin > end ? i-- : i++) {
		const queueablePieces = uiSegments[i].pieces.filter(isAdLibQueueable)
		if (uiSegments[i].isHidden && uiSegments[i].showShelf && queueablePieces.length) {
			return { segment: uiSegments[i], queueablePieces }
		}
	}
	return undefined
}

const isAdLibQueueable = (piece: AdLibPieceUi) => {
	return !piece.invalid && !piece.floated && (piece.isAction || piece.sourceLayer?.isQueueable)
}

const hasCurrentPartChanged = (prevPlaylist: DBRundownPlaylist, newPlaylist: DBRundownPlaylist) => {
	return prevPlaylist.currentPartInfo?.partInstanceId !== newPlaylist.currentPartInfo?.partInstanceId
}

const isCurrentPartKeyboardQueuedPart = (
	newPlaylist: DBRundownPlaylist,
	keyboardQueuedPartInstanceId: PartInstanceId | undefined
) => {
	return newPlaylist.currentPartInfo?.partInstanceId === keyboardQueuedPartInstanceId
}

const hasNextPartChanged = (prevPlaylist: DBRundownPlaylist, newPlaylist: DBRundownPlaylist) => {
	return prevPlaylist.nextPartInfo?.partInstanceId !== newPlaylist.nextPartInfo?.partInstanceId
}

const isNextPartDifferentFromKeyboardQueuedPart = (
	newPlaylist: DBRundownPlaylist,
	keyboardQueuedPartInstanceId: PartInstanceId | undefined
) => {
	return newPlaylist.nextPartInfo?.partInstanceId !== keyboardQueuedPartInstanceId
}
