import { Meteor } from 'meteor/meteor'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { IPreviewPopUpContext } from '../../PreviewPopUp/PreviewPopUpContext.js'
import type { ReadonlyDeep } from 'type-fest'
import type { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import type { IDashboardButtonProps } from './types'
import { usePreviewPopUpSession } from './usePreviewPopUpSession'
import { isTouchDevice } from '../../../lib/lib.js'
import { getPieceScrubDurationMs } from '../../../lib/ui/splitsPreviewVideo.js'

export function useDashboardButtonInteractions(args: {
	piece: IDashboardButtonProps['piece']
	layer: IDashboardButtonProps['layer']
	contentStatus: ReadonlyDeep<PieceContentStatusObj> | undefined
	previewContext: IPreviewPopUpContext
	disableHoverInspector: boolean | undefined
	toggleOnSingleClick: boolean | undefined
	queueAllAdlibs: boolean | undefined
	canOverflowHorizontally: boolean | undefined
	onToggleAdLib: IDashboardButtonProps['onToggleAdLib']
	onSelectAdLib: IDashboardButtonProps['onSelectAdLib']
}): {
	elementRef: React.MutableRefObject<HTMLDivElement | null>
	timePosition: number
	setTimePosition: React.Dispatch<React.SetStateAction<number>>
	updatePositionAndSize: () => void
	onPointerEnter: (e: React.PointerEvent<HTMLDivElement>) => void
	onPointerLeave: () => void
	onMouseDown: (e: React.PointerEvent<HTMLDivElement>) => void
	onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
	onPointerOut: (e: React.PointerEvent<HTMLDivElement>) => void
	onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
	onClick: (e: React.MouseEvent<HTMLDivElement>) => void
	onDoubleClick: (e: React.MouseEvent<HTMLDivElement>) => void
	onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void
	onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void
	onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void
	onTouchEnd: () => void
	deferredNameChange: (fn: () => void) => void
} {
	const elementRef = useRef<HTMLDivElement | null>(null)
	const pointerIdRef = useRef<number | null>(null)
	const positionAndSizeRef = useRef<{ top: number; left: number; width: number; height: number } | null>(null)

	const [timePosition, setTimePosition] = useState(0)

	const scrubDurationMs = useMemo(
		() => getPieceScrubDurationMs(args.piece.content as { sourceDuration?: number }, args.contentStatus),
		[args.piece.content, args.contentStatus]
	)

	const { openPreview, closePreview, setPointerTime, hasPreview } = usePreviewPopUpSession({
		previewContext: args.previewContext,
		layerType: args.layer?.type,
		piece: args.piece,
		contentStatus: args.contentStatus,
		enableHoverPreview: !args.disableHoverInspector,
	})

	const queueFlagFromEvent = useCallback(
		(e: { shiftKey?: boolean }) => !!e.shiftKey || !!args.queueAllAdlibs,
		[args.queueAllAdlibs]
	)

	const updatePositionAndSize = useCallback(() => {
		const el = elementRef.current
		if (!el) return
		const { top, left, width, height } = el.getBoundingClientRect()
		positionAndSizeRef.current = { top, left, width, height }
	}, [])

	const timeFromClientX = useCallback(
		(clientX: number) => {
			const rect = positionAndSizeRef.current
			const timePercentage = Math.max(
				0,
				Math.min((clientX - (rect?.left || 0) - 5) / ((rect?.width || 1) - 10), 1)
			)
			return timePercentage * scrubDurationMs
		},
		[scrubDurationMs]
	)

	const onPointerEnter = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			updatePositionAndSize()
			if (e.pointerType === 'mouse' && hasPreview) {
				const time = timeFromClientX(e.clientX)
				setTimePosition(time)
				openPreview(e.currentTarget, time)
			}
		},
		[hasPreview, openPreview, timeFromClientX, updatePositionAndSize]
	)

	const onPointerLeave = useCallback(() => {
		positionAndSizeRef.current = null
		closePreview()
	}, [closePreview])

	const onMouseDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			pointerIdRef.current = null
			if (e.button) args.onSelectAdLib(args.piece, e)
			if (isTouchDevice()) onPointerLeave()
		},
		[args, onPointerLeave]
	)

	const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		pointerIdRef.current = e.pointerType !== 'mouse' ? e.pointerId : null
	}, [])

	const onPointerOut = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerId === pointerIdRef.current) pointerIdRef.current = null
	}, [])

	const onPointerUp = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (e.pointerType === 'mouse' || e.pointerId === null || e.pointerId !== pointerIdRef.current) return
			if (!args.toggleOnSingleClick) {
				args.onToggleAdLib(args.piece, queueFlagFromEvent(e), e)
			}
			e.preventDefault()
		},
		[args, queueFlagFromEvent]
	)

	const onClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (pointerIdRef.current !== null || e.button !== 0) return
			if (args.toggleOnSingleClick) {
				args.onToggleAdLib(args.piece, queueFlagFromEvent(e), e)
			} else {
				args.onSelectAdLib(args.piece, e)
			}
		},
		[args, queueFlagFromEvent]
	)

	const onDoubleClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (args.toggleOnSingleClick) return
			args.onToggleAdLib(args.piece, queueFlagFromEvent(e), e)
		},
		[args, queueFlagFromEvent]
	)

	const onMoveClientX = useCallback(
		(clientX: number) => {
			const newTime = timeFromClientX(clientX)
			setTimePosition(newTime)
			setPointerTime(newTime)
		},
		[setPointerTime, timeFromClientX]
	)

	const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => onMoveClientX(e.clientX), [onMoveClientX])

	const onTouchMove = useCallback(
		(e: React.TouchEvent<HTMLDivElement>) => {
			if (args.canOverflowHorizontally) return
			if (e.changedTouches && e.changedTouches.length > 0) onMoveClientX(e.changedTouches[0].clientX)
		},
		[args.canOverflowHorizontally, onMoveClientX]
	)

	const onTouchStart = useCallback(
		(e: React.TouchEvent<HTMLDivElement>) => {
			if (args.canOverflowHorizontally) return
			updatePositionAndSize()
			if (hasPreview && e.touches.length > 0) {
				const time = timeFromClientX(e.touches[0].clientX)
				setTimePosition(time)
				openPreview(e.currentTarget, time)
			}
		},
		[args.canOverflowHorizontally, hasPreview, openPreview, timeFromClientX, updatePositionAndSize]
	)

	const onTouchEnd = useCallback(() => {
		if (args.canOverflowHorizontally) return
		onPointerLeave()
	}, [args.canOverflowHorizontally, onPointerLeave])

	// For some rename flows we want to notify after state settles.
	const deferredNameChange = useMemo(() => (fn: () => void) => Meteor.defer(fn), [])

	return {
		elementRef,
		timePosition,
		setTimePosition,
		updatePositionAndSize,
		onPointerEnter,
		onPointerLeave,
		onMouseDown,
		onPointerDown,
		onPointerOut,
		onPointerUp,
		onClick,
		onDoubleClick,
		onMouseMove,
		onTouchMove,
		onTouchStart,
		onTouchEnd,
		deferredNameChange,
	}
}
