import React from 'react'
import _ from 'underscore'

import { RundownUtils } from '../../lib/rundown.js'

import { getElementWidth, getElementHeight } from '../../utils/dimensions.js'
import { onElementResize } from '../../lib/resizeObserver.js'
import { PartUi } from './SegmentTimelineContainer.js'
import { getCurrentTime } from '../../lib/systemTime.js'
import { RundownTiming } from '../RundownView/RundownTiming/RundownTiming.js'
import { SegmentTimelinePartClass } from './Parts/SegmentTimelinePart.js'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownTimingProviderContext } from '../RundownView/RundownTiming/withTiming.js'

// We're cheating a little: Fontface
declare class FontFace {
	loaded: Promise<FontFace>
	constructor(font: string, url: string, options: object)

	load(): void
}

const LABEL_FONT_URL = `url("${new URL(
	'../../../fonts/roboto-gh-pages/fonts/Light/Roboto-Light.woff2',
	import.meta.url
)}")`
const LABEL_COLOR = 'rgb(80,80,80)'
const SHORT_LINE_GRID_COLOR = 'rgb(112,112,112)'
const LONG_LINE_GRID_COLOR = 'rgb(80,80,80)'
const TIMELINE_FINISHED_BACKGROUND_COLOR = 'rgb(0,0,0)'

const FONT_SIZE = 15
const LABEL_TOP = 18
const LONG_LINE_TOP = 25
const LONG_LINE_HEIGHT = 0
const SHORT_LINE_TOP = 30
const SHORT_LINE_HEIGHT = 6

interface ITimelineGridProps {
	frameRate: number
	timeScale: number
	scrollLeft: number
	isLiveSegment: boolean
	partInstances: PartUi[]
	currentPartInstanceId: PartInstanceId | null
	onResize: (size: number[]) => void
}

let gridFont: any | undefined = undefined
let gridFontAvailable = false

export class TimelineGrid extends React.Component<ITimelineGridProps> {
	static contextType = RundownTimingProviderContext
	declare context: React.ContextType<typeof RundownTimingProviderContext>

	canvasElement: HTMLCanvasElement | null = null
	parentElement: HTMLDivElement | null = null
	ctx: CanvasRenderingContext2D | null = null

	width = 1
	height = 1
	pixelRatio = 1
	scheduledRepaint?: number | null

	private _resizeObserver: ResizeObserver | undefined

	private fontSize: number = FONT_SIZE
	private labelTop: number = LABEL_TOP
	private longLineTop: number = LONG_LINE_TOP
	private longLineHeight: number = LONG_LINE_HEIGHT
	private shortLineTop: number = SHORT_LINE_TOP
	private shortLineHeight: number = SHORT_LINE_HEIGHT

	private labelColor: string = LABEL_COLOR
	private timelineFinishedBackgroundColor = TIMELINE_FINISHED_BACKGROUND_COLOR
	private shortLineColor: string = SHORT_LINE_GRID_COLOR
	private longLineColor: string = LONG_LINE_GRID_COLOR

	private lastTotalSegmentDuration: number | null = null

	private contextResize = _.throttle(
		(parentElementWidth: number, parentElementHeight: number) => {
			if (this.ctx && this.canvasElement) {
				const devicePixelRatio = window.devicePixelRatio || 1

				const backingStoreRatio =
					(this.ctx as any).webkitBackingStorePixelRatio ||
					(this.ctx as any).mozBackingStorePixelRatio ||
					(this.ctx as any).msBackingStorePixelRatio ||
					(this.ctx as any).oBackingStorePixelRatio ||
					(this.ctx as any).backingStorePixelRatio ||
					1

				this.pixelRatio = devicePixelRatio / backingStoreRatio

				this.width = (parentElementWidth || 0) * this.pixelRatio
				this.height = (parentElementHeight || 0) * this.pixelRatio
				this.canvasElement.width = this.width
				this.canvasElement.height = this.height

				this.repaint()
			}
			if (this.props.onResize) {
				this.props.onResize([parentElementWidth || 1, parentElementHeight || 1])
			}
		},
		Math.ceil(1000 / 15)
	) // don't repaint faster than 15 fps

	private setParentRef = (element: HTMLDivElement) => {
		this.parentElement = element
	}

