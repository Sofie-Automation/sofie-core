import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import { usePopper } from 'react-popper'
import { Padding, Placement, VirtualElement } from '@popperjs/core'

import './PreviewPopUp.scss'

export const PreviewPopUp = React.forwardRef<
	PreviewPopUpHandle,
	React.PropsWithChildren<{
		anchor: HTMLElement | VirtualElement | null
		padding: Padding
		placement: Placement
		size: 'small' | 'large'
		hidden?: boolean
		preview?: React.ReactNode
		initialOffsetX?: number
		trackMouse?: boolean
	}>
>(function PreviewPopUp(
	{ anchor, padding, placement, hidden, size, children, initialOffsetX, trackMouse },
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
	const virtualElement = useRef<VirtualElement>({
		getBoundingClientRect: generateGetBoundingClientRect(
			initialOffsetX ?? anchor?.getBoundingClientRect().x ?? 0,
			anchor?.getBoundingClientRect().y ?? 0
		),
	})
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
		if (trackMouse) {
			const listener = ({ clientX: x }: MouseEvent) => {
				virtualElement.current.getBoundingClientRect = generateGetBoundingClientRect(
					x,
					anchor?.getBoundingClientRect().y ?? 0
				)
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
				'preview-popUp--hidden': hidden,
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
