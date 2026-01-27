import { Meteor } from 'meteor/meteor'
import React, { useContext, useMemo } from 'react'
import { ParsedQuery, parse as queryStringParse } from 'query-string'
import { Translated, translateWithTracker, useTracker } from '../lib/ReactMeteorData/react-meteor-data.js'
import { VTContent, NoteSeverity, ISourceLayer } from '@sofie-automation/blueprints-integration'
import { Spinner } from '../lib/Spinner.js'
import classNames from 'classnames'
import * as _ from 'underscore'
import { Prompt } from 'react-router-dom'
import { DBRundownPlaylist, QuickLoopMarker } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBRundown, Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { StudioRouteSet } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { SegmentTimelineContainer, PieceUi, PartUi, SegmentUi } from './SegmentTimeline/SegmentTimelineContainer.js'
import { SegmentContextMenu } from './SegmentTimeline/SegmentContextMenu.js'
import { Shelf, ShelfTabs } from './Shelf/Shelf.js'
import { unprotectString, protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { getCurrentTime } from '../lib/systemTime.js'
import { RundownUtils } from '../lib/rundown.js'
import { ErrorBoundary } from '../lib/ErrorBoundary.js'
import { ModalDialog, doModalDialog } from '../lib/ModalDialog.js'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import {
	scrollToPosition,
	scrollToSegment,
	maintainFocusOnPartInstance,
	scrollToPartInstance,
	getHeaderHeight,
} from '../lib/viewPort.js'
import { AfterBroadcastForm } from './AfterBroadcastForm.js'
import { RundownRightHandControls } from './RundownView/RundownRightHandControls.js'
import { PeripheralDevicesAPI } from '../lib/clientAPI.js'
import {
	RONotificationEvent,
	onRONotificationClick as rundownNotificationHandler,
	RundownNotifier,
} from './RundownView/RundownNotifier.js'
import { NotificationCenterPanel } from '../lib/notifications/NotificationCenterPanel.js'
import { NotificationCenter, NoticeLevel, Notification } from '../lib/notifications/notifications.js'
import { SupportPopUp } from './SupportPopUp.js'
import { KeyboardFocusIndicator } from '../lib/KeyboardFocusIndicator.js'
import { PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { doUserAction, UserAction } from '../lib/clientUserAction.js'
import { hashSingleUseToken } from '../lib/lib.js'
import { ClipTrimDialog } from './ClipTrimPanel/ClipTrimDialog.js'
import {
	RundownLayoutType,
	RundownLayoutBase,
	RundownViewLayout,
	RundownLayoutShelfBase,
	RundownLayoutRundownHeader,
	RundownLayoutFilterBase,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { VirtualElement } from '../lib/VirtualElement.js'
import { SEGMENT_TIMELINE_ELEMENT_ID } from './SegmentTimeline/SegmentTimeline.js'
import { OffsetPosition } from '../utils/positions.js'
import { MeteorCall } from '../lib/meteorApi.js'
import { Settings } from '../lib/Settings.js'
import { PointerLockCursor } from '../lib/PointerLockCursor.js'
import { documentTitle } from '../lib/DocumentTitleProvider.js'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { RundownDividerHeader } from './RundownView/RundownDividerHeader.js'
import { PlaylistLoopingHeader } from './RundownView/PlaylistLoopingHeader.js'
import RundownViewEventBus, { RundownViewEvents } from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { RundownLayoutsAPI } from '../lib/rundownLayouts.js'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { BreakSegment } from './SegmentTimeline/BreakSegment.js'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant.js'
import { SegmentStoryboardContainer } from './SegmentStoryboard/SegmentStoryboardContainer.js'
import { SegmentViewMode } from './SegmentContainer/SegmentViewModes.js'
import { UIStateStorage } from '../lib/UIStateStorage.js'
import { AdLibPieceUi, AdlibSegmentUi } from '../lib/shelf.js'
import { SegmentListContainer } from './SegmentList/SegmentListContainer.js'
import { getNextMode as getNextSegmentViewMode } from './SegmentContainer/SwitchViewModeButton.js'
import { IResolvedSegmentProps } from './SegmentContainer/withResolvedSegment.js'
import { UIParts, UIShowStyleBases, UIStudios } from './Collections.js'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import {
	RundownId,
	RundownLayoutId,
	RundownPlaylistId,
	SegmentId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	PeripheralDevices,
	RundownLayouts,
	RundownPlaylists,
	Rundowns,
	ShowStyleVariants,
} from '../collections/index.js'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { RundownPlaylistCollectionUtil } from '../collections/rundownPlaylistUtil.js'
import { SegmentAdlibTestingContainer } from './SegmentAdlibTesting/SegmentAdlibTestingContainer.js'
import { PromiseButton } from '../lib/Components/PromiseButton.js'
import { logger } from '../lib/logging.js'
import { isEntirePlaylistLooping, PieceExtended } from '../lib/RundownResolver.js'
import { RundownPlaylistClientUtil } from '../lib/rundownPlaylistUtil.js'
import { UserPermissionsContext, UserPermissions } from './UserPermissions.js'
import { MAGIC_TIME_SCALE_FACTOR } from './SegmentTimeline/Constants.js'
import { SelectedElementsContext } from './RundownView/SelectedElementsContext.js'
import { PropertiesPanel } from './UserEditOperations/PropertiesPanel.js'
import { RundownHeader } from './RundownView/RundownHeader/RundownHeader.js'
import { RundownDataMissing } from './RundownView/DataMissing.js'
import { CasparCGRestartButtons } from './RundownView/CasparCGRestartButtons.js'
import { RundownSorensenContext } from './RundownView/RundownSorensenContext.js'
import { RundownDetachedShelf } from './RundownView/RundownDetachedShelf.js'
import { useRundownViewSubscriptions } from './RundownView/RundownViewSubscriptions.js'
import { useMiniShelfAdlibsData } from './RundownView/useQueueMiniShelfAdlib.js'
import { RundownViewContextProviders } from './RundownView/RundownViewContextProviders.js'
import { AnimatePresence } from 'motion/react'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { DragContextProvider } from './RundownView/DragContextProvider.js'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance.js'

const HIDE_NOTIFICATIONS_AFTER_MOUNT: number | undefined = 5000

const DEFAULT_SEGMENT_VIEW_MODE = SegmentViewMode.Timeline

interface IProps {
	playlistId: RundownPlaylistId
	inActiveRundownView?: boolean
	onlyShelf?: boolean
}

export interface IContextMenuContext {
	segment?: SegmentUi
	part?: PartUi | null
	piece?: PieceExtended | null

	partDocumentOffset?: OffsetPosition
	timeScale?: number
	mousePosition?: OffsetPosition
	partStartsAt?: number
}

interface IState {
	timeScale: number
	contextMenuContext: IContextMenuContext | null
	bottomMargin: string
	followLiveSegments: boolean
	manualSetAsNext: boolean
	isNotificationsCenterOpen: NoticeLevel | undefined
	isSupportPanelOpen: boolean
	isInspectorShelfExpanded: boolean
	isClipTrimmerOpen: boolean
	selectedPiece: AdLibPieceUi | PieceUi | undefined
	currentRundown: Rundown | undefined
	/** Tracks whether the user has resized the shelf to prevent using default shelf settings */
	wasShelfResizedByUser: boolean
	rundownDefaultSegmentViewMode: SegmentViewMode | undefined
	segmentViewModes: Record<string, SegmentViewMode>
}

export type MinimalRundown = Pick<Rundown, '_id' | 'name' | 'timing' | 'showStyleBaseId' | 'endOfRundownIsShowBreak'>

type MatchedSegment = {
	rundown: MinimalRundown
	segments: DBSegment[]
	segmentIdsBeforeEachSegment: Set<SegmentId>[]
}

const EmptyRundownsToShowStylesMap: ReadonlyMap<RundownId, ShowStyleBaseId> = new Map()

interface ITrackedProps {
	rundownPlaylistId: RundownPlaylistId
	rundowns: Rundown[]
	playlist?: DBRundownPlaylist
	currentRundown?: Rundown
	matchedSegments: MatchedSegment[]
	rundownsToShowstyles: ReadonlyMap<RundownId, ShowStyleBaseId>
	studio?: UIStudio
	showStyleBase?: UIShowStyleBase
	showStyleVariant?: DBShowStyleVariant
	currentPartInstance: PartInstance | undefined
	nextPartInstance: PartInstance | undefined

	selectedShelfLayout: RundownLayoutShelfBase | undefined
	selectedViewLayout: RundownViewLayout | undefined
	selectedHeaderLayout: RundownLayoutRundownHeader | undefined
	selectedMiniShelfLayout: RundownLayoutShelfBase | undefined

	/** MiniShelf data */
	uiSegmentMap: Map<SegmentId, AdlibSegmentUi>
	// uiSegments: AdlibSegmentUi[]
	// sourceLayerLookup: SourceLayers
	miniShelfFilter: RundownLayoutFilterBase | undefined
}

export function RundownView(props: Readonly<IProps>): JSX.Element {
	const userPermissions = useContext(UserPermissionsContext)

	const subsReady = useRundownViewSubscriptions(props.playlistId)

	const playlist = useTracker(() => RundownPlaylists.findOne(props.playlistId), [props.playlistId])
	const studio = useTracker(() => playlist && UIStudios.findOne({ _id: playlist.studioId }), [playlist?.studioId])
	const rundowns = useTracker(
		() => (playlist && RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)) || [],
		[playlist?._id, playlist?.rundownIdsInOrder],
		[]
	)

	const partInstances = useTracker(
		() => playlist && RundownPlaylistClientUtil.getSelectedPartInstances(playlist),
		[playlist?._id, playlist?.nextPartInfo, playlist?.currentPartInfo, playlist?.previousPartInfo]
	)

	const somePartInstance = partInstances?.currentPartInstance || partInstances?.nextPartInstance
	const currentRundown = somePartInstance && rundowns.find((rundown) => rundown._id === somePartInstance?.rundownId)

	const params = queryStringParse(location.search)

	const showStyleBaseId = currentRundown?.showStyleBaseId ?? rundowns[0]?.showStyleBaseId
	const showStyleBase = useTracker(
		() => showStyleBaseId && UIShowStyleBases.findOne(showStyleBaseId),
		[showStyleBaseId]
	)
	const showStyleVariantId = currentRundown?.showStyleVariantId ?? rundowns[0]?.showStyleVariantId
	const showStyleVariant = useTracker(
		() => showStyleVariantId && ShowStyleVariants.findOne(showStyleVariantId),
		[showStyleVariantId]
	)

	const rundownsToShowStyles = useTracker<ReadonlyMap<RundownId, ShowStyleBaseId>>(
		() => {
			// Perform the search again, so that we can reduce the dependencies of this computation
			if (!playlist?._id) return new Map()

			const allRundowns = Rundowns.find(
				{
					playlistId: playlist._id,
				},
				{
					projection: {
						_id: 1,
						showStyleBaseId: 1,
					},
				}
			).fetch() as Pick<DBRundown, '_id' | 'showStyleBaseId'>[]

			const rundownsToShowStyles: Map<RundownId, ShowStyleBaseId> = new Map()
			for (const rundown of allRundowns) {
				rundownsToShowStyles.set(rundown._id, rundown.showStyleBaseId)
			}

			return rundownsToShowStyles
		},
		[playlist?._id],
		EmptyRundownsToShowStylesMap
	)

	const rundownLayouts = useTracker(
		() => showStyleBaseId && RundownLayouts.find({ showStyleBaseId }).fetch(),
		[showStyleBaseId]
	)

	const selectedRundownLayouts = findRundownLayouts(rundownLayouts, params)

	const matchedSegments = useTracker(
		() => {
			if (!playlist) return []

			return RundownPlaylistClientUtil.getRundownsAndSegments(playlist, {}).map(
				(input, rundownIndex, rundownArray) => ({
					...input,
					segmentIdsBeforeEachSegment: input.segments.map(
						(_segment, segmentIndex, segmentArray) =>
							new Set<SegmentId>([
								..._.flatten(
									rundownArray.slice(0, rundownIndex).map((match) => match.segments.map((segment) => segment._id))
								),
								...segmentArray.slice(0, segmentIndex).map((segment) => segment._id),
							])
					),
				})
			)
		},
		[playlist?._id, playlist?.rundownIdsInOrder],
		[]
	)

	const miniShelfData = useMiniShelfAdlibsData(
		playlist,
		showStyleBase,
		selectedRundownLayouts.selectedMiniShelfLayout,
		partInstances?.currentPartInstance
	)

	const hideRundownHeader = params['hideRundownHeader'] === '1'

	return (
		<div
			className={classNames('container-fluid', 'header-clear', {
				'header-clear--no-rundown-header': hideRundownHeader,
			})}
		>
			<RundownViewContent
				{...props}
				subsReady={subsReady}
				userPermissions={userPermissions}
				rundownPlaylistId={props.playlistId}
				rundowns={rundowns}
				currentRundown={currentRundown}
				matchedSegments={matchedSegments}
				rundownsToShowstyles={rundownsToShowStyles}
				playlist={playlist}
				studio={studio}
				showStyleBase={showStyleBase}
				showStyleVariant={showStyleVariant}
				currentPartInstance={partInstances?.currentPartInstance}
				nextPartInstance={partInstances?.nextPartInstance}
				{...selectedRundownLayouts}
				uiSegmentMap={miniShelfData.uiSegmentMap}
				miniShelfFilter={miniShelfData.miniShelfFilter}
				hideRundownHeader={hideRundownHeader}
			/>
		</div>
	)
}

interface IPropsWithReady extends IProps {
	subsReady: boolean
	userPermissions: Readonly<UserPermissions>
	hideRundownHeader?: boolean
}

interface IRundownViewContentSnapshot {
	elementId: string
	top: number
}

const RundownViewContent = translateWithTracker<IPropsWithReady & ITrackedProps, IState, {}>(() => {
	// TODO - remove this without breaking the component types..
	return {}
})(
	class RundownViewContent extends React.Component<Translated<IPropsWithReady & ITrackedProps>, IState> {
		private _hideNotificationsAfterMount: number | undefined

		constructor(props: Translated<IPropsWithReady & ITrackedProps>) {
			super(props)

			const isInspectorShelfExpanded = this.props.selectedShelfLayout?.openByDefault ?? false

			this.state = {
				timeScale: MAGIC_TIME_SCALE_FACTOR * Settings.defaultTimeScale,
				contextMenuContext: null,
				bottomMargin: '',
				followLiveSegments: true,
				manualSetAsNext: false,
				isNotificationsCenterOpen: undefined,
				isSupportPanelOpen: false,
				isInspectorShelfExpanded,
				isClipTrimmerOpen: false,
				selectedPiece: undefined,
				currentRundown: undefined,
				wasShelfResizedByUser: false,
				segmentViewModes: this.props.playlist?._id
					? UIStateStorage.getItemRecord(`rundownView.${this.props.playlist._id}`, `segmentViewModes`, {})
					: {},
				rundownDefaultSegmentViewMode: this.props.playlist?._id
					? (UIStateStorage.getItemString(
							`rundownView.${this.props.playlist._id}`,
							`rundownDefaultSegmentViewMode`,
							''
						) as SegmentViewMode) || undefined
					: undefined,
				// uiSegmentMap: new Map(),
				// uiSegments: [],
				// sourceLayerLookup: {},
				// miniShelfFilter: undefined,
			}
		}

		componentDidMount(): void {
			document.body.classList.add('dark', 'vertical-overflow-only')
			document.documentElement.setAttribute('data-bs-theme', 'dark')

			rundownNotificationHandler.set(this.onRONotificationClick)

			RundownViewEventBus.on(RundownViewEvents.GO_TO_LIVE_SEGMENT, this.onGoToLiveSegment)
			RundownViewEventBus.on(RundownViewEvents.GO_TO_TOP, this.onGoToTop)

			if (this.props.playlist) {
				documentTitle.set(this.props.playlist.name)
			}

			const themeColor = document.head.querySelector('meta[name="theme-color"]')
			if (themeColor) {
				themeColor.setAttribute('data-content', themeColor.getAttribute('content') || '')
				themeColor.setAttribute('content', '#000000')
			}

			// Snooze notifications for a period after mounting the RundownView
			if (HIDE_NOTIFICATIONS_AFTER_MOUNT) {
				NotificationCenter.isOpen = true
				this._hideNotificationsAfterMount = Meteor.setTimeout(() => {
					NotificationCenter.isOpen = this.state.isNotificationsCenterOpen !== undefined
					this._hideNotificationsAfterMount = undefined
				}, HIDE_NOTIFICATIONS_AFTER_MOUNT)
			}
			NotificationCenter.isConcentrationMode = true
		}

		componentDidUpdate(
			prevProps: IPropsWithReady & ITrackedProps,
			prevState: IState,
			snapshot: IRundownViewContentSnapshot | null
		) {
			this.handleFollowLiveSegment(prevProps, snapshot)

			this.handleBeforeUnloadEventAttach(prevProps, prevState)

			if (
				this.props.playlist &&
				(prevProps.playlist === undefined || this.props.playlist._id !== prevProps.playlist._id)
			) {
				this.setState({
					segmentViewModes: UIStateStorage.getItemRecord(
						`rundownView.${this.props.playlist._id}`,
						`segmentViewModes`,
						{}
					),
					rundownDefaultSegmentViewMode:
						(UIStateStorage.getItemString(
							`rundownView.${this.props.playlist._id}`,
							`rundownDefaultSegmentViewMode`,
							''
						) as SegmentViewMode) || undefined,
				})
			}

			if (this.props.playlist?.name !== prevProps.playlist?.name) {
				if (this.props.playlist?.name) {
					documentTitle.set(this.props.playlist.name)
				} else {
					documentTitle.set(null)
				}
			}
		}

		public getSnapshotBeforeUpdate(): IRundownViewContentSnapshot | null {
			if (!this.state.followLiveSegments) return null

			let focalElement: HTMLElement | null = null

			const liveSegmentEl = document.querySelector<HTMLElement>('.segment-timeline.live')
			if (liveSegmentEl) focalElement = liveSegmentEl

			if (!focalElement) {
				const nextSegmentEl = document.querySelector<HTMLElement>('.segment-timeline.next')
				if (nextSegmentEl) focalElement = nextSegmentEl
			}

			if (!focalElement) return null

			const { top } = focalElement.getBoundingClientRect()

			return {
				elementId: focalElement.id,
				top: top,
			}
		}

		private handleFollowLiveSegment(
			prevProps: IPropsWithReady & ITrackedProps,
			snapshot: IRundownViewContentSnapshot | null
		) {
			if (this.props.onlyShelf) return

			if (
				this.props.playlist &&
				prevProps.playlist &&
				prevProps.playlist.currentPartInfo?.partInstanceId !== this.props.playlist.currentPartInfo?.partInstanceId &&
				prevProps.playlist.nextPartInfo?.manuallySelected
			) {
				// reset followLiveSegments after a manual set as next
				this.setState({
					manualSetAsNext: false,
					followLiveSegments: true,
				})
				if (this.props.playlist.currentPartInfo) {
					scrollToPartInstance(this.props.playlist.currentPartInfo?.partInstanceId, true).catch((error) => {
						if (!error.toString().match(/another scroll/)) console.warn(error)
					})
				}
			} else if (
				this.props.playlist &&
				prevProps.playlist &&
				prevProps.playlist.activationId &&
				!this.props.playlist.activationId
			) {
				// reset followLiveSegments after deactivating a rundown
				this.setState({
					followLiveSegments: true,
				})
			} else if (
				this.props.playlist &&
				prevProps.playlist &&
				!prevProps.playlist.activationId &&
				this.props.playlist.activationId &&
				this.props.playlist.nextPartInfo
			) {
				// scroll to next after activation
				// add small delay to ensure the nextPartInfo is available
				setTimeout(() => {
					if (this.props.playlist && this.props.playlist.nextPartInfo) {
						scrollToPartInstance(this.props.playlist.nextPartInfo.partInstanceId).catch((error) => {
							if (!error.toString().match(/another scroll/)) console.warn(error)
						})
					}
				}, 120)
			} else if (
				// after take
				this.props.playlist &&
				prevProps.playlist &&
				this.props.playlist.currentPartInfo?.partInstanceId !== prevProps.playlist.currentPartInfo?.partInstanceId &&
				this.props.playlist.currentPartInfo &&
				this.state.followLiveSegments
			) {
				scrollToPartInstance(this.props.playlist.currentPartInfo.partInstanceId, true).catch((error) => {
					if (!error.toString().match(/another scroll/)) console.warn(error)
				})
			} else if (
				this.props.playlist &&
				prevProps.playlist &&
				this.props.playlist.nextPartInfo?.partInstanceId !== prevProps.playlist.nextPartInfo?.partInstanceId &&
				this.props.playlist.currentPartInfo?.partInstanceId === prevProps.playlist.currentPartInfo?.partInstanceId &&
				this.props.playlist.nextPartInfo &&
				this.props.playlist.nextPartInfo.manuallySelected
			) {
				scrollToPartInstance(this.props.playlist.nextPartInfo.partInstanceId, false).catch((error) => {
					if (!error.toString().match(/another scroll/)) console.warn(error)
				})
			} else if (
				// initial Rundown open
				this.props.playlist &&
				this.props.playlist.currentPartInfo &&
				this.props.subsReady &&
				!prevProps.subsReady
			) {
				// allow for some time for the Rundown to render
				maintainFocusOnPartInstance(this.props.playlist.currentPartInfo.partInstanceId, 7000, true, true)
			} else if (
				this.props.playlist &&
				this.props.playlist.currentPartInfo?.partInstanceId === prevProps.playlist?.currentPartInfo?.partInstanceId &&
				this.props.playlist.nextPartInfo?.partInstanceId === prevProps.playlist?.nextPartInfo?.partInstanceId &&
				this.props.matchedSegments !== prevProps.matchedSegments &&
				this.state.followLiveSegments &&
				snapshot
			) {
				// segments changed before the live segment
				const focalElement = document.getElementById(snapshot.elementId)
				if (!focalElement) return
				const { top } = focalElement.getBoundingClientRect()

				const diff = top - snapshot.top
				window.scrollBy({
					top: diff,
					behavior: 'instant',
				})
			}
		}

		private handleBeforeUnloadEventAttach(prevProps: IPropsWithReady & ITrackedProps, _prevState: IState) {
			if (this.props.onlyShelf) return

			if (
				typeof this.props.playlist !== typeof prevProps.playlist ||
				this.props.playlist?._id !== prevProps.playlist?._id ||
				!!this.props.playlist?.activationId !== !!prevProps.playlist?.activationId ||
				this.props.userPermissions.studio !== prevProps.userPermissions.studio
			) {
				if (
					this.props.playlist &&
					this.props.playlist.activationId &&
					this.props.userPermissions.studio &&
					!this.props.userPermissions.developer
				) {
					window.addEventListener('beforeunload', this.onBeforeUnload)
				} else {
					window.removeEventListener('beforeunload', this.onBeforeUnload)
				}
			}
		}

		private onSelectPiece = (piece: PieceUi) => {
			if (piece) {
				const vtContent = piece.instance.piece.content as VTContent | undefined
				if (
					vtContent &&
					vtContent.editable &&
					(vtContent.editable.editorialDuration !== undefined || vtContent.editable.editorialStart !== undefined)
				) {
					this.setState({
						isClipTrimmerOpen: true,
						selectedPiece: piece,
					})
				} else {
					RundownViewEventBus.emit(RundownViewEvents.SELECT_PIECE, {
						piece,
					})
				}
			}
		}

		componentWillUnmount(): void {
			document.body.classList.remove('dark', 'vertical-overflow-only')
			document.documentElement.removeAttribute('data-bs-theme')
			window.removeEventListener('beforeunload', this.onBeforeUnload)

			documentTitle.set(null)

			const themeColor = document.head.querySelector('meta[name="theme-color"]')
			if (themeColor) {
				themeColor.setAttribute('content', themeColor.getAttribute('data-content') || '#ffffff')
			}

			if (this._hideNotificationsAfterMount) {
				Meteor.clearTimeout(this._hideNotificationsAfterMount)
			}
			NotificationCenter.isConcentrationMode = false

			RundownViewEventBus.off(RundownViewEvents.GO_TO_LIVE_SEGMENT, this.onGoToLiveSegment)
			RundownViewEventBus.off(RundownViewEvents.GO_TO_TOP, this.onGoToTop)
		}

		private onBeforeUnload = (e: any) => {
			const { t } = this.props

			e.preventDefault()
			e.returnValue = t('This rundown is now active. Are you sure you want to exit this screen?')

			return t('This rundown is now active. Are you sure you want to exit this screen?')
		}

		private onRewindSegments = () => {
			RundownViewEventBus.emit(RundownViewEvents.REWIND_SEGMENTS)
		}

		private onSegmentScroll = () => {
			if (this.state.followLiveSegments && this.props.playlist && this.props.playlist.activationId) {
				this.setState({
					followLiveSegments: false,
				})
			}
		}

		onWheelScrollInner = _.throttle(
			() => {
				if (this.state.followLiveSegments && this.props.playlist && this.props.playlist.activationId) {
					const liveSegmentComponent = document.querySelector('.segment-timeline.live')
					if (liveSegmentComponent) {
						const offsetPosition = liveSegmentComponent.getBoundingClientRect()
						const headerHeight = getHeaderHeight()

						// Use a buffer zone to prevent oscillation
						const topBuffer = headerHeight + 10
						const bottomBuffer = window.innerHeight - headerHeight - 20 - (offsetPosition.height * 3) / 2

						// Check if segment is outside the comfortable viewing area
						const segmentComponentTooHigh = offsetPosition.top < topBuffer
						const segmentComponentTooLow = offsetPosition.bottom < bottomBuffer

						if (segmentComponentTooHigh || segmentComponentTooLow) {
							// Only change state if we need to
							if (this.state.followLiveSegments) {
								this.setState({
									followLiveSegments: false,
								})
							}
						}
					}
				}
			},
			100,
			{ leading: true, trailing: true }
		)

		private onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
			if (e.deltaX === 0 && e.deltaY !== 0 && !e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
				this.onWheelScrollInner()
			}
		}

		private onGoToTop = () => {
			scrollToPosition(0).catch((error) => {
				if (!error.toString().match(/another scroll/)) console.warn(error)
			})

			window.requestIdleCallback(
				() => {
					this.setState({
						followLiveSegments: true,
					})
				},
				{ timeout: 1000 }
			)
		}

		private onGoToLiveSegment = () => {
			if (
				this.props.playlist &&
				this.props.playlist.activationId &&
				!this.props.playlist.currentPartInfo &&
				this.props.playlist.nextPartInfo
			) {
				this.setState({
					followLiveSegments: true,
				})
				// Small delay to ensure the nextPartInfo is available
				setTimeout(() => {
					if (this.props.playlist && this.props.playlist.nextPartInfo) {
						scrollToPartInstance(this.props.playlist.nextPartInfo.partInstanceId, true).catch((error) => {
							if (!error.toString().match(/another scroll/)) console.warn(error)
						})
					}
				}, 120)
				setTimeout(() => {
					this.setState({
						followLiveSegments: true,
					})
					RundownViewEventBus.emit(RundownViewEvents.REWIND_SEGMENTS)
				}, 2000)
			} else if (this.props.playlist && this.props.playlist.activationId && this.props.playlist.currentPartInfo) {
				this.setState({
					followLiveSegments: true,
				})
				scrollToPartInstance(this.props.playlist.currentPartInfo.partInstanceId, true).catch((error) => {
					if (!error.toString().match(/another scroll/)) console.warn(error)
				})
				setTimeout(() => {
					this.setState({
						followLiveSegments: true,
					})
					RundownViewEventBus.emit(RundownViewEvents.REWIND_SEGMENTS)
				}, 2000)
			} else {
				this.setState({
					followLiveSegments: true,
				})
			}
		}

		private onActivate = () => {
			this.onGoToLiveSegment()
		}

		private onContextMenu = (contextMenuContext: IContextMenuContext) => {
			this.setState({
				contextMenuContext,
			})
		}

		private onSetNext = (part: DBPartInstance | DBPart | undefined, e: any, offset?: number, take?: boolean) => {
			const { t } = this.props
			if (this.props.userPermissions.studio && part && part._id && this.props.playlist) {
				const playlistId = this.props.playlist._id
				doUserAction(
					t,
					e,
					UserAction.SET_NEXT,
					(e, ts) => MeteorCall.userAction.setNext(e, ts, playlistId, part._id, offset, 'part' in part),
					(err) => {
						this.setState({
							manualSetAsNext: true,
						})
						if (!err && take && this.props.playlist) {
							const playlistId = this.props.playlist._id
							const currentPartInstanceId = this.props.playlist.currentPartInfo?.partInstanceId ?? null
							doUserAction(t, e, UserAction.TAKE, (e, ts) =>
								MeteorCall.userAction.take(e, ts, playlistId, currentPartInstanceId)
							)
						}
					}
				)
			}
		}

		private onSetNextSegment = (segmentId: SegmentId, e: any) => {
			const { t } = this.props
			if (this.props.userPermissions.studio && segmentId && this.props.playlist) {
				const playlistId = this.props.playlist._id
				doUserAction(
					t,
					e,
					UserAction.SET_NEXT,
					(e, ts) => MeteorCall.userAction.setNextSegment(e, ts, playlistId, segmentId),
					(err) => {
						if (err) logger.error(err)
						this.setState({
							manualSetAsNext: true,
						})
					}
				)
			}
		}

		private onQueueNextSegment = (segmentId: SegmentId | null, e: any) => {
			const { t } = this.props
			if (this.props.userPermissions.studio && (segmentId || segmentId === null) && this.props.playlist) {
				const playlistId = this.props.playlist._id
				doUserAction(
					t,
					e,
					UserAction.QUEUE_NEXT_SEGMENT,
					(e, ts) => MeteorCall.userAction.queueNextSegment(e, ts, playlistId, segmentId),
					(err) => {
						if (err) logger.error(err)
						this.setState({
							manualSetAsNext: true,
						})
					}
				)
			}
		}

		private onSetQuickLoopStart = (marker: QuickLoopMarker | null, e: any) => {
			const { t } = this.props
			if (this.props.userPermissions.studio && this.props.playlist) {
				const playlistId = this.props.playlist._id
				doUserAction(
					t,
					e,
					UserAction.SET_QUICK_LOOP_START,
					(e, ts) => MeteorCall.userAction.setQuickLoopStart(e, ts, playlistId, marker),
					(err) => {
						if (err) logger.error(err)
					}
				)
			}
		}

		private onSetQuickLoopEnd = (marker: QuickLoopMarker | null, e: any) => {
			const { t } = this.props
			if (this.props.userPermissions.studio && this.props.playlist) {
				const playlistId = this.props.playlist._id
				doUserAction(
					t,
					e,
					UserAction.SET_QUICK_LOOP_END,
					(e, ts) => MeteorCall.userAction.setQuickLoopEnd(e, ts, playlistId, marker),
					(err) => {
						if (err) logger.error(err)
					}
				)
			}
		}

		private onPieceDoubleClick = (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => {
			const { t } = this.props
			if (
				this.props.userPermissions.studio &&
				item &&
				item.instance &&
				this.props.playlist &&
				this.props.playlist.currentPartInfo &&
				this.props.studio?.settings.allowPieceDirectPlay
			) {
				const idToCopy = item.instance.isTemporary ? item.instance.piece._id : item.instance._id
				const playlistId = this.props.playlist._id
				const currentPartInstanceId = this.props.playlist.currentPartInfo.partInstanceId
				doUserAction(t, e, UserAction.TAKE_PIECE, (e, ts) =>
					MeteorCall.userAction.pieceTakeNow(e, ts, playlistId, currentPartInstanceId, idToCopy)
				)
			}
		}

		private onRONotificationClick = (e: RONotificationEvent) => {
			if (e.sourceLocator) {
				let segmentId = e.sourceLocator.segmentId

				if (!segmentId) {
					if (e.sourceLocator.partId) {
						const part = UIParts.findOne(e.sourceLocator.partId)
						if (part) {
							segmentId = part.segmentId
						}
					}
				}
				if (segmentId) {
					scrollToSegment(segmentId)
						.then(() => {
							RundownViewEventBus.emit(RundownViewEvents.HIGHLIGHT, e.sourceLocator)
						})
						.catch((error) => {
							if (!error.toString().match(/another scroll/)) console.warn(error)
						})
				}
			}
		}
		private onHeaderNoteClick = (segmentId: SegmentId, level: NoteSeverity) => {
			NotificationCenter.snoozeAll()
			const isOpen = this.state.isNotificationsCenterOpen
			this.setState({
				isNotificationsCenterOpen: level === NoteSeverity.ERROR ? NoticeLevel.CRITICAL : NoticeLevel.WARNING,
			})
			setTimeout(
				function () {
					NotificationCenter.highlightSource(
						segmentId,
						level === NoteSeverity.ERROR ? NoticeLevel.CRITICAL : NoticeLevel.WARNING
					)
				},
				isOpen ? 1 : 1000
			)
		}

		private onToggleSupportPanel = () => {
			this.setState({
				isSupportPanelOpen: !this.state.isSupportPanelOpen,
			})
		}

		private onSegmentViewModeChange = () => {
			const nextMode = getNextSegmentViewMode(this.state.rundownDefaultSegmentViewMode)
			this.setState(
				{
					segmentViewModes: {},
					rundownDefaultSegmentViewMode: nextMode,
				},
				() => {
					if (!this.props.playlist?._id) return
					UIStateStorage.setItem(`rundownView.${this.props.playlist._id}`, `segmentViewModes`, {})
					UIStateStorage.setItem(`rundownView.${this.props.playlist._id}`, 'rundownDefaultSegmentViewMode', nextMode)
				}
			)
		}

		private onStudioRouteSetSwitch = (
			e: React.ChangeEvent<HTMLElement>,
			routeSetId: string,
			_routeSet: StudioRouteSet,
			state: boolean
		) => {
			const { t } = this.props
			if (this.props.studio) {
				doUserAction(t, e, UserAction.SWITCH_ROUTE_SET, (e, ts) =>
					MeteorCall.userAction.switchRouteSet(e, ts, this.props.studio!._id, routeSetId, state)
				)
			}
		}

		private onSwitchViewMode = (segmentId: SegmentId, viewMode: SegmentViewMode) => {
			if (!this.props.playlist?._id) return
			this.setState(
				(state) => ({
					segmentViewModes: {
						...state.segmentViewModes,
						[unprotectString(segmentId)]: viewMode,
					},
				}),
				() => {
					if (!this.props.playlist?._id) return
					UIStateStorage.setItem(
						`rundownView.${this.props.playlist._id}`,
						`segmentViewModes`,
						this.state.segmentViewModes
					)
				}
			)
		}

		private renderSegments() {
			if (!this.props.matchedSegments) {
				return null
			}

			let globalIndex = 0
			const rundowns = this.props.matchedSegments.map((m) => m.rundown._id)

			return this.props.matchedSegments.map((rundownAndSegments, rundownIndex, rundownArray) => {
				let currentSegmentIndex = -1
				const rundownIdsBefore = rundowns.slice(0, rundownIndex)
				return (
					<React.Fragment key={unprotectString(rundownAndSegments.rundown._id)}>
						{this.props.matchedSegments.length > 1 && !this.props.selectedViewLayout?.hideRundownDivider && (
							<RundownDividerHeader
								key={`rundown_${rundownAndSegments.rundown._id}`}
								rundown={rundownAndSegments.rundown}
								playlist={this.props.playlist!}
							/>
						)}
						{rundownAndSegments.segments.map((segment, segmentIndex, segmentArray) => {
							if (this.props.studio && this.props.playlist && this.props.showStyleBase) {
								const ownCurrentPartInstance =
									// feed the currentPartInstance into the SegmentTimelineContainer component, if the currentPartInstance
									// is a part of the segment
									(this.props.currentPartInstance && this.props.currentPartInstance.segmentId === segment._id) ||
									// or the nextPartInstance is a part of this segment, and the currentPartInstance is autoNext
									(this.props.nextPartInstance &&
										this.props.nextPartInstance.segmentId === segment._id &&
										this.props.currentPartInstance &&
										this.props.currentPartInstance.part.autoNext)
										? this.props.currentPartInstance
										: undefined
								const ownNextPartInstance =
									this.props.nextPartInstance && this.props.nextPartInstance.segmentId === segment._id
										? this.props.nextPartInstance
										: undefined

								if (ownCurrentPartInstance) {
									currentSegmentIndex = segmentIndex
								}

								const isFollowingOnAirSegment = segmentIndex === currentSegmentIndex + 1

								const isLastSegment =
									rundownIndex === rundownArray.length - 1 && segmentIndex === segmentArray.length - 1

								// Calculate placeholder height based on segment properties
								const calculatePlaceholderHeight = (segment: DBSegment): number => {
									// Base height for a normal segment timeline
									const BASE_SEGMENT_HEIGHT = 260
									// Approximate height for dashboard panel (mini-shelf) when displayed
									const DASHBOARD_PANEL_HEIGHT = 200
									// Minimum height for hidden segments to prevent layout issues
									const HIDDEN_SEGMENT_MIN_HEIGHT = 10

									if (segment.isHidden) {
										// Hidden segments don't render the timeline at all
										// They only render the dashboard panel if showShelf is true
										return segment.showShelf ? DASHBOARD_PANEL_HEIGHT : HIDDEN_SEGMENT_MIN_HEIGHT
									}

									// Normal segment: base timeline height + optional dashboard panel
									return segment.showShelf ? BASE_SEGMENT_HEIGHT + DASHBOARD_PANEL_HEIGHT : BASE_SEGMENT_HEIGHT
								}

								const segmentPlaceholderHeight = calculatePlaceholderHeight(segment)

								return (
									<ErrorBoundary key={unprotectString(segment._id)}>
										<VirtualElement
											className={classNames({
												'segment-timeline-wrapper--hidden': segment.isHidden,
												'segment-timeline-wrapper--shelf': segment.showShelf,
											})}
											id={SEGMENT_TIMELINE_ELEMENT_ID + segment._id}
											margin={'100% 0px 100% 0px'}
											initialShow={globalIndex++ < window.innerHeight / segmentPlaceholderHeight}
											placeholderHeight={segmentPlaceholderHeight}
											placeholderClassName="placeholder-shimmer-element segment-timeline-placeholder"
											width="auto"
										>
											{this.renderSegmentComponent(
												segment,
												segmentIndex,
												rundownAndSegments,
												this.props.playlist,
												this.props.studio,
												this.props.showStyleBase,
												isLastSegment,
												isFollowingOnAirSegment,
												ownCurrentPartInstance,
												ownNextPartInstance,
												rundownAndSegments.segmentIdsBeforeEachSegment[segmentIndex],
												rundownIdsBefore
											)}
										</VirtualElement>
									</ErrorBoundary>
								)
							}
						})}
						{this.props.selectedViewLayout?.showBreaksAsSegments &&
							rundownAndSegments.rundown.endOfRundownIsShowBreak && (
								<BreakSegment breakTime={PlaylistTiming.getExpectedEnd(rundownAndSegments.rundown.timing)} />
							)}
					</React.Fragment>
				)
			})
		}

		private renderSegmentComponent(
			segment: DBSegment,
			_index: number,
			rundownAndSegments: MatchedSegment,
			rundownPlaylist: DBRundownPlaylist,
			studio: UIStudio,
			showStyleBase: UIShowStyleBase,
			isLastSegment: boolean,
			isFollowingOnAirSegment: boolean,
			ownCurrentPartInstance: PartInstance | undefined,
			ownNextPartInstance: PartInstance | undefined,
			segmentIdsBeforeSegment: Set<SegmentId>,
			rundownIdsBefore: RundownId[]
		) {
			const userSegmentViewMode = this.state.segmentViewModes[unprotectString(segment._id)] as
				| SegmentViewMode
				| undefined
			const userRundownSegmentViewMode = this.state.rundownDefaultSegmentViewMode
			const displayMode =
				userSegmentViewMode ?? userRundownSegmentViewMode ?? segment.displayAs ?? DEFAULT_SEGMENT_VIEW_MODE

			const showDurationSourceLayers = this.props.selectedViewLayout?.showDurationSourceLayers
				? new Set<ISourceLayer['_id']>(this.props.selectedViewLayout?.showDurationSourceLayers)
				: undefined

			const resolvedSegmentProps: IResolvedSegmentProps & { id: string } = {
				id: SEGMENT_TIMELINE_ELEMENT_ID + segment._id,
				studio: studio,
				showStyleBase: showStyleBase,
				followLiveSegments: this.state.followLiveSegments,
				rundownViewLayout: this.props.selectedViewLayout,
				rundownId: rundownAndSegments.rundown._id,
				segmentId: segment._id,
				playlist: rundownPlaylist,
				rundown: rundownAndSegments.rundown,
				timeScale: this.state.timeScale,
				onContextMenu: this.onContextMenu,
				onSegmentScroll: this.onSegmentScroll,
				segmentsIdsBefore: segmentIdsBeforeSegment,
				rundownIdsBefore: rundownIdsBefore,
				rundownsToShowstyles: this.props.rundownsToShowstyles,
				isLastSegment: isLastSegment,
				onPieceClick: this.onSelectPiece,
				onPieceDoubleClick: this.onPieceDoubleClick,
				onHeaderNoteClick: this.onHeaderNoteClick,
				onSwitchViewMode: (viewMode) => this.onSwitchViewMode(segment._id, viewMode),
				ownCurrentPartInstance: ownCurrentPartInstance,
				ownNextPartInstance: ownNextPartInstance,
				isFollowingOnAirSegment: isFollowingOnAirSegment,
				miniShelfFilter: this.props.miniShelfFilter,
				countdownToSegmentRequireLayers: this.props.selectedViewLayout?.countdownToSegmentRequireLayers,
				fixedSegmentDuration: this.props.selectedViewLayout?.fixedSegmentDuration,
				studioMode: this.props.userPermissions.studio,
				adLibSegmentUi: this.props.uiSegmentMap.get(segment._id),
				showDurationSourceLayers: showDurationSourceLayers,
			}

			if (segment.orphaned === SegmentOrphanedReason.ADLIB_TESTING) {
				return <SegmentAdlibTestingContainer {...resolvedSegmentProps} />
			}

			switch (displayMode) {
				case SegmentViewMode.Storyboard:
					return <SegmentStoryboardContainer {...resolvedSegmentProps} />
				case SegmentViewMode.List:
					return <SegmentListContainer {...resolvedSegmentProps} hideRundownHeader={this.props.hideRundownHeader} />
				case SegmentViewMode.Timeline:
				default:
					return <SegmentTimelineContainer {...resolvedSegmentProps} />
			}
		}

		private renderSegmentsList() {
			if (!this.props.playlist || !this.props.rundowns.length) {
				return (
					<div className="m-2">
						<Spinner />
					</div>
				)
			}
			return (
				<React.Fragment>
					{isEntirePlaylistLooping(this.props.playlist) && (
						<PlaylistLoopingHeader position="start" multiRundown={this.props.matchedSegments.length > 1} />
					)}
					<div className="segment-timeline-container" role="main" aria-labelledby="rundown-playlist-name">
						{this.renderSegments()}
					</div>
					{isEntirePlaylistLooping(this.props.playlist) && (
						<PlaylistLoopingHeader
							position="end"
							multiRundown={this.props.matchedSegments.length > 1}
							showCountdowns={!!(this.props.playlist.activationId && this.props.playlist.currentPartInfo)}
						/>
					)}
				</React.Fragment>
			)
		}

		private onChangeBottomMargin = (newBottomMargin: string) => {
			this.setState({
				bottomMargin: newBottomMargin,
			})
		}

		private onContextMenuTop = (e: React.MouseEvent<HTMLDivElement>): boolean => {
			if (!this.props.userPermissions.developer) {
				e.preventDefault()
				e.stopPropagation()
			}
			return false
		}

		private onToggleNotifications = (_e: React.MouseEvent<HTMLElement>, filter: NoticeLevel) => {
			if (!this.state.isNotificationsCenterOpen === true) {
				NotificationCenter.highlightSource(undefined, NoticeLevel.CRITICAL)
			}

			NotificationCenter.isOpen = !(this.state.isNotificationsCenterOpen === filter)

			this.setState({
				isNotificationsCenterOpen: this.state.isNotificationsCenterOpen === filter ? undefined : filter,
			})
		}

		private onToggleHotkeys = () => {
			if (!this.state.isInspectorShelfExpanded) {
				this.setState({
					isInspectorShelfExpanded: true,
				})
				RundownViewEventBus.emit(RundownViewEvents.SWITCH_SHELF_TAB, {
					tab: ShelfTabs.SYSTEM_HOTKEYS,
				})
			} else {
				this.setState({
					isInspectorShelfExpanded: false,
				})
			}

			this.setState({
				wasShelfResizedByUser: true,
			})
		}

		private onRestartPlayout = (e: React.MouseEvent<HTMLButtonElement>) => {
			const { t, studio } = this.props

			if (!studio) {
				return
			}

			const attachedPlayoutGateways = PeripheralDevices.find({
				'studioAndConfigId.studioId': studio._id,
				connected: true,
				type: PeripheralDeviceType.PLAYOUT,
			}).fetch()
			if (attachedPlayoutGateways.length === 0) {
				NotificationCenter.push(
					new Notification(
						undefined,
						NoticeLevel.CRITICAL,
						t(
							'There are no Playout\xa0Gateways connected and attached to this studio. Please contact the system administrator to start the Playout Gateway.'
						),
						'RundownView'
					)
				)
				return
			}

			e.persist()

			const restartPlayoutGateway = () => {
				attachedPlayoutGateways.forEach((item) => {
					PeripheralDevicesAPI.restartDevice(item, e)
						.then(() => {
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.NOTIFICATION,
									t('Playout\xa0Gateway "{{playoutDeviceName}}" is now restarting.', {
										playoutDeviceName: item.name,
									}),
									'RundownView'
								)
							)
						})
						.catch(() => {
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.CRITICAL,
									t('Could not restart Playout\xa0Gateway "{{playoutDeviceName}}".', {
										playoutDeviceName: item.name,
									}),
									'RundownView'
								)
							)
						})
				})
			}

			doModalDialog({
				title: t('Restart Playout'),
				message: t('Do you want to restart the Playout\xa0Gateway?'),
				onAccept: restartPlayoutGateway,
			})
		}

		private onTakeRundownSnapshot = async (e: React.MouseEvent<HTMLButtonElement>): Promise<boolean> => {
			const { t } = this.props
			if (!this.props.playlist) {
				return Promise.resolve(false)
			}
			const playlistId = this.props.playlist._id
			const doneMessage = t('A snapshot of the current Running\xa0Order has been created for troubleshooting.')
			const errorMessage = t(
				'Something went wrong when creating the snapshot. Please contact the system administrator if the problem persists.'
			)

			return new Promise<boolean>((resolve) => {
				doUserAction(
					t,
					e,
					UserAction.CREATE_SNAPSHOT_FOR_DEBUG,
					async (e, ts) => {
						const tokenResponse = await MeteorCall.system.generateSingleUseToken()

						if (ClientAPI.isClientResponseError(tokenResponse)) throw UserError.fromSerialized(tokenResponse.error)
						if (!tokenResponse.result) throw new Meteor.Error(500, 'Failed to generate token')

						return MeteorCall.userAction.storeRundownSnapshot(
							e,
							ts,
							hashSingleUseToken(tokenResponse.result),
							playlistId,
							'User requested log at' + getCurrentTime(),
							false
						)
					},
					(err: any) => {
						if (err) {
							NotificationCenter.push(new Notification(undefined, NoticeLevel.WARNING, errorMessage, 'userAction'))
							resolve(false)
						} else {
							NotificationCenter.push(new Notification(undefined, NoticeLevel.NOTIFICATION, doneMessage, 'userAction'))
							resolve(true)
						}

						return false
					}
				)
			})
		}

		private onShelfChangeExpanded = (value: boolean) => {
			this.setState({
				isInspectorShelfExpanded: value,
				wasShelfResizedByUser: true,
			})
		}

		private onTake = (e: any) => {
			RundownViewEventBus.emit(RundownViewEvents.TAKE, {
				context: e,
			})
		}

		private getStyle() {
			return {
				marginBottom: this.state.bottomMargin,
			}
		}

		private renderRundownView(
			studio: UIStudio,
			playlist: DBRundownPlaylist,
			showStyleBase: UIShowStyleBase,
			showStyleVariant: DBShowStyleVariant
		) {
			const { t } = this.props

			const selectedPiece = this.state.selectedPiece
			const selectedPieceRundown: Rundown | undefined =
				(selectedPiece &&
					RundownUtils.isPieceInstance(selectedPiece) &&
					this.props.rundowns.find((r) => r._id === selectedPiece?.instance.rundownId)) ||
				undefined

			const currentRundown = this.state.currentRundown || this.props.rundowns[0]

			return (
				<RundownViewContextProviders
					studio={studio}
					playlist={playlist}
					currentRundown={currentRundown}
					onActivate={this.onActivate}
				>
					<DragContextProvider t={t}>
						<SelectedElementsContext.Consumer>
							{(selectionContext) => {
								return (
									<div
										className={classNames('rundown-view', {
											'notification-center-open': this.state.isNotificationsCenterOpen !== undefined,
											'rundown-view--studio-mode': this.props.userPermissions.studio,
											'properties-panel-open': selectionContext.listSelectedElements().length > 0,
										})}
										style={this.getStyle()}
										onWheelCapture={this.onWheel}
										onContextMenu={this.onContextMenuTop}
									>
										{this.renderSegmentsList()}
										<ErrorBoundary>
											{this.props.matchedSegments &&
												this.props.matchedSegments.length > 0 &&
												this.props.userPermissions.studio &&
												studio.settings.enableEvaluationForm && <AfterBroadcastForm playlist={playlist} />}
										</ErrorBoundary>
										{!this.props.hideRundownHeader && (
											<ErrorBoundary>
												<RundownHeader
													playlist={playlist}
													studio={studio}
													rundownIds={this.props.rundowns.map((r) => r._id)}
													firstRundown={this.props.rundowns[0]}
													onActivate={this.onActivate}
													inActiveRundownView={this.props.inActiveRundownView}
													currentRundown={currentRundown}
													layout={this.props.selectedHeaderLayout}
													showStyleBase={showStyleBase}
													showStyleVariant={showStyleVariant}
												/>
											</ErrorBoundary>
										)}
										<ErrorBoundary>
											<Shelf
												isExpanded={
													this.state.isInspectorShelfExpanded ||
													!!(!this.state.wasShelfResizedByUser && this.props.selectedShelfLayout?.openByDefault)
												}
												onChangeExpanded={this.onShelfChangeExpanded}
												playlist={playlist}
												showStyleBase={showStyleBase}
												showStyleVariant={showStyleVariant}
												onChangeBottomMargin={this.onChangeBottomMargin}
												rundownLayout={this.props.selectedShelfLayout}
												studio={studio}
											/>
										</ErrorBoundary>
										<ErrorBoundary>
											{this.props.userPermissions.studio && !Settings.disableBlurBorder && (
												<KeyboardFocusIndicator userPermissions={this.props.userPermissions}>
													<div
														className={classNames('rundown-view__focus-lost-frame', {
															'rundown-view__focus-lost-frame--reduce-animation': import.meta.env.DEV,
														})}
													></div>
												</KeyboardFocusIndicator>
											)}
										</ErrorBoundary>
										<ErrorBoundary>
											<RundownRightHandControls
												playlistId={playlist._id}
												isFollowingOnAir={this.state.followLiveSegments}
												onFollowOnAir={this.onGoToLiveSegment}
												onRewindSegments={this.onRewindSegments}
												isNotificationCenterOpen={this.state.isNotificationsCenterOpen}
												onToggleNotifications={this.onToggleNotifications}
												isSupportPanelOpen={this.state.isSupportPanelOpen}
												onToggleSupportPanel={this.onToggleSupportPanel}
												isStudioMode={this.props.userPermissions.studio}
												isUserEditsEnabled={this.props.studio?.settings.enableUserEdits ?? false}
												onTake={this.onTake}
												studioRouteSets={studio.routeSets}
												studioRouteSetExclusivityGroups={studio.routeSetExclusivityGroups}
												onStudioRouteSetSwitch={this.onStudioRouteSetSwitch}
												onSegmentViewMode={this.onSegmentViewModeChange}
												hideRundownHeader={this.props.hideRundownHeader}
											/>
										</ErrorBoundary>
										<ErrorBoundary>
											{this.props.userPermissions.studio && currentRundown && (
												<RundownSorensenContext
													studio={studio}
													playlist={playlist}
													currentRundown={currentRundown}
													showStyleBase={showStyleBase}
												/>
											)}
										</ErrorBoundary>
										<ErrorBoundary>
											<AnimatePresence>
												{this.state.isNotificationsCenterOpen && (
													<NotificationCenterPanel
														filter={this.state.isNotificationsCenterOpen}
														hideRundownHeader={this.props.hideRundownHeader}
													/>
												)}
												{!this.state.isNotificationsCenterOpen &&
													selectionContext.listSelectedElements().length > 0 && (
														<div>
															<PropertiesPanel />
														</div>
													)}

												{this.state.isSupportPanelOpen && (
													<SupportPopUp>
														<hr />
														<button className="btn btn-secondary" onClick={this.onToggleHotkeys}>
															{t('Show Hotkeys')}
														</button>
														<hr />
														<PromiseButton
															className="btn btn-secondary"
															onClick={this.onTakeRundownSnapshot}
															disableDuringFeedback={true}
														>
															{t('Take a Snapshot')}
														</PromiseButton>
														<hr />
														{this.props.userPermissions.studio && (
															<>
																<button className="btn btn-secondary" onClick={this.onRestartPlayout}>
																	{t('Restart Playout')}
																</button>
																<hr />
															</>
														)}
														{this.props.userPermissions.studio && <CasparCGRestartButtons studioId={studio._id} />}
													</SupportPopUp>
												)}
											</AnimatePresence>
										</ErrorBoundary>
										<ErrorBoundary>
											{this.props.userPermissions.studio && (
												<Prompt
													when={!!playlist.activationId}
													message={t('This rundown is now active. Are you sure you want to exit this screen?')}
												/>
											)}
										</ErrorBoundary>
										<ErrorBoundary>
											<SegmentContextMenu
												contextMenuContext={this.state.contextMenuContext}
												playlist={playlist}
												onSetNext={this.onSetNext}
												onSetNextSegment={this.onSetNextSegment}
												onQueueNextSegment={this.onQueueNextSegment}
												onSetQuickLoopStart={this.onSetQuickLoopStart}
												onSetQuickLoopEnd={this.onSetQuickLoopEnd}
												onEditProps={(selection) => selectionContext.clearAndSetSelection(selection)}
												studioMode={this.props.userPermissions.studio}
												enablePlayFromAnywhere={!!studio.settings.enablePlayFromAnywhere}
												enableQuickLoop={!!studio.settings.enableQuickLoop}
												enableUserEdits={!!studio.settings.enableUserEdits}
											/>
										</ErrorBoundary>
										<ErrorBoundary>
											{this.state.isClipTrimmerOpen &&
												this.state.selectedPiece &&
												RundownUtils.isPieceInstance(this.state.selectedPiece) &&
												(selectedPieceRundown === undefined ? (
													<ModalDialog
														onAccept={() => this.setState({ selectedPiece: undefined })}
														title={t('Rundown not found')}
														acceptText={t('Close')}
													>
														{t('Rundown for piece "{{pieceLabel}}" could not be found.', {
															pieceLabel: this.state.selectedPiece.instance.piece.name,
														})}
													</ModalDialog>
												) : (
													<ClipTrimDialog
														studio={studio}
														playlistId={playlist._id}
														rundown={selectedPieceRundown}
														selectedPiece={this.state.selectedPiece.instance.piece}
														onClose={() => this.setState({ isClipTrimmerOpen: false })}
													/>
												))}
										</ErrorBoundary>
										<ErrorBoundary>
											<PointerLockCursor />
										</ErrorBoundary>
										<ErrorBoundary>
											{this.props.playlist && this.props.studio && this.props.showStyleBase && (
												<RundownNotifier playlistId={this.props.playlist._id} studio={this.props.studio} />
											)}
										</ErrorBoundary>
									</div>
								)
							}}
							{
								// USE IN CASE OF DEBUGGING EMERGENCY
								/* getDeveloperMode() && <div id='debug-console' className='debug-console' style={{
									background: 'rgba(255,255,255,0.7)',
									color: '#000',
									position: 'fixed',
									top: '0',
									right: '0',
									zIndex: 10000,
									pointerEvents: 'none'
								}}>
								</div> */
							}
						</SelectedElementsContext.Consumer>
					</DragContextProvider>
				</RundownViewContextProviders>
			)
		}

		render(): JSX.Element {
			if (!this.props.subsReady) {
				return (
					<div className="rundown-view rundown-view--loading">
						<Spinner />
					</div>
				)
			}

			if (
				this.props.playlist &&
				this.props.studio &&
				this.props.showStyleBase &&
				this.props.showStyleVariant &&
				!this.props.onlyShelf
			) {
				return this.renderRundownView(
					this.props.studio,
					this.props.playlist,
					this.props.showStyleBase,
					this.props.showStyleVariant
				)
			} else if (
				this.props.playlist &&
				this.props.studio &&
				this.props.showStyleBase &&
				this.props.showStyleVariant &&
				this.props.onlyShelf
			) {
				return (
					<RundownDetachedShelf
						playlist={this.props.playlist}
						currentRundown={this.props.currentRundown}
						studio={this.props.studio}
						showStyleBase={this.props.showStyleBase}
						showStyleVariant={this.props.showStyleVariant}
						shelfLayout={this.props.selectedShelfLayout}
					/>
				)
			} else {
				return (
					<RundownDataMissing
						playlist={this.props.playlist}
						studio={this.props.studio}
						rundowns={this.props.rundowns}
						showStyleBase={this.props.showStyleBase}
						showStyleVariant={this.props.showStyleVariant}
					/>
				)
			}
		}
	}
)

