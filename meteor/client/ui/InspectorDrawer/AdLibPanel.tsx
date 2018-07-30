import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as _ from 'underscore'
import * as $ from 'jquery'

import { ClientAPI } from '../../../lib/api/client'
import { PlayoutAPI } from '../../../lib/api/playout'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'
import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { Segment } from '../../../lib/collections/Segments'
import { SegmentLine } from '../../../lib/collections/SegmentLines'
import { SegmentLineAdLibItem } from '../../../lib/collections/SegmentLineAdLibItems'
import { StudioInstallation, IOutputLayer, ISourceLayer } from '../../../lib/collections/StudioInstallations'
import { RunningOrderBaselineAdLibItems } from '../../../lib/collections/RunningOrderBaselineAdLibItems'
import { AdLibListItem } from './AdLibListItem'
import * as ClassNames from 'classnames'
import * as mousetrap from 'mousetrap'

import * as faTh from '@fortawesome/fontawesome-free-solid/faTh'
import * as faList from '@fortawesome/fontawesome-free-solid/faList'
import * as faTimes from '@fortawesome/fontawesome-free-solid/faTimes'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { Spinner } from '../../lib/Spinner'

interface IListViewPropsHeader {
	uiSegments: Array<SegmentUi>
	onSelectAdLib: (aSLine: SegmentLineAdLibItemUi) => void
	onToggleAdLib: (aSLine: SegmentLineAdLibItemUi) => void
	selectedItem: SegmentLineAdLibItemUi | undefined
	selectedSegment: SegmentUi | undefined
	filter: string | undefined
	studioInstallation: StudioInstallation
	roAdLibs: Array<SegmentLineAdLibItemUi>
}

interface IListViewStateHeader {
	outputLayers: {
		[key: string]: IOutputLayer
	}
	sourceLayers: {
		[key: string]: ISourceLayer
	}
}

