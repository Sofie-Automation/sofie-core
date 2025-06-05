import { VirtualElement } from '@popperjs/core'
import React, { useMemo, useEffect, useRef, RefObject, useLayoutEffect, useState } from 'react'
import { usePopper } from 'react-popper'
import { getHeaderHeight } from '../../lib/viewPort'
import { catchError } from '../../lib/lib'

export function useInspectorPosition(
	position: IFloatingInspectorPosition,
	inspectorEl: RefObject<HTMLElement>,
	shown = true
): {
	style: React.CSSProperties | undefined
	isFlipped: boolean
} {
	const [, forceUpdate] = useState(Symbol())

	const positionRef = useRef({
		...position,
	})

	const popperModifiers = useMemo(() => {
		return [
			{
				name: 'flip',
				options: {
					padding: { top: getHeaderHeight() - 10 },
				},
			},
			{
				name: 'preventOverflow',
				options: {
					// leave space for the right-hand panel (notifications and other panels)
					padding: { right: 70 },
				},
			},
			{
				name: 'offset',
				options: {
					offset: [0, 8],
				},
			},
		]
	}, [position.position])

	const virtualElement = useMemo<VirtualElement>(() => {
		return {
			getBoundingClientRect: (): DOMRect => {
				const top = (positionRef.current.top ?? 0) - window.scrollY
				const left = (positionRef.current.left ?? 0) - window.scrollX
				const right = left
				const height = positionRef.current.height ?? LAYER_HEIGHT
				const bottom = top - height
				const x = left
				const y = top
				return {
					top,
					left,
					width: 0,
					height,
					right,
					bottom,
					x,
					y,
					toJSON: () => '',
				}
			},
		}
	}, [])

	useEffect(() => {
		positionRef.current = {
			...position,
		}
	}, [position])

	const { styles, update, state } = usePopper(virtualElement, inspectorEl.current, {
		placement: position.position,
		modifiers: popperModifiers,
	})

	useEffect(() => {
		if (update) {
			update().catch(catchError('userInspectorPosition popper update'))
		}
	}, [update, position])

	useLayoutEffect(() => {
		const timeout = setTimeout(() => {
			forceUpdate(Symbol())
		}, 10)

		return () => {
			clearTimeout(timeout)
		}
	}, [shown])

	let isFlipped = false
	if (state?.placement !== undefined && state.placement !== position.position) {
		isFlipped = true
	}

	return {
		style: styles.popper,
		isFlipped,
	}
}

export interface IFloatingInspectorPosition {
	top: number
	left: number
	height?: number
	position: 'top' | 'bottom' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'
	anchor: 'start' | 'center' | 'end'
}

const LAYER_HEIGHT = 24