	private setCanvasRef = (element: HTMLCanvasElement) => {
		this.canvasElement = element

		if (this.canvasElement) {
			const style = getComputedStyle(this.canvasElement)

			this.fontSize = parseFloat(style.fontSize || FONT_SIZE.toString())
			this.labelTop = parseFloat(style.getPropertyValue('--timeline-grid-label-top') || LABEL_TOP.toString())

			this.labelColor = style.color || LABEL_COLOR
			this.longLineColor = style.getPropertyValue('--timeline-grid-long-line-color') || LONG_LINE_GRID_COLOR
			this.shortLineColor = style.getPropertyValue('--timeline-grid-short-line-color') || SHORT_LINE_GRID_COLOR
			this.timelineFinishedBackgroundColor =
				style.getPropertyValue('--timeline-grid-finished-background-color') || TIMELINE_FINISHED_BACKGROUND_COLOR

			this.longLineTop = parseFloat(style.getPropertyValue('--timeline-grid-long-line-top') || LONG_LINE_TOP.toString())
			this.longLineHeight = parseFloat(
				style.getPropertyValue('--timeline-grid-long-line-height') || LONG_LINE_HEIGHT.toString()
			)
			this.shortLineTop = parseFloat(
				style.getPropertyValue('--timeline-grid-short-line-top') || SHORT_LINE_TOP.toString()
			)
			this.shortLineHeight = parseFloat(
				style.getPropertyValue('--timeline-grid-short-line-height') || SHORT_LINE_HEIGHT.toString()
			)
		}
	}

	private onCanvasResize = (entries: ResizeObserverEntry[]) => {
		let box: DOMRectReadOnly | undefined

		if (entries && entries.length && entries[0].contentRect?.width !== undefined) {
			box = entries[0].contentRect
		}

		if (box && box.width !== undefined) {
			this.contextResize(box.width, box.height)
		} else if (this.parentElement) {
			this.contextResize(getElementWidth(this.parentElement), getElementHeight(this.parentElement))
		}
	}

	private ring(value: number, ringMax: number) {
		return value < 0 ? ringMax + (value % ringMax) : value % ringMax
	}

	private requestRepaint = () => {
		if (this.scheduledRepaint) return
		this.scheduledRepaint = window.requestAnimationFrame(this.onAnimationFrame)
	}

	private onAnimationFrame = () => {
		this.scheduledRepaint = null
		this.repaint()
	}

