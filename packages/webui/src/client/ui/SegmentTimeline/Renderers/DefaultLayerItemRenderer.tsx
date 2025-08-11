import ClassNames from 'classnames'
import { getElementWidth } from '../../../utils/dimensions.js'

import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer.js'
type IProps = ICustomLayerItemProps
interface IState {}

export class DefaultLayerItemRenderer extends CustomLayerItemRenderer<IProps, IState> {
	leftLabel: HTMLSpanElement | null = null
	rightLabel: HTMLSpanElement | null = null

	private setLeftLabelRef = (e: HTMLSpanElement) => {
		this.leftLabel = e
	}

	private setRightLabelRef = (e: HTMLSpanElement) => {
		this.rightLabel = e
	}

	componentDidMount(): void {
		this.updateAnchoredElsWidths()
	}

	private updateAnchoredElsWidths = () => {
		const leftLabelWidth = this.leftLabel ? getElementWidth(this.leftLabel) : 0
		const rightLabelWidth = this.rightLabel ? getElementWidth(this.rightLabel) : 0

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>): void {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		if (this.props.piece.instance.piece.name !== prevProps.piece.instance.piece.name) {
			this.updateAnchoredElsWidths()
		}
	}

	render(): JSX.Element | false {
		const label = this.props.piece.instance.piece.name
		const duration = this.renderDuration()

		return (
			!this.props.isTooSmallForText && (
				<>
					{!this.props.piece.hasOriginInPreceedingPart || this.props.isLiveLine ? (
						<span
							className="segment-timeline__piece__label"
							ref={this.setLeftLabelRef}
							style={this.getItemLabelOffsetLeft()}
						>
							<span
								className={ClassNames('segment-timeline__piece__label', {
									'with-duration': !!duration,
									[`with-duration--${this.getSourceDurationLabelAlignment()}`]: !!duration,
								})}
							>
								{duration ? (
									<>
										<span>{label}</span>
										{duration}
									</>
								) : (
									label
								)}
							</span>
						</span>
					) : null}
					<span
						className="segment-timeline__piece__label right-side overflow-label"
						ref={this.setRightLabelRef}
						style={this.getItemLabelOffsetRight()}
					>
						{this.renderInfiniteIcon()}
						{this.renderOverflowTimeLabel()}
					</span>
				</>
			)
		)
	}
}
