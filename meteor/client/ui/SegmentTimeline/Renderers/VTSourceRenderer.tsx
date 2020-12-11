import * as React from 'react'
import ReactDOM from 'react-dom'
import * as _ from 'underscore'

import { getElementWidth } from '../../../utils/dimensions'

import ClassNames from 'classnames'
import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
import { MediaObject, Anomaly } from '../../../../lib/collections/MediaObjects'

import { Lottie } from '@crello/react-lottie'
// @ts-ignore Not recognized by Typescript
import * as loopAnimation from './icon-loop.json'
import { withTranslation, WithTranslation } from 'react-i18next'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { PieceStatusIcon } from '../PieceStatusIcon'
import { NoticeLevel, getNoticeLevelForPieceStatus } from '../../../lib/notifications/notifications'
import { VTFloatingInspector } from '../../FloatingInspectors/VTFloatingInspector'

interface IProps extends ICustomLayerItemProps {}
interface IState {
	scenes?: Array<number>
	blacks?: Array<Anomaly>
	freezes?: Array<Anomaly>

	rightLabelIsAppendage?: boolean
	noticeLevel: NoticeLevel | null
	begin: string
	end: string
}
export class VTSourceRendererBase extends CustomLayerItemRenderer<IProps & WithTranslation, IState> {
	private vPreview: HTMLVideoElement
	private leftLabel: HTMLSpanElement
	private rightLabel: HTMLSpanElement

	private metadataRev: string | undefined

	private leftLabelNodes: JSX.Element
	private rightLabelNodes: JSX.Element

	private rightLabelContainer: HTMLSpanElement | null

	private static readonly defaultLottieOptions = {
		loop: true,
		autoplay: false,
		animationData: loopAnimation,
		rendererSettings: {
			preserveAspectRatio: 'xMidYMid slice',
		},
	}

	constructor(props: IProps & WithTranslation) {
		super(props)

		const innerPiece = props.piece.instance.piece

		let labelItems = innerPiece.name.split('||')

		this.state = {
			noticeLevel: getNoticeLevelForPieceStatus(innerPiece.status),
			begin: labelItems[0] || '',
			end: labelItems[1] || '',
		}

		this.rightLabelContainer = document.createElement('span')
	}

	setVideoRef = (e: HTMLVideoElement) => {
		this.vPreview = e
	}

	setLeftLabelRef = (e: HTMLSpanElement) => {
		this.leftLabel = e
	}

	setRightLabelRef = (e: HTMLSpanElement) => {
		this.rightLabel = e
	}

	getItemLabelOffsetRight(): React.CSSProperties {
		return {
			...super.getItemLabelOffsetRight(),
			top: this.state.rightLabelIsAppendage
				? `calc(${this.props.layerIndex} * var(--segment-layer-height))`
				: undefined,
		}
	}

	componentDidMount() {
		if (super.componentDidMount && typeof super.componentDidMount === 'function') {
			super.componentDidMount()
		}

		const { itemElement } = this.props

		this.updateAnchoredElsWidths()
		const metadata = this.props.piece.contentMetaData as MediaObject
		if (metadata && metadata._rev) {
			this.metadataRev = metadata._rev // update only if the metadata object changed

			this.setState({
				scenes: this.getScenes(),
				freezes: this.getFreezes(),
				blacks: this.getBlacks(),
			})
		}

		if (this.rightLabelContainer && itemElement) {
			const itemDuration = this.getItemDuration(true)
			if (itemDuration === Number.POSITIVE_INFINITY) {
				itemElement.parentNode &&
					itemElement.parentNode.parentNode &&
					itemElement.parentNode.parentNode.parentNode &&
					itemElement.parentNode.parentNode.parentNode.appendChild(this.rightLabelContainer)

				this.setState({
					rightLabelIsAppendage: true,
				})
			} else {
				itemElement.appendChild(this.rightLabelContainer)
			}

			// ReactDOM.render(this.rightLabelNodes, this.rightLabelContainer)
		}
	}