	private repaint = () => {
		if (!this.ctx) return

		this.ctx.lineCap = 'butt'
		this.ctx.lineWidth = 1
		this.ctx.font = (this.fontSize * this.pixelRatio).toString() + 'px GridTimecodeFont, Roboto, Arial, sans-serif'
		this.ctx.fillStyle = this.labelColor

		const fps = this.props.frameRate

		const secondTimeScale = this.props.timeScale * 1000

		// timeScale is how many pixels does a second take
		// secondsStep - draw the big, labeled line very X seconds
		let secondsStep = 5 * 60
		// interStep - draw X lines between every big line
		let interStep = 5
		if (secondTimeScale > 0 && secondTimeScale < 0.04) {
			secondsStep = 4 * 3600
			interStep = 10
		} else if (secondTimeScale > 0.04 && secondTimeScale < 0.1) {
			secondsStep = 3600
			interStep = 10
		} else if (secondTimeScale >= 0.1 && secondTimeScale < 0.5) {
			secondsStep = 600
			interStep = 10
		} else if (secondTimeScale >= 0.5 && secondTimeScale < 1) {
			secondsStep = 600
			interStep = 60
		} else if (secondTimeScale >= 1 && secondTimeScale < 3) {
			secondsStep = 300
			interStep = 10
		} else if (secondTimeScale >= 3 && secondTimeScale < 10) {
			secondsStep = 30
			interStep = 10
		} else if (secondTimeScale >= 10 && secondTimeScale < 20) {
			secondsStep = 10
			interStep = 10
		} else if (secondTimeScale >= 20 && secondTimeScale < 45) {
			secondsStep = 5
			interStep = 5
		} else if (secondTimeScale >= 45 && secondTimeScale < 90) {
			secondsStep = 2
			interStep = 2
		} else if (secondTimeScale >= 90 && secondTimeScale < 120) {
			secondsStep = 2
			interStep = 1
		} else if (secondTimeScale >= 120 && secondTimeScale < 250) {
			secondsStep = 1
			interStep = 1
		} else if (secondTimeScale >= 250) {
			secondsStep = 1
			interStep = fps || 25
		}

		const step = (secondsStep * secondTimeScale * this.pixelRatio) / interStep
		const pixelOffset = this.props.scrollLeft * this.props.timeScale * this.pixelRatio

		this.ctx.clearRect(0, 0, this.width, this.height)

		// We want to ensure that we draw at least n+1 (where n is the amount of ticks fitting on the display)
		// "large" ticks (one's with label), so we divide the display width by the amount of large steps (step / interStep)
		// and then after getting the ceil of the value, multiply it back for all the inter-steps,
		// beacuse we do the paint iteration for every line
		const maxTicks = Math.ceil(this.width / (step * interStep)) * interStep + interStep

		// We store the x-position of the 0-th line to know if a particular section is N or N+1
		// and switch between base and baseN
		// let breakX = 0

		// Go up to (width / step) + 1, to allow for the grid line + text, dissapearing on the left
		// in effect, we are rendering +1 grid lines than there should fit inside the area
		let i = 0
		for (i = 0; i < maxTicks; i++) {
			// we should offset the first step -1, as this is the one that will be dissaperaing as the
			// timeline is moving
			const xPosition = this.ring(i * step - pixelOffset, maxTicks * step) - step * interStep

			const isLabel = i % interStep === 0

			if (isLabel === true) {
				const t = Math.round(xPosition / this.pixelRatio / this.props.timeScale + this.props.scrollLeft)

				this.ctx.fillText(
					RundownUtils.formatDiffToTimecode(t, false, false, true, false, true),
					xPosition,
					this.labelTop * this.pixelRatio
				)

				this.ctx.strokeStyle = this.longLineColor
			} else {
				this.ctx.strokeStyle = this.shortLineColor
			}

			this.ctx.beginPath()
			this.ctx.moveTo(xPosition, isLabel ? this.longLineTop * this.pixelRatio : this.shortLineTop * this.pixelRatio)
			this.ctx.lineTo(
				xPosition,
				isLabel
					? this.longLineHeight > 0
						? (this.longLineTop + this.longLineHeight) * this.pixelRatio
						: this.height
					: this.shortLineHeight > 0
						? (this.shortLineTop + this.shortLineHeight) * this.pixelRatio
						: this.height
			)
			this.ctx.stroke()
		}

		this.ctx.fillStyle = this.timelineFinishedBackgroundColor
		const endOfSegment = (this.getSegmentDuration() - this.props.scrollLeft) * this.props.timeScale * this.pixelRatio
		if (endOfSegment < this.width) {
			this.ctx.fillRect(
				endOfSegment,
				(this.shortLineTop + this.shortLineHeight) * this.pixelRatio,
				this.width - endOfSegment,
				this.height
			)
		}
	}

	private getSegmentDuration(): number {
		if (this.props.isLiveSegment || this.lastTotalSegmentDuration === null) {
			const total = this.calculateSegmentDisplayDuration()
			this.lastTotalSegmentDuration = total
			return total
		}

		return this.lastTotalSegmentDuration
	}

	private onTimeupdate = () => {
		this.checkTimingChange()
	}

	private checkTimingChange = () => {
		const total = this.calculateSegmentDisplayDuration()
		if (total !== this.lastTotalSegmentDuration) {
			this.lastTotalSegmentDuration = total
			this.requestRepaint()
		}
	}

	private calculateSegmentDisplayDuration(): number {
		let total = 0
		if (this.context?.durations) {
			const durations = this.context.durations
			this.props.partInstances.forEach((partInstance) => {
				const currentTime = durations.currentTime || getCurrentTime()
				const duration =
					partInstance.instance.timings?.duration ??
					Math.max(
						SegmentTimelinePartClass.getPartDisplayDuration(partInstance, durations),
						partInstance.instance._id === this.props.currentPartInstanceId && !partInstance.instance.part.autoNext
							? SegmentTimelinePartClass.getCurrentLiveLinePosition(partInstance, currentTime) +
									SegmentTimelinePartClass.getLiveLineTimePadding(this.props.timeScale)
							: partInstance.instance._id === this.props.currentPartInstanceId && partInstance.instance.part.autoNext
								? SegmentTimelinePartClass.getCurrentLiveLinePosition(partInstance, currentTime)
								: 0
					)
				total += duration
			})
		} else {
			total = RundownUtils.getSegmentDuration(this.props.partInstances, true)
		}
		return total
	}

