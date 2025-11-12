import { getElementWidth } from '../../../utils/dimensions.js'

import { TransitionContent } from '@sofie-automation/blueprints-integration'

import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer.js'
import { createPrivateApiPath } from '../../../url.js'

type IProps = ICustomLayerItemProps
interface IState {
	iconFailed: boolean
}
export class TransitionSourceRenderer extends CustomLayerItemRenderer<IProps, IState> {
	leftLabel: HTMLElement | null = null
	rightLabel: HTMLElement | null = null

	constructor(props: IProps) {
		super(props)

		this.state = {
			...this.state,
			iconFailed: false,
		}
	}

	private updateAnchoredElsWidths = () => {
		const leftLabelWidth = this.leftLabel ? getElementWidth(this.leftLabel) : 0

		this.setAnchoredElsWidths(leftLabelWidth, 0)
	}

	private setLeftLabelRef = (e: HTMLSpanElement) => {
		this.leftLabel = e
	}

	componentDidMount(): void {
		this.updateAnchoredElsWidths()
	}

	// this will be triggered if the SVG icon for the transition will 404.
	private iconFailed = () => {
		this.setState({
			iconFailed: true,
		})
	}

	componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>): void {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		if (this.props.piece.instance.piece.name !== prevProps.piece.instance.piece.name) {
			this.updateAnchoredElsWidths()
		}
	}

	render(): JSX.Element {
		const content = this.props.piece.instance.piece.content as TransitionContent | undefined
		return (
			<>
				{!this.props.piece.hasOriginInPreceedingPart || this.props.isLiveLine ? (
					<span
						className="segment-timeline__piece__label with-overflow"
						ref={this.setLeftLabelRef}
						style={this.getItemLabelOffsetLeft()}
					>
						{this.props.piece.instance.piece.name}
						{content?.icon && !this.state.iconFailed && (
							<img
								src={createPrivateApiPath('blueprints/assets/' + content.icon)}
								className="segment-timeline__piece__label__transition-icon"
								onError={this.iconFailed}
								alt={this.props.piece.instance.piece.name}
								role="presentation"
							/>
						)}
					</span>
				) : null}
				{/* {this.props.showMiniInspector && !this.state.iconFailed && content?.preview && (
					<TransitionFloatingInspector position={this.getFloatingInspectorStyle()} preview={content.preview} />
				)} */}
			</>
		)
	}
}
