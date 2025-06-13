import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'

import { faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export interface ColorPickerEvent {
	selectedValue: string
}

export const defaultColorPickerPalette = [
	'#ffffff',
	'#23ad94',
	'#14c942',
	'#1769ff',
	'#8e44ad',
	'#1c177a',
	'#000000',
	'#f0d718',
	'#e67e22',
	'#e82c2c',
	'#ecf0f1',
	'#95a5a6',
	'#ac29a5',
	'#00a97f',
	'#005919',
	'#af4900',
	'#ca9d00',
	'#370020',
	'#1769ff',
]

interface IProps {
	availableOptions: Array<string>
	placeholder?: string
	className?: string
	value?: string
	onChange?: (event: ColorPickerEvent) => void
}

interface IState {
	selectedValue: string
	expanded: boolean
}

export class ColorPicker extends React.Component<IProps, IState> {
	constructor(props: IProps) {
		super(props)

		this.state = {
			selectedValue: '',
			expanded: false,
		}
	}

	componentDidMount(): void {
		this.refreshChecked()
	}

	componentDidUpdate(prevProps: IProps): void {
		if (this.props.value !== prevProps.value) {
			this.refreshChecked()
		}
	}

	private refreshChecked() {
		if (this.props.value) {
			this.setState({
				selectedValue: this.props.value,
			})
		} else {
			this.setState({
				selectedValue: '',
			})
		}
	}

	private handleChange = (value: string) => {
		this.setState({
			selectedValue: value,
		})

		if (this.props.onChange && typeof this.props.onChange === 'function') {
			this.props.onChange({ selectedValue: value })
		}
		this.toggleExpco()
	}

	private toggleExpco = () => {
		this.setState({
			expanded: !this.state.expanded,
		})
	}

	render(): JSX.Element {
		return (
			<div
				className={ClassNames(
					'expco focusable subtle colorpicker',
					{
						'expco-expanded': this.state.expanded,
					},
					this.props.className
				)}
			>
				<div className={ClassNames('expco-title focusable-main')} onClick={this.toggleExpco}>
					<div className="color-preview" style={{ backgroundColor: this.state.selectedValue }}></div>
				</div>
				<a className="action-btn right expco-expand subtle" onClick={this.toggleExpco}>
					<FontAwesomeIcon icon={faChevronUp} />
				</a>
				<div className="expco-body bd">
					{_.values(
						_.mapObject(this.props.availableOptions, (value, key) => {
							return (
								<div className="expco-item" key={key}>
									<label className="action-btn" onClick={() => this.handleChange(value)}>
										<div className="color-preview" style={{ backgroundColor: value }}></div>
									</label>
								</div>
							)
						})
					)}
				</div>
			</div>
		)
	}
}