const AdLibListView = translate()(class extends React.Component<Translated<IListViewPropsHeader>, IListViewStateHeader> {
	table: HTMLTableElement

	constructor (props: Translated<IListViewPropsHeader>) {
		super(props)

		this.state = {
			outputLayers: {},
			sourceLayers: {}
		}
	}

	static getDerivedStateFromProps (props: IListViewPropsHeader, state) {
		let tOLayers: {
			[key: string]: IOutputLayer
		} = {}
		let tSLayers: {
			[key: string]: ISourceLayer
		} = {}

		if (props.studioInstallation && props.studioInstallation.outputLayers && props.studioInstallation.sourceLayers) {
			props.studioInstallation.outputLayers.forEach((item) => {
				tOLayers[item._id] = item
			})
			props.studioInstallation.sourceLayers.forEach((item) => {
				tSLayers[item._id] = item
			})

			return _.extend(state, {
				outputLayers: tOLayers,
				sourceLayers: tSLayers
			})
		} else {
			return state
		}
	}

	componentDidUpdate (prevProps: IListViewPropsHeader) {
		if (this.props.selectedSegment && prevProps.selectedSegment !== this.props.selectedSegment && this.table) {
			// scroll to selected segment
			const segmentPosition = $('#adlib-panel__list-view__' + this.props.selectedSegment._id).position()
			if (segmentPosition) {
				const targetPosition = segmentPosition.top + ($(this.table).scrollTop() || 0)
				$(this.table).animate({
					'scrollTop': targetPosition
				}, 250, 'swing')
			}
		}
	}

	renderGlobalAdLibs () {
		return (
			<tbody id={'adlib-panel__list-view__globals'} key='globals' className={ClassNames('adlib-panel__list-view__list__segment')}>
			{
					this.props.roAdLibs.map((item) => {
						if (!this.props.filter || item.name.toUpperCase().indexOf(this.props.filter.toUpperCase()) >= 0) {
							return (
								<AdLibListItem
									key={item._id}
									item={item}
									selected={this.props.selectedItem && this.props.selectedItem._id === item._id || false}
									layer={this.state.sourceLayers[item.sourceLayerId]}
									outputLayer={this.state.outputLayers[item.outputLayerId]}
									onToggleAdLib={this.props.onToggleAdLib}
									onSelectAdLib={this.props.onSelectAdLib}
								/>
							)
						} else {
							return null
						}
					})
			}
			</tbody>
		)
	}

	renderSegments () {
		return this.props.uiSegments.map((seg) => {
			return (
				<tbody id={'adlib-panel__list-view__' + seg._id} key={seg._id} className={ClassNames('adlib-panel__list-view__list__segment', {
					'live': seg.isLive,
					'next': seg.isNext && !seg.isLive,
					'past': seg.segLines.reduce((memo, item) => { return item.startedPlayback && item.duration ? memo : false }, true) === true
				})}>
					<tr className='adlib-panel__list-view__list__seg-header'>
						<td colSpan={9}>
							{seg.name}
						</td>
					</tr>
					{
						seg.items && seg.items.
							filter((item) => {
								if (!this.props.filter) return true
								if (item.name.toUpperCase().indexOf(this.props.filter.toUpperCase()) >= 0) return true
								return false
							}).
							map((item) => {
								return (
									<AdLibListItem
										key={item._id}
										item={item}
										selected={this.props.selectedItem && this.props.selectedItem._id === item._id || false}
										layer={this.state.sourceLayers[item.sourceLayerId]}
										outputLayer={this.state.outputLayers[item.outputLayerId]}
										onToggleAdLib={this.props.onToggleAdLib}
										onSelectAdLib={this.props.onSelectAdLib}
										/>
								)
							})
					}
				</tbody>
			)
		})
	}

	setTableRef = (el) => {
		this.table = el
	}

	render () {
		const { t } = this.props

		return (
			<div className='adlib-panel__list-view__list'>
				<table className='adlib-panel__list-view__list__table adlib-panel__list-view__list__table--header'>
					<thead>
						<tr>
							<th className='adlib-panel__list-view__list__table__cell--icon'>&nbsp;</th>
							<th className='adlib-panel__list-view__list__table__cell--shortcut'>{t('Key')}</th>
							<th className='adlib-panel__list-view__list__table__cell--output'>{t('Output')}</th>
							<th className='adlib-panel__list-view__list__table__cell--name'>{t('Name')}</th>
							<th className='adlib-panel__list-view__list__table__cell--data'>{t('Data')}</th>
							<th className='adlib-panel__list-view__list__table__cell--resolution'>{t('Resolution')}</th>
							<th className='adlib-panel__list-view__list__table__cell--fps'>{t('FPS')}</th>
							<th className='adlib-panel__list-view__list__table__cell--duration'>{t('Duration')}</th>
							<th className='adlib-panel__list-view__list__table__cell--tc-start'>{t('TC Start')}</th>
						</tr>
					</thead>
				</table>
				<table className='adlib-panel__list-view__list__table' ref={this.setTableRef}>
					{this.renderGlobalAdLibs()}
					{this.renderSegments()}
				</table>
			</div>
		)
	}
})

interface IToolbarPropsHeader {
	onFilterChange?: (newFilter: string | undefined) => void
}

interface IToolbarStateHader {
	searchInputValue: string
}

const AdLibPanelToolbar = translate()(class AdLibPanelToolbar extends React.Component<Translated<IToolbarPropsHeader>, IToolbarStateHader> {
	searchInput: HTMLInputElement

	constructor (props: Translated<IToolbarPropsHeader> ) {
		super(props)

		this.state = {
			searchInputValue: ''
		}
	}

	setSearchInputRef = (el: HTMLInputElement) => {
		this.searchInput = el
	}

	searchInputChanged = (e?: React.ChangeEvent<HTMLInputElement>) => {
		this.setState({
			searchInputValue: this.searchInput.value
		})

		this.props.onFilterChange && typeof this.props.onFilterChange === 'function' &&
			this.props.onFilterChange(this.searchInput.value)
	}

	clearSearchInput = () => {
		this.searchInput.value = ''

		this.searchInputChanged()
	}

	render () {
		const { t } = this.props
		return (
			<div className='adlib-panel__list-view__toolbar'>
				<div className='adlib-panel__list-view__toolbar__filter'>
					<input className='adlib-panel__list-view__toolbar__filter__input' type='text'
						   ref={this.setSearchInputRef}
						   placeholder={t('Search...')}
						   onChange={this.searchInputChanged} />
					{ this.state.searchInputValue !== '' &&
						<div className='adlib-panel__list-view__toolbar__filter__clear' onClick={this.clearSearchInput}>
							<FontAwesomeIcon icon={faTimes} />
						</div>
					}
				</div>
				<div className='adlib-panel__list-view__toolbar__buttons'>
					<button className='action-btn'>
						<FontAwesomeIcon icon={faList} />
					</button>
					<button className='action-btn'>
						<FontAwesomeIcon icon={faTh} />
					</button>
				</div>
			</div>
		)
	}
})

