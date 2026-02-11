import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
	CameraContent,
	RemoteContent,
	RemoteSpeakContent,
	SourceLayerType,
	SplitsContent,
} from '@sofie-automation/blueprints-integration'
import { RundownId, ShowStyleBaseId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PieceExtended } from '../../../lib/RundownResolver.js'
import { Rundowns } from '../../../collections/index.js'
import { useSubscription, useSubscriptionIfEnabled, useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData.js'
import { UIPartInstances, UIStudios } from '../../Collections.js'
import { Rundown as RundownComponent } from './Rundown.js'
import { useLocation } from 'react-router-dom'
import { parse as queryStringParse } from 'query-string'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { OrderedPartsProvider } from './OrderedPartsProvider.js'
import { offElementResize, onElementResize } from '../../../lib/resizeObserver.js'
import { useTranslation } from 'react-i18next'
import { Spinner } from '../../../lib/Spinner.js'
import { useBlackBrowserTheme } from '../../../lib/useBlackBrowserTheme.js'
import { useWakeLock } from './useWakeLock.js'
import { catchError, useDebounce } from '../../../lib/lib.js'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { useSetDocumentClass, useSetDocumentDarkTheme } from '../../util/useSetDocumentClass.js'

interface IProps {
	playlist: DBRundownPlaylist | undefined
	studioId: StudioId
}

interface IActivePartInstancesContext {
	currentPartInstance: PartInstance | undefined
	nextPartInstance: PartInstance | undefined
}

type FilterFuction = (piece: PieceExtended) => boolean

export const StudioContext = React.createContext<UIStudio | undefined>(undefined)
export const RundownToShowStyleContext = React.createContext<Map<RundownId, ShowStyleBaseId>>(new Map())
export const PieceFilter = React.createContext<FilterFuction>(() => true)
export const ActivePartInstancesContext = React.createContext<IActivePartInstancesContext>({
	currentPartInstance: undefined,
	nextPartInstance: undefined,
})
export const AreaZoom = React.createContext<number>(1)
export const CanvasSizeContext = React.createContext<number>(1)

const PARAM_NAME_SOURCE_LAYER_IDS = 'sourceLayerIds'
const PARAM_NAME_STUDIO_LABEL = 'studioLabels'
const PARAM_NAME_FULLSCREEN = 'fullscreen'

export function CameraScreen({ playlist, studioId }: Readonly<IProps>): JSX.Element | null {
	const playlistIds = playlist ? [playlist._id] : []

	const [studioLabels, setStudioLabels] = useState<string[] | null>(null)
	const [sourceLayerIds, setSourceLayerIds] = useState<string[] | null>(null)
	const [fullScreenMode, setFullScreenMode] = useState<boolean>(false)

	useBlackBrowserTheme()

	const location = useLocation()
	useEffect(() => {
		const queryParams = queryStringParse(location.search, {
			arrayFormat: 'comma',
		})

		const studioLabelParam = queryParams[PARAM_NAME_STUDIO_LABEL] ?? null
		const sourceLayerTypeParam = queryParams[PARAM_NAME_SOURCE_LAYER_IDS] ?? null
		const fullscreenParam = queryParams[PARAM_NAME_FULLSCREEN] ?? false

		setStudioLabels(
			Array.isArray(studioLabelParam) ? studioLabelParam : studioLabelParam === null ? null : [studioLabelParam]
		)
		setSourceLayerIds(
			Array.isArray(sourceLayerTypeParam)
				? sourceLayerTypeParam
				: sourceLayerTypeParam === null
					? null
					: [sourceLayerTypeParam]
		)
		setFullScreenMode(Array.isArray(fullscreenParam) ? fullscreenParam[0] === '1' : fullscreenParam === '1')
	}, [location.search])

	const rundowns = useTracker(
		() =>
			Rundowns.find({
				playlistId: {
					$in: playlistIds,
				},
			}).fetch(),
		[playlistIds.join(',')],
		[] as Rundown[]
	)

	const rundownIds = useMemo(() => rundowns.map((rundown) => rundown._id), [rundowns])
	const showStyleBaseIds = useMemo(() => rundowns.map((rundown) => rundown.showStyleBaseId), [rundowns])

	const rundownsReady = useSubscriptionIfEnabled(CorelibPubSub.rundownsInPlaylists, playlistIds.length > 0, playlistIds)
	useSubscriptionIfEnabled(CorelibPubSub.segments, rundownIds.length > 0, rundownIds, {})

	const studioReady = useSubscription(MeteorPubSub.uiStudio, studioId)
	useSubscriptionIfEnabled(MeteorPubSub.uiPartInstances, !!playlist?.activationId, playlist?.activationId ?? null)

	useSubscriptionIfEnabled(CorelibPubSub.parts, rundownIds.length > 0, rundownIds, null)

	useSubscriptionIfEnabled(CorelibPubSub.pieceInstancesSimple, rundownIds.length > 0, rundownIds, null)

	const piecesReady = useSubscriptionIfEnabled(CorelibPubSub.pieces, rundownIds.length > 0, rundownIds, null)

	const [piecesReadyOnce, setPiecesReadyOnce] = useState(false)
	useEffect(() => {
		if (piecesReady) setPiecesReadyOnce(true)
	}, [piecesReady])

	const currentPartInstanceVolatile = useTracker(
		() =>
			playlist?.currentPartInfo?.partInstanceId
				? UIPartInstances.findOne(playlist?.currentPartInfo?.partInstanceId)
				: undefined,
		[playlist?.currentPartInfo?.partInstanceId],
		undefined
	)
	const nextPartInstanceVolatile = useTracker(
		() =>
			playlist?.nextPartInfo?.partInstanceId
				? UIPartInstances.findOne(playlist?.nextPartInfo?.partInstanceId)
				: undefined,
		[playlist?.nextPartInfo?.partInstanceId],
		undefined
	)

	const currentPartInstance = useDebounce(currentPartInstanceVolatile, 100)
	const nextPartInstance = useDebounce(nextPartInstanceVolatile, 100)

	const partInstanceContext = useMemo(
		() => ({
			currentPartInstance,
			nextPartInstance,
		}),
		[currentPartInstance, nextPartInstance]
	)

	useSetDocumentClass('dark', 'xdark', 'vertical-overflow-only')
	useSetDocumentDarkTheme()

	useEffect(() => {
		const containerEl = document.querySelector('#render-target > .container-fluid.header-clear')
		if (containerEl) containerEl.classList.remove('header-clear')

		return () => {
			if (containerEl) containerEl.classList.add('header-clear')
		}
	}, [])

	const studio = useTracker(() => UIStudios.findOne(studioId), [studioId], undefined)

	const rundownToShowStyle = useMemo(() => {
		const result = new Map<RundownId, ShowStyleBaseId>()
		rundowns.forEach((rundown) => {
			result.set(rundown._id, rundown.showStyleBaseId)
		})
		return result
	}, [rundowns.map((rundown) => rundown._id).join(','), showStyleBaseIds.join(',')])

	const pieceFilterFunction = useMemo(() => {
		return (piece: PieceExtended) => {
			// eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
			const camLikeContent = piece.instance.piece.content as CameraContent | RemoteContent | RemoteSpeakContent
			if (
				sourceLayerIds !== null &&
				(piece.sourceLayer?._id === undefined || !sourceLayerIds.includes(piece.sourceLayer?._id))
			)
				return false
			if (studioLabels !== null) {
				if (piece.sourceLayer?.type === SourceLayerType.SPLITS) {
					const splitContent = piece.instance.piece.content as SplitsContent
					if (!splitContent.boxSourceConfiguration.find((item) => studioLabels.includes(item.studioLabel))) return false
				} else {
					if (!studioLabels.includes(camLikeContent.studioLabel)) return false
				}
			}
			if (sourceLayerIds === null && (piece.sourceLayer?.isHidden || !piece.outputLayer?.isPGM)) return false
			return true
		}
	}, [studioLabels, sourceLayerIds])

	const [canvasWidth, setCanvasWidth] = useState(1)

	const canvasElRef = useRef<HTMLDivElement>(null)

	const { t } = useTranslation()

	useLayoutEffect(() => {
		const canvasEl = canvasElRef.current
		const dimentions = canvasEl?.getBoundingClientRect()

		setCanvasWidth(dimentions?.width ?? 1)

		if (!canvasEl) return

		function onReisze(entries: ResizeObserverEntry[]): void {
			setCanvasWidth(entries[0].borderBoxSize[0].inlineSize)
		}

		const observer = onElementResize(canvasEl, onReisze)

		return () => {
			offElementResize(observer, canvasEl)
			observer.disconnect()
		}
	}, [canvasElRef.current])

	useLayoutEffect(() => {
		if (!document.fullscreenEnabled || !fullScreenMode) return

		const targetEl = document.documentElement

		function onCanvasClick() {
			if (document.fullscreenElement !== null) return
			targetEl
				?.requestFullscreen({
					navigationUI: 'hide',
				})
				.catch(catchError('targetEl.requestFullscreen'))
		}

		document.documentElement.addEventListener('click', onCanvasClick)

		return () => {
			document.documentElement.removeEventListener('click', onCanvasClick)
		}
	}, [fullScreenMode])

	useWakeLock()

	if (!studio && studioReady) return <h1 className="m-4 text-center">{t("This studio doesn't exist.")}</h1>

	if (!playlist && rundownsReady)
		return <h1 className="m-4 text-center">{t('There is no rundown active in this studio.')}</h1>

	if ((playlist && !piecesReadyOnce) || !playlist)
		return (
			<div className="m-4">
				<Spinner />
			</div>
		)

	const rundownIdsBefore: RundownId[] = []

	return (
		<StudioContext.Provider value={studio}>
			<RundownToShowStyleContext.Provider value={rundownToShowStyle}>
				<PieceFilter.Provider value={pieceFilterFunction}>
					<OrderedPartsProvider>
						<ActivePartInstancesContext.Provider value={partInstanceContext}>
							<AreaZoom.Provider value={0.01}>
								<CanvasSizeContext.Provider value={canvasWidth}>
									<div className="camera-screen" ref={canvasElRef}>
										{rundowns.map((rundown) => {
											rundownIdsBefore.push(rundown._id)
											return (
												<RundownComponent
													key={unprotectString(rundown._id)}
													playlist={playlist}
													rundown={rundown}
													rundownIdsBefore={rundownIdsBefore.slice(0, -1)}
												/>
											)
										})}
									</div>
								</CanvasSizeContext.Provider>
							</AreaZoom.Provider>
						</ActivePartInstancesContext.Provider>
					</OrderedPartsProvider>
				</PieceFilter.Provider>
			</RundownToShowStyleContext.Provider>
		</StudioContext.Provider>
	)
}
