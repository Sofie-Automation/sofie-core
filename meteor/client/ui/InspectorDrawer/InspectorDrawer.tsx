import * as React from 'react'
import { translate } from 'react-i18next'

import * as ClassNames from 'classnames'
import * as _ from 'underscore'
import * as $ from 'jquery'
import * as mousetrap from 'mousetrap'

import * as faBars from '@fortawesome/fontawesome-free-solid/faBars'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { AdLibPanel } from './AdLibPanel'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { SegmentUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { RunningOrderViewKbdShortcuts } from '../RunningOrderView'

enum InspectorPanelTabs {
	ADLIB = 'adlib'
}
interface IProps {
	segments: Array<SegmentUi>
	liveSegment?: SegmentUi
	runningOrder: RunningOrder
	studioInstallation: StudioInstallation

	onChangeBottomMargin?: (newBottomMargin: string) => void
}

interface IState {
	expanded: boolean
	drawerHeight: string
	overrideHeight: number | undefined
	moving: boolean
	selectedTab: InspectorPanelTabs
}

const CLOSE_MARGIN = 45

export const InspectorDrawer = translate()(class extends React.Component<Translated<IProps>, IState> {
	private _mouseStart: {
		x: number
		y: number
	} = {
		x: 0,
		y: 0
	}
	private _mouseOffset: {
		x: number
		y: number
	} = {
		x: 0,
		y: 0
	}
	private _mouseDown: number

	private bindKeys: Array<{
		key: string,
		up?: (e: KeyboardEvent) => any
		down?: (e: KeyboardEvent) => any
	}> = []

	constructor (props: Translated<IProps>) {
		super(props)

		this.state = {
			expanded: false,
			moving: false,
			drawerHeight: localStorage.getItem('runningOrderView.inspectorDrawer.drawerHeight') || '50vh',
			overrideHeight: undefined,
			selectedTab: InspectorPanelTabs.ADLIB
		}

		this.bindKeys = [
			{
				key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_TOGGLE_DRAWER,
				up: this.keyToggleDrawer
			}
		]
	}

	componentDidMount () {
		let preventDefault = (e) => {
			e.preventDefault()
			e.stopImmediatePropagation()
			e.stopPropagation()
		}
		_.each(this.bindKeys, (k) => {
			if (k.up) {
				mousetrap.bind(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
					if (k.up) k.up(e)
				}, 'keyup')
				mousetrap.bind(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
				}, 'keydown')
			}
			if (k.down) {
				mousetrap.bind(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
					if (k.down) k.down(e)
				}, 'keydown')
			}
		})
	}

	componentWillUnmount () {
		_.each(this.bindKeys, (k) => {
			if (k.up) {
				mousetrap.unbind(k.key, 'keyup')
				mousetrap.unbind(k.key, 'keydown')
			}
			if (k.down) {
				mousetrap.unbind(k.key, 'keydown')
			}
		})
	}

	getHeight (newState?: boolean): string | undefined {
		return this.state.overrideHeight ?
			((this.state.overrideHeight / window.innerHeight) * 100) + 'vh' :
			((newState !== undefined ? newState : this.state.expanded) ?
				this.state.drawerHeight
				:
				undefined)
	}

	getStyle () {
		return this.state.expanded ?
		{
			'top': this.getHeight(),
			'transition': this.state.moving ? '' : '0.5s top ease-out'
		}
		:
		{
			'top': this.getHeight(),
			'transition': this.state.moving ? '' : '0.5s top ease-out'
		}
	}

	keyToggleDrawer = () => {
		this.toggleDrawer()
	}

	toggleDrawer = () => {
		this.setState({
			expanded: !this.state.expanded
		})
	}

	dropHandle = (e: MouseEvent) => {
		document.removeEventListener('mouseup', this.dropHandle)
		document.removeEventListener('mouseleave', this.dropHandle)
		document.removeEventListener('mousemove', this.dragHandle)

		let stateChange = {
			moving: false,
			overrideHeight: undefined
		}

		if (Date.now() - this._mouseDown > 350) {
			if (this.state.overrideHeight && (window.innerHeight - this.state.overrideHeight > CLOSE_MARGIN)) {
				stateChange = _.extend(stateChange, {
					drawerHeight: ((this.state.overrideHeight / window.innerHeight) * 100) + 'vh',
					expanded: true
				})
			} else {
				stateChange = _.extend(stateChange, {
					expanded: false
				})
			}
		} else {
			stateChange = _.extend(stateChange, {
				expanded: !this.state.expanded
			})
		}

		this.setState(stateChange)

		localStorage.setItem('runningOrderView.inspectorDrawer.drawerHeight', this.state.drawerHeight)
	}

	dragHandle = (e: MouseEvent) => {
		this.setState({
			overrideHeight: e.clientY - this._mouseOffset.y
		})
	}

	grabHandle = (e: React.MouseEvent<HTMLDivElement>) => {
		document.addEventListener('mouseup', this.dropHandle)
		document.addEventListener('mouseleave', this.dropHandle)
		document.addEventListener('mousemove', this.dragHandle)

		this._mouseStart.x = e.clientX
		this._mouseStart.y = e.clientY

		const handlePosition = $(e.currentTarget).offset()
		if (handlePosition) {
			this._mouseOffset.x = (handlePosition.left - ($('html,body').scrollLeft() || 0)) - this._mouseStart.x
			this._mouseOffset.y = (handlePosition.top - ($('html,body').scrollTop() || 0)) - this._mouseStart.y
		}

		this._mouseDown = Date.now()

		this.setState({
			moving: true
		})
	}

	switchTab (tab: InspectorPanelTabs) {
		this.setState({
			selectedTab: tab
		})
	}

	render () {
		const { t } = this.props
		return (
			<div className='running-order-view__inspector-drawer dark' style={this.getStyle()}>
				<div className='running-order-view__inspector-drawer__handle dark' tabIndex={0} onMouseDown={this.grabHandle}>
					<FontAwesomeIcon icon={faBars} />
				</div>
				<div className='running-order-view__inspector-drawer__tabs'>
					<div className={ClassNames('running-order-view__inspector-drawer__tabs__tab', {
						'selected': this.state.selectedTab === InspectorPanelTabs.ADLIB
					})} onClick={(e) => this.switchTab(InspectorPanelTabs.ADLIB)} tabIndex={0}>{t('AdLib')}</div>
				</div>
				<div className='running-order-view__inspector-drawer__panel super-dark'>
					<AdLibPanel {...this.props}></AdLibPanel>
				</div>
			</div>
		)
	}
})
