import React from 'react'
import _ from 'underscore'
import { Translated } from '../../lib/ReactMeteorData/react-meteor-data.js'
import ClassNames from 'classnames'
import { Spinner } from '../../lib/Spinner.js'
import { DashboardLayoutFilter, PieceDisplayStyle } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { IAdLibPanelProps, AdLibFetchAndFilterProps } from './AdLibPanel.js'
import { AdLibPanelToolbar } from './AdLibPanelToolbar.js'
import { matchFilter } from './AdLibListView.js'
import { DashboardPieceButton } from './DashboardPieceButton.js'
import { contextMenuHoldToDisplayTime } from '../../lib/lib.js'
import {
	DashboardPanelInner,
	dashboardElementStyle,
	IDashboardPanelProps,
	IDashboardPanelState,
	DashboardPanelInnerProps,
	useDashboardPanelTrackedProps,
} from './DashboardPanel.js'
import { unprotectString } from '../../lib/tempLib.js'
import { RundownUtils } from '../../lib/rundown.js'
import { AdLibPieceUi } from '../../lib/shelf.js'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { ContextType, setShelfContextMenuContext } from './ShelfContextMenu.js'
import { withTranslation } from 'react-i18next'

export const TimelineDashboardPanel = React.memo(
	function TimelineDashboardPanel(props: IAdLibPanelProps & IDashboardPanelProps) {
		const trackedProps = useDashboardPanelTrackedProps(props)
		if (!trackedProps.studio) return null

		return <TimelineDashboardPanelContent {...props} {...trackedProps} studio={trackedProps.studio} />
	},
	(props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
		return _.isEqual(props, nextProps)
	}
)