	updateAnchoredElsWidths = () => {
		const leftLabelWidth = this.leftLabel ? getElementWidth(this.leftLabel) : 0
		const rightLabelWidth = this.rightLabel ? getElementWidth(this.rightLabel) : 0

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	componentDidUpdate(prevProps: Readonly<IProps & WithTranslation>, prevState: Readonly<IState>) {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		const { itemElement } = this.props
		const innerPiece = this.props.piece.instance.piece

		if (innerPiece.name !== prevProps.piece.instance.piece.name) {
			this.updateAnchoredElsWidths()
		}

		const newState: Partial<IState> = {}
		if (
			innerPiece.name !== prevProps.piece.instance.piece.name ||
			innerPiece.status !== prevProps.piece.instance.piece.status
		) {
			let labelItems = innerPiece.name.split('||')
			newState.noticeLevel = getNoticeLevelForPieceStatus(innerPiece.status)
			newState.begin = labelItems[0] || ''
			newState.end = labelItems[1] || ''
		}

		const metadata = this.props.piece.contentMetaData as MediaObject
		if (metadata && metadata._rev && metadata._rev !== this.metadataRev) {
			this.metadataRev = metadata._rev // update only if the metadata object changed
			newState.scenes = this.getScenes()
			newState.freezes = this.getFreezes()
			newState.blacks = this.getBlacks()
		} else if (!metadata && this.metadataRev !== undefined) {
			this.metadataRev = undefined

			newState.scenes = undefined
			newState.freezes = undefined
			newState.blacks = undefined
		}

		if (this.rightLabelContainer && itemElement) {
			const itemDuration = this.getItemDuration(true)
			if (itemElement !== prevProps.itemElement) {
				if (itemDuration === Number.POSITIVE_INFINITY) {
					itemElement.parentNode &&
						itemElement.parentNode.parentNode &&
						itemElement.parentNode.parentNode.parentNode &&
						itemElement.parentNode.parentNode.parentNode.appendChild(this.rightLabelContainer)

					newState.rightLabelIsAppendage = true
				} else {
					this.rightLabelContainer?.remove()
					itemElement.appendChild(this.rightLabelContainer)
					newState.rightLabelIsAppendage = false
				}
			} else if (prevProps.partDuration !== this.props.partDuration) {
				if (itemDuration === Number.POSITIVE_INFINITY && this.state.rightLabelIsAppendage === false) {
					itemElement.parentNode &&
						itemElement.parentNode.parentNode &&
						itemElement.parentNode.parentNode.parentNode &&
						itemElement.parentNode.parentNode.parentNode.appendChild(this.rightLabelContainer)

					newState.rightLabelIsAppendage = true
				} else if (itemDuration !== Number.POSITIVE_INFINITY && this.state.rightLabelIsAppendage === true) {
					this.rightLabelContainer?.remove()
					itemElement.appendChild(this.rightLabelContainer)
					newState.rightLabelIsAppendage = false
				}
			}
		}

		if (Object.keys(newState).length > 0) {
			this.setState(newState as IState)
		}

		// ReactDOM.render(this.rightLabelNodes, this.rightLabelContainer!)
	}

	componentWillUnmount() {
		if (super.componentWillUnmount && typeof super.componentWillUnmount === 'function') {
			super.componentWillUnmount()
		}

		if (this.rightLabelContainer) {
			// ReactDOM.unmountComponentAtNode(this.rightLabelContainer)
			this.rightLabelContainer.remove()
			this.rightLabelContainer = null
		}
	}

	getScenes = (): Array<number> | undefined => {
		if (this.props.piece) {
			const itemDuration = this.getItemDuration()
			const item = this.props.piece
			const metadata = item.contentMetaData as MediaObject
			if (metadata && metadata.mediainfo && metadata.mediainfo.scenes) {
				return _.compact(
					metadata.mediainfo.scenes.map((i) => {
						if (i < itemDuration) {
							return i * 1000
						}
						return undefined
					})
				) // convert into milliseconds
			}
		}
	}

	getFreezes = (): Array<Anomaly> | undefined => {
		if (this.props.piece) {
			const itemDuration = this.getItemDuration()
			const item = this.props.piece
			const metadata = item.contentMetaData as MediaObject
			let items: Array<Anomaly> = []
			// add freezes
			if (metadata && metadata.mediainfo && metadata.mediainfo.freezes) {
				items = metadata.mediainfo.freezes
					.filter((i) => i.start < itemDuration)
					.map(
						(i): Anomaly => {
							return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 }
						}
					)
			}
			return items
		}
	}