function findRundownLayouts(rundownLayouts: RundownLayoutBase[] | undefined, params: ParsedQuery) {
	const rundownViewLayoutId = protectString<RundownLayoutId>((params['rundownViewLayout'] as string) || '')
	const miniShelfLayoutId = protectString<RundownLayoutId>((params['miniShelfLayout'] as string) || '')
	const shelfLayoutId = protectString<RundownLayoutId>(
		(params['layout'] as string) || (params['shelfLayout'] as string) || ''
	)
	const rundownHeaderLayoutId = protectString<RundownLayoutId>((params['rundownHeaderLayout'] as string) || '')

	const selectedViewLayout = useMemo(() => {
		if (!rundownLayouts) return undefined

		const possibleRundownViewLayouts = rundownLayouts.filter((layout) => RundownLayoutsAPI.isRundownViewLayout(layout))

		let selectedViewLayout: RundownViewLayout | undefined = undefined

		if (rundownViewLayoutId) {
			selectedViewLayout = possibleRundownViewLayouts.find((i) => i._id === rundownViewLayoutId)
		}

		if (rundownViewLayoutId && !selectedViewLayout) {
			selectedViewLayout = possibleRundownViewLayouts.find((i) => i.name.includes(unprotectString(rundownViewLayoutId)))
		}

		if (!selectedViewLayout) {
			selectedViewLayout = possibleRundownViewLayouts.find((layout) => RundownLayoutsAPI.isDefaultLayout(layout))
		}

		return selectedViewLayout
	}, [rundownLayouts, rundownViewLayoutId])

	const selectedMiniShelfLayout = useMemo(() => {
		if (!rundownLayouts) return undefined

		const possibleMiniShelfLayouts = rundownLayouts.filter((layout) => RundownLayoutsAPI.isLayoutForMiniShelf(layout))

		// first try to use the one selected by the user
		let selectedMiniShelfLayout = possibleMiniShelfLayouts.find((i) => i._id === miniShelfLayoutId)

		// if couldn't find based on id, try matching part of the name
		if (miniShelfLayoutId && !selectedMiniShelfLayout) {
			selectedMiniShelfLayout = possibleMiniShelfLayouts.find((i) =>
				i.name.includes(unprotectString(miniShelfLayoutId))
			)
		}

		// Try to load defaults from rundown view layouts
		if (selectedViewLayout && RundownLayoutsAPI.isLayoutForRundownView(selectedViewLayout)) {
			if (!selectedMiniShelfLayout && selectedViewLayout.miniShelfLayout) {
				selectedMiniShelfLayout = possibleMiniShelfLayouts.find((i) => i._id === selectedViewLayout.miniShelfLayout)
			}
		}

		// if still not found, use the first one - this is a fallback functionality reserved for Shelf layouts
		// To be removed once Rundown View Layouts/Shelf layouts are refactored
		if (!selectedMiniShelfLayout) {
			selectedMiniShelfLayout = possibleMiniShelfLayouts.find((layout) => RundownLayoutsAPI.isDefaultLayout(layout))
		}

		return selectedMiniShelfLayout
	}, [rundownLayouts, miniShelfLayoutId, selectedViewLayout])

	const selectedShelfLayout = useMemo(() => {
		if (!rundownLayouts) return undefined

		const possibleShelfLayouts = rundownLayouts.filter((layout) => RundownLayoutsAPI.isLayoutForShelf(layout))

		// first try to use the one selected by the user
		let selectedShelfLayout = possibleShelfLayouts.find((i) => i._id === shelfLayoutId)

		// if couldn't find based on id, try matching part of the name
		if (shelfLayoutId && !selectedShelfLayout) {
			selectedShelfLayout = possibleShelfLayouts.find((i) => i.name.includes(unprotectString(shelfLayoutId)))
		}

		// Try to load defaults from rundown view layouts
		if (selectedViewLayout && RundownLayoutsAPI.isLayoutForRundownView(selectedViewLayout)) {
			if (!selectedShelfLayout && selectedViewLayout.shelfLayout) {
				selectedShelfLayout = possibleShelfLayouts.find((i) => i._id === selectedViewLayout.shelfLayout)
			}
		}

		// if not, try the first RUNDOWN_LAYOUT available
		if (!selectedShelfLayout) {
			selectedShelfLayout = possibleShelfLayouts.find((i) => i.type === RundownLayoutType.RUNDOWN_LAYOUT)
		}

		// if still not found, use the first one - this is a fallback functionality reserved for Shelf layouts
		// To be removed once Rundown View Layouts/Shelf layouts are refactored
		if (!selectedShelfLayout) {
			selectedShelfLayout = possibleShelfLayouts[0]
		}

		return selectedShelfLayout
	}, [rundownLayouts, shelfLayoutId, selectedViewLayout])

	const selectedHeaderLayout = useMemo(() => {
		if (!rundownLayouts) return undefined

		const possibleHeaderLayouts = rundownLayouts.filter((layout) => RundownLayoutsAPI.isLayoutForRundownHeader(layout))

		// first try to use the one selected by the user
		let selectedHeaderLayout = possibleHeaderLayouts.find((i) => i._id === rundownHeaderLayoutId)

		// if couldn't find based on id, try matching part of the name
		if (rundownHeaderLayoutId && !selectedHeaderLayout) {
			selectedHeaderLayout = possibleHeaderLayouts.find((i) => i.name.includes(unprotectString(rundownHeaderLayoutId)))
		}

		// Try to load defaults from rundown view layouts
		if (selectedViewLayout && RundownLayoutsAPI.isLayoutForRundownView(selectedViewLayout)) {
			if (!selectedHeaderLayout && selectedViewLayout.rundownHeaderLayout) {
				selectedHeaderLayout = possibleHeaderLayouts.find((i) => i._id === selectedViewLayout.rundownHeaderLayout)
			}
		}

		// if still not found, use the first one - this is a fallback functionality reserved for Shelf layouts
		// To be removed once Rundown View Layouts/Shelf layouts are refactored
		if (!selectedHeaderLayout) {
			selectedHeaderLayout = possibleHeaderLayouts.find((layout) => RundownLayoutsAPI.isDefaultLayout(layout))
		}

		return selectedHeaderLayout
	}, [rundownLayouts, rundownHeaderLayoutId, selectedViewLayout])

	return {
		selectedViewLayout,
		selectedHeaderLayout,
		selectedMiniShelfLayout,
		selectedShelfLayout,
	}
}
