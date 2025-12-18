import { SEGMENT_TIMELINE_ELEMENT_ID } from '../ui/SegmentTimeline/SegmentTimeline.js'
import { isProtectedString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import RundownViewEventBus, { RundownViewEvents } from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { Settings } from '../lib/Settings.js'
import { PartId, PartInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UIPartInstances, UIParts } from '../ui/Collections.js'
import { logger } from './logging.js'
import { parse as queryStringParse } from 'query-string'

const HEADER_MARGIN = 24 // TODOSYNC: TV2 uses 15. If it's needed to be different, it needs to be made generic somehow..
const FALLBACK_HEADER_HEIGHT = 65

// Replace the global variable with a more structured approach
const focusState = {
	interval: undefined as NodeJS.Timeout | undefined,
	isScrolling: false,
	startTime: 0,
}

const viewPortScrollingState = {
	isProgrammaticScrollInProgress: false,
	lastProgrammaticScrollTime: 0,
}

export function getViewPortScrollingState(): {
	isProgrammaticScrollInProgress: boolean
	lastProgrammaticScrollTime: number
} {
	return viewPortScrollingState
}

export function maintainFocusOnPartInstance(
	partInstanceId: PartInstanceId,
	timeWindow: number,
	forceScroll?: boolean,
	noAnimation?: boolean
): void {
	focusState.startTime = Date.now()

	const focus = async () => {
		// Only proceed if we're not already scrolling and within the time window
		if (!focusState.isScrolling && Date.now() - focusState.startTime < timeWindow) {
			focusState.isScrolling = true

			try {
				await scrollToPartInstance(partInstanceId, forceScroll, noAnimation)
			} catch (_error) {
				// Handle error if needed
			} finally {
				focusState.isScrolling = false
			}
		} else if (Date.now() - focusState.startTime >= timeWindow) {
			quitFocusOnPart()
		}
	}

	document.addEventListener('wheel', onWheelWhenMaintainingFocus, {
		once: true,
		capture: true,
		passive: true,
	})

	// Clear any existing interval before creating a new one
	if (focusState.interval) {
		clearInterval(focusState.interval)
	}

	focus()
		.then(() => {
			focusState.interval = setInterval(focus, 500)
		})
		.catch(() => {
			// Handle error if needed
		})
}

export function isMaintainingFocus(): boolean {
	return !!focusState.interval
}

function onWheelWhenMaintainingFocus() {
	quitFocusOnPart()
}

function quitFocusOnPart() {
	document.removeEventListener('wheel', onWheelWhenMaintainingFocus, {
		capture: true,
	})

	if (focusState.interval) {
		clearInterval(focusState.interval)
		focusState.interval = undefined
	}
}

export async function scrollToPartInstance(
	partInstanceId: PartInstanceId,
	forceScroll?: boolean,
	noAnimation?: boolean
): Promise<boolean> {
	quitFocusOnPart()
	const partInstance = UIPartInstances.findOne(partInstanceId)
	if (partInstance) {
		return scrollToSegment(partInstance.segmentId, forceScroll, noAnimation)
	}
	throw new Error('Could not find PartInstance')
}

export async function scrollToPart(
	partId: PartId,
	forceScroll?: boolean,
	noAnimation?: boolean,
	zoomInToFit?: boolean
): Promise<boolean> {
	quitFocusOnPart()
	const part = UIParts.findOne(partId)
	if (part) {
		await scrollToSegment(part.segmentId, forceScroll, noAnimation)

		RundownViewEventBus.emit(RundownViewEvents.GO_TO_PART, {
			segmentId: part.segmentId,
			partId: partId,
			zoomInToFit,
		})

		return true // rather meaningless as we don't know what happened
	}
	throw new Error('Could not find part')
}

let HEADER_HEIGHT: number | undefined = undefined

export function getHeaderHeight(): number {
	if (queryStringParse(location.search)['hideRundownHeader'] === '1') {
		return 0
	}

	if (HEADER_HEIGHT === undefined) {
		const root = document.querySelector(
			'#render-target > .container-fluid-custom > .rundown-view > .rundown-header'
		)
		if (!root) {
			return FALLBACK_HEADER_HEIGHT
		}
		const { height } = root.getBoundingClientRect()
		HEADER_HEIGHT = height
	}
	return HEADER_HEIGHT
}

let pendingSecondStageScroll: number | undefined
let currentScrollingElement: HTMLElement | undefined

export async function scrollToSegment(
	elementToScrollToOrSegmentId: HTMLElement | SegmentId,
	forceScroll?: boolean,
	noAnimation?: boolean
): Promise<boolean> {
	const elementToScrollTo: HTMLElement | null = getElementToScrollTo(elementToScrollToOrSegmentId, false)
	const historyTarget: HTMLElement | null = getElementToScrollTo(elementToScrollToOrSegmentId, true)

	// historyTarget will be === to elementToScrollTo if history is not used / not found
	if (!elementToScrollTo || !historyTarget) {
		throw new Error('Could not find segment element')
	}

	return innerScrollToSegment(
		historyTarget,
		forceScroll || !regionInViewport(historyTarget, elementToScrollTo),
		noAnimation,
		false
	)
}

function getElementToScrollTo(
	elementToScrollToOrSegmentId: HTMLElement | SegmentId,
	showHistory: boolean
): HTMLElement | null {
	if (isProtectedString(elementToScrollToOrSegmentId)) {
		// Get the current segment element
		let targetElement = document.querySelector<HTMLElement>(
			`#${SEGMENT_TIMELINE_ELEMENT_ID}${elementToScrollToOrSegmentId}`
		)
		if (showHistory && Settings.followOnAirSegmentsHistory && targetElement) {
			let i = Settings.followOnAirSegmentsHistory

			// Find previous segments
			while (i > 0 && targetElement) {
				const currentSegmentId = targetElement.id
				const allSegments = Array.from(document.querySelectorAll(`[id^="${SEGMENT_TIMELINE_ELEMENT_ID}"]`))

				// Find current segment's index in the array of all segments
				const currentIndex = allSegments.findIndex((el) => el.id === currentSegmentId)

				// Find the previous segment
				if (currentIndex > 0) {
					targetElement = allSegments[currentIndex - 1] as HTMLElement
					i--
				} else {
					// No more previous segments
					break
				}
			}
		}

		return targetElement
	}

	return elementToScrollToOrSegmentId
}

let pendingFirstStageTimeout: NodeJS.Timeout | undefined

async function innerScrollToSegment(
	elementToScrollTo: HTMLElement,
	forceScroll?: boolean,
	noAnimation?: boolean,
	secondStage?: boolean
): Promise<boolean> {
	if (!secondStage) {
		if (pendingFirstStageTimeout) {
			clearTimeout(pendingFirstStageTimeout)
			pendingFirstStageTimeout = undefined
		}
		currentScrollingElement = elementToScrollTo
	} else if (secondStage && elementToScrollTo !== currentScrollingElement) {
		throw new Error('Scroll overriden by another scroll')
	}

	// Ensure that the element is ready to be scrolled:
	if (!secondStage) {
		await new Promise((resolve) => setTimeout(resolve, 100))
	}
	await new Promise((resolve) => requestAnimationFrame(resolve))

	let { top, bottom } = elementToScrollTo.getBoundingClientRect()
	top = Math.floor(top)
	bottom = Math.floor(bottom)

	const headerHeight = Math.floor(getHeaderHeight())

	// check if the item is in viewport
	if (forceScroll || bottom > Math.floor(window.innerHeight) || top < headerHeight) {
		if (pendingSecondStageScroll) window.cancelIdleCallback(pendingSecondStageScroll)

		return scrollToPosition(top + window.scrollY, noAnimation).then(
			async () => {
				return new Promise<boolean>((resolve, reject) => {
					if (!secondStage) {
						//  Wait to settle 1 atemt to scroll
						pendingFirstStageTimeout = setTimeout(() => {
							pendingFirstStageTimeout = undefined
							let { top, bottom } = elementToScrollTo.getBoundingClientRect()
							top = Math.floor(top)
							bottom = Math.floor(bottom)
							if (bottom > Math.floor(window.innerHeight) || top < headerHeight) {
								// If not in place atempt to scroll again
								innerScrollToSegment(elementToScrollTo, forceScroll, true, true).then(resolve, reject)
							} else {
								resolve(true)
							}
						}, 1000) // When UI is getting optimized further we could lower this value
					} else {
						currentScrollingElement = undefined
						resolve(true)
					}
				})
			},
			(error) => {
				if (!error.toString().match(/another scroll/)) logger.error(error)
				return false
			}
		)
	}

	return Promise.resolve(false)
}

function regionInViewport(topElement: HTMLElement, bottomElement: HTMLElement) {
	const { top, bottom } = getRegionPosition(topElement, bottomElement)

	const headerHeight = Math.floor(getHeaderHeight())

	return !(bottom > Math.floor(window.innerHeight) || top < headerHeight)
}

function getRegionPosition(topElement: HTMLElement, bottomElement: HTMLElement): { top: number; bottom: number } {
	let top = topElement.getBoundingClientRect().top
	let bottom = bottomElement.getBoundingClientRect().bottom
	top = Math.floor(top)
	bottom = Math.floor(bottom)

	return { top, bottom }
}

export async function scrollToPosition(scrollPosition: number, noAnimation?: boolean): Promise<void> {
	// Calculate the exact position
	const headerOffset = getHeaderHeight() + HEADER_MARGIN
	const targetTop = Math.max(0, scrollPosition - headerOffset)

	if (noAnimation) {
		window.scroll({
			top: targetTop,
			left: 0,
			behavior: 'instant',
		})
		return Promise.resolve()
	} else {
		viewPortScrollingState.isProgrammaticScrollInProgress = true
		viewPortScrollingState.lastProgrammaticScrollTime = Date.now()

		window.scroll({
			top: targetTop,
			left: 0,
			behavior: 'smooth',
		})
		await new Promise((resolve) => setTimeout(resolve, 300))
		viewPortScrollingState.isProgrammaticScrollInProgress = false
	}
}

let pointerLockTurnstile = 0
let pointerHandlerAttached = false

function pointerLockChange(_e: Event): void {
	if (!document.pointerLockElement) {
		// noOp, if the pointer is unlocked, good. That's a safe position
		return
	}

	// if a pointer has been locked, check if it should be. We might have already
	// changed our mind
	if (pointerLockTurnstile <= 0) {
		// this means that the we've received an equal amount of locks and unlocks (or even more unlocks)
		// we should request an exit from the pointer lock
		pointerLockTurnstile = 0
		document.exitPointerLock()
	}
}

function pointerLockError(e: Event): void {
	console.log('Pointer lock error', e)
	pointerLockTurnstile = 0
}

export function lockPointer(): void {
	if (pointerLockTurnstile === 0) {
		// pointerLockTurnstile === 0 means that no requests for locking the pointer have been made
		// since we last unlocked it
		document.body.requestPointerLock().catch((e) => console.error('Lock pointer failed', e))
		// attach the event handlers only once. Once they are attached, we will track the
		// locked state and act according to the turnstile
		if (!pointerHandlerAttached) {
			pointerHandlerAttached = true
			document.addEventListener('pointerlockchange', pointerLockChange)
			document.addEventListener('pointerlockerror', pointerLockError)
		}
	}
	// regardless of any other state, modify the turnstile so that we can track locks/unlocks
	pointerLockTurnstile++
}

export function unlockPointer(): void {
	// request and exit, but bear in mind that this might not actually
	// cause an exit, for timing reasons, so lets modify the turnstile
	// to be able to act, once the lock is confirmed
	document.exitPointerLock()
	pointerLockTurnstile--
}
