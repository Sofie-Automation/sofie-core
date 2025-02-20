import * as React from 'react'
import { withTranslation } from 'react-i18next'

import ClassNames from 'classnames'

import { faBars } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { getElementDocumentOffset } from '../../utils/positions'
import {
	DashboardLayoutExternalFrame,
	RundownLayoutElementType,
	RundownLayoutFilter,
	RundownLayoutShelfBase,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { UIStateStorage } from '../../lib/UIStateStorage'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts'
import { contextMenuHoldToDisplayTime } from '../../lib/lib'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import { ShelfRundownLayout } from './ShelfRundownLayout'
import { ShelfDashboardLayout } from './ShelfDashboardLayout'
import { Bucket } from '@sofie-automation/corelib/dist/dataModel/Bucket'
import { RundownViewBuckets, BucketAdLibItem } from './RundownViewBuckets'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { ShelfInspector } from './Inspector/ShelfInspector'
import RundownViewEventBus, {
	IEventContext,
	RundownViewEvents,
	SelectPieceEvent,
	ShelfStateEvent,
	SwitchToShelfTabEvent,
} from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { IAdLibListItem } from './AdLibListItem'
import ShelfContextMenu from './ShelfContextMenu'
import { doUserAction, UserAction } from '../../lib/clientUserAction'
import { MeteorCall } from '../../lib/meteorApi'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { ShelfDisplayOptions } from '../../lib/shelf'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'

import { ShelfTabs } from '@sofie-automation/meteor-lib/dist/uiTypes/ShelfTabs'

export { ShelfTabs } from '@sofie-automation/meteor-lib/dist/uiTypes/ShelfTabs'

export interface IShelfProps extends React.ComponentPropsWithRef<any> {
	isExpanded: boolean
	buckets: Array<Bucket>
	playlist: DBRundownPlaylist
	currentRundown: Rundown
	studio: UIStudio
	showStyleBase: UIShowStyleBase
	showStyleVariant: DBShowStyleVariant
	studioMode: boolean
	hotkeys: Array<{
		key: string
		label: string
	}>
	rundownLayout?: RundownLayoutShelfBase
	fullViewport?: boolean
	shelfDisplayOptions: ShelfDisplayOptions
	bucketDisplayFilter: number[] | undefined
	showInspector: boolean

	onChangeExpanded: (value: boolean) => void
	onChangeBottomMargin?: (newBottomMargin: string) => void
}

interface IState {
	shelfHeight: string
	overrideHeight: number | undefined
	moving: boolean
	selectedTab: string | undefined
	shouldQueue: boolean
	selectedPiece: BucketAdLibItem | IAdLibListItem | PieceUi | undefined
	localStorageName: string
}

const CLOSE_MARGIN = 45
const MAX_HEIGHT = 95
export const DEFAULT_TAB = ShelfTabs.ADLIB

export class ShelfBase extends React.Component<Translated<IShelfProps>, IState> {
	private _mouseStart: {
		x: number
		y: number
	} = {
		x: 0,
		y: 0,
	}
	private _mouseOffset: {
		x: number
		y: number
	} = {
		x: 0,
		y: 0,
	}
	private _mouseDown = 0

	constructor(props: Translated<IShelfProps>) {
		super(props)

		const defaultHeight = props.rundownLayout?.startingHeight
			? `${100 - Math.min(props.rundownLayout.startingHeight, MAX_HEIGHT)}vh`
			: '50vh'

		const localStorageName = props.rundownLayout ? `rundownView.shelf_${props.rundownLayout._id}` : `rundownView.shelf`

		this.state = {
			moving: false,
			shelfHeight: localStorage.getItem(`${localStorageName}.shelfHeight`) ?? defaultHeight,
			overrideHeight: undefined,
			selectedTab: UIStateStorage.getItem(`rundownView.${props.playlist._id}`, 'shelfTab', undefined) as
				| string
				| undefined,
			shouldQueue: false,
			selectedPiece: undefined,
			localStorageName,
		}
	}

	private onTake = (e: IEventContext) => {
		this.take(e.context)
	}

	private take = (e: any) => {
		const { t } = this.props
		if (this.props.studioMode) {
			doUserAction(t, e, UserAction.TAKE, (e, ts) =>
				MeteorCall.userAction.take(
					e,
					ts,
					this.props.playlist._id,
					this.props.playlist.currentPartInfo?.partInstanceId ?? null
				)
			)
		}
	}

	componentDidMount(): void {
		this.restoreDefaultTab()

		RundownViewEventBus.on(RundownViewEvents.SWITCH_SHELF_TAB, this.onSwitchShelfTab)
		RundownViewEventBus.on(RundownViewEvents.SELECT_PIECE, this.onSelectPiece)
		RundownViewEventBus.on(RundownViewEvents.SHELF_STATE, this.onShelfStateChange)

		// NOTE: When not in shelfOnly mode, the RundownHeader is responsible for listening to the for soft takes.
		//       This caused shelfOnly mode to not registering takes.
		if (this.props.fullViewport) {
			RundownViewEventBus.on(RundownViewEvents.TAKE, this.onTake)
		}
	}

	componentWillUnmount(): void {
		RundownViewEventBus.off(RundownViewEvents.SWITCH_SHELF_TAB, this.onSwitchShelfTab)
		RundownViewEventBus.off(RundownViewEvents.SELECT_PIECE, this.onSelectPiece)
		RundownViewEventBus.off(RundownViewEvents.SHELF_STATE, this.onShelfStateChange)

		if (this.props.fullViewport) {
			RundownViewEventBus.off(RundownViewEvents.TAKE, this.onTake)
		}
	}

	componentDidUpdate(prevProps: IShelfProps, prevState: IState): void {
		if (prevProps.isExpanded !== this.props.isExpanded || prevState.shelfHeight !== this.state.shelfHeight) {
			if (this.props.onChangeBottomMargin && typeof this.props.onChangeBottomMargin === 'function') {
				this.props.onChangeBottomMargin(this.getHeight() || '0px')
			}
		}

		this.restoreDefaultTab()
	}

	private restoreDefaultTab() {
		if (
			this.state.selectedTab === undefined &&
			this.props.rundownLayout &&
			RundownLayoutsAPI.isRundownLayout(this.props.rundownLayout)
		) {
			const defaultTab = this.props.rundownLayout.filters.find((i) => (i as RundownLayoutFilter).default)
			if (defaultTab) {
				this.setState({
					selectedTab: `${ShelfTabs.ADLIB_LAYOUT_FILTER}_${defaultTab._id}`,
				})
			} else if (this.props.rundownLayout.filters.length > 0) {
				// there is no AdLib tab so some default needs to be selected
				this.setState({
					selectedTab: `${ShelfTabs.ADLIB_LAYOUT_FILTER}_${this.props.rundownLayout.filters[0]._id}`,
				})
			}
		}
	}

	private getHeight(): string {
		const top = parseFloat(this.state.shelfHeight.substr(0, this.state.shelfHeight.length - 2))
		return this.props.isExpanded ? (100 - top).toString() + 'vh' : '0px'
	}

	private getTop(newState?: boolean): string | undefined {
		return this.state.overrideHeight
			? (this.state.overrideHeight / window.innerHeight) * 100 + 'vh'
			: (newState !== undefined ? newState : this.props.isExpanded)
			? this.state.shelfHeight
			: undefined
	}

	private getStyle() {
		return {
			top: this.getTop(),
			transition: this.state.moving ? '' : '0.5s top ease-out',
		}
	}

	private blurActiveElement = () => {
		try {
			// @ts-expect-error blur isnt always valid
			document.activeElement.blur()
		} catch (e) {
			// do nothing
		}
	}

	private dropHandle = (e: MouseEvent) => {
		document.removeEventListener('mouseup', this.dropHandle)
		document.removeEventListener('mouseleave', this.dropHandle)
		document.removeEventListener('mousemove', this.dragHandle)

		this.endResize()

		e.preventDefault()
	}

	private dragHandle = (e: MouseEvent) => {
		if (e.buttons !== 1) {
			this.dropHandle(e)
			return
		}

		this.setState({
			overrideHeight: e.clientY + this._mouseOffset.y,
		})

		e.preventDefault()
	}

	private grabHandle = (e: React.MouseEvent<HTMLButtonElement>) => {
		if (e.button !== 0) {
			return
		}

		document.addEventListener('mouseup', this.dropHandle)
		document.addEventListener('mouseleave', this.dropHandle)
		document.addEventListener('mousemove', this.dragHandle)

		this.beginResize(e.clientX, e.clientY, e.currentTarget)

		e.preventDefault()
	}

	private touchMoveHandle = (e: TouchEvent) => {
		this.setState({
			overrideHeight: e.touches[0].clientY + this._mouseOffset.y,
		})

		e.preventDefault()
	}

	private touchOffHandle = (e: TouchEvent) => {
		document.removeEventListener('touchmove', this.touchMoveHandle)
		document.removeEventListener('touchcancel', this.touchOffHandle)
		document.removeEventListener('touchend', this.touchOffHandle)

		this.endResize()

		e.preventDefault()
	}

	private touchOnHandle = (e: React.TouchEvent<HTMLButtonElement>) => {
		document.addEventListener('touchmove', this.touchMoveHandle, {
			passive: false,
		})
		document.addEventListener('touchcancel', this.touchOffHandle)
		document.addEventListener('touchend', this.touchOffHandle, {
			passive: false,
		})

		if (e.touches.length > 1) {
			this.touchOffHandle(e.nativeEvent)
			return
		}

		this.beginResize(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget)

		e.preventDefault()
	}

	private toggleHandle = (e: React.KeyboardEvent<HTMLButtonElement>) => {
		if (e.key !== 'Enter') return
		this.props.onChangeExpanded(!this.props.isExpanded)
	}

	private endResize = () => {
		const stateChange: Partial<IState> = {
			moving: false,
			overrideHeight: undefined,
		}

		let shouldBeExpanded = false

		if (Date.now() - this._mouseDown > 350) {
			if (this.state.overrideHeight && window.innerHeight - this.state.overrideHeight > CLOSE_MARGIN) {
				stateChange.shelfHeight = Math.max(0.1, 0, this.state.overrideHeight / window.innerHeight) * 100 + 'vh'
				shouldBeExpanded = true
			} else {
				shouldBeExpanded = false
			}
		} else {
			shouldBeExpanded = !this.props.isExpanded
		}

		this.setState(stateChange as any)

		document.body.style.cursor = ''

		this.props.onChangeExpanded(shouldBeExpanded)
		this.blurActiveElement()

		localStorage.setItem(`${this.state.localStorageName}.shelfHeight`, this.state.shelfHeight)
	}

	private beginResize = (x: number, y: number, targetElement: HTMLElement) => {
		this._mouseStart.x = x
		this._mouseStart.y = y

		const handlePosition = getElementDocumentOffset(targetElement.parentElement)
		if (handlePosition) {
			this._mouseOffset.x = handlePosition.left - window.scrollX - this._mouseStart.x
			this._mouseOffset.y = handlePosition.top - window.scrollY - this._mouseStart.y
		}

		this._mouseDown = Date.now()

		document.body.style.cursor = 'grabbing'

		this.setState({
			moving: true,
		})
	}

	private onShelfStateChange = (e: ShelfStateEvent) => {
		this.blurActiveElement()
		this.props.onChangeExpanded(e.state === 'toggle' ? !this.props.isExpanded : e.state)
	}

	private onSwitchShelfTab = (e: SwitchToShelfTabEvent) => {
		if (e.tab) {
			this.switchTab(e.tab)
		}
	}

	private switchTab = (tab: string) => {
		this.setState({
			selectedTab: tab,
		})

		UIStateStorage.setItem(`rundownView.${this.props.playlist._id}`, 'shelfTab', tab)
	}

	private onSelectPiece = (e: SelectPieceEvent) => {
		this.selectPiece(e.piece)
	}

	private selectPiece = (piece: BucketAdLibItem | IAdLibListItem | PieceUi | undefined) => {
		this.setState({
			selectedPiece: piece,
		})
	}

	private changeQueueAdLib = (shouldQueue: boolean) => {
		this.setState({
			shouldQueue,
		})
	}

	render(): JSX.Element {
		const { fullViewport, shelfDisplayOptions, isExpanded, t } = this.props
		return (
			<div
				className={ClassNames('rundown-view__shelf dark', {
					'scroll-sink': !fullViewport,
					'full-viewport': fullViewport,
					moving: this.state.moving,
				})}
				style={fullViewport ? undefined : this.getStyle()}
			>
				{!this.props.rundownLayout?.disableContextMenu && (
					<ShelfContextMenu
						shelfDisplayOptions={this.props.shelfDisplayOptions}
						hideDefaultStartExecute={!!this.props.rundownLayout?.hideDefaultStartExecute}
					/>
				)}
				{!fullViewport && (
					<button
						className="rundown-view__shelf__handle dark"
						tabIndex={0}
						onKeyDown={this.toggleHandle}
						onMouseDown={this.grabHandle}
						onTouchStart={this.touchOnHandle}
						aria-label={t('Shelf')}
						aria-pressed={isExpanded ? 'true' : 'false'}
					>
						<FontAwesomeIcon icon={faBars} />
					</button>
				)}
				<div className="rundown-view__shelf__contents">
					{shelfDisplayOptions.enableLayout ? (
						<ContextMenuTrigger
							id="shelf-context-menu"
							attributes={{
								className: 'rundown-view__shelf__contents__pane fill',
							}}
							holdToDisplay={contextMenuHoldToDisplayTime()}
						>
							<ErrorBoundary>
								{this.props.rundownLayout && RundownLayoutsAPI.isRundownLayout(this.props.rundownLayout) ? (
									<ShelfRundownLayout
										playlist={this.props.playlist}
										showStyleBase={this.props.showStyleBase}
										studioMode={this.props.studioMode}
										hotkeys={this.props.hotkeys}
										rundownLayout={this.props.rundownLayout}
										selectedTab={this.state.selectedTab}
										selectedPiece={this.state.selectedPiece}
										onSelectPiece={this.selectPiece}
										onSwitchTab={this.switchTab}
										studio={this.props.studio}
									/>
								) : this.props.rundownLayout && RundownLayoutsAPI.isDashboardLayout(this.props.rundownLayout) ? (
									<ShelfDashboardLayout
										playlist={this.props.playlist}
										showStyleBase={this.props.showStyleBase}
										showStyleVariant={this.props.showStyleVariant}
										// buckets={this.props.buckets}
										studioMode={this.props.studioMode}
										rundownLayout={this.props.rundownLayout}
										shouldQueue={this.state.shouldQueue}
										selectedPiece={this.state.selectedPiece}
										onSelectPiece={this.selectPiece}
										onChangeQueueAdLib={this.changeQueueAdLib}
										studio={this.props.studio}
									/>
								) : (
									// ultimate fallback if not found
									<ShelfRundownLayout
										playlist={this.props.playlist}
										showStyleBase={this.props.showStyleBase}
										studioMode={this.props.studioMode}
										hotkeys={this.props.hotkeys}
										rundownLayout={undefined}
										selectedTab={this.state.selectedTab}
										selectedPiece={this.state.selectedPiece}
										onSelectPiece={this.selectPiece}
										onSwitchTab={this.switchTab}
										studio={this.props.studio}
									/>
								)}
							</ErrorBoundary>
						</ContextMenuTrigger>
					) : null}
					{shelfDisplayOptions.enableBuckets ? (
						<ErrorBoundary>
							<RundownViewBuckets
								buckets={this.props.buckets}
								playlist={this.props.playlist}
								shouldQueue={this.state.shouldQueue}
								showStyleBase={this.props.showStyleBase}
								fullViewport={
									!!this.props.fullViewport &&
									this.props.shelfDisplayOptions.enableBuckets === true &&
									this.props.shelfDisplayOptions.enableInspector === false &&
									this.props.shelfDisplayOptions.enableLayout === false
								}
								displayBuckets={this.props.bucketDisplayFilter}
								selectedPiece={this.state.selectedPiece}
								onSelectPiece={this.selectPiece}
								extFrames={
									this.props.rundownLayout?.filters.filter(
										(panel): panel is DashboardLayoutExternalFrame =>
											panel.type === RundownLayoutElementType.EXTERNAL_FRAME
									) ?? []
								}
							/>
						</ErrorBoundary>
					) : null}
					{this.props.rundownLayout?.showInspector ? (
						<ErrorBoundary>
							<ShelfInspector
								selected={this.state.selectedPiece}
								showStyleBase={this.props.showStyleBase}
								studio={this.props.studio}
								rundownPlaylist={this.props.playlist}
								onSelectPiece={this.selectPiece}
							/>
						</ErrorBoundary>
					) : null}
				</div>
			</div>
		)
	}
}

export const Shelf = withTranslation(undefined, {
	withRef: true,
})(ShelfBase)
