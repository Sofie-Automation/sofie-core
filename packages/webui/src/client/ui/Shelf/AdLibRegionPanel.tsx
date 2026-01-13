import * as React from 'react'
import _ from 'underscore'
import {
	RundownLayoutBase,
	RundownLayoutAdLibRegion,
	DashboardLayoutAdLibRegion,
	RundownLayoutAdLibRegionRole,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { dashboardElementStyle, IDashboardPanelTrackedProps } from './DashboardPanel.js'
import ClassNames from 'classnames'
import { IAdLibPanelProps, AdLibFetchAndFilterProps, fetchAndFilter } from './AdLibPanel.js'
import { matchFilter } from './AdLibListView.js'
import { doUserAction, UserAction } from '../../lib/clientUserAction.js'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications.js'
import { MeteorCall } from '../../lib/meteorApi.js'
import {
	AdLibPieceUi,
	getNextPieceInstancesGrouped,
	getUnfinishedPieceInstancesGrouped,
	isAdLibDisplayedAsOnAir,
	isAdLibNext,
	isAdLibOnAir,
} from '../../lib/shelf.js'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer.js'
import {
	useContentStatusForPieceInstance,
	WithMediaObjectStatusProps,
} from '../SegmentTimeline/withMediaObjectStatus.js'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { UIStudios } from '../Collections.js'
import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'

interface IState {
	objId?: string
}

interface IAdLibRegionPanelProps {
	layout: RundownLayoutBase
	panel: RundownLayoutAdLibRegion
	visible: boolean
	adlibRank?: number
}

interface IAdLibRegionPanelTrackedProps extends IDashboardPanelTrackedProps {
	piece?: PieceUi | undefined
	layer?: ISourceLayer
	isLiveLine: boolean
}

class AdLibRegionPanelBase extends React.Component<
	Translated<
		IAdLibPanelProps &
			IAdLibRegionPanelProps &
			AdLibFetchAndFilterProps &
			IAdLibRegionPanelTrackedProps &
			WithMediaObjectStatusProps
	>,
	IState
> {
	constructor(
		props: Translated<
			IAdLibPanelProps &
				IAdLibRegionPanelProps &
				AdLibFetchAndFilterProps &
				IAdLibRegionPanelTrackedProps &
				WithMediaObjectStatusProps
		>
	) {
		super(props)

		this.state = {}
	}

	private isAdLibOnAir(adLib: AdLibPieceUi) {
		return isAdLibOnAir(this.props.unfinishedAdLibIds, this.props.unfinishedTags, adLib)
	}

	private isAdLibDisplayedAsOnAir(adLib: AdLibPieceUi) {
		return isAdLibDisplayedAsOnAir(this.props.unfinishedAdLibIds, this.props.unfinishedTags, adLib)
	}

	private isAdLibNext(adLib: AdLibPieceUi) {
		return isAdLibNext(this.props.nextAdLibIds, this.props.nextTags, adLib)
	}

	private onToggleSticky = (sourceLayerId: string, e: any) => {
		if (this.props.playlist && this.props.playlist.currentPartInfo && this.props.playlist.activationId) {
			const { t } = this.props
			doUserAction(t, e, UserAction.START_STICKY_PIECE, (e, ts) =>
				MeteorCall.userAction.sourceLayerStickyPieceStart(e, ts, this.props.playlist._id, sourceLayerId)
			)
		}
	}

	private toggleAdLib(e: any, piece?: AdLibPieceUi, queueWhenOnAir?: boolean) {
		const { t } = this.props
		if (!piece) {
			return
		}

		if (piece.invalid) {
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

		const currentPartInstanceId = this.props.playlist.currentPartInfo?.partInstanceId

		if ((!this.isAdLibOnAir(piece) || queueWhenOnAir) && this.props.playlist && currentPartInstanceId) {
			if (piece.isAction && piece.adlibAction) {
				const action = piece.adlibAction
				doUserAction(t, e, piece.isGlobal ? UserAction.START_GLOBAL_ADLIB : UserAction.START_ADLIB, (e, ts) =>
					MeteorCall.userAction.executeAction(
						e,
						ts,
						this.props.playlist._id,
						action._id,
						action.actionId,
						action.userData
					)
				)
			} else if (!piece.isGlobal && !piece.isAction) {
				doUserAction(t, e, UserAction.START_ADLIB, (e, ts) =>
					MeteorCall.userAction.segmentAdLibPieceStart(
						e,
						ts,
						this.props.playlist._id,
						currentPartInstanceId,
						piece._id,
						true
					)
				)
			} else if (piece.isGlobal && !piece.isSticky) {
				doUserAction(t, e, UserAction.START_GLOBAL_ADLIB, (e, ts) =>
					MeteorCall.userAction.baselineAdLibPieceStart(
						e,
						ts,
						this.props.playlist._id,
						currentPartInstanceId,
						piece._id,
						true
					)
				)
			} else if (piece.isSticky) {
				this.onToggleSticky(piece.sourceLayerId, e)
			}
		}
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

	private onAction = (e: any, piece?: AdLibPieceUi) => {
		switch (this.props.panel.role) {
			case RundownLayoutAdLibRegionRole.QUEUE:
				this.toggleAdLib(e, piece, true)
				break
			case RundownLayoutAdLibRegionRole.TAKE:
				this.take(e)
				break
			case RundownLayoutAdLibRegionRole.PROGRAM:
				break
		}
	}

	private renderPreview() {
		const thumbnailUrl = this.props.contentStatus?.thumbnailUrl
		if (thumbnailUrl) {
			return <img src={thumbnailUrl} className="adlib-region-panel__image" />
		}
	}

	render(): JSX.Element {
		const liveSegment = this.props.uiSegments.find((i) => i.isLive === true)
		const piece =
			this.props.panel.tags && this.props.rundownBaselineAdLibs
				? this.props.rundownBaselineAdLibs
						.concat(_.flatten(this.props.uiSegments.map((seg) => seg.pieces)))
						.filter((item) => matchFilter(item, this.props.showStyleBase.sourceLayers, liveSegment, this.props.filter))[
						this.props.adlibRank ? this.props.adlibRank : 0
					]
				: undefined
		return (
			<div
				className="adlib-region-panel"
				style={{
					visibility: this.props.visible ? 'visible' : 'hidden',
					...(RundownLayoutsAPI.isDashboardLayout(this.props.layout)
						? dashboardElementStyle(this.props.panel as DashboardLayoutAdLibRegion)
						: {}),
				}}
			>
				<div
					className={ClassNames('adlib-region-panel__image-container', {
						next: piece && this.isAdLibNext(piece),
						'on-air': piece && this.isAdLibDisplayedAsOnAir(piece),
						blackout: !!this.props.piece || this.props.panel.showBlackIfNoThumbnailPiece,
					})}
				>
					<div className="adlib-region-panel__button" onClick={(e) => this.onAction(e, piece)}>
						{this.renderPreview()}
						{
							<span
								className={ClassNames('adlib-region-panel__label', {
									'adlib-region-panel__label--large': this.props.panel.labelBelowPanel,
								})}
							>
								{this.props.panel.name}
							</span>
						}
					</div>
				</div>
			</div>
		)
	}
}

function AdLibRegionPanelWithStatus(
	props: Translated<
		IAdLibPanelProps & IAdLibRegionPanelProps & AdLibFetchAndFilterProps & IAdLibRegionPanelTrackedProps
	>
) {
	const contentStatus = useContentStatusForPieceInstance(props.piece?.instance)

	return <AdLibRegionPanelBase {...props} contentStatus={contentStatus} />
}

export const AdLibRegionPanel = translateWithTracker<
	IAdLibPanelProps & IAdLibRegionPanelProps,
	IState,
	AdLibFetchAndFilterProps & IAdLibRegionPanelTrackedProps
>(
	(props: Translated<IAdLibPanelProps & IAdLibRegionPanelProps>) => {
		const studio = UIStudios.findOne(props.playlist.studioId)
		if (!studio) throw new Meteor.Error(404, 'Studio "' + props.playlist.studioId + '" not found!')

		const { unfinishedAdLibIds, unfinishedTags, unfinishedPieceInstances } = getUnfinishedPieceInstancesGrouped(
			props.playlist,
			props.showStyleBase
		)
		const { nextAdLibIds, nextTags, nextPieceInstances } = getNextPieceInstancesGrouped(
			props.playlist,
			props.showStyleBase
		)

		// Pick thumbnails to display
		const nextThumbnail: ReadonlyDeep<PieceInstance> | undefined = nextPieceInstances.find((p) =>
			props.panel.thumbnailSourceLayerIds?.includes(p.piece.sourceLayerId)
		)
		const currentThumbnail: ReadonlyDeep<PieceInstance> | undefined = !props.panel.hideThumbnailsForActivePieces
			? unfinishedPieceInstances.find((p) => props.panel.thumbnailSourceLayerIds?.includes(p.piece.sourceLayerId))
			: undefined
		const thumbnailPiece: ReadonlyDeep<PieceInstance> | undefined = props.panel.thumbnailPriorityNextPieces
			? (nextThumbnail ?? currentThumbnail)
			: (currentThumbnail ?? nextThumbnail)

		const pieceUi: PieceUi | undefined = thumbnailPiece
			? {
					instance: { ...thumbnailPiece, priority: 1 },
					renderedInPoint: null,
					renderedDuration: null,
				}
			: undefined

		const sourceLayer = thumbnailPiece && props.showStyleBase.sourceLayers[thumbnailPiece.piece.sourceLayerId]

		return Object.assign({}, fetchAndFilter(props), {
			studio,
			piece: pieceUi,
			layer: sourceLayer,
			unfinishedAdLibIds,
			unfinishedTags,
			nextAdLibIds,
			nextTags,
			isLiveLine: false,
		})
	},
	(_data, props: IAdLibPanelProps, nextProps: IAdLibPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(AdLibRegionPanelWithStatus)
