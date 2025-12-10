import { getElementWidth } from '../../../utils/dimensions.js'
import { EvsContent } from '@sofie-automation/blueprints-integration'

import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer.js'
type IProps = ICustomLayerItemProps
interface IState {}

export class LocalLayerItemRenderer extends CustomLayerItemRenderer<IProps, IState> {
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

	render(): JSX.Element | false | null {
		const innerPiece = this.props.piece.instance.piece
		const { color } = innerPiece.content as EvsContent

		return (
			!this.props.isTooSmallForText && (
				<>
					{!this.props.piece.hasOriginInPreceedingPart || this.props.isLiveLine ? (
						<span
							className="segment-timeline__piece__label"
							ref={this.setLeftLabelRef}
							style={this.getItemLabelOffsetLeft()}
						>
							<span className="segment-timeline__piece__label">
								{color && (
									<span
										style={{ color: color.startsWith('#') ? color : `#${color}` }}
										className="segment-timeline__piece__label segment-timeline__piece__label__colored-mark"
									></span>
								)}
								<span className="segment-timeline__piece__label">{this.props.piece.instance.piece.name}</span>
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
