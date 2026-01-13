import * as React from 'react'
import _ from 'underscore'
import ClassNames from 'classnames'
import { Manager, Reference, Popper } from 'react-popper'
import Form from 'react-bootstrap/esm/Form'

export interface MultiSelectEvent {
	selectedValues: Array<string>
}

export type MultiSelectOptions = Record<string, { value: string | string[]; className?: string }>

interface IProps {
	/**
	 * A value of type string results in a checkbox with the key becoming the label.
	 * A value of type string[] results in a group of checkboxes with the key becoming the header of the group.
	 */
	availableOptions: MultiSelectOptions
	placeholder?: string
	className?: string
	value?: Array<string>
	onChange?: (event: MultiSelectEvent) => void
	disabled?: boolean
}

interface IState {
	checkedValues: _.Dictionary<boolean>
	expanded: boolean
}

export class MultiSelect extends React.Component<IProps, IState> {
	private _titleRef: HTMLElement | null = null
	private _popperRef: HTMLElement | null = null
	private _popperUpdate: (() => Promise<any>) | undefined

	constructor(props: IProps) {
		super(props)

		this.state = {
			checkedValues: {},
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
		if (this.props.value && _.isArray(this.props.value)) {
			const checkedValues: _.Dictionary<boolean> = {}
			_.forEach(this.props.value, (value) => {
				checkedValues[value] = true
			})

			this.setState({
				checkedValues,
			})
		} else {
			this.setState({
				checkedValues: {},
			})
		}
	}

	private handleChange = (key: string) => {
		const valueUpdate = {
			...this.state.checkedValues,
			[key]: !this.state.checkedValues[key],
		}

		this.setState({
			checkedValues: valueUpdate,
		})

		if (this.props.onChange && typeof this.props.onChange === 'function') {
			this.props.onChange({
				selectedValues: _.compact(
					_.values(
						_.mapObject(valueUpdate, (value, key) => {
							return value ? key : null
						})
					)
				),
			})
		}
	}

	private isChecked = (key: string): boolean => {
		return !!this.state.checkedValues[key]
	}

	private generateSimpleSummary = () => {
		return _.compact(
			_.values(
				_.mapObject(this.state.checkedValues, (value, key) => {
					return value ? this.props.availableOptions[key].value || key : null
				})
			)
		).join(', ')
	}

	private generateRichSummary = () => {
		return (
			<>
				{_.compact(
					_.values(
						_.mapObject(this.state.checkedValues, (value, key) => {
							return value ? (
								<span key={key} className={this.props.availableOptions[key].className}>
									{this.props.availableOptions[key].value || key}
								</span>
							) : null
						})
					)
				)}
			</>
		)
	}

	private onBlur = (event: React.FocusEvent<HTMLDivElement>) => {
		if (
			!(
				event.relatedTarget &&
				event.relatedTarget instanceof HTMLElement &&
				this._popperRef &&
				(this._popperRef === event.relatedTarget ||
					this._popperRef.contains(event.relatedTarget) ||
					this._titleRef === event.relatedTarget)
			)
		) {
			this.setState({
				expanded: false,
			})
		}
	}

	private toggleExpco = async (e: React.MouseEvent<any>) => {
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

	private setTitleRef = (ref: HTMLDivElement | null, popperRef: React.Ref<any>) => {
		this._titleRef = ref
		if (typeof popperRef === 'function') {
			popperRef(ref)
		}
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

	private renderOption = (value: string, key: string, className: string | undefined) => {
		return (
			<div className="expco-item" key={key}>
				<Form.Check
					className={ClassNames(className)}
					checked={this.isChecked(key)}
					onChange={() => this.handleChange(key)}
					id={`multiseelct-${value}`}
					label={value}
				/>
			</div>
		)
	}

	render(): JSX.Element {
		const simpleSummary = this.generateSimpleSummary()
		return (
			<Manager>
				<Reference>
					{({ ref }) => (
						<div
							ref={(r) => this.setTitleRef(r, ref)}
							className={ClassNames(
								'expco form-select',
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
							<div
								className={ClassNames('expco-title', {
									'title-placeholder': !simpleSummary,
								})}
								title={simpleSummary || this.props.placeholder || ''}
							>
								{this.generateRichSummary() || this.props.placeholder || ''}
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
									'expco expco-popper dropdown',
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
										{_.values(
											_.mapObject(this.props.availableOptions, (value, key) => {
												return Array.isArray(value.value) ? (
													<React.Fragment key={key}>
														<p className="expco-item" key={key}>
															{key}
														</p>
														{value.value.map((v) => this.renderOption(v, v, value.className))}
													</React.Fragment>
												) : (
													this.renderOption(value.value, key, value.className)
												)
											})
										)}
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
