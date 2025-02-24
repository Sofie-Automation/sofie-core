import * as React from 'react'
import { ISourceLayerUi, IOutputLayerUi, PartUi, PieceUi } from './SegmentTimelineContainer'
import { SourceLayerType, PieceLifespan, IBlueprintPieceType } from '@sofie-automation/blueprints-integration'
import { RundownUtils } from '../../lib/rundown'
import { DefaultLayerItemRenderer } from './Renderers/DefaultLayerItemRenderer'
import { MicSourceRenderer } from './Renderers/MicSourceRenderer'
import { VTSourceRenderer } from './Renderers/VTSourceRenderer'
import { L3rdSourceRenderer } from './Renderers/L3rdSourceRenderer'
import { SplitsSourceRenderer } from './Renderers/SplitsSourceRenderer'
import { LocalLayerItemRenderer } from './Renderers/LocalLayerItemRenderer'

import { DEBUG_MODE } from './SegmentTimelineDebugMode'
import { withTranslation, WithTranslation } from 'react-i18next'
import { getElementDocumentOffset, OffsetPosition } from '../../utils/positions'
import { unprotectString } from '../../lib/tempLib'
import RundownViewEventBus, {
	RundownViewEvents,
	HighlightEvent,
} from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { pieceUiClassNames } from '../../lib/ui/pieceUiClassNames'
import { SourceDurationLabelAlignment } from './Renderers/CustomLayerItemRenderer'
import { TransitionSourceRenderer } from './Renderers/TransitionSourceRenderer'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { ReadonlyDeep } from 'type-fest'
import { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { SelectedElementsContext } from '../RundownView/SelectedElementsContext'
const LEFT_RIGHT_ANCHOR_SPACER = 15
const MARGINAL_ANCHORED_WIDTH = 5

export interface ISourceLayerItemProps {
	/** SourceLayer this item is on */
	layer: ISourceLayerUi
	/** Output layer the source layer belongs to */
	outputLayer: IOutputLayerUi
	/** Part containing this item */
	part: PartUi
	/** When the part starts (unix timestamp)  */
	partStartsAt: number
	/** Part definite duration (generally set after part is played) */
	partDuration: number
	/** Part expected duration (before playout) */
	partDisplayDuration: number
	/** The piece being rendered in this layer */
	piece: PieceUi
	/** The content status for the piece being rendered */
	contentStatus: ReadonlyDeep<PieceContentStatusObj> | undefined
	/** Scaling factor for this segment */
	timeScale: number
	/** Whether this part is live */
	isLiveLine: boolean
	/** Whether this part is next */
	isNextLine: boolean
	/** Seemingly always true? */
	isPreview: boolean
	/** Whether the element does not have enough width to render text */
	isTooSmallForText: boolean
	/** Callback fired when the segment tracks to the live line */
	onFollowLiveLine?: (state: boolean, event: any) => void
	/** Callback fired when the element is clicked */
	onClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	/** Callback fired when the element is double-clicked */
	onDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	/** Whether the movement of the element should follow the live line. False when the user is scrolling the segment themselves */
	followLiveLine: boolean
	/** True when we are automatically moving to the next part at the end of the allocated time */
	autoNextPart: boolean
	/** How much of the segment to show behind the live line position */
	liveLineHistorySize: number
	/** Position of the live line */
	livePosition: number | null
	/** Whether output groups are in "collapsed" mode, showing just a preview of each source layer */
	outputGroupCollapsed: boolean
	/** Amount of scroll relative to left of segment container */
	scrollLeft: number
	/** Width of element including content not visible due to overflow */
	scrollWidth: number
	/** Seemingly unused */
	liveLinePadding: number
	/** Index of this source layer in an array of sorted sourcelayers (generally sorted by rank) */
	layerIndex: number
	/** The studio this content belongs to */
	studio: UIStudio | undefined
	/** If source duration of piece's content should be displayed next to any labels */
	showDuration?: boolean
}
interface ISourceLayerItemState {
	/** Whether hover-scrub / inspector is shown */
	showMiniInspector: boolean
	/** Element position relative to document top-left */
	elementPosition: OffsetPosition
	/** Cursor position relative to element */
	cursorPosition: OffsetPosition
	/** Cursor position relative to entire viewport */
	cursorRawPosition: { clientX: number; clientY: number }
	/** Timecode under cursor */
	cursorTimePosition: number
	/** A reference to this element (&self) */
	itemElement: HTMLDivElement | null
	/** Width of the child element anchored to the left side of this element */
	leftAnchoredWidth: number
	/** Width of the child element anchored to the right side of this element */
	rightAnchoredWidth: number
	/** Set to `true` when the segment is "highlighted" (in focus, generally from a scroll event) */
	highlight: boolean
}

export const SourceLayerItem = withTranslation()(
	class SourceLayerItem extends React.Component<
		ISourceLayerItemProps & WithTranslation & ISourceLayerItemProps,
		ISourceLayerItemState
	> {
		animFrameHandle: number | undefined

		constructor(props: ISourceLayerItemProps & WithTranslation & ISourceLayerItemProps) {
			super(props)
			this.state = {
				showMiniInspector: false,
				elementPosition: {
					top: 0,
					left: 0,
				},
				cursorPosition: {
					top: 0,
					left: 0,
				},
				cursorRawPosition: {
					clientX: 0,
					clientY: 0,
				},
				cursorTimePosition: 0,
				itemElement: null,
				leftAnchoredWidth: 0,
				rightAnchoredWidth: 0,
				highlight: false,
			}
		}

		setRef = (e: HTMLDivElement) => {
			this.setState({
				itemElement: e,
			})
		}

		convertTimeToPixels = (time: number) => {
			return Math.round(this.props.timeScale * time)
		}

		private getSourceDurationLabelAlignment = (): SourceDurationLabelAlignment => {
			if (this.props.part && this.props.partStartsAt !== undefined && !this.props.isLiveLine) {
				const elementWidth = this.getElementAbsoluteWidth()
				return this.state.leftAnchoredWidth + this.state.rightAnchoredWidth > elementWidth - 10 ? 'left' : 'right'
			}
			return 'right'
		}

		getItemLabelOffsetLeft = (): React.CSSProperties => {
			const maxLabelWidth = this.props.piece.maxLabelWidth

			if (this.props.part && this.props.partStartsAt !== undefined) {
				//  && this.props.piece.renderedInPoint !== undefined && this.props.piece.renderedDuration !== undefined
				const piece = this.props.piece

				const inPoint = piece.renderedInPoint || 0
				const duration = Number.isFinite(piece.renderedDuration || 0)
					? piece.renderedDuration || this.props.partDuration || this.props.part.renderedDuration || 0
					: this.props.partDuration || this.props.part.renderedDuration || 0

				const elementWidth = this.getElementAbsoluteWidth()

				const widthConstrictedMode =
					this.props.isTooSmallForText ||
					(this.state.leftAnchoredWidth > 0 &&
						this.state.rightAnchoredWidth > 0 &&
						this.state.leftAnchoredWidth + this.state.rightAnchoredWidth > elementWidth)

				const nextIsTouching = !!piece.cropped

				if (this.props.followLiveLine && this.props.isLiveLine) {
					const liveLineHistoryWithMargin = this.props.liveLineHistorySize - 10
					if (
						this.props.scrollLeft + liveLineHistoryWithMargin / this.props.timeScale >
							inPoint + this.props.partStartsAt + this.state.leftAnchoredWidth / this.props.timeScale &&
						this.props.scrollLeft + liveLineHistoryWithMargin / this.props.timeScale <
							inPoint + duration + this.props.partStartsAt
					) {
						const targetPos = this.convertTimeToPixels(this.props.scrollLeft - inPoint - this.props.partStartsAt)

						return {
							maxWidth:
								this.state.rightAnchoredWidth > 0
									? (elementWidth - this.state.rightAnchoredWidth).toString() + 'px'
									: maxLabelWidth !== undefined
									? this.convertTimeToPixels(maxLabelWidth).toString() + 'px'
									: nextIsTouching
									? '100%'
									: 'none',
							transform:
								'translate(' +
								(widthConstrictedMode
									? targetPos
									: Math.min(targetPos, elementWidth - this.state.rightAnchoredWidth - liveLineHistoryWithMargin - 10)
								).toString() +
								'px, 0) ' +
								'translate(' +
								liveLineHistoryWithMargin.toString() +
								'px, 0) ' +
								'translate(-100%, 0)',
							willChange: 'transform',
						}
					} else if (
						this.state.rightAnchoredWidth < elementWidth &&
						this.state.leftAnchoredWidth < elementWidth &&
						this.props.scrollLeft + liveLineHistoryWithMargin / this.props.timeScale >=
							inPoint + duration + this.props.partStartsAt
					) {
						const targetPos = this.convertTimeToPixels(this.props.scrollLeft - inPoint - this.props.partStartsAt)

						return {
							maxWidth:
								this.state.rightAnchoredWidth > 0
									? (elementWidth - this.state.rightAnchoredWidth).toString() + 'px'
									: maxLabelWidth !== undefined
									? this.convertTimeToPixels(maxLabelWidth).toString() + 'px'
									: nextIsTouching
									? '100%'
									: 'none',
							transform:
								'translate(' +
								Math.min(
									targetPos,
									elementWidth - this.state.rightAnchoredWidth - liveLineHistoryWithMargin - 10
								).toString() +
								'px, 0) ' +
								'translate(' +
								liveLineHistoryWithMargin.toString() +
								'px, 0) ' +
								'translate3d(-100%, 0)',
							willChange: 'transform',
						}
					} else {
						return {
							maxWidth:
								this.state.rightAnchoredWidth > 0
									? (elementWidth - this.state.rightAnchoredWidth - 10).toString() + 'px'
									: maxLabelWidth !== undefined
									? this.convertTimeToPixels(maxLabelWidth).toString() + 'px'
									: nextIsTouching
									? '100%'
									: 'none',
						}
					}
				} else {
					if (
						this.props.scrollLeft > inPoint + this.props.partStartsAt &&
						this.props.scrollLeft < inPoint + duration + this.props.partStartsAt
					) {
						const targetPos = this.convertTimeToPixels(this.props.scrollLeft - inPoint - this.props.partStartsAt)

						return {
							maxWidth:
								this.state.rightAnchoredWidth > 0
									? (elementWidth - this.state.rightAnchoredWidth - 10).toString() + 'px'
									: maxLabelWidth !== undefined
									? this.convertTimeToPixels(maxLabelWidth).toString() + 'px'
									: nextIsTouching
									? '100%'
									: 'none',
							transform:
								'translate(' +
								(widthConstrictedMode || this.state.leftAnchoredWidth === 0 || this.state.rightAnchoredWidth === 0
									? targetPos
									: Math.min(targetPos, elementWidth - this.state.leftAnchoredWidth - this.state.rightAnchoredWidth)
								).toString() +
								'px,  0)',
						}
					} else {
						return {
							maxWidth:
								this.state.rightAnchoredWidth > 0
									? (elementWidth - this.state.rightAnchoredWidth - 10).toString() + 'px'
									: maxLabelWidth !== undefined
									? this.convertTimeToPixels(maxLabelWidth).toString() + 'px'
									: nextIsTouching
									? '100%'
									: 'none',
						}
					}
				}
			}
			return {}
		}

		getItemLabelOffsetRight = (): React.CSSProperties => {
			if (!this.props.part || this.props.partStartsAt === undefined) return {}

			const piece = this.props.piece
			const innerPiece = piece.instance.piece

			const inPoint = piece.renderedInPoint || 0
			const duration =
				innerPiece.lifespan !== PieceLifespan.WithinPart || piece.renderedDuration === 0
					? this.props.partDuration - inPoint
					: Math.min(piece.renderedDuration || 0, this.props.partDuration - inPoint)
			const outPoint = inPoint + duration

			const elementWidth = this.getElementAbsoluteWidth()

			// const widthConstrictedMode = this.state.leftAnchoredWidth > 0 && this.state.rightAnchoredWidth > 0 && ((this.state.leftAnchoredWidth + this.state.rightAnchoredWidth) > this.state.elementWidth)

			if (
				this.props.scrollLeft + this.props.scrollWidth < outPoint + this.props.partStartsAt &&
				this.props.scrollLeft + this.props.scrollWidth > inPoint + this.props.partStartsAt
			) {
				const targetPos = Math.max(
					(this.props.scrollLeft + this.props.scrollWidth - outPoint - this.props.partStartsAt) * this.props.timeScale,
					(elementWidth - this.state.leftAnchoredWidth - this.state.rightAnchoredWidth - LEFT_RIGHT_ANCHOR_SPACER) * -1
				)

				return {
					transform: 'translate(' + targetPos.toString() + 'px,  0)',
				}
			}
			return {}
		}

		getItemDuration = (returnInfinite?: boolean): number => {
			const piece = this.props.piece
			const innerPiece = piece.instance.piece

			const expectedDurationNumber =
				typeof innerPiece.enable.duration === 'number' ? innerPiece.enable.duration || 0 : 0

			let itemDuration: number
			if (!returnInfinite) {
				itemDuration = Math.min(
					piece.renderedDuration || expectedDurationNumber || 0,
					this.props.partDuration - (piece.renderedInPoint || 0)
				)
			} else {
				itemDuration =
					this.props.partDuration - (piece.renderedInPoint || 0) <
					(piece.renderedDuration || expectedDurationNumber || 0)
						? Number.POSITIVE_INFINITY
						: piece.renderedDuration || expectedDurationNumber || 0
			}

			if (
				(innerPiece.lifespan !== PieceLifespan.WithinPart ||
					(innerPiece.enable.start !== undefined &&
						innerPiece.enable.duration === undefined &&
						piece.instance.userDuration === undefined)) &&
				!piece.cropped &&
				piece.renderedDuration === null &&
				piece.instance.userDuration === undefined
			) {
				if (!returnInfinite) {
					itemDuration = this.props.partDuration - (piece.renderedInPoint || 0)
				} else {
					itemDuration = Number.POSITIVE_INFINITY
				}
			}

			return itemDuration
		}

		getElementAbsoluteWidth(): number {
			const itemDuration = this.getItemDuration()
			return this.convertTimeToPixels(itemDuration)
		}

		getElementAbsoluteStyleWidth(): string {
			const renderedInPoint = this.props.piece.renderedInPoint
			if (renderedInPoint === 0) {
				const itemPossiblyInfiniteDuration = this.getItemDuration(true)
				if (!Number.isFinite(itemPossiblyInfiniteDuration)) {
					return '100%'
				}
			}
			const itemDuration = this.getItemDuration(false)
			return this.convertTimeToPixels(itemDuration).toString() + 'px'
		}

		getItemStyle(): { [key: string]: string } {
			const piece = this.props.piece
			const innerPiece = piece.instance.piece

			// If this is a live line, take duration verbatim from SegmentLayerItemContainer with a fallback on expectedDuration.
			// If not, as-run part "duration" limits renderdDuration which takes priority over MOS-import
			// expectedDuration (editorial duration)

			// let liveLinePadding = this.props.autoNextPart ? 0 : (this.props.isLiveLine ? this.props.liveLinePadding : 0)

			if (innerPiece.pieceType === IBlueprintPieceType.OutTransition) {
				return {
					left: 'auto',
					right: '0',
					width: this.getElementAbsoluteWidth().toString() + 'px',
				}
			}
			return {
				left: this.convertTimeToPixels(piece.renderedInPoint || 0).toString() + 'px',
				width: this.getElementAbsoluteStyleWidth(),
			}
		}

		// TODO(Performance): use ResizeObserver to avoid style recalculations
		// checkElementWidth = () => {
		// 	if (this.state.itemElement && this._forceSizingRecheck) {
		// 		this._forceSizingRecheck = false
		// 		const width = getElementWidth(this.state.itemElement) || 0
		// 		if (this.state.elementWidth !== width) {
		// 			this.setState({
		// 				elementWidth: width
		// 			})
		// 		}
		// 	}
		// }

		private highlightTimeout: NodeJS.Timeout | undefined

		private onHighlight = (e: HighlightEvent) => {
			if (
				e.partId === this.props.part.partId &&
				(e.pieceId === this.props.piece.instance.piece._id || e.pieceId === this.props.piece.instance._id)
			) {
				this.setState({
					highlight: true,
				})
				clearTimeout(this.highlightTimeout)
				this.highlightTimeout = setTimeout(() => {
					this.setState({
						highlight: false,
					})
				}, 5000)
			}
		}

		componentDidMount(): void {
			RundownViewEventBus.on(RundownViewEvents.HIGHLIGHT, this.onHighlight)
		}

		componentWillUnmount(): void {
			super.componentWillUnmount && super.componentWillUnmount()
			RundownViewEventBus.off(RundownViewEvents.HIGHLIGHT, this.onHighlight)
			clearTimeout(this.highlightTimeout)
		}

		componentDidUpdate(prevProps: ISourceLayerItemProps, _prevState: ISourceLayerItemState) {
			if (this.state.showMiniInspector) {
				if (prevProps.scrollLeft !== this.props.scrollLeft) {
					const cursorPosition = {
						left: this.state.cursorRawPosition.clientX - this.state.elementPosition.left,
						top: this.state.cursorRawPosition.clientY - this.state.elementPosition.top,
					}
					const cursorTimePosition = Math.max(cursorPosition.left, 0) / this.props.timeScale
					if (this.state.cursorTimePosition !== cursorTimePosition) {
						this.setState({
							cursorTimePosition,
						})
					}
				}
			}
		}

		itemClick = (e: React.MouseEvent<HTMLDivElement>) => {
			// this.props.onFollowLiveLine && this.props.onFollowLiveLine(false, e)
			e.preventDefault()
			e.stopPropagation()
			this.props.onClick && this.props.onClick(this.props.piece, e)
		}

		itemDblClick = (e: React.MouseEvent<HTMLDivElement>) => {
			e.preventDefault()
			e.stopPropagation()

			if (typeof this.props.onDoubleClick === 'function') {
				this.props.onDoubleClick(this.props.piece, e)
			}
		}

		itemMouseUp = (e: any) => {
			const eM = e as MouseEvent
			if (eM.ctrlKey === true) {
				eM.preventDefault()
				eM.stopPropagation()
			}
			return
		}

		toggleMiniInspectorOn = (e: React.MouseEvent) => this.toggleMiniInspector(e, true)
		toggleMiniInspectorOff = (e: React.MouseEvent) => this.toggleMiniInspector(e, false)

		toggleMiniInspector = (e: MouseEvent | any, v: boolean) => {
			this.setState({
				showMiniInspector: v,
				cursorRawPosition: {
					clientX: e.clientX,
					clientY: e.clientY,
				},
			})

			if (v) {
				const updatePos = () => {
					const elementPos = getElementDocumentOffset(this.state.itemElement) || {
						top: 0,
						left: 0,
					}
					const cursorPosition = {
						left: this.state.cursorRawPosition.clientX - elementPos.left,
						top: this.state.cursorRawPosition.clientY - elementPos.top,
					}

					const cursorTimePosition = Math.max(cursorPosition.left, 0) / this.props.timeScale

					this.setState({
						elementPosition: elementPos,
						cursorPosition,
						cursorTimePosition,
					})
					this.animFrameHandle = requestAnimationFrame(updatePos)
				}
				this.animFrameHandle = requestAnimationFrame(updatePos)
			} else if (this.animFrameHandle !== undefined) {
				cancelAnimationFrame(this.animFrameHandle)
			}
		}

		moveMiniInspector = (e: MouseEvent | any) => {
			this.setState({
				cursorRawPosition: {
					clientX: e.clientX,
					clientY: e.clientY,
				},
			})
		}

		setAnchoredElsWidths = (leftAnchoredWidth: number, rightAnchoredWidth: number) => {
			// anchored labels will sometimes errorneously report some width. Discard if it's marginal.
			this.setState({
				leftAnchoredWidth: leftAnchoredWidth > MARGINAL_ANCHORED_WIDTH ? leftAnchoredWidth : 0,
				rightAnchoredWidth: rightAnchoredWidth > MARGINAL_ANCHORED_WIDTH ? rightAnchoredWidth : 0,
			})
		}

		renderInsideItem(typeClass: string) {
			switch (this.props.layer.type) {
				case SourceLayerType.SCRIPT:
					// case SourceLayerType.MIC:
					return (
						<MicSourceRenderer
							key={unprotectString(this.props.piece.instance._id)}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					)
				case SourceLayerType.VT:
				case SourceLayerType.LIVE_SPEAK:
					return (
						<VTSourceRenderer
							key={unprotectString(this.props.piece.instance._id)}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getSourceDurationLabelAlignment={this.getSourceDurationLabelAlignment}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					)
				case SourceLayerType.GRAPHICS:
				case SourceLayerType.LOWER_THIRD:
				case SourceLayerType.STUDIO_SCREEN:
					return (
						<L3rdSourceRenderer
							key={unprotectString(this.props.piece.instance._id)}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					)
				case SourceLayerType.SPLITS:
					return (
						<SplitsSourceRenderer
							key={unprotectString(this.props.piece.instance._id)}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					)

				case SourceLayerType.TRANSITION:
					// TODOSYNC: TV2 uses other renderers, to be discussed.

					return (
						<TransitionSourceRenderer
							key={unprotectString(this.props.piece.instance._id)}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					)
				case SourceLayerType.LOCAL:
					return (
						<LocalLayerItemRenderer
							key={unprotectString(this.props.piece.instance._id)}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					)
				default:
					return (
						<DefaultLayerItemRenderer
							key={unprotectString(this.props.piece.instance._id)}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getSourceDurationLabelAlignment={this.getSourceDurationLabelAlignment}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					)
			}
		}

		isInsideViewport() {
			return RundownUtils.isInsideViewport(
				this.props.scrollLeft,
				this.props.scrollWidth,
				this.props.part,
				this.props.partStartsAt,
				this.props.partDuration,
				this.props.piece
			)
		}

		render(): JSX.Element {
			if (this.isInsideViewport()) {
				const typeClass = RundownUtils.getSourceLayerClassName(this.props.layer.type)

				const piece = this.props.piece
				const innerPiece = piece.instance.piece

				const elementWidth = this.getElementAbsoluteWidth()

				return (
					<SelectedElementsContext.Consumer>
						{(selectElementContext) => (
							<div
								className={pieceUiClassNames(
									piece,
									this.props.contentStatus,
									'segment-timeline__piece',
									selectElementContext.isSelected(this.props.piece.instance.piece._id) ||
										selectElementContext.isSelected(this.props.part.instance.part._id),
									this.props.layer.type,
									this.props.part.partId,
									this.state.highlight,
									elementWidth,
									this.state
								)}
								data-obj-id={piece.instance._id}
								ref={this.setRef}
								onClick={this.itemClick}
								onDoubleClick={(e) => {
									if (
										this.props.studio?.settings.enableUserEdits &&
										!this.props.studio?.settings.allowPieceDirectPlay
									) {
										const pieceId = this.props.piece.instance.piece._id
										if (!selectElementContext.isSelected(pieceId)) {
											selectElementContext.clearAndSetSelection({ type: 'piece', elementId: pieceId })
										} else {
											selectElementContext.clearSelections()
										}
										// Until a proper data structure, the only reference is a part.
										// const partId = this.props.part.instance.part._id
										// if (!selectElementContext.isSelected(partId)) {
										// 	selectElementContext.clearAndSetSelection({ type: 'part', elementId: partId })
										// } else {
										// 	selectElementContext.clearSelections()
										// }
									} else {
										this.itemDblClick(e)
									}
								}}
								onMouseUp={this.itemMouseUp}
								onMouseMove={this.moveMiniInspector}
								onMouseEnter={this.toggleMiniInspectorOn}
								onMouseLeave={this.toggleMiniInspectorOff}
								style={this.getItemStyle()}
							>
								{this.renderInsideItem(typeClass)}
								{DEBUG_MODE && this.props.studio && (
									<div className="segment-timeline__debug-info">
										{innerPiece.enable.start} /{' '}
										{RundownUtils.formatTimeToTimecode(this.props.studio.settings, this.props.partDuration).substr(-5)}{' '}
										/{' '}
										{piece.renderedDuration
											? RundownUtils.formatTimeToTimecode(this.props.studio.settings, piece.renderedDuration).substr(-5)
											: 'X'}{' '}
										/{' '}
										{typeof innerPiece.enable.duration === 'number'
											? RundownUtils.formatTimeToTimecode(
													this.props.studio.settings,
													innerPiece.enable.duration
											  ).substr(-5)
											: ''}
									</div>
								)}
							</div>
						)}
					</SelectedElementsContext.Consumer>
				)
			} else {
				// render a placeholder
				return (
					<div
						className="segment-timeline__piece"
						data-obj-id={this.props.piece.instance._id}
						ref={this.setRef}
						style={this.getItemStyle()}
					></div>
				)
			}
		}
	}
)
