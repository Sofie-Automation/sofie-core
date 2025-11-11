import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import ClassNames from 'classnames'
import { RundownUtils } from '../../lib/rundown.js'
import { ISourceLayer, IOutputLayer, SourceLayerType, VTContent } from '@sofie-automation/blueprints-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { IAdLibListItem } from './AdLibListItem.js'
import SplitInputIcon from '../PieceIcons/Renderers/SplitInputIcon.js'
import { PieceDisplayStyle } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { DashboardPieceButtonSplitPreview } from './DashboardPieceButtonSplitPreview.js'
import { StyledTimecode } from '../../lib/StyledTimecode.js'
import { useContentStatusForAdlibPiece, WithMediaObjectStatusProps } from '../SegmentTimeline/withMediaObjectStatus.js'

import { isTouchDevice } from '../../lib/lib.js'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import {
	convertSourceLayerItemToPreview,
	IPreviewPopUpContext,
	IPreviewPopUpSession,
	PreviewPopUpContext,
} from '../PreviewPopUp/PreviewPopUpContext.js'

export interface IDashboardButtonProps {
	piece: IAdLibListItem
	studio: UIStudio
	layer?: ISourceLayer
	outputLayer?: IOutputLayer
	onToggleAdLib: (aSLine: IAdLibListItem, queue: boolean, context: React.SyntheticEvent) => void
	onSelectAdLib: (aSLine: IAdLibListItem, context: React.SyntheticEvent) => void
	playlist: DBRundownPlaylist
	isOnAir?: boolean
	isNext?: boolean
	widthScale?: number
	heightScale?: number
	disabled?: boolean
	displayStyle: PieceDisplayStyle
	isSelected?: boolean
	queueAllAdlibs?: boolean
	showThumbnailsInList?: boolean
	disableHoverInspector?: boolean
	editableName?: boolean
	onNameChanged?: (e: any, value: string) => void
	toggleOnSingleClick?: boolean
	canOverflowHorizontally?: boolean
	lineBreak?: string
}
interface WithPreviewContext {
	previewContext: IPreviewPopUpContext
}
export const DEFAULT_BUTTON_WIDTH = 6.40625
export const DEFAULT_BUTTON_HEIGHT = 5.625
export const HOVER_TIMEOUT = 5000

interface IState {
	label: string
	isHovered: boolean
	timePosition: number
	active: boolean
}

export class DashboardPieceButtonBase<T = {}> extends React.Component<
	React.PropsWithChildren<IDashboardButtonProps> & T & WithMediaObjectStatusProps & WithPreviewContext,
	IState
