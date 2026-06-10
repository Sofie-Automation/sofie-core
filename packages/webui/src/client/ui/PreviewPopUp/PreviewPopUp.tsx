import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import { usePopper } from 'react-popper'
import type { Padding, Placement, VirtualElement } from '@popperjs/core'

import './PreviewPopUp.scss'

function isDetachedHTMLElementAnchor(anchor: HTMLElement | VirtualElement | null): anchor is HTMLElement {
	return anchor instanceof HTMLElement && !anchor.isConnected
}

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
	const popperOptions = useMemo(
		() => ({
			placement: placement ?? 'top',
			strategy: 'fixed' as const,
			modifiers: [
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
	const virtualPositionRef = useRef({
		x: initialOffsetX ?? anchor?.getBoundingClientRect().x ?? 0,
		y: anchor?.getBoundingClientRect().y ?? 0,
	})
	const virtualElement = useRef<VirtualElement>({
		getBoundingClientRect: () =>
			generateVirtualBoundingClientRect(virtualPositionRef.current.x, virtualPositionRef.current.y),
	})
	const anchorRef = useRef(anchor)
	const anchorYRef = useRef(anchor?.getBoundingClientRect().y ?? 0)
	const { styles, attributes, update } = usePopper(
		trackMouse ? virtualElement.current : anchor,
		popperEl,
		popperOptions
	)

	const updateRef = useRef(update)

	useEffect(() => {
		updateRef.current = update
	}, [update])

	useEffect(() => {
		anchorRef.current = anchor
		anchorYRef.current = anchor?.getBoundingClientRect().y ?? 0
		virtualPositionRef.current = {
			x: initialOffsetX ?? anchor?.getBoundingClientRect().x ?? 0,
			y: anchor?.getBoundingClientRect().y ?? 0,
		}
	}, [anchor, initialOffsetX])

	useEffect(() => {
		if (trackMouse) {
			const listener = ({ clientX: x }: MouseEvent) => {
				if (isDetachedHTMLElementAnchor(anchorRef.current)) return
				virtualPositionRef.current = { x, y: anchorYRef.current }
				// If update is available, call it to reposition the popper:
				if (updateRef.current) {
					updateRef.current().catch((e) => console.error(e))
				}
			}
			document.addEventListener('mousemove', listener)

			return () => {
				document.removeEventListener('mousemove', listener)
			}
		}
	}, [trackMouse])

	useEffect(() => {
		return () => {
			anchorRef.current = null
			anchorYRef.current = 0
			virtualPositionRef.current = { x: 0, y: 0 }
			updateRef.current = null
		}
	}, [])

	useImperativeHandle(ref, () => {
		return {
			update: () => {
				if (isDetachedHTMLElementAnchor(anchorRef.current)) return
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
			style={styles.popper}
			{...attributes.popper}
		>
			{children && <div className="preview-popUp__preview">{children}</div>}
		</div>
	)
})

export type PreviewPopUpHandle = {
	readonly update: () => void
}

function generateVirtualBoundingClientRect(x = 0, y = 0) {
	return {
		width: 0,
		height: 0,
		x: x,
		y: y,
		top: y,
		right: x,
		bottom: y,
		left: x,
		toJSON: () => '',
	}
}
