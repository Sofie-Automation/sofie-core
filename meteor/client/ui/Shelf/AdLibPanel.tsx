import * as React from 'react'
import * as _ from 'underscore'
import * as Velocity from 'velocity-animate'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'
import { Rundown } from '../../../lib/collections/Rundowns'
import { Segment } from '../../../lib/collections/Segments'
import { Part } from '../../../lib/collections/Parts'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { AdLibListItem } from './AdLibListItem'
import * as ClassNames from 'classnames'
import { mousetrapHelper } from '../../lib/mousetrapHelper'

import * as faTh from '@fortawesome/fontawesome-free-solid/faTh'
import * as faList from '@fortawesome/fontawesome-free-solid/faList'
import * as faTimes from '@fortawesome/fontawesome-free-solid/faTimes'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownViewKbdShortcuts } from '../RundownView'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { IOutputLayer, ISourceLayer } from 'tv-automation-sofie-blueprints-integration'
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'
import { doUserAction } from '../../lib/userAction'
import { UserActionAPI } from '../../../lib/api/userActions'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'

interface IListViewPropsHeader {
	uiSegments: Array<SegmentUi>
	onSelectAdLib: (piece: AdLibPieceUi) => void
	onToggleAdLib: (piece: AdLibPieceUi, queue: boolean, e: ExtendedKeyboardEvent) => void
	selectedPart: AdLibPieceUi | undefined
	selectedSegment: SegmentUi | undefined
	filter: string | undefined
	showStyleBase: ShowStyleBase
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

	constructor(props: Translated<IListViewPropsHeader>) {
		super(props)

		this.state = {
			outputLayers: {},
			sourceLayers: {}
		}
	}