> {
	private element: HTMLDivElement | null = null
	/** positionAndSize needs to be in document coordinate space */
	private positionAndSize: {
		top: number
		left: number
		width: number
		height: number
	} | null = null
	private _labelEl: HTMLTextAreaElement | null = null
	private pointerId: number | null = null
	private hoverTimeout: number | null = null
	protected inBucket = false
	private previewSession: IPreviewPopUpSession | null = null

	constructor(props: IDashboardButtonProps & T & WithMediaObjectStatusProps & WithPreviewContext) {
		super(props)

		this.state = {
			isHovered: false,
			timePosition: 0,
			label: this.props.piece.name,
			active: false,
		}
	}

	componentDidUpdate(prevProps: IDashboardButtonProps & T): void {
		if (prevProps.piece.name !== this.props.piece.name) {
			this.setState({
				label: this.props.piece.name,
			})
		}
	}

	componentWillUnmount(): void {
		if (this.hoverTimeout) {
			clearTimeout(this.hoverTimeout)
			this.hoverTimeout = null
		}
	}

	private renderVTLiveSpeak(renderThumbnail?: boolean) {
		const thumbnailUrl = this.props.contentStatus?.thumbnailUrl
		const vtContent = this.props.piece.content as VTContent | undefined
		const sourceDuration = vtContent?.sourceDuration

		return (
			<>
				{sourceDuration && (
					<span className="dashboard-panel__panel__button__sub-label">
						{sourceDuration ? (
							<StyledTimecode time={sourceDuration || 0} studioSettings={this.props.studio?.settings} />
						) : null}
					</span>
				)}
				{thumbnailUrl && renderThumbnail && (
					<div className="dashboard-panel__panel__button__thumbnail">
						<img src={thumbnailUrl} />
					</div>
				)}
			</>
		)
	}

	private renderSplits(renderThumbnail = false) {
		const splitAdLib = this.props.piece
		if (splitAdLib?.content) {
			return (
				<>
					{renderThumbnail ? (
						<DashboardPieceButtonSplitPreview piece={splitAdLib} />
					) : (
						<SplitInputIcon
							abbreviation={this.props.layer ? this.props.layer.abbreviation : undefined}
							piece={splitAdLib}
							hideLabel={true}
						/>
					)}
				</>
			)
		}
	}

	private setRef = (el: HTMLDivElement | null) => {
		this.element = el
	}

	private handleOnMouseEnter = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
		if (this.element) {
			const { top, left, width, height } = this.element.getBoundingClientRect()
			this.positionAndSize = {
				top: window.scrollY + top,
				left: window.scrollX + left,
				width,
				height,
			}
		}

		const { contents: previewContents, options: previewOptions } = convertSourceLayerItemToPreview(
			this.props.layer?.type,
			this.props.piece,
			this.props.contentStatus
		)

		if (!previewContents.length) return

		this.previewSession = this.props.previewContext.requestPreview(e.target as any, previewContents, {
			...previewOptions,
			time: this.state.timePosition,
		})
	}

	private handleOnMouseLeave = (_e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
		this.setState({ isHovered: false })
		this.positionAndSize = null

		if (this.previewSession) {
			this.previewSession.close()
			this.previewSession = null
		}
	}

	private handleOnPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
		if (this.element) {
			const { top, left, width, height } = this.element.getBoundingClientRect()
			this.positionAndSize = {
				top: window.scrollY + top,
				left: window.scrollX + left,
				width,
				height,
			}
		}
		if (e.pointerType === 'mouse') {
			this.startHoverTimeout()

			const { contents: previewContents, options: previewOptions } = convertSourceLayerItemToPreview(
				this.props.layer?.type,
				this.props.piece,
				this.props.contentStatus
			)

			if (!previewContents.length) return

			this.previewSession = this.props.previewContext.requestPreview(e.target as any, previewContents, {
				...previewOptions,
				time: this.state.timePosition,
			})
		}
	}

	private handleOnPointerLeave = (_e: React.PointerEvent<HTMLDivElement>) => {
		this.setState({ isHovered: false })
		if (this.hoverTimeout) {
			Meteor.clearTimeout(this.hoverTimeout)
			this.hoverTimeout = null
		}
		this.positionAndSize = null

		if (this.previewSession) {
			this.previewSession.close()
			this.previewSession = null
		}
	}

	private handleOnMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		this.handleMove(e.clientX)
	}

	private handleOnTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
		if (e.changedTouches && e.changedTouches.length > 0) {
			this.handleMove(e.changedTouches[0].clientX)
		}
	}

	private handleMove = (clientX: number) => {
		const timePercentage = Math.max(
			0,
			Math.min((clientX - (this.positionAndSize?.left || 0) - 5) / ((this.positionAndSize?.width || 1) - 10), 1)
		)
		const sourceDuration = (this.props.piece.content as VTContent | undefined)?.sourceDuration || 0
		this.setState({
			timePosition: timePercentage * sourceDuration,
		})
		if (this.hoverTimeout) {
			Meteor.clearTimeout(this.hoverTimeout)
			this.startHoverTimeout()
		}
		if (this.previewSession) {
			this.previewSession.setPointerTime(timePercentage * sourceDuration)
		}
	}

	private startHoverTimeout = () => {
		this.hoverTimeout = Meteor.setTimeout(() => {
			this.hoverTimeout = null
			this.setState({ isHovered: false })
		}, HOVER_TIMEOUT)
	}

	private onNameChanged = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		this.setState({
			label: e.currentTarget.value || '',
		})
	}

	private onRenameTextBoxKeyUp = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			this.setState(
				{
					label: this.props.piece.name,
				},
				() => {
					this._labelEl?.blur()
				}
			)
			e.preventDefault()
			e.stopPropagation()
			e.stopImmediatePropagation()
		} else if (e.key === 'Enter') {
			this._labelEl?.blur()
			e.preventDefault()
			e.stopPropagation()
			e.stopImmediatePropagation()
		}
	}

	private onRenameTextBoxBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
		if (!this.state.label.trim()) {
			e.persist()
			this.setState(
				{
					label: this.props.piece.name,
				},
				() => {
					this.props.onNameChanged?.(e, this.state.label)
				}
			)
		} else {
			this.props.onNameChanged?.(e, this.state.label)
		}
	}

	private renameTextBoxFocus = (input: HTMLTextAreaElement) => {
		input.focus()
		input.setSelectionRange(0, input.value.length)
	}

	private onRenameTextBoxShow = (ref: HTMLTextAreaElement | null) => {
		if (ref && !this._labelEl) {
			ref.addEventListener('keyup', this.onRenameTextBoxKeyUp)
			this.renameTextBoxFocus(ref)
		}
		this._labelEl = ref
	}

	private handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		const { toggleOnSingleClick } = this.props
		// if pointerId is not set, it means we are dealing with a mouse and not an emulated mouse event
		if (this.pointerId !== null || e.button !== 0) {
			return
		}
		// this is a main-button-click
		if (toggleOnSingleClick) {
			this.props.onToggleAdLib(this.props.piece, e.shiftKey || !!this.props.queueAllAdlibs, e)
		} else {
			this.props.onSelectAdLib(this.props.piece, e)
		}
	}

	private handleOnMouseDown = (e: React.PointerEvent<HTMLDivElement>) => {
		// if mouseDown event is fired, that means that pointerDown did not fire, which means we are dealing with a mouse
		this.pointerId = null
		if (e.button) {
			// this is some other button, main button is 0
			this.props.onSelectAdLib(this.props.piece, e)
		}
		if (isTouchDevice()) {
			// hide the hoverscrub
			this.handleOnPointerLeave(e)
		}
	}

	private handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		const { toggleOnSingleClick } = this.props
		if (toggleOnSingleClick) {
			return
		}
		this.props.onToggleAdLib(this.props.piece, e.shiftKey || !!this.props.queueAllAdlibs, e)
	}

	private handleOnPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			const pointerCopy = e.pointerId
			this.pointerId = pointerCopy
		} else {
			this.pointerId = null
		}
	}

	private handleOnPointerOut = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerId === this.pointerId) {
			this.pointerId = null
		}
	}

	private handleOnPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
		const { toggleOnSingleClick } = this.props
		if (e.pointerType === 'mouse' || e.pointerId === null || e.pointerId !== this.pointerId) {
			return
		}
		if (!toggleOnSingleClick) {
			this.props.onToggleAdLib(this.props.piece, e.shiftKey || !!this.props.queueAllAdlibs, e)
		}
		e.preventDefault()
	}

	private renderHotkey = () => {
		if (this.props.piece.hotkey) {
			return <div className="dashboard-panel__panel__button__hotkey">{this.props.piece.hotkey}</div>
		}
	}

	render(): JSX.Element {
		const isList = this.props.displayStyle === PieceDisplayStyle.LIST
		const isButtons = this.props.displayStyle === PieceDisplayStyle.BUTTONS
		return (
			<div
				className={ClassNames(
					'dashboard-panel__panel__button',
					{
						invalid: this.props.piece.invalid,
						floated: this.props.piece.floated,
						active: this.state.active,
						live: this.props.isOnAir,
						disabled: this.props.disabled,
						list: isList,
						selected: this.props.isNext || this.props.isSelected,
					},
					!this.inBucket && this.props.layer && RundownUtils.getSourceLayerClassName(this.props.layer.type),
					RundownUtils.getPieceStatusClassName(this.props.contentStatus?.status),
					...(this.props.piece.tags ? this.props.piece.tags.map((tag) => `piece-tag--${tag}`) : [])
				)}
				style={{
					width: isList
						? 'calc(100% - 8px)'
						: this.props.widthScale
							? (this.props.widthScale as number) * DEFAULT_BUTTON_WIDTH + 'em'
							: undefined,
					height:
						!isList && !!this.props.heightScale
							? (this.props.heightScale as number) * DEFAULT_BUTTON_HEIGHT + 'em'
							: undefined,
				}}
				onClick={this.handleClick}
				onDoubleClick={this.handleDoubleClick}
				ref={this.setRef}
				onMouseDown={this.handleOnMouseDown}
				onPointerEnter={this.handleOnPointerEnter}
				onPointerLeave={this.handleOnPointerLeave}
				onMouseMove={this.handleOnMouseMove}
				onPointerDown={this.handleOnPointerDown}
				onPointerOut={this.handleOnPointerOut}
				onPointerUp={this.handleOnPointerUp}
				onTouchStart={!this.props.canOverflowHorizontally ? this.handleOnMouseEnter : undefined}
				onTouchEnd={!this.props.canOverflowHorizontally ? this.handleOnMouseLeave : undefined}
				onTouchMove={!this.props.canOverflowHorizontally ? this.handleOnTouchMove : undefined}
				data-obj-id={this.props.piece._id}
			>
				<div className="dashboard-panel__panel__button__content">
					{this.props.disableHoverInspector || !this.props.layer
						? null
						: this.props.layer.type === SourceLayerType.VT || this.props.layer.type === SourceLayerType.LIVE_SPEAK
							? // VT should have thumbnails in "Button" layout.
								this.renderVTLiveSpeak(isButtons || (isList && this.props.showThumbnailsInList))
							: this.props.layer.type === SourceLayerType.SPLITS
								? this.renderSplits(isList && this.props.showThumbnailsInList)
								: null}

					{this.renderHotkey()}
					<div className="dashboard-panel__panel__button__label-container">
						{this.inBucket && (
							<div
								className={ClassNames(
									'dashboard-panel__panel__button__tag-container',
									this.props.layer && RundownUtils.getSourceLayerClassName(this.props.layer.type)
								)}
							>
								&nbsp;
							</div>
						)}
						{this.props.editableName ? (
							<textarea
								className="dashboard-panel__panel__button__label dashboard-panel__panel__button__label--editable"
								value={this.state.label}
								onChange={this.onNameChanged}
								onBlur={this.onRenameTextBoxBlur}
								ref={this.onRenameTextBoxShow}
							></textarea>
						) : (
							<div className="dashboard-panel__panel__button__label">{this.state.label}</div>
						)}
					</div>
				</div>
			</div>
		)
	}
}

export function DashboardPieceButton(props: React.PropsWithChildren<IDashboardButtonProps>): JSX.Element {
	const contentStatus = useContentStatusForAdlibPiece(props.piece)
	const previewContext = React.useContext(PreviewPopUpContext)

	return <DashboardPieceButtonBase {...props} contentStatus={contentStatus} previewContext={previewContext} />
}
