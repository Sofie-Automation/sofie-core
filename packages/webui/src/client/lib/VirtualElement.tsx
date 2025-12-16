import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { InView } from 'react-intersection-observer'
import { getViewPortScrollingState } from './viewPort'

interface IElementMeasurements {
	width: string | number
	clientHeight: number
	marginLeft: string | number | undefined
	marginRight: string | number | undefined
	marginTop: string | number | undefined
	marginBottom: string | number | undefined
	id: string | undefined
}

const IDLE_CALLBACK_TIMEOUT = 100

/**
 * This is a component that allows optimizing the amount of elements present in the DOM through replacing them
 * with placeholders when they aren't visible in the viewport.
 * Scroll timing issues, should be handled in viewPort.tsx where the scrolling state is tracked.
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
	const resizeObserverManager = ElementObserverManager.getInstance()
	const [inView, setInView] = useState(initialShow ?? false)
	const [waitForInitialLoad, setWaitForInitialLoad] = useState(true)
	const [isShowingChildren, setIsShowingChildren] = useState(inView)

	const [measurements, setMeasurements] = useState<IElementMeasurements | null>(null)
	const [ref, setRef] = useState<HTMLDivElement | null>(null)

	// Timers for visibility changes:
	const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const inViewChangeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const skipInitialrunRef = useRef<boolean>(true)
	const isTransitioning = useRef(false)

	const isCurrentlyObserving = useRef(false)

	const styleObj = useMemo<React.CSSProperties>(
		() => ({
			width: width ?? 'auto',
			height: ((placeholderHeight || ref?.clientHeight) ?? '0') + 'px',
			// These properties are used to ensure that if a prior element is changed from
			// placeHolder to element, the position of visible elements are not affected.
			contentVisibility: 'auto',
			containIntrinsicSize: `0 ${(placeholderHeight || ref?.clientHeight) ?? '0'}px`,
			contain: 'size layout',
		}),
		[width, placeholderHeight]
	)

	const handleResize = useCallback(() => {
		if (ref) {
			// Show children during measurement
			setIsShowingChildren(true)

			requestAnimationFrame(() => {
				const measurements = measureElement(ref, placeholderHeight)
				if (measurements) {
					setMeasurements(measurements)

					// Only hide children again if not in view
					if (!inView && measurements.clientHeight > 0) {
						setIsShowingChildren(false)
					} else {
						setIsShowingChildren(true)
					}
				}
			})
		}
	}, [ref, inView, placeholderHeight])

	// failsafe to ensure visible elements if resizing happens while scrolling
	useEffect(() => {
		if (!isShowingChildren) {
			const checkVisibilityByPosition = () => {
				if (ref) {
					const rect = ref.getBoundingClientRect()
					const isInViewport = rect.top < window.innerHeight && rect.bottom > 0

					if (isInViewport) {
						setIsShowingChildren(true)
						setInView(true)
					}
				}
			}

			// Check every second
			const positionCheckInterval = setInterval(checkVisibilityByPosition, 1000)

			return () => {
				clearInterval(positionCheckInterval)
			}
		}
	}, [ref, isShowingChildren])

	// Ensure elements are visible after a fast scroll:
	useEffect(() => {
		const checkVisibilityOnScroll = () => {
			if (inView && !isShowingChildren) {
				setIsShowingChildren(true)
			}

			// Add a check after scroll stops
			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current)
			}
			scrollTimeoutRef.current = setTimeout(() => {
				// Recheck visibility after scroll appears to have stopped
				if (inView && !isShowingChildren) {
					setIsShowingChildren(true)
				}
			}, 200)
		}

		window.addEventListener('scroll', checkVisibilityOnScroll, { passive: true })

		return () => {
			window.removeEventListener('scroll', checkVisibilityOnScroll)
			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current)
			}
		}
	}, [inView, isShowingChildren])

	useEffect(() => {
		if (inView) {
			setIsShowingChildren(true)
		}

		// Startup skip:
		if (skipInitialrunRef.current) {
			skipInitialrunRef.current = false
			return
		}

		if (isTransitioning.current) {
			return
		}

		isTransitioning.current = true

		// Clear any existing timers
		if (inViewChangeTimerRef.current) {
			clearTimeout(inViewChangeTimerRef.current)
			inViewChangeTimerRef.current = undefined
		}

		// Delay the visibility change to avoid flickering
		// But low enough for scrolling to be responsive
		inViewChangeTimerRef.current = setTimeout(() => {
			try {
				if (inView) {
					if (ref) {
						if (!isCurrentlyObserving.current) {
							resizeObserverManager.observe(ref, handleResize)
							isCurrentlyObserving.current = true
						}
					}
				} else {
					if (ref && isCurrentlyObserving.current) {
						resizeObserverManager.unobserve(ref)
						isCurrentlyObserving.current = false
					}
					setIsShowingChildren(false)
				}
			} catch (error) {
				console.error('Error in visibility change handler:', error)
			} finally {
				isTransitioning.current = false
				inViewChangeTimerRef.current = undefined
			}
		}, 100)
	}, [inView, ref, handleResize, resizeObserverManager])

	const onVisibleChanged = useCallback(
		(visible: boolean) => {
			// Only update state if there's a change
			if (inView !== visible) {
				setInView(visible)
			}
		},
		[inView]
	)

	const isScrolling = (): boolean => {
		// Don't do updates while scrolling:
		if (getViewPortScrollingState().isProgrammaticScrollInProgress) {
			return true
		}
		// And wait if a programmatic scroll was done recently:
		const timeSinceLastProgrammaticScroll = Date.now() - getViewPortScrollingState().lastProgrammaticScrollTime
		if (timeSinceLastProgrammaticScroll < 100) {
			return true
		}
		return false
	}

	useEffect(() => {
		// Setup initial observer if element is in view
		if (ref && inView && !isCurrentlyObserving.current) {
			resizeObserverManager.observe(ref, handleResize)
			isCurrentlyObserving.current = true
		}

		// Cleanup function
		return () => {
			// Clean up resize observer
			if (ref && isCurrentlyObserving.current) {
				resizeObserverManager.unobserve(ref)
				isCurrentlyObserving.current = false
			}

			if (inViewChangeTimerRef.current) {
				clearTimeout(inViewChangeTimerRef.current)
			}
		}
	}, [ref, inView, handleResize])

	useEffect(() => {
		if (inView === true) {
			setIsShowingChildren(true)

			// Schedule a measurement after a short delay
			if (waitForInitialLoad && ref) {
				const initialMeasurementTimeout = window.setTimeout(() => {
					const measurements = measureElement(ref, placeholderHeight)
					if (measurements) {
						setMeasurements(measurements)
						setWaitForInitialLoad(false)
					}
				}, 800)

				return () => {
					window.clearTimeout(initialMeasurementTimeout)
				}
			}
			return
		}

		let idleCallback: number | undefined
		let optimizeTimeout: number | undefined

		const scheduleOptimization = () => {
			if (optimizeTimeout) {
				window.clearTimeout(optimizeTimeout)
			}
			// Don't proceed if we're scrolling
			if (isScrolling()) {
				// Reschedule for after the scroll should be complete
				const scrollDelay = 400
				window.clearTimeout(optimizeTimeout)
				optimizeTimeout = window.setTimeout(scheduleOptimization, scrollDelay)
				return
			}
			idleCallback = window.requestIdleCallback(
				() => {
					// Measure the entire wrapper element instead of just the childRef
					if (ref) {
						const measurements = measureElement(ref, placeholderHeight)
						if (measurements) {
							setMeasurements(measurements)
						}
					}
					setIsShowingChildren(false)
				},
				{
					timeout: IDLE_CALLBACK_TIMEOUT,
				}
			)
		}

		// Schedule the optimization:
		scheduleOptimization()

		return () => {
			if (idleCallback) {
				window.cancelIdleCallback(idleCallback)
			}
			if (optimizeTimeout) {
				window.clearTimeout(optimizeTimeout)
			}
		}
	}, [ref, inView, placeholderHeight])

	return (
		<InView
			threshold={0}
			rootMargin={margin || '50% 0px 50% 0px'}
			onChange={onVisibleChanged}
			className={className}
			as="div"
		>
			<div
				ref={setRef}
				id={id}
				style={
					// Use measurements if available, otherwise fall back to placeholder/ref height when virtualized
					measurements
						? {
								height: measurements.clientHeight + 'px',
							}
						: !isShowingChildren
							? {
									height: ((placeholderHeight || ref?.clientHeight) ?? 0) + 'px',
								}
							: undefined
				}
			>
				{!isShowingChildren ? (
					<div className={`virtual-element-placeholder ${placeholderClassName}`} style={styleObj}></div>
				) : (
					children
				)}
			</div>
		</InView>
	)
}
function measureElement(wrapperEl: HTMLDivElement, placeholderHeight?: number): IElementMeasurements | null {
	if (!wrapperEl || !wrapperEl.firstElementChild) {
		return null
	}

	const el = wrapperEl.firstElementChild as HTMLElement
	const style = window.getComputedStyle(el)

	let segmentTimeline: Element | null = null
	let dashboardPanel: Element | null = null

	segmentTimeline = wrapperEl.querySelector('.segment-timeline')
	dashboardPanel = wrapperEl.querySelector('.dashboard-panel')

	if (segmentTimeline) {
		const segmentRect = segmentTimeline.getBoundingClientRect()
		let totalHeight = segmentRect.height

		if (dashboardPanel) {
			const panelRect = dashboardPanel.getBoundingClientRect()
			totalHeight += panelRect.height
		}

		if (totalHeight < 40) {
			totalHeight = placeholderHeight ?? el.clientHeight
		}

		return {
			width: style.width || 'auto',
			clientHeight: totalHeight,
			marginTop: style.marginTop || undefined,
			marginBottom: style.marginBottom || undefined,
			marginLeft: style.marginLeft || undefined,
			marginRight: style.marginRight || undefined,
			id: el.id,
		}
	}

	// Fallback to just measuring the element itself if wrapper isn't found
	return {
		width: style.width || 'auto',
		clientHeight: placeholderHeight ?? el.clientHeight,
		marginTop: style.marginTop || undefined,
		marginBottom: style.marginBottom || undefined,
		marginLeft: style.marginLeft || undefined,
		marginRight: style.marginRight || undefined,
		id: el.id,
	}
}

// Singleton class to manage ResizeObserver instances
export class ElementObserverManager {
	private static instance: ElementObserverManager
	private resizeObserver: ResizeObserver
	private mutationObserver: MutationObserver
	private observedElements: Map<HTMLElement, () => void>

	private constructor() {
		this.observedElements = new Map()

		// Configure ResizeObserver
		this.resizeObserver = new ResizeObserver((entries) => {
			entries.forEach((entry) => {
				const element = entry.target as HTMLElement
				const callback = this.observedElements.get(element)
				if (callback) {
					callback()
				}
			})
		})

		// Configure MutationObserver
		this.mutationObserver = new MutationObserver((mutations) => {
			const targets = new Set<HTMLElement>()

			mutations.forEach((mutation) => {
				const target = mutation.target as HTMLElement
				// Find the closest observed element
				let element = target
				while (element) {
					if (this.observedElements.has(element)) {
						targets.add(element)
						break
					}
					if (!element.parentElement) break
					element = element.parentElement
				}
			})

			// Call callbacks for affected elements
			targets.forEach((element) => {
				const callback = this.observedElements.get(element)
				if (callback) callback()
			})
		})
	}

	public static getInstance(): ElementObserverManager {
		if (!ElementObserverManager.instance) {
			ElementObserverManager.instance = new ElementObserverManager()
		}
		return ElementObserverManager.instance
	}

	public observe(element: HTMLElement, callback: () => void): void {
		if (!element) return

		this.observedElements.set(element, callback)
		this.resizeObserver.observe(element)
		this.mutationObserver.observe(element, {
			childList: true,
			subtree: true,
			attributes: true,
			characterData: true,
		})
	}

	public unobserve(element: HTMLElement): void {
		if (!element) return
		this.observedElements.delete(element)
		this.resizeObserver.unobserve(element)

		// Disconnect and reconnect mutation observer to refresh the list of observed elements
		this.mutationObserver.disconnect()
		this.observedElements.forEach((_, el) => {
			this.mutationObserver.observe(el, {
				childList: true,
				subtree: true,
				attributes: true,
				characterData: true,
			})
		})
	}
}