	getBlacks = (): Array<Anomaly> | undefined => {
		if (this.props.piece) {
			const itemDuration = this.getItemDuration()
			const item = this.props.piece
			const metadata = item.contentMetaData as MediaObject
			let items: Array<Anomaly> = []
			// add blacks
			if (metadata && metadata.mediainfo && metadata.mediainfo.blacks) {
				items = [
					...items,
					...metadata.mediainfo.blacks
						.filter((i) => i.start < itemDuration)
						.map(
							(i): Anomaly => {
								return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 }
							}
						),
				]
			}
			return items
		}
	}

	getInspectorWarnings = (time: number): JSX.Element | undefined => {
		let show = false
		let msgBlacks = ''
		let msgFreezes = ''
		const item = this.props.piece
		const metadata = item.contentMetaData as MediaObject
		const timebase = metadata.mediainfo && metadata.mediainfo.timebase ? metadata.mediainfo.timebase : 20
		if (this.state.blacks) {
			let tot = 0
			for (const b of this.state.blacks) {
				tot += b.duration
				let s = b.start
				let e = b.end
				if (b.duration < 5000) {
					s = b.start + b.duration * 0.5 - 2500
					e = b.end - b.duration * 0.5 + 2500
				}
				if (s < time && e > time) {
					show = true
				}
			}
			// @todo: hardcoded 25fps
			if (tot > 0) msgBlacks = `${Math.round(tot / timebase)} black frame${tot > timebase ? 's' : ''} in clip`
		}
		if (this.state.freezes) {
			let tot = 0
			for (const b of this.state.freezes) {
				tot += b.duration
				let s = b.start
				let e = b.end
				if (b.duration < 5000) {
					s = b.start + b.duration * 0.5 - 2500
					e = b.end - b.duration * 0.5 + 2500
				}
				if (s < time && e > time) {
					show = true
				}
			}
			// @todo: hardcoded 25fps
			if (tot > 0) msgFreezes += `${Math.round(tot / timebase)} freeze\n frame${tot > timebase ? 's' : ''} in clip`
		}
		if (show) {
			return (
				<React.Fragment>
					<div className="segment-timeline__mini-inspector__warnings">
						{msgBlacks}
						{msgFreezes && <br />}
						{msgFreezes}
					</div>
				</React.Fragment>
			)
		} else {
			return undefined
		}
	}

	renderLeftLabel() {
		const { noticeLevel, begin, end } = this.state

		const vtContent = this.props.piece.instance.piece.content as VTContent | undefined

		return (
			<span className="segment-timeline__piece__label" ref={this.setLeftLabelRef} style={this.getItemLabelOffsetLeft()}>
				{noticeLevel !== null && <PieceStatusIcon noticeLevel={noticeLevel} />}
				<span
					className={ClassNames('segment-timeline__piece__label', {
						'overflow-label': end !== '',
					})}>
					{begin}
				</span>
				{begin && end === '' && vtContent && vtContent.loop && (
					<div className="segment-timeline__piece__label label-icon label-loop-icon">
						<Lottie
							config={VTSourceRendererBase.defaultLottieOptions}
							width="24px"
							height="24px"
							playingState={this.props.showMiniInspector ? 'playing' : 'stopped'}
						/>
					</div>
				)}
				{this.renderContentTrimmed()}
			</span>
		)
	}

	renderRightLabel() {
		const { begin, end } = this.state

		const vtContent = this.props.piece.instance.piece.content as VTContent | undefined

		return (
			<span
				className={ClassNames('segment-timeline__piece__label right-side', {
					'segment-timeline__piece-appendage': this.state.rightLabelIsAppendage,
					hidden: this.props.outputGroupCollapsed,
				})}
				ref={this.setRightLabelRef}
				style={this.getItemLabelOffsetRight()}>
				{end && vtContent && vtContent.loop && (
					<div className="segment-timeline__piece__label label-icon label-loop-icon">
						<Lottie
							config={VTSourceRendererBase.defaultLottieOptions}
							width="24px"
							height="24px"
							playingState={this.props.showMiniInspector ? 'playing' : 'stopped'}
						/>
					</div>
				)}
				<span className="segment-timeline__piece__label last-words">{end}</span>
				{this.renderInfiniteIcon()}
				{this.renderOverflowTimeLabel()}
			</span>
		)
	}

	render() {
		const itemDuration = this.getItemDuration()
		const vtContent = this.props.piece.instance.piece.content as VTContent | undefined
		const seek = vtContent && vtContent.seek ? vtContent.seek : 0

		const realCursorTimePosition = this.props.cursorTimePosition + seek

		if (!this.props.relative) {
			this.leftLabelNodes = this.renderLeftLabel()
			this.rightLabelNodes = this.renderRightLabel()
		}

		return (
			<React.Fragment>
				{this.renderInfiniteItemContentEnded()}
				{this.state.scenes &&
					this.state.scenes.map(
						(i) =>
							i < itemDuration &&
							i - seek >= 0 && (
								<span
									className="segment-timeline__piece__scene-marker"
									key={i}
									style={{ left: ((i - seek) * this.props.timeScale).toString() + 'px' }}></span>
							)
					)}
				{this.state.freezes &&
					this.state.freezes.map(
						(i) =>
							i.start < itemDuration &&
							i.start - seek >= 0 && (
								<span
									className="segment-timeline__piece__anomaly-marker"
									key={i.start}
									style={{
										left: ((i.start - seek) * this.props.timeScale).toString() + 'px',
										width:
											(Math.min(itemDuration - i.start + seek, i.duration) * this.props.timeScale).toString() + 'px',
									}}></span>
							)
					)}
				{this.state.blacks &&
					this.state.blacks.map(
						(i) =>
							i.start < itemDuration &&
							i.start - seek >= 0 && (
								<span
									className="segment-timeline__piece__anomaly-marker segment-timeline__piece__anomaly-marker__freezes"
									key={i.start}
									style={{
										left: ((i.start - seek) * this.props.timeScale).toString() + 'px',
										width:
											(Math.min(itemDuration - i.start + seek, i.duration) * this.props.timeScale).toString() + 'px',
									}}></span>
							)
					)}
				{this.leftLabelNodes}
				{this.rightLabelContainer && ReactDOM.createPortal(this.rightLabelNodes, this.rightLabelContainer)}
				<VTFloatingInspector
					floatingInspectorStyle={this.getFloatingInspectorStyle()}
					content={vtContent}
					itemElement={this.props.itemElement}
					noticeLevel={this.state.noticeLevel}
					showMiniInspector={this.props.showMiniInspector}
					timePosition={realCursorTimePosition}
					mediaPreviewUrl={this.props.mediaPreviewUrl}
					typeClass={this.props.typeClass}
					contentMetaData={this.props.piece.contentMetaData}
					noticeMessage={this.props.piece.message || ''}
					renderedDuration={this.props.piece.renderedDuration || undefined}
				/>
			</React.Fragment>
		)
	}
}

export const VTSourceRenderer = withTranslation()(VTSourceRendererBase)
