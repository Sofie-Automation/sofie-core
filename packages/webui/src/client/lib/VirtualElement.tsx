import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
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
	const observedElementRef = useRef<HTMLDivElement | null>(null)
	const isMountedRef = useRef(true)

	useEffect(() => {
		return () => {
			isMountedRef.current = false
		}
	}, [])

	const placeholderHeightPx = measurements?.clientHeight ?? placeholderHeight ?? ref?.clientHeight ?? 0

	const styleObj = useMemo<React.CSSProperties>(
		() => ({
			width: width ?? 'auto',
			height: `${placeholderHeightPx}px`,
			// These properties are used to ensure that if a prior element is changed from
			// placeholder to element, the position of visible elements are not affected.
			contentVisibility: 'auto',
			containIntrinsicSize: `0 ${placeholderHeightPx}px`,
			contain: 'size layout',
		}),
		[width, placeholderHeightPx]
	)

	const handleResize = useCallback(() => {
		if (!isMountedRef.current) return
		if (ref) {
			// Show children during measurement
			setIsShowingChildren(true)

			requestAnimationFrame(() => {
				if (!isMountedRef.current) return
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

	const unobserveElement = useCallback(
		(element: HTMLDivElement | null) => {
			if (!element) return
			resizeObserverManager.unobserve(element)
			if (observedElementRef.current === element) {
				observedElementRef.current = null
			}
			isCurrentlyObserving.current = false
		},
		[resizeObserverManager]
	)

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
		if (observedElementRef.current && observedElementRef.current !== ref) {
			unobserveElement(observedElementRef.current)
		}

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
							observedElementRef.current = ref
							isCurrentlyObserving.current = true
						}
					}
				} else {
					if (ref) unobserveElement(ref)
					setIsShowingChildren(false)
				}
			} catch (error) {
				console.error('Error in visibility change handler:', error)
			} finally {
				isTransitioning.current = false
				inViewChangeTimerRef.current = undefined
			}
		}, 100)
	}, [inView, ref, handleResize, resizeObserverManager, unobserveElement])

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
		const { isProgrammaticScrollInProgress, lastProgrammaticScrollTime } = getViewPortScrollingState()
		// Don't do updates while scrolling:
		if (isProgrammaticScrollInProgress) {
			return true
		}
		// And wait if a programmatic scroll was done recently:
		const timeSinceLastProgrammaticScroll = Date.now() - lastProgrammaticScrollTime
		if (timeSinceLastProgrammaticScroll < 100) {
			return true
		}
		return false
	}

	useEffect(() => {
		// Setup initial observer if element is in view
		if (ref && inView && !isCurrentlyObserving.current) {
			resizeObserverManager.observe(ref, handleResize)
			observedElementRef.current = ref
			isCurrentlyObserving.current = true
		}

		// Cleanup function
		return () => {
			// Clean up resize observer
			if (ref) unobserveElement(ref)
			if (observedElementRef.current && observedElementRef.current !== ref) {
				unobserveElement(observedElementRef.current)
			}

			if (inViewChangeTimerRef.current) {
				clearTimeout(inViewChangeTimerRef.current)
			}
		}
	}, [ref, inView, handleResize, unobserveElement])

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
					if (!isMountedRef.current) return
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
	private isMutationObserverActive = false

	private hasConnectedObservedElements(): boolean {
		for (const observedElement of this.observedElements.keys()) {
			if (document.contains(observedElement)) return true
		}
		return false
	}

	private pruneDetachedObservedElements(): void {
		for (const observedElement of Array.from(this.observedElements.keys())) {
			if (!document.contains(observedElement)) {
				this.observedElements.delete(observedElement)
				this.resizeObserver.unobserve(observedElement)
			}
		}
	}

	private constructor() {
		this.observedElements = new Map()

		// Configure ResizeObserver
		this.resizeObserver = new ResizeObserver((entries) => {
			entries.forEach((entry) => {
				const element = entry.target as HTMLElement
				if (!document.contains(element)) {
					this.observedElements.delete(element)
					this.resizeObserver.unobserve(element)
					return
				}
				const callback = this.observedElements.get(element)
				if (callback) {
					callback()
				}
			})

			// Ensure detached entries are aggressively cleaned even without follow-up DOM mutations.
			this.pruneDetachedObservedElements()
			if (this.observedElements.size === 0) {
				this.disconnectMutationObserver()
			}
		})

		// Configure MutationObserver once and only connect/disconnect based on active observed elements.
		this.mutationObserver = new MutationObserver((mutations) => {
			if (this.observedElements.size === 0) return

			this.pruneDetachedObservedElements()
			if (this.observedElements.size === 0) {
				this.disconnectMutationObserver()
				return
			}
			const targets = new Set<HTMLElement>()

			mutations.forEach((mutation) => {
				let element: HTMLElement | null = null
				if (mutation.target instanceof HTMLElement) {
					element = mutation.target
				} else {
					element = mutation.target.parentElement
				}

				if (!element || !document.contains(element)) return

				while (element) {
					if (this.observedElements.has(element)) {
						targets.add(element)
						break
					}
					element = element.parentElement
				}
			})

			targets.forEach((element) => {
				if (!document.contains(element)) {
					this.observedElements.delete(element)
					this.resizeObserver.unobserve(element)
					return
				}
				const callback = this.observedElements.get(element)
				if (callback) callback()
			})
		})
	}

	private ensureMutationObserverConnected(): void {
		if (this.isMutationObserverActive) return
		if (this.observedElements.size === 0) return
		if (!this.hasConnectedObservedElements()) return
		if (!document.body) return

		this.mutationObserver.observe(document.body, {
			childList: true,
			subtree: true,
		})
		this.isMutationObserverActive = true
	}

	private disconnectMutationObserver(): void {
		if (!this.isMutationObserverActive) return
		this.mutationObserver.disconnect()
		this.isMutationObserverActive = false
	}

	public static getInstance(): ElementObserverManager {
		if (!ElementObserverManager.instance) {
			ElementObserverManager.instance = new ElementObserverManager()
		}
		return ElementObserverManager.instance
	}

	public observe(element: HTMLElement, callback: () => void): void {
		if (!element) return
		if (!document.contains(element)) return
		this.pruneDetachedObservedElements()

		this.observedElements.set(element, callback)
		this.resizeObserver.observe(element)
		this.ensureMutationObserverConnected()
	}

	public unobserve(element: HTMLElement): void {
		if (!element) return
		this.observedElements.delete(element)
		this.resizeObserver.unobserve(element)
		this.pruneDetachedObservedElements()

		if (this.observedElements.size === 0) {
			this.resizeObserver.disconnect()
			this.disconnectMutationObserver()
			return
		}

		if (!this.hasConnectedObservedElements()) {
			this.disconnectMutationObserver()
			return
		}

		this.ensureMutationObserverConnected()
	}
}
