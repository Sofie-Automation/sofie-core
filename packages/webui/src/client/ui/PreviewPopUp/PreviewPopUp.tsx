import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import { usePopper } from 'react-popper'
import type { Padding, Placement, VirtualElement } from '@popperjs/core'

import './PreviewPopUp.scss'

export const PreviewPopUp = React.forwardRef<
	PreviewPopUpHandle,
	React.PropsWithChildren<{
		anchor: HTMLElement | VirtualElement | null
		padding: Padding
		placement: Placement
		size: 'small' | 'large'
		preview?: React.ReactNode
		initialOffsetX?: number
		trackMouse?: boolean
	}>
>(function PreviewPopUp(
	{ anchor, padding, placement, size, children, initialOffsetX, trackMouse },
	ref
): React.JSX.Element {
	const [popperEl, setPopperEl] = useState<HTMLDivElement | null>(null)
	const popperWidthPx = size === 'large' ? 482 : 322

	const popperOptions = useMemo(
		() => ({
			placement: placement ?? 'top',
			strategy: 'fixed' as const,
			modifiers: [
				{
					name: 'computeStyles',
					options: {
						// Do not shrink the popup to the (zero-width) virtual mouse anchor when trackMouse is on.
						adaptive: false,
					},
				},
				{
					name: 'flip',
					options: {
						fallbackPlacements: [
							'top-start',
							'top-end',
							'right',
							'right-start',
							'right-end',
							'left',
							'left-start',
							'left-end',
							'bottom',
							'bottom-start',
							'bottom-end',
						],
						rootBoundary: 'viewport',
						padding: padding ?? 0,
					},
				},
				{
					name: 'preventOverflow',
					options: {
						padding: padding ?? 0, // additional padding placed here (like Header, etc.)
					},
				},
			],
		}),
		[padding]
	)

	const getAnchorY = () => {
		if (anchor && 'getBoundingClientRect' in anchor) {
			return anchor.getBoundingClientRect().y
		}
		return 0
	}

	const initialVirtualX =
		trackMouse && typeof initialOffsetX === 'number'
			? initialOffsetX
			: anchor && 'getBoundingClientRect' in anchor
				? anchor.getBoundingClientRect().x
				: 0

	const virtualElement = useRef<VirtualElement>({
		getBoundingClientRect: generateGetBoundingClientRect(initialVirtualX, getAnchorY()),
	})

	const { styles, attributes, update } = usePopper(
		trackMouse ? virtualElement.current : anchor,
		popperEl,
		popperOptions
	)

	const popperStyle = useMemo(
		() => ({
			...styles.popper,
			width: popperWidthPx,
		}),
		[styles.popper, popperWidthPx]
	)

	const updateRef = useRef(update)

	useEffect(() => {
		updateRef.current = update
	}, [update])

	// Re-sync virtual anchor when a new preview session starts (trackMouse + cursor X).
	useEffect(() => {
		if (!trackMouse) return
		virtualElement.current.getBoundingClientRect = generateGetBoundingClientRect(
			typeof initialOffsetX === 'number' ? initialOffsetX : 0,
			getAnchorY()
		)
		updateRef.current?.().catch(console.error)
	}, [trackMouse, initialOffsetX, anchor])

	useEffect(() => {
		if (trackMouse) {
			const listener = ({ clientX: x }: MouseEvent) => {
				virtualElement.current.getBoundingClientRect = generateGetBoundingClientRect(x, getAnchorY())
				if (updateRef.current) {
					updateRef.current().catch((e) => console.error(e))
				}
			}
			document.addEventListener('mousemove', listener)

			return () => {
				document.removeEventListener('mousemove', listener)
			}
		}
	}, [trackMouse, anchor])

	useImperativeHandle(ref, () => {
		return {
			update: () => {
				if (!updateRef.current) return
				updateRef.current().catch(console.error)
			},
		}
	}, [])

	return (
		<div
			ref={setPopperEl}
			className={classNames('preview-popUp', {
				'preview-popUp--large': size === 'large',
				'preview-popUp--small': size === 'small',
			})}
			style={popperStyle}
			{...attributes.popper}
		>
			{children && <div className="preview-popUp__preview">{children}</div>}
		</div>
	)
})

export type PreviewPopUpHandle = {
	readonly update: () => void
}

function generateGetBoundingClientRect(x = 0, y = 0) {
	return () => ({
		width: 0,
		height: 0,
		x: x,
		y: y,
		top: y,
		right: x,
		bottom: y,
		left: x,
		toJSON: () => '',
	})
}
