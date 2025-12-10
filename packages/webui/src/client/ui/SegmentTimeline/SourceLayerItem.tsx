import * as React from 'react'
import { ISourceLayerUi, IOutputLayerUi, PartUi, PieceUi } from './SegmentTimelineContainer.js'
import {
	SourceLayerType,
	PieceLifespan,
	IBlueprintPieceType,
	UserEditingType,
	DefaultUserOperationsTypes,
} from '@sofie-automation/blueprints-integration'
import { RundownUtils } from '../../lib/rundown.js'
import { DefaultLayerItemRenderer } from './Renderers/DefaultLayerItemRenderer.js'
import { MicSourceRenderer } from './Renderers/MicSourceRenderer.js'
import { VTSourceRenderer } from './Renderers/VTSourceRenderer.js'
import { L3rdSourceRenderer } from './Renderers/L3rdSourceRenderer.js'
import { SplitsSourceRenderer } from './Renderers/SplitsSourceRenderer.js'
import { LocalLayerItemRenderer } from './Renderers/LocalLayerItemRenderer.js'

import { DEBUG_MODE } from './SegmentTimelineDebugMode.js'
import { getElementDocumentOffset, OffsetPosition } from '../../utils/positions.js'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { RundownViewEvents, HighlightEvent } from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { pieceUiClassNames } from '../../lib/ui/pieceUiClassNames.js'
import { TransitionSourceRenderer } from './Renderers/TransitionSourceRenderer.js'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { ReadonlyDeep } from 'type-fest'
import { useSelectedElementsContext } from '../RundownView/SelectedElementsContext.js'
import { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { useCallback, useRef, useState, useEffect, useContext } from 'react'
import { dragContext } from '../RundownView/DragContext.js'
import {
	convertSourceLayerItemToPreview,
	IPreviewPopUpSession,
	PreviewPopUpContext,
} from '../PreviewPopUp/PreviewPopUpContext.js'
import { useRundownViewEventBusListener } from '../../lib/lib.js'
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

export const SourceLayerItem = (props: Readonly<ISourceLayerItemProps>): JSX.Element => {
	const {
		layer,
		part,
		partStartsAt,
		partDuration,
		piece,
		contentStatus,
		timeScale,
		isLiveLine,
		isTooSmallForText,
		onClick,
		onDoubleClick,
		followLiveLine,
		liveLineHistorySize,
		scrollLeft,
		scrollWidth,
		studio,
	} = props

	const [highlight, setHighlight] = useState(false)
	const [showPreviewPopUp, setShowPreviewPopUp] = useState(false)
	const [elementPosition, setElementPosition] = useState<OffsetPosition>({ top: 0, left: 0 })
	const [cursorPosition, setCursorPosition] = useState<OffsetPosition>({ top: 0, left: 0 })
	const [cursorTimePosition, setCursorTimePosition] = useState(0)
	const [leftAnchoredWidth, setLeftAnchoredWidth] = useState<number>(0)
	const [rightAnchoredWidth, setRightAnchoredWidth] = useState<number>(0)

	const dragCtx = useContext(dragContext)
	const hasDraggableElement = !!piece.instance.piece.userEditOperations?.find(
		(op) => op.type === UserEditingType.SOFIE && op.id === DefaultUserOperationsTypes.RETIME_PIECE
	)

	const state = {
		highlight,
		showPreviewPopUp,
		elementPosition,
		cursorPosition,
		cursorTimePosition,
		leftAnchoredWidth,
		rightAnchoredWidth,
	}

	const itemElementRef = useRef<HTMLDivElement | null>(null)
	const animFrameHandle = useRef<number | undefined>(undefined)
	const cursorRawPosition = useRef({ clientX: 0, clientY: 0 })
	const setRef = useCallback((e: HTMLDivElement) => {
		itemElementRef.current = e
	}, [])

	const highlightTimeout = useRef<undefined | NodeJS.Timeout>(undefined)
	const onHighlight = useCallback(
		(e: HighlightEvent) => {
			if (e.partId === part.partId && (e.pieceId === piece.instance.piece._id || e.pieceId === piece.instance._id)) {
				setHighlight(true)
				clearTimeout(highlightTimeout.current)
				highlightTimeout.current = setTimeout(() => {
					setHighlight(false)
				}, 5000)
			}
		},
		[part, piece]
	)

	useRundownViewEventBusListener(RundownViewEvents.HIGHLIGHT, onHighlight)
	useEffect(() => {
		return () => {
			clearTimeout(highlightTimeout.current)
		}
	}, [])

	const selectElementContext = useSelectedElementsContext()
	const itemClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			// this.props.onFollowLiveLine?.(false, e)
			e.preventDefault()
			e.stopPropagation()
			onClick?.(piece, e)
		},
		[piece]
	)
	const itemDblClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			e.preventDefault()
			e.stopPropagation()

			if (studio?.settings.enableUserEdits && !studio?.settings.allowPieceDirectPlay) {
				const pieceId = piece.instance.piece._id
				if (!selectElementContext.isSelected(pieceId)) {
					selectElementContext.clearAndSetSelection({ type: 'piece', elementId: pieceId })
				} else {
					selectElementContext.clearSelections()
				}
			} else if (typeof onDoubleClick === 'function') {
				onDoubleClick(piece, e)
			}
		},
		[piece]
	)
	const itemMouseDown = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			e.preventDefault()
			e.stopPropagation()

			if (!hasDraggableElement) return

			const targetPos = (e.target as HTMLDivElement).getBoundingClientRect()
			if (dragCtx && dragCtx.enabled)
				dragCtx.startDrag(
					piece,
					timeScale,
					{
						x: e.clientX,
						y: e.clientY,
					},
					targetPos.x - e.clientX,
					part.instance.segmentId
				)
		},
		[piece, timeScale, dragCtx]
	)
	const itemMouseUp = useCallback((e: any) => {
		const eM = e as MouseEvent
		if (eM.ctrlKey === true) {
			eM.preventDefault()
			eM.stopPropagation()
		}
		return
	}, [])

	const previewContext = useContext(PreviewPopUpContext)
	const previewSession = useRef<IPreviewPopUpSession | null>(null)
	const toggleMiniInspectorOn = useCallback(
		(e: React.MouseEvent) => togglePreviewPopUp(e, true),
		[piece, cursorTimePosition, contentStatus, timeScale]
	)
	const toggleMiniInspectorOff = useCallback(
		(e: React.MouseEvent) => togglePreviewPopUp(e, false),
		[piece, cursorTimePosition, contentStatus, timeScale]
	)
	const updatePos = useCallback(() => {
		const elementPos = getElementDocumentOffset(itemElementRef.current) || {
			top: 0,
			left: 0,
		}
		const cursorPosition = {
			left: cursorRawPosition.current.clientX - elementPos.left,
			top: cursorRawPosition.current.clientY - elementPos.top,
		}

		const cursorTimePosition = Math.max(cursorPosition.left, 0) / timeScale

		setElementPosition(elementPos)
		setCursorPosition(cursorPosition)
		setCursorTimePosition(cursorTimePosition)

		if (previewSession.current) {
			previewSession.current.setPointerTime(cursorTimePosition)
		}

		animFrameHandle.current = requestAnimationFrame(updatePos)
	}, [piece, contentStatus, timeScale])
	const togglePreviewPopUp = useCallback(
		(e: React.MouseEvent, state: boolean) => {
			if (!state && previewSession.current) {
				previewSession.current.close()
				previewSession.current = null
			} else {
				const { contents: previewContents, options: previewOptions } = convertSourceLayerItemToPreview(
					layer.type,
					piece.instance.piece,
					contentStatus,
					{
						in: props.piece.renderedInPoint,
						dur: props.piece.renderedDuration,
					}
				)

				if (previewContents.length) {
					previewSession.current = previewContext.requestPreview(e.target as any, previewContents, {
						...previewOptions,
						time: cursorTimePosition,
						initialOffsetX: e.screenX,
						trackMouse: true,
					})
				}
			}

			setShowPreviewPopUp(state)

			cursorRawPosition.current = {
				clientX: e.clientX,
				clientY: e.clientY,
			}

			if (state) {
				animFrameHandle.current = requestAnimationFrame(updatePos)
			} else if (animFrameHandle.current !== undefined) {
				cancelAnimationFrame(animFrameHandle.current)
			}
		},
		[piece, cursorTimePosition, contentStatus, timeScale]
	)
	const moveMiniInspector = useCallback((e: MouseEvent | any) => {
		cursorRawPosition.current = {
			clientX: e.clientX,
			clientY: e.clientY,
		}
	}, [])

	const convertTimeToPixels = (time: number) => {
		return Math.round(timeScale * time)
	}
	const getItemDuration = (returnInfinite?: boolean): number => {
		const innerPiece = piece.instance.piece

		const expectedDurationNumber = typeof innerPiece.enable.duration === 'number' ? innerPiece.enable.duration || 0 : 0

		let itemDuration: number
		if (!returnInfinite) {
			itemDuration = Math.min(
				piece.renderedDuration || expectedDurationNumber || 0,
				partDuration - (piece.renderedInPoint || 0)
			)
		} else {
			itemDuration =
				partDuration - (piece.renderedInPoint || 0) < (piece.renderedDuration || expectedDurationNumber || 0)
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
				itemDuration = partDuration - (piece.renderedInPoint || 0)
			} else {
				itemDuration = Number.POSITIVE_INFINITY
			}
		}

		return itemDuration
	}
	const getElementAbsoluteWidth = (): number => {
		const itemDuration = getItemDuration()
		return convertTimeToPixels(itemDuration)
	}

	const isInsideViewport = RundownUtils.isInsideViewport(
		scrollLeft,
		scrollWidth,
		part,
		partStartsAt,
		partDuration,
		piece
	)
	const getItemStyle = (): { [key: string]: string } => {
		const innerPiece = piece.instance.piece

		// If this is a live line, take duration verbatim from SegmentLayerItemContainer with a fallback on expectedDuration.
		// If not, as-run part "duration" limits renderdDuration which takes priority over MOS-import
		// expectedDuration (editorial duration)

		// let liveLinePadding = this.props.autoNextPart ? 0 : (this.props.isLiveLine ? this.props.liveLinePadding : 0)

		if (innerPiece.pieceType === IBlueprintPieceType.OutTransition) {
			return {
				left: 'auto',
				right: '0',
				width: getElementAbsoluteWidth().toString() + 'px',
			}
		}
		return {
			left: convertTimeToPixels(piece.renderedInPoint || 0).toString() + 'px',
			width: getElementAbsoluteStyleWidth(),
		}
	}
	const getElementAbsoluteStyleWidth = (): string => {
		const renderedInPoint = piece.renderedInPoint
		if (renderedInPoint === 0) {
			const itemPossiblyInfiniteDuration = getItemDuration(true)
			if (!Number.isFinite(itemPossiblyInfiniteDuration)) {
				return '100%'
			}
		}
		const itemDuration = getItemDuration(false)
		return convertTimeToPixels(itemDuration).toString() + 'px'
	}

	const getItemLabelOffsetLeft = (): React.CSSProperties => {
		const maxLabelWidth = piece.maxLabelWidth

		if (part && partStartsAt !== undefined) {
			//  && this.props.piece.renderedInPoint !== undefined && this.props.piece.renderedDuration !== undefined

			const inPoint = piece.renderedInPoint || 0
			const duration = Number.isFinite(piece.renderedDuration || 0)
				? piece.renderedDuration || partDuration || part.renderedDuration || 0
				: partDuration || part.renderedDuration || 0

			const elementWidth = getElementAbsoluteWidth()

			const widthConstrictedMode =
				isTooSmallForText ||
				(leftAnchoredWidth > 0 && rightAnchoredWidth > 0 && leftAnchoredWidth + rightAnchoredWidth > elementWidth)

			const nextIsTouching = !!piece.cropped

			if (followLiveLine && isLiveLine) {
				const liveLineHistoryWithMargin = liveLineHistorySize - 10
				if (
					scrollLeft + liveLineHistoryWithMargin / timeScale > inPoint + partStartsAt + leftAnchoredWidth / timeScale &&
					scrollLeft + liveLineHistoryWithMargin / timeScale < inPoint + duration + partStartsAt
				) {
					const targetPos = convertTimeToPixels(scrollLeft - inPoint - partStartsAt)

					return {
						maxWidth:
							rightAnchoredWidth > 0
								? (elementWidth - rightAnchoredWidth).toString() + 'px'
								: maxLabelWidth !== undefined
									? convertTimeToPixels(maxLabelWidth).toString() + 'px'
									: nextIsTouching
										? '100%'
										: 'none',
						transform:
							'translate(' +
							(widthConstrictedMode
								? targetPos
								: Math.min(targetPos, elementWidth - rightAnchoredWidth - liveLineHistoryWithMargin - 10)
							).toString() +
							'px, 0) ' +
							'translate(' +
							liveLineHistoryWithMargin.toString() +
							'px, 0) ' +
							'translate(-100%, 0)',
						willChange: 'transform',
					}
				} else if (
					rightAnchoredWidth < elementWidth &&
					leftAnchoredWidth < elementWidth &&
					scrollLeft + liveLineHistoryWithMargin / timeScale >= inPoint + duration + partStartsAt
				) {
					const targetPos = convertTimeToPixels(scrollLeft - inPoint - partStartsAt)

					return {
						maxWidth:
							rightAnchoredWidth > 0
								? (elementWidth - rightAnchoredWidth).toString() + 'px'
								: maxLabelWidth !== undefined
									? convertTimeToPixels(maxLabelWidth).toString() + 'px'
									: nextIsTouching
										? '100%'
										: 'none',
						transform:
							'translate(' +
							Math.min(targetPos, elementWidth - rightAnchoredWidth - liveLineHistoryWithMargin - 10).toString() +
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
							rightAnchoredWidth > 0
								? (elementWidth - rightAnchoredWidth - 10).toString() + 'px'
								: maxLabelWidth !== undefined
									? convertTimeToPixels(maxLabelWidth).toString() + 'px'
									: nextIsTouching
										? '100%'
										: 'none',
					}
				}
			} else {
				if (scrollLeft > inPoint + partStartsAt && scrollLeft < inPoint + duration + partStartsAt) {
					const targetPos = convertTimeToPixels(scrollLeft - inPoint - partStartsAt)

					return {
						maxWidth:
							rightAnchoredWidth > 0
								? (elementWidth - rightAnchoredWidth - 10).toString() + 'px'
								: maxLabelWidth !== undefined
									? convertTimeToPixels(maxLabelWidth).toString() + 'px'
									: nextIsTouching
										? '100%'
										: 'none',
						transform:
							'translate(' +
							(widthConstrictedMode || leftAnchoredWidth === 0 || rightAnchoredWidth === 0
								? targetPos
								: Math.min(targetPos, elementWidth - leftAnchoredWidth - rightAnchoredWidth)
							).toString() +
							'px,  0)',
					}
				} else {
					return {
						maxWidth:
							rightAnchoredWidth > 0
								? (elementWidth - rightAnchoredWidth - 10).toString() + 'px'
								: maxLabelWidth !== undefined
									? convertTimeToPixels(maxLabelWidth).toString() + 'px'
									: nextIsTouching
										? '100%'
										: 'none',
					}
				}
			}
		}
		return {}
	}
	const getItemLabelOffsetRight = (): React.CSSProperties => {
		if (!part || partStartsAt === undefined) return {}

		const innerPiece = piece.instance.piece

		const inPoint = piece.renderedInPoint || 0
		const duration =
			innerPiece.lifespan !== PieceLifespan.WithinPart || piece.renderedDuration === 0
				? partDuration - inPoint
				: Math.min(piece.renderedDuration || 0, partDuration - inPoint)
		const outPoint = inPoint + duration

		const elementWidth = getElementAbsoluteWidth()

		// const widthConstrictedMode = this.state.leftAnchoredWidth > 0 && this.state.rightAnchoredWidth > 0 && ((this.state.leftAnchoredWidth + this.state.rightAnchoredWidth) > this.state.elementWidth)

		if (scrollLeft + scrollWidth < outPoint + partStartsAt && scrollLeft + scrollWidth > inPoint + partStartsAt) {
			const targetPos = Math.max(
				(scrollLeft + scrollWidth - outPoint - partStartsAt) * timeScale,
				(elementWidth - leftAnchoredWidth - rightAnchoredWidth - LEFT_RIGHT_ANCHOR_SPACER) * -1
			)

			return {
				transform: 'translate(' + targetPos.toString() + 'px,  0)',
			}
		}
		return {}
	}
	const setAnchoredElsWidths = (leftAnchoredWidth: number, rightAnchoredWidth: number) => {
		// anchored labels will sometimes erroneously report some width. Discard if it's marginal.
		setLeftAnchoredWidth(leftAnchoredWidth > MARGINAL_ANCHORED_WIDTH ? leftAnchoredWidth : 0)
		setRightAnchoredWidth(rightAnchoredWidth > MARGINAL_ANCHORED_WIDTH ? rightAnchoredWidth : 0)
	}

	const renderInsideItem = (typeClass: string) => {
		const elProps = {
			typeClass: typeClass,
			getItemDuration: getItemDuration,
			getItemLabelOffsetLeft: getItemLabelOffsetLeft,
			getItemLabelOffsetRight: getItemLabelOffsetRight,
			setAnchoredElsWidths: setAnchoredElsWidths,
			itemElement: itemElementRef.current,
			...props,
			...state,
		}
		// Key cannot be part of a spread operator, therefore needs to be kept out of elProps
		const elKey = unprotectString(piece.instance._id)

		switch (layer.type) {
			case SourceLayerType.SCRIPT:
				// case SourceLayerType.MIC:
				return <MicSourceRenderer key={elKey} {...elProps} />
			case SourceLayerType.VT:
			case SourceLayerType.LIVE_SPEAK:
				return <VTSourceRenderer key={elKey} {...elProps} />
			case SourceLayerType.GRAPHICS:
			case SourceLayerType.LOWER_THIRD:
			case SourceLayerType.STUDIO_SCREEN:
				return <L3rdSourceRenderer key={elKey} {...elProps} />
			case SourceLayerType.SPLITS:
				return <SplitsSourceRenderer key={elKey} {...elProps} />

			case SourceLayerType.TRANSITION:
				// TODOSYNC: TV2 uses other renderers, to be discussed.

				return <TransitionSourceRenderer key={elKey} {...elProps} />
			case SourceLayerType.LOCAL:
				return <LocalLayerItemRenderer key={elKey} {...elProps} />
			default:
				return <DefaultLayerItemRenderer key={elKey} {...elProps} />
		}
	}

	if (isInsideViewport) {
		const typeClass = RundownUtils.getSourceLayerClassName(layer.type)

		const innerPiece = piece.instance.piece

		const elementWidth = getElementAbsoluteWidth()

		return (
			<div
				className={pieceUiClassNames(
					piece,
					contentStatus,
					'segment-timeline__piece',
					selectElementContext.isSelected(piece.instance.piece._id) ||
						selectElementContext.isSelected(part.instance.part._id),
					layer.type,
					part.partId,
					highlight,
					elementWidth,
					// this.state
					undefined,
					hasDraggableElement && dragCtx?.enabled
				)}
				data-obj-id={piece.instance._id}
				ref={setRef}
				onClick={itemClick}
				onDoubleClick={itemDblClick}
				onMouseUp={itemMouseUp}
				onMouseDown={itemMouseDown}
				onMouseMove={moveMiniInspector}
				onMouseEnter={toggleMiniInspectorOn}
				onMouseLeave={toggleMiniInspectorOff}
				style={getItemStyle()}
			>
				{renderInsideItem(typeClass)}
				{DEBUG_MODE && studio && (
					<div className="segment-timeline__debug-info">
						{innerPiece.enable.start} / {RundownUtils.formatTimeToTimecode(studio.settings, partDuration).substr(-5)} /{' '}
						{piece.renderedDuration
							? RundownUtils.formatTimeToTimecode(studio.settings, piece.renderedDuration).substr(-5)
							: 'X'}{' '}
						/{' '}
						{typeof innerPiece.enable.duration === 'number'
							? RundownUtils.formatTimeToTimecode(studio.settings, innerPiece.enable.duration).substr(-5)
							: ''}
					</div>
				)}
			</div>
		)
	} else {
		// render a placeholder
		return (
			<div
				className="segment-timeline__piece"
				data-obj-id={piece.instance._id}
				ref={setRef}
				style={getItemStyle()}
			></div>
		)
	}
}