	static getDerivedStateFromProps(props: IListViewPropsHeader, state) {
		let tOLayers: {
			[key: string]: IOutputLayer
		} = {}
		let tSLayers: {
			[key: string]: ISourceLayer
		} = {}

		if (props.showStyleBase && props.showStyleBase.outputLayers && props.showStyleBase.sourceLayers) {
			props.showStyleBase.outputLayers.forEach((item) => {
				tOLayers[item._id] = item
			})
			props.showStyleBase.sourceLayers.forEach((item) => {
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

	componentDidUpdate(prevProps: IListViewPropsHeader) {
		if (this.props.selectedSegment && prevProps.selectedSegment !== this.props.selectedSegment && this.table) {
			// scroll to selected segment
			const segment: HTMLElement | null = document.querySelector('#adlib-panel__list-view__' + this.props.selectedSegment._id)
			if (segment) {
				const targetPosition = segment.offsetTop + this.table.scrollTop
				Velocity(this.table, {
					'scrollTop': targetPosition
				}, 250, 'swing')
			}
		}
	}

	renderSegments() {
		return this.props.uiSegments.map((seg) => {
			return (
				<tbody id={'adlib-panel__list-view__' + seg._id} key={seg._id} className={ClassNames('adlib-panel__list-view__list__segment', {
					'live': seg.isLive,
					'next': seg.isNext && !seg.isLive,
					'past': seg.parts.reduce((memo, item) => { return item.startedPlayback && item.duration ? memo : false }, true) === true
				})}>
					<tr className='adlib-panel__list-view__list__seg-header'>
						<td colSpan={9}>
							{seg.name}
						</td>
					</tr>
					{
						seg.pieces && seg.pieces.
							filter((item) => {
								if (!this.props.filter) return true
								if (item.name.toUpperCase().indexOf(this.props.filter.toUpperCase()) >= 0) return true
								return false
							}).
							map((item: AdLibPieceUi) => {
								return (
									<AdLibListItem
										key={item._id}
										item={item}
										selected={this.props.selectedPart && this.props.selectedPart._id === item._id || false}
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

	render() {

		return (
			<div className='adlib-panel__list-view__list'>
				<table className='adlib-panel__list-view__list__table' ref={this.setTableRef}>
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

	constructor(props: Translated<IToolbarPropsHeader>) {
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

	render() {
		const { t } = this.props
		return (
			<div className='adlib-panel__list-view__toolbar'>
				<div className='adlib-panel__list-view__toolbar__filter'>
					<input className='adlib-panel__list-view__toolbar__filter__input' type='text'
						ref={this.setSearchInputRef}
						placeholder={t('Search...')}
						onChange={this.searchInputChanged} />
					{this.state.searchInputValue !== '' &&
						<div className='adlib-panel__list-view__toolbar__filter__clear' onClick={this.clearSearchInput}>
							<FontAwesomeIcon icon={faTimes} />
						</div>
					}
				</div>
				<div className='adlib-panel__list-view__toolbar__buttons' style={{ 'display': 'none' }}>
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

export interface AdLibPieceUi extends AdLibPiece {
	hotkey?: string
	isGlobal?: boolean
	isHidden?: boolean
}

export interface SegmentUi extends Segment {
	/** Pieces belonging to this part */
	parts: Array<Part>
	pieces?: Array<AdLibPieceUi>
	isLive: boolean
	isNext: boolean
}

interface ISourceLayerLookup {
	[key: string]: ISourceLayer
}

interface IProps {
	// liveSegment: Segment | undefined
	visible: boolean
	rundown: Rundown
	showStyleBase: ShowStyleBase
	studioMode: boolean
}

interface IState {
	selectedPart: AdLibPiece | undefined
	selectedSegment: SegmentUi | undefined
	followLive: boolean
	filter: string | undefined
}
interface ITrackedProps {
	uiSegments: Array<SegmentUi>
	liveSegment: SegmentUi | undefined
	sourceLayerLookup: ISourceLayerLookup
}

export const AdLibPanel = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps, state: IState) => {
	let liveSegment: SegmentUi | undefined = undefined

	const sourceLayerLookup: ISourceLayerLookup = (
		props.showStyleBase && props.showStyleBase.sourceLayers ?
			_.object(_.map(props.showStyleBase.sourceLayers, (item) => [item._id, item])) :
			{}
	)
	// a hash to store various indices of the used hotkey lists
	let sourceHotKeyUse = {}

	const sharedHotkeyList = _.groupBy(props.showStyleBase.sourceLayers, (item) => item.activateKeyboardHotkeys)
	let segments: Array<Segment> = props.rundown.getSegments()

	const uiSegments = props.rundown ? (segments as Array<SegmentUi>).map((segSource) => {
		const seg = _.clone(segSource)
		seg.parts = segSource.getParts()
		let segmentAdLibPieces: Array<AdLibPiece> = []
		seg.parts.forEach((part) => {
			if (part._id === props.rundown.currentPartId) {
				seg.isLive = true
				liveSegment = seg
			}
			if (part._id === props.rundown.nextPartId) {
				seg.isNext = true
			}
			segmentAdLibPieces = segmentAdLibPieces.concat(part.getAdLibPieces())
		})
		seg.pieces = segmentAdLibPieces

		// automatically assign hotkeys based on adLibItem index
		if (seg.isLive) {
			seg.pieces.forEach((item) => {
				let sourceLayer = item.sourceLayerId && sourceLayerLookup[item.sourceLayerId]

				if (sourceLayer && sourceLayer.activateKeyboardHotkeys) {
					let keyboardHotkeysList = sourceLayer.activateKeyboardHotkeys.split(',')
					const sourceHotKeyUseLayerId = (sharedHotkeyList[sourceLayer.activateKeyboardHotkeys][0]._id) || item.sourceLayerId
					if ((sourceHotKeyUse[sourceHotKeyUseLayerId] || 0) < keyboardHotkeysList.length) {
						item.hotkey = keyboardHotkeysList[(sourceHotKeyUse[sourceHotKeyUseLayerId] || 0)]
						// add one to the usage hash table
						sourceHotKeyUse[sourceHotKeyUseLayerId] = (sourceHotKeyUse[sourceHotKeyUseLayerId] || 0) + 1
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
	}
})(class AdLibPanel extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	usedHotkeys: Array<string> = []

	constructor(props: Translated<IProps & ITrackedProps>) {
		super(props)

		this.state = {
			selectedPart: undefined,
			selectedSegment: undefined,
			filter: undefined,
			followLive: true
		}
	}

	componentWillMount() {
		this.subscribe(PubSub.segments, {
			rundownId: this.props.rundown._id
		})
		this.subscribe(PubSub.parts, {
			rundownId: this.props.rundown._id
		})
		this.subscribe(PubSub.adLibPieces, {
			rundownId: this.props.rundown._id
		})
		this.subscribe(PubSub.rundownBaselineAdLibPieces, {
			rundownId: this.props.rundown._id
		})
		meteorSubscribe(PubSub.studios, {
			_id: this.props.rundown.studioId
		})
		meteorSubscribe(PubSub.showStyleBases, {
			_id: this.props.rundown.showStyleBaseId
		})
	}

	componentDidMount() {
		if (this.props.liveSegment) {
			this.setState({
				selectedSegment: this.props.liveSegment
			})
		}

		this.refreshKeyboardHotkeys()
	}

	componentDidUpdate(prevProps: IProps & ITrackedProps) {
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keyup')
		this.usedHotkeys.length = 0

		if (this.props.liveSegment && this.props.liveSegment !== prevProps.liveSegment && this.state.followLive) {
			this.setState({
				selectedSegment: this.props.liveSegment
			})
		}

		this.refreshKeyboardHotkeys()
	}

	componentWillUnmount() {
		this._cleanUp()
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keyup')
		mousetrapHelper.unbindAll(this.usedHotkeys, 'keydown')

		this.usedHotkeys.length = 0
	}

	refreshKeyboardHotkeys() {
		if (!this.props.studioMode) return

		let preventDefault = (e) => {
			e.preventDefault()
		}

		if (this.props.liveSegment && this.props.liveSegment.pieces) {
			this.props.liveSegment.pieces.forEach((item) => {
				if (item.hotkey) {
					mousetrapHelper.bind(item.hotkey, preventDefault, 'keydown')
					mousetrapHelper.bind(item.hotkey, (e: ExtendedKeyboardEvent) => {
						preventDefault(e)
						this.onToggleAdLib(item, false, e)
					}, 'keyup')
					this.usedHotkeys.push(item.hotkey)

					const sourceLayer = this.props.sourceLayerLookup[item.sourceLayerId]
					if (sourceLayer && sourceLayer.isQueueable) {
						const queueHotkey = [RundownViewKbdShortcuts.ADLIB_QUEUE_MODIFIER, item.hotkey].join('+')
						mousetrapHelper.bind(queueHotkey, preventDefault, 'keydown')
						mousetrapHelper.bind(queueHotkey, (e: ExtendedKeyboardEvent) => {
							preventDefault(e)
							this.onToggleAdLib(item, true, e)
						}, 'keyup')
						this.usedHotkeys.push(queueHotkey)
					}
				}
			})
		}
	}

	onFilterChange = (filter: string) => {
		this.setState({
			filter
		})
	}

	onSelectAdLib = (piece: AdLibPieceUi) => {
		// console.log(aSLine)
		this.setState({
			selectedPart: piece
		})
	}

	onToggleAdLib = (piece: AdLibPieceUi, queue: boolean, e: any) => {
		const { t } = this.props

		if (piece.invalid) {
			NotificationCenter.push(new Notification(t('Invalid AdLib'), NoticeLevel.WARNING, t('Cannot play this AdLib becasue it is marked as Invalid'), 'toggleAdLib'))
			return
		}

		if (queue && this.props.sourceLayerLookup && this.props.sourceLayerLookup[piece.sourceLayerId] &&
			!this.props.sourceLayerLookup[piece.sourceLayerId].isQueueable) {
			console.log(`Item "${piece._id}" is on sourceLayer "${piece.sourceLayerId}" that is not queueable.`)
			return
		}
		if (this.props.rundown && this.props.rundown.currentPartId) {
			doUserAction(t, e, UserActionAPI.methods.segmentAdLibPieceStart, [this.props.rundown._id, this.props.rundown.currentPartId, piece._id, queue || false])
		}
	}

	onClearAllSourceLayer = (sourceLayer: ISourceLayer, e: any) => {
		// console.log(sourceLayer)
		const { t } = this.props
		if (this.props.rundown && this.props.rundown.currentPartId) {
			doUserAction(t, e, UserActionAPI.methods.sourceLayerOnPartStop, [this.props.rundown._id, this.props.rundown.currentPartId, sourceLayer._id])
		}
	}

	onSelectSegment = (segment: SegmentUi) => {
		// console.log(segment)
		this.setState({
			selectedSegment: segment,
			followLive: (this.props.liveSegment ? segment._id === this.props.liveSegment._id : true)
		})
	}

	renderSegmentList() {
		return this.props.uiSegments.map((item) => {
			return (
				<li className={ClassNames('adlib-panel__segments__segment', {
					'live': item.isLive,
					'next': item.isNext && !item.isLive,
					'past': item.parts.reduce((memo, part) => { return part.startedPlayback && part.duration ? memo : false }, true) === true
				})} onClick={(e) => this.onSelectSegment(item)} key={item._id} tabIndex={0}>
					{item.name}
				</li>
			)
		})
	}

	renderListView() {
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
					selectedPart={this.state.selectedPart}
					selectedSegment={this.state.selectedSegment}
					showStyleBase={this.props.showStyleBase}
					filter={this.state.filter} />
			</React.Fragment>
		)
	}

	render() {
		if (this.props.visible) {
			if (!this.props.uiSegments || !this.props.rundown) {
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
		return null
	}
})