const TimelineDashboardPanelContent = withTranslation()(
	class TimelineDashboardPanelContent extends DashboardPanelInner {
		liveLine: HTMLDivElement | null = null
		scrollIntoViewTimeout: NodeJS.Timeout | undefined = undefined

		constructor(props: Translated<DashboardPanelInnerProps>) {
			super(props)
		}

		private setRefExt = (ref: HTMLDivElement | null) => {
			this.liveLine = ref
			this.ensureLiveLineVisible()

			this.setRef(ref)
		}
		componentDidUpdate(prevProps: IAdLibPanelProps & AdLibFetchAndFilterProps, prevState: IDashboardPanelState) {
			super.componentDidUpdate(prevProps, prevState)
			this.ensureLiveLineVisible()
		}
		componentDidMount(): void {
			super.componentDidMount?.()
			this.ensureLiveLineVisible()
		}
		private ensureLiveLineVisible = _.debounce(() => {
			if (this.liveLine) {
				this.liveLine.scrollIntoView({
					behavior: 'smooth',
					block: 'start',
					inline: 'start',
				})
			}
		}, 250)

		render(): JSX.Element | null {
			if (this.props.visible && this.props.showStyleBase && this.props.filter) {
				const filter = this.props.filter as DashboardLayoutFilter
				const uniquenessIds = new Set<string>()
				const liveSegment = this.props.uiSegments.find((i) => i.isLive)
				if (!this.props.uiSegments || !this.props.playlist) {
					return <Spinner />
				} else {
					const filteredRudownBaselineAdLibs = this.props.rundownBaselineAdLibs.filter((item) =>
						matchFilter(
							item,
							this.props.showStyleBase.sourceLayers,
							liveSegment,
							this.props.filter,
							this.state.searchFilter,
							uniquenessIds
						)
					)

					return (
						<div className="dashboard-panel dashboard-panel--timeline-style" style={dashboardElementStyle(filter)}>
							<h4 className="dashboard-panel__header">{this.props.filter.name}</h4>
							{filter.enableSearch && (
								<AdLibPanelToolbar onFilterChange={this.onFilterChange} searchFilter={this.state.searchFilter} />
							)}
							<div
								className={ClassNames('dashboard-panel__panel', {
									'dashboard-panel__panel--horizontal': filter.overflowHorizontally,
								})}
							>
								{filteredRudownBaselineAdLibs.length > 0 && (
									<div className="dashboard-panel__panel__group">
										{filteredRudownBaselineAdLibs.map((adLibListItem: AdLibPieceUi) => {
											return (
												<ContextMenuTrigger
													id="shelf-context-menu"
													collect={() =>
														setShelfContextMenuContext({
															type: ContextType.ADLIB,
															details: {
																adLib: adLibListItem,
																onToggle: !adLibListItem.disabled ? this.onToggleAdLib : undefined,
																disabled: adLibListItem.disabled,
															},
														})
													}
													playlist={this.props.playlist}
													isOnAir={this.isAdLibOnAir(adLibListItem)}
													widthScale={filter.buttonWidthScale}
													heightScale={filter.buttonHeightScale}
													displayStyle={PieceDisplayStyle.BUTTONS}
													showThumbnailsInList={filter.showThumbnailsInList}
													toggleOnSingleClick={filter.toggleOnSingleClick || this.state.singleClickMode}
													renderTag="span"
													key={unprotectString(adLibListItem._id)}
													holdToDisplay={contextMenuHoldToDisplayTime()}
												>
													<DashboardPieceButton
														key={unprotectString(adLibListItem._id)}
														piece={adLibListItem}
														studio={this.props.studio}
														layer={this.props.showStyleBase.sourceLayers[adLibListItem.sourceLayerId]}
														outputLayer={this.props.showStyleBase.outputLayers[adLibListItem.outputLayerId]}
														onToggleAdLib={this.onToggleOrSelectAdLib}
														onSelectAdLib={this.onSelectAdLib}
														isSelected={
															(this.props.selectedPiece &&
																RundownUtils.isAdLibPiece(this.props.selectedPiece) &&
																this.props.selectedPiece._id === adLibListItem._id) ||
															false
														}
														playlist={this.props.playlist}
														isOnAir={this.isAdLibOnAir(adLibListItem)}
														widthScale={filter.buttonWidthScale}
														heightScale={filter.buttonHeightScale}
														displayStyle={PieceDisplayStyle.BUTTONS}
														showThumbnailsInList={filter.showThumbnailsInList}
														toggleOnSingleClick={filter.toggleOnSingleClick || this.state.singleClickMode}
													>
														{adLibListItem.name}
													</DashboardPieceButton>
												</ContextMenuTrigger>
											)
										})}
									</div>
								)}
								{this.props.uiSegments.map((seg) => {
									const filteredPieces = seg.pieces
										? seg.pieces.filter((item) =>
												matchFilter(
													item,
													this.props.showStyleBase.sourceLayers,
													liveSegment,
													this.props.filter,
													this.state.searchFilter,
													uniquenessIds
												)
											)
										: []
									return filteredPieces.length > 0 ||
										seg.isLive ||
										(seg.isNext && !this.props.playlist.currentPartInfo) ? (
										<div
											key={unprotectString(seg._id)}
											id={'dashboard-panel__panel__group__' + seg._id}
											className={ClassNames('dashboard-panel__panel__group', {
												live: seg.isLive,
												next: seg.isNext && !this.props.playlist.currentPartInfo,
											})}
										>
											{(seg.isLive || (seg.isNext && !this.props.playlist.currentPartInfo)) && (
												<div className="dashboard-panel__panel__group__liveline" ref={this.setRefExt}></div>
											)}
											{filteredPieces.map((adLibListItem: AdLibPieceUi) => {
												return (
													<ContextMenuTrigger
														id="shelf-context-menu"
														collect={() =>
															setShelfContextMenuContext({
																type: ContextType.ADLIB,
																details: {
																	adLib: adLibListItem,
																	onToggle: !adLibListItem.disabled ? this.onToggleAdLib : undefined,
																	disabled: adLibListItem.disabled,
																},
															})
														}
														playlist={this.props.playlist}
														studio={this.props.studio}
														isOnAir={this.isAdLibOnAir(adLibListItem)}
														widthScale={filter.buttonWidthScale}
														heightScale={filter.buttonHeightScale}
														showThumbnailsInList={filter.showThumbnailsInList}
														canOverflowHorizontally={filter.overflowHorizontally}
														displayStyle={filter.displayStyle}
														toggleOnSingleClick={filter.toggleOnSingleClick || this.state.singleClickMode}
														renderTag="span"
														key={unprotectString(adLibListItem._id)}
														holdToDisplay={contextMenuHoldToDisplayTime()}
													>
														<DashboardPieceButton
															key={unprotectString(adLibListItem._id)}
															piece={adLibListItem}
															layer={this.props.showStyleBase.sourceLayers[adLibListItem.sourceLayerId]}
															outputLayer={this.props.showStyleBase.outputLayers[adLibListItem.outputLayerId]}
															onToggleAdLib={this.onToggleOrSelectAdLib}
															onSelectAdLib={this.onSelectAdLib}
															isSelected={
																(this.props.selectedPiece &&
																	RundownUtils.isAdLibPiece(this.props.selectedPiece) &&
																	this.props.selectedPiece._id === adLibListItem._id) ||
																false
															}
															playlist={this.props.playlist}
															studio={this.props.studio}
															isOnAir={this.isAdLibOnAir(adLibListItem)}
															widthScale={filter.buttonWidthScale}
															heightScale={filter.buttonHeightScale}
															showThumbnailsInList={filter.showThumbnailsInList}
															canOverflowHorizontally={filter.overflowHorizontally}
															displayStyle={filter.displayStyle}
															toggleOnSingleClick={filter.toggleOnSingleClick || this.state.singleClickMode}
														>
															{adLibListItem.name}
														</DashboardPieceButton>
													</ContextMenuTrigger>
												)
											})}
										</div>
									) : undefined
								})}
							</div>
						</div>
					)
				}
			}
			return null
		}
	}
)