export interface SegmentLineAdLibItemUi extends SegmentLineAdLibItem {
	hotkey?: string
	isGlobal?: boolean
}

export interface SegmentUi extends Segment {
	/** Segment line items belonging to this segment line */
	segLines: Array<SegmentLine>
	items?: Array<SegmentLineAdLibItemUi>
	isLive: boolean
	isNext: boolean
}

interface ISourceLayerLookup {
	[key: string]: ISourceLayer
}

interface IProps {
	segments: Array<Segment>
	// liveSegment: Segment | undefined
	runningOrder: RunningOrder
	studioInstallation: StudioInstallation
}

interface IState {
	selectedItem: SegmentLineAdLibItem | undefined
	selectedSegment: SegmentUi | undefined
	followLive: boolean
	filter: string | undefined
}
interface ITrackedProps {
	uiSegments: Array<SegmentUi>
	liveSegment: SegmentUi | undefined
	sourceLayerLookup: ISourceLayerLookup
	roAdLibs: Array<SegmentLineAdLibItemUi>
}

export const AdLibPanel = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps, state: IState) => {
	let subSegments = Meteor.subscribe('segments', {})
	let subSegmentLines = Meteor.subscribe('segmentLines', {})
	let subSegmentLineItems = Meteor.subscribe('segmentLineAdLibItems', {})
	let subRunningOrderAdLibItems = Meteor.subscribe('runningOrderBaselineAdLibItems', {})
	let subStudioInstallations = Meteor.subscribe('studioInstallations', {})
	let subShowStyles = Meteor.subscribe('showStyles', {})

	let liveSegment: SegmentUi | undefined = undefined

	const sourceLayerLookup: ISourceLayerLookup = (
		props.studioInstallation && props.studioInstallation.sourceLayers ?
		_.object(_.map(props.studioInstallation.sourceLayers, (item) => [item._id, item])) :
		{}
	)
	// a hash to store various indices of the used hotkey lists
	let sourceHotKeyUse = {}

	let roAdLibs: Array<SegmentLineAdLibItemUi> = []

	if (props.runningOrder) {
		let roAdLibItems = RunningOrderBaselineAdLibItems.find({runningOrderId: props.runningOrder._id}).fetch()
		roAdLibItems.forEach((item) => {
			// automatically assign hotkeys based on adLibItem index
			const uiAdLib: SegmentLineAdLibItemUi = _.clone(item)
			uiAdLib.isGlobal = true

			let sourceLayer = item.sourceLayerId && sourceLayerLookup[item.sourceLayerId]
			if (sourceLayer &&
				sourceLayer.activateKeyboardHotkeys &&
				sourceLayer.assignHotkeysToGlobalAdlibs
			) {
				let keyboardHotkeysList = sourceLayer.activateKeyboardHotkeys.split(',')
				if ((sourceHotKeyUse[uiAdLib.sourceLayerId] || 0) < keyboardHotkeysList.length) {
					uiAdLib.hotkey = keyboardHotkeysList[(sourceHotKeyUse[uiAdLib.sourceLayerId] || 0)]
					// add one to the usage hash table
					sourceHotKeyUse[uiAdLib.sourceLayerId] = (sourceHotKeyUse[uiAdLib.sourceLayerId] || 0) + 1
				}
			}
			// always add them to the list
			roAdLibs.push(uiAdLib)
		})
	}

	const uiSegments = props.runningOrder && props.segments ? (props.segments as Array<SegmentUi>).map((segSource) => {
		const seg = _.clone(segSource)
		seg.segLines = segSource.getSegmentLines()
		let segmentAdLibItems: Array<SegmentLineAdLibItem> = []
		seg.segLines.forEach((segLine) => {
			if (segLine._id === props.runningOrder.currentSegmentLineId) {
				seg.isLive = true
				liveSegment = seg
			}
			if (segLine._id === props.runningOrder.nextSegmentLineId) {
				seg.isNext = true
			}
			segmentAdLibItems = segmentAdLibItems.concat(segLine.getSegmentLinesAdLibItems())
		})
		seg.items = segmentAdLibItems

		// automatically assign hotkeys based on adLibItem index
		if (seg.isLive) {
			seg.items.forEach((item) => {
				if (item.sourceLayerId && sourceLayerLookup[item.sourceLayerId] && sourceLayerLookup[item.sourceLayerId].activateKeyboardHotkeys) {
					let keyboardHotkeysList = sourceLayerLookup[item.sourceLayerId].activateKeyboardHotkeys!.split(',')
					if ((sourceHotKeyUse[item.sourceLayerId] || 0) < keyboardHotkeysList.length) {
						item.hotkey = keyboardHotkeysList[(sourceHotKeyUse[item.sourceLayerId] || 0)]
						// add one to the usage hash table
						sourceHotKeyUse[item.sourceLayerId] = (sourceHotKeyUse[item.sourceLayerId] || 0) + 1
					}
				}
			})
		}
		return seg
	}) : []

	return {
		uiSegments,
		liveSegment,
		sourceLayerLookup,
		roAdLibs
	}
})(class AdLibPanel extends React.Component<Translated<IProps & ITrackedProps>, IState> {
	usedHotkeys: Array<string> = []

	constructor (props: Translated<IProps & ITrackedProps>) {
		super(props)

		this.state = {
			selectedItem: undefined,
			selectedSegment: undefined,
			filter: undefined,
			followLive: true
		}
	}

	componentDidMount () {
		if (this.props.liveSegment) {
			this.setState({
				selectedSegment: this.props.liveSegment
			})
		}

		this.refreshKeyboardHotkeys()
	}

	componentDidUpdate (prevProps: IProps & ITrackedProps) {
		mousetrap.unbind(this.usedHotkeys, 'keyup')
		this.usedHotkeys.length = 0

		if (this.props.liveSegment && this.props.liveSegment !== prevProps.liveSegment && this.state.followLive) {
			this.setState({
				selectedSegment: this.props.liveSegment
			})
		}

		this.refreshKeyboardHotkeys()
	}

	componentWillUnmount () {
		mousetrap.unbind(this.usedHotkeys, 'keyup')
		mousetrap.unbind(this.usedHotkeys, 'keydown')
		this.usedHotkeys.length = 0
	}

	refreshKeyboardHotkeys () {
		let preventDefault = (e) => {
			e.preventDefault()
			e.stopImmediatePropagation()
			e.stopPropagation()
		}

		if (this.props.roAdLibs) {
			this.props.roAdLibs.forEach((item) => {
				if (item.hotkey) {
					mousetrap.bind(item.hotkey, preventDefault, 'keydown')
					mousetrap.bind(item.hotkey, (e: ExtendedKeyboardEvent) => {
						preventDefault(e)
						this.onToggleAdLib(item)
					}, 'keyup')
					this.usedHotkeys.push(item.hotkey)
				}
			})
		}

		if (this.props.liveSegment && this.props.liveSegment.items) {
			this.props.liveSegment.items.forEach((item) => {
				if (item.hotkey) {
					mousetrap.bind(item.hotkey, preventDefault, 'keydown')
					mousetrap.bind(item.hotkey, (e: ExtendedKeyboardEvent) => {
						preventDefault(e)
						this.onToggleAdLib(item)
					}, 'keyup')
					this.usedHotkeys.push(item.hotkey)
				}
			})
		}

		if (this.props.sourceLayerLookup) {
			_.forEach(this.props.sourceLayerLookup, (item) => {
				if (item.clearKeyboardHotkey) {
					mousetrap.bind(item.clearKeyboardHotkey, preventDefault, 'keydown')
					mousetrap.bind(item.clearKeyboardHotkey, (e: ExtendedKeyboardEvent) => {
						preventDefault(e)
						this.onClearAllSourceLayer(item)
					}, 'keyup')
					this.usedHotkeys.push(item.clearKeyboardHotkey)
				}
			})
		}
	}

	onFilterChange = (filter: string) => {
		this.setState({
			filter
		})
	}

	onSelectAdLib = (aSLine: SegmentLineAdLibItemUi) => {
		console.log(aSLine)
		this.setState({
			selectedItem: aSLine
		})
	}

	onToggleAdLib = (aSLine: SegmentLineAdLibItemUi) => {
		console.log(aSLine)
		if (this.props.runningOrder && this.props.runningOrder.currentSegmentLineId && !aSLine.isGlobal) {
			Meteor.call(ClientAPI.methods.execMethod, PlayoutAPI.methods.segmentAdLibLineItemStart, this.props.runningOrder._id, this.props.runningOrder.currentSegmentLineId, aSLine._id)
		} else if (this.props.runningOrder && this.props.runningOrder.currentSegmentLineId && aSLine.isGlobal) {
			Meteor.call(ClientAPI.methods.execMethod, PlayoutAPI.methods.runningOrderBaselineAdLibItemStart, this.props.runningOrder._id, this.props.runningOrder.currentSegmentLineId, aSLine._id)
		}
	}

	onClearAllSourceLayer = (sourceLayer: ISourceLayer) => {
		console.log(sourceLayer)

		if (this.props.runningOrder && this.props.runningOrder.currentSegmentLineId) {
			Meteor.call(ClientAPI.methods.execMethod, PlayoutAPI.methods.sourceLayerOnLineStop, this.props.runningOrder._id, this.props.runningOrder.currentSegmentLineId, sourceLayer._id)
		}
	}

	onSelectSegment = (segment: SegmentUi) => {
		console.log(segment)
		this.setState({
			selectedSegment: segment,
			followLive: (this.props.liveSegment ? segment._id === this.props.liveSegment._id : true)
		})
	}

	renderSegmentList () {
		return this.props.uiSegments.map((item) => {
			return (
				<li className={ClassNames('adlib-panel__segments__segment', {
					'live': item.isLive,
					'next': item.isNext && !item.isLive,
					'past': item.segLines.reduce((memo, item) => { return item.startedPlayback && item.duration ? memo : false }, true) === true
				})} onClick={(e) => this.onSelectSegment(item)} key={item._id} tabIndex={0}>
					{item.name}
				</li>
			)
		})
	}

	renderListView () {
		// let a = new AdLibPanelToolbar({
			// t: () => {},
			// onFilterChange: () => { console.log('a') }
		// })
		return (
			<React.Fragment>
				<AdLibPanelToolbar
					onFilterChange={this.onFilterChange} />
				<AdLibListView
					uiSegments={this.props.uiSegments}
					onSelectAdLib={this.onSelectAdLib}
					onToggleAdLib={this.onToggleAdLib}
					selectedItem={this.state.selectedItem}
					selectedSegment={this.state.selectedSegment}
					studioInstallation={this.props.studioInstallation}
					roAdLibs={this.props.roAdLibs}
					filter={this.state.filter} />
			</React.Fragment>
		)
	}

	render () {
		if (!this.props.segments || !this.props.runningOrder) {
			return <Spinner />
		} else {
			return (
				<div className='adlib-panel super-dark'>
					<ul className='adlib-panel__segments'>
						{this.renderSegmentList()}
					</ul>
					{this.renderListView()}
				</div>
			)
		}
	}
})
