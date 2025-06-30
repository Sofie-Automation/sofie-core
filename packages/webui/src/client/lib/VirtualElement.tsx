import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { InView } from 'react-intersection-observer'

interface IElementMeasurements {
	width: string | number
	clientHeight: number
	marginLeft: string | number | undefined
	marginRight: string | number | undefined
	marginTop: string | number | undefined
	marginBottom: string | number | undefined
	id: string | undefined
}

const OPTIMIZE_PERIOD = 5000
const IDLE_CALLBACK_TIMEOUT = 100

/**
 * This is a component that allows optimizing the amount of elements present in the DOM through replacing them
 * with placeholders when they aren't visible in the viewport.
 *
 * @export
 * @param {(React.PropsWithChildren<{
 * 	initialShow?: boolean
 * 	placeholderHeight?: number
 * 	_debug?: boolean
 * 	placeholderClassName?: string
 * 	width?: string | number
 * 	margin?: string
 * 	id?: string | undefined
 * 	className?: string
 * }>)} {
 * 	initialShow,
 * 	placeholderHeight,
 * 	placeholderClassName,
 * 	width,
 * 	margin,
 * 	id,
 * 	className,
 * 	children,
 * }
 * @return {*}  {(JSX.Element | null)}
 */
export function VirtualElement({
	initialShow,
	placeholderHeight,
	placeholderClassName,
	width,
	margin,
	id,
	className,
	children,
}: React.PropsWithChildren<{
	initialShow?: boolean
	placeholderHeight?: number
	_debug?: boolean
	placeholderClassName?: string
	width?: string | number
	margin?: string
	id?: string | undefined
	className?: string
}>): JSX.Element | null {
	const [inView, setInView] = useState(initialShow ?? false)
	const [isShowingChildren, setIsShowingChildren] = useState(inView)
	const [measurements, setMeasurements] = useState<IElementMeasurements | null>(null)
	const [ref, setRef] = useState<HTMLDivElement | null>(null)
	const [childRef, setChildRef] = useState<HTMLElement | null>(null)

	const isMeasured = !!measurements

	const styleObj = useMemo<React.CSSProperties>(
		() => ({
			width: width ?? measurements?.width ?? 'auto',
			height: (measurements?.clientHeight ?? placeholderHeight ?? '0') + 'px',
			marginTop: measurements?.marginTop,
			marginLeft: measurements?.marginLeft,
			marginRight: measurements?.marginRight,
			marginBottom: measurements?.marginBottom,
		}),
		[width, measurements, placeholderHeight]
	)

	const onVisibleChanged = useCallback((visible: boolean) => {
		setInView(visible)
	}, [])

	useEffect(() => {
		if (inView === true) {
			setIsShowingChildren(true)
			return
		}

		let idleCallback: number | undefined
		const optimizeTimeout = window.setTimeout(() => {
			idleCallback = window.requestIdleCallback(
				() => {
					if (childRef) {
						setMeasurements(measureElement(childRef))
					}
					setIsShowingChildren(false)
				},
				{
					timeout: IDLE_CALLBACK_TIMEOUT,
				}
			)
		}, OPTIMIZE_PERIOD)

		return () => {
			if (idleCallback) {
				window.cancelIdleCallback(idleCallback)
			}

			window.clearTimeout(optimizeTimeout)
		}
	}, [childRef, inView])

	const showPlaceholder = !isShowingChildren && (!initialShow || isMeasured)

	useLayoutEffect(() => {
		if (!ref || showPlaceholder) return

		const el = ref?.firstElementChild
		if (!el || el.classList.contains('virtual-element-placeholder') || !(el instanceof HTMLElement)) return

		setChildRef(el)

		let idleCallback: number | undefined
		const refreshSizingTimeout = window.setTimeout(() => {
			idleCallback = window.requestIdleCallback(
				() => {
					setMeasurements(measureElement(el))
				},
				{
					timeout: IDLE_CALLBACK_TIMEOUT,
				}
			)
		}, 1000)

		return () => {
			if (idleCallback) {
				window.cancelIdleCallback(idleCallback)
			}
			window.clearTimeout(refreshSizingTimeout)
		}
	}, [ref, showPlaceholder])

	return (
		<InView
			threshold={0}
			rootMargin={margin || '50% 0px 50% 0px'}
			onChange={onVisibleChanged}
			className={className}
			as="div"
		>
			<div ref={setRef}>
				{showPlaceholder ? (
					<div
						id={measurements?.id ?? id}
						className={`virtual-element-placeholder ${placeholderClassName}`}
						style={styleObj}
					></div>
				) : (
					children
				)}
			</div>
		</InView>
	)
}

function measureElement(el: HTMLElement): IElementMeasurements | null {
	const style = window.getComputedStyle(el)
	const clientRect = el.getBoundingClientRect()

	return {
		width: style.width || 'auto',
		clientHeight: clientRect.height,
		marginTop: style.marginTop || undefined,
		marginBottom: style.marginBottom || undefined,
		marginLeft: style.marginLeft || undefined,
		marginRight: style.marginRight || undefined,
		id: el.id,
	}
}
