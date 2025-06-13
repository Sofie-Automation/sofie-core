import * as React from 'react'
import { getElementWidth } from '../../../utils/dimensions'

import { NoraContent, SourceLayerType } from '@sofie-automation/blueprints-integration'
import classNames from 'classnames'
import { RundownUtils } from '../../../lib/rundown'
import { L3rdFloatingInspector } from '../../FloatingInspectors/L3rdFloatingInspector'
import { PieceMultistepChevron, getPieceSteps } from '../../SegmentContainer/PieceMultistepChevron'
import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'

type IProps = ICustomLayerItemProps
interface IState {
	leftLabelWidth: number
	rightLabelWidth: number
	multistepPillWidth: number
	stepsStyle: React.CSSProperties | null
}

export class L3rdSourceRenderer extends CustomLayerItemRenderer<IProps, IState> {
	leftLabel: HTMLElement | null = null
	rightLabel: HTMLElement | null = null
	lastOverflowTime: boolean | undefined

	constructor(props: IProps) {
		super(props)
		this.state = {
			leftLabelWidth: 0,
			rightLabelWidth: 0,
			multistepPillWidth: 0,
			stepsStyle: null,
		}
	}

	private updateAnchoredElsWidths = () => {
		const leftLabelWidth = this.leftLabel ? getElementWidth(this.leftLabel) : 0
		const rightLabelWidth = this.rightLabel ? getElementWidth(this.rightLabel) : 0

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)

		this.setState({
			leftLabelWidth,
			rightLabelWidth,
		})
	}

	private setLeftLabelRef = (el: HTMLSpanElement) => {
		this.leftLabel = el
	}

	private setRightLabelRef = (el: HTMLSpanElement) => {
		this.rightLabel = el
	}

	private setMultistepPillEl = (el: HTMLSpanElement | null) => {
		if (!el) {
			this.setState({
				multistepPillWidth: 0,
			})
			return
		}

		const { width } = el.getBoundingClientRect()
		this.setState({
			multistepPillWidth: width,
		})
	}

	componentDidMount(): void {
		this.updateAnchoredElsWidths()
	}

	componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>): void {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		const timeOverflow = this.doesOverflowTime()
		const newOverflowTime = timeOverflow !== false && timeOverflow > 0 ? true : false
		if (
			this.props.piece.instance.piece.name !== prevProps.piece.instance.piece.name ||
			newOverflowTime !== this.lastOverflowTime
		) {
			this.lastOverflowTime = newOverflowTime
			this.updateAnchoredElsWidths()
		}
	}

	static getDerivedStateFromProps(props: Readonly<IProps>, state: Readonly<IState>): Partial<IState> {
		const {
			scrollLeft,
			timeScale,
			isLiveLine,
			liveLineHistorySize,
			followLiveLine,
			isPreview,
			relative,
			partStartsAt,
			piece,
		} = props
		const { leftLabelWidth, multistepPillWidth } = state
		if (!isLiveLine || !followLiveLine || isPreview || relative) {
			return {
				stepsStyle: null,
			}
		}

		const inPoint = piece.renderedInPoint || 0
		const targetPos = Math.min(
			(scrollLeft - inPoint - partStartsAt) * timeScale - multistepPillWidth - 10,
			leftLabelWidth - multistepPillWidth - liveLineHistorySize
		)

		return {
			stepsStyle: {
				transform: ` translate(${targetPos}px, 0) ` + ` translate(${liveLineHistorySize}px, 0) `,
				willChange: 'transform',
			},
		}
	}

	render(): JSX.Element {
		const { piece, isTooSmallForText, isLiveLine } = this.props
		const innerPiece = piece.instance.piece
		const noraContent = innerPiece.content as NoraContent | undefined

		const hasStepChevron = getPieceSteps(piece)
		const multistepPill = (
			<PieceMultistepChevron
				ref={this.setMultistepPillEl}
				className="segment-timeline__piece__step segment-timeline__piece__step--fixed-width"
				piece={piece}
				style={this.state.stepsStyle ?? undefined}
			/>
		)

		return (
			<React.Fragment>
				{!isTooSmallForText && (
					<>
						{!piece.hasOriginInPreceedingPart || isLiveLine ? (
							<span
								className={classNames('segment-timeline__piece__label', {
									'with-steps': hasStepChevron,
								})}
								ref={this.setLeftLabelRef}
								style={this.getItemLabelOffsetLeft()}
							>
								{multistepPill}
								<span className="segment-timeline__piece__label">{innerPiece.name}</span>
							</span>
						) : null}
						<span
							className="segment-timeline__piece__label right-side overflow-label"
							ref={this.setRightLabelRef}
							style={this.getItemLabelOffsetRight()}
						>
							{this.renderInfiniteIcon()}
							{this.renderLoopIcon()}
							{this.renderOverflowTimeLabel()}
						</span>
					</>
				)}
				<L3rdFloatingInspector
					content={noraContent}
					typeClass={this.props.typeClass || RundownUtils.getSourceLayerClassName(SourceLayerType.LOWER_THIRD)}
					itemElement={this.props.itemElement}
					piece={this.props.piece.instance.piece}
					showMiniInspector={this.props.showMiniInspector}
					position={this.getFloatingInspectorStyle()}
					pieceRenderedDuration={this.props.piece.renderedDuration}
					pieceRenderedIn={this.props.piece.renderedInPoint}
				/>
			</React.Fragment>
		)
	}
}