	render(): JSX.Element {
		return (
			<div className="segment-timeline__timeline-grid" ref={this.setParentRef}>
				<canvas
					className="segment-timeline__timeline-grid__canvas"
					ref={this.setCanvasRef}
					role="presentation"
				></canvas>
			</div>
		)
	}

	private initialize() {
		if (this.canvasElement && this.parentElement && !this.ctx) {
			this.ctx = this.canvasElement.getContext('2d', {
				// alpha: false
			})
			if (this.ctx) {
				const parentWidth = getElementWidth(this.parentElement)
				const parentHeight = getElementHeight(this.parentElement)
				this.contextResize(parentWidth, parentHeight)

				// $(window).on('resize', this.onCanvasResize)
				this._resizeObserver = onElementResize(this.parentElement, this.onCanvasResize)

				if (!gridFont && typeof FontFace !== 'undefined') {
					gridFont = new FontFace('GridTimecodeFont', LABEL_FONT_URL, {
						style: 'normal',
						weight: 100,
					})
					gridFont.load()
					gridFont.loaded
						.then(() => {
							gridFontAvailable = true
							window.requestAnimationFrame(() => {
								this.repaint()
							})
						})
						.catch((err: any) => console.log(err))
					document['fonts'].add(gridFont)
				} else if (gridFont && !gridFontAvailable) {
					gridFont.loaded.then(() => {
						window.requestAnimationFrame(() => {
							this.repaint()
						})
					})
				}

				if (this.props.onResize) {
					this.props.onResize([parentWidth || 1, parentHeight || 1])
				}
			}
		}
	}

	private reattachTimingEventListeners = () => {
		if (this.props.isLiveSegment) {
			window.removeEventListener(RundownTiming.Events.timeupdateLowResolution, this.onTimeupdate)
			window.addEventListener(RundownTiming.Events.timeupdateHighResolution, this.onTimeupdate)
		} else {
			window.addEventListener(RundownTiming.Events.timeupdateLowResolution, this.onTimeupdate)
			window.removeEventListener(RundownTiming.Events.timeupdateHighResolution, this.onTimeupdate)
		}
	}

	componentDidMount(): void {
		if (this.canvasElement && this.parentElement && !this.ctx) {
			this.initialize()
		}
		this.checkTimingChange()
		this.reattachTimingEventListeners()
	}

	shouldComponentUpdate(nextProps: ITimelineGridProps): boolean {
		if (
			nextProps.timeScale !== this.props.timeScale ||
			nextProps.scrollLeft !== this.props.scrollLeft ||
			nextProps.isLiveSegment !== this.props.isLiveSegment ||
			nextProps.partInstances !== this.props.partInstances ||
			nextProps.currentPartInstanceId !== this.props.currentPartInstanceId
		) {
			return true
		}
		return false
	}

	componentDidUpdate(prevProps: ITimelineGridProps): void {
		if (this.canvasElement && this.parentElement && !this.ctx) {
			this.initialize()
		}

		if (
			prevProps.isLiveSegment !== this.props.isLiveSegment ||
			prevProps.partInstances !== this.props.partInstances ||
			prevProps.currentPartInstanceId !== this.props.currentPartInstanceId
		) {
			this.lastTotalSegmentDuration = null
		}

		if (prevProps.isLiveSegment !== this.props.isLiveSegment) {
			this.reattachTimingEventListeners()
		}

		this.requestRepaint()
	}

	componentWillUnmount(): void {
		if (this._resizeObserver) this._resizeObserver.disconnect()
		window.removeEventListener(RundownTiming.Events.timeupdateLowResolution, this.onTimeupdate)
		window.removeEventListener(RundownTiming.Events.timeupdateHighResolution, this.onTimeupdate)
	}
}
