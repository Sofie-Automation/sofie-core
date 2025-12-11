import * as React from 'react'
import _ from 'underscore'
import ClassNames from 'classnames'
import { Manager, Popper, Reference } from 'react-popper'

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
	disabled?: boolean
	onChange?: (event: ColorPickerEvent) => void
}

interface IState {
	selectedValue: string
	expanded: boolean
}

export class ColorPicker extends React.Component<IProps, IState> {
	private _popperRef: HTMLElement | null = null
	private _popperUpdate: (() => Promise<any>) | undefined

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

	async componentDidUpdate(prevProps: IProps): Promise<void> {
		if (this.props.value !== prevProps.value) {
			this.refreshChecked()
		}

		if (this.state.expanded && typeof this._popperUpdate === 'function') {
			await this._popperUpdate()
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
			expanded: false,
		})

		if (this.props.onChange && typeof this.props.onChange === 'function') {
			this.props.onChange({ selectedValue: value })
		}
	}

	private toggleExpco = async (e: React.MouseEvent<HTMLElement>) => {
		e.preventDefault()
		e.stopPropagation()

		if (this.props.disabled) return

		if (typeof this._popperUpdate === 'function') {
			await this._popperUpdate()
		}

		this.setState({
			expanded: !this.state.expanded,
		})
	}

	private setPopperRef = (ref: HTMLDivElement | null, popperRef: React.Ref<any>) => {
		this._popperRef = ref
		if (typeof popperRef === 'function') {
			popperRef(ref)
		}
	}

	private setUpdate = (update: () => Promise<any>) => {
		this._popperUpdate = update
	}

	private onBlur = (event: React.FocusEvent<HTMLDivElement>) => {
		if (
			!(
				event.relatedTarget &&
				event.relatedTarget instanceof HTMLElement &&
				this._popperRef &&
				(this._popperRef === event.relatedTarget || this._popperRef.contains(event.relatedTarget))
			)
		) {
			this.setState({
				expanded: false,
			})
		}
	}

	render(): JSX.Element {
		return (
			<Manager>
				<Reference>
					{({ ref }) => (
						<div
							ref={ref}
							className={ClassNames(
								'expco form-select colorpicker',
								{
									'expco-expanded': this.state.expanded,
									disabled: this.props.disabled,
								},
								this.props.className
							)}
							tabIndex={-1}
							onBlur={this.onBlur}
							onClick={this.toggleExpco}
						>
							<div className={ClassNames('expco-title focusable-main')} onClick={this.toggleExpco}>
								<div className="color-preview" style={{ backgroundColor: this.state.selectedValue }}></div>
							</div>
							<a className="action-btn right expco-expand" onClick={this.toggleExpco}>
								&nbsp;
							</a>
						</div>
					)}
				</Reference>
				<Popper
					placement="bottom-start"
					modifiers={[
						{ name: 'flip', enabled: false },
						{ name: 'offset', enabled: true, options: { offset: [0, -1] } },
						{
							name: 'eventListeners',
							enabled: true,
							options: {
								scroll: this.state.expanded,
								resize: this.state.expanded,
							},
						},
					]}
				>
					{({ ref, style, placement, update }) => {
						this.setUpdate(update)
						return (
							<div
								ref={(r) => this.setPopperRef(r, ref)}
								style={style}
								data-placement={placement}
								className={ClassNames(
									'expco expco-popper colorpicker',
									{
										'expco-expanded': this.state.expanded,
									},
									this.props.className
								)}
								tabIndex={-1}
								onBlur={this.onBlur}
							>
								{this.state.expanded && (
									<div className="expco-body bd">
										<div className="expco-list">
											{_.map(this.props.availableOptions, (value, key) => {
												return (
													<div className="expco-item" key={key}>
														<label className="action-btn" onClick={() => this.handleChange(value)}>
															<div className="color-preview" style={{ backgroundColor: value }}></div>
														</label>
													</div>
												)
											})}
										</div>
									</div>
								)}
							</div>
						)
					}}
				</Popper>
			</Manager>
		)
	}
}
