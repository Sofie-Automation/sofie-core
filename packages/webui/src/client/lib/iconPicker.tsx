import * as React from 'react'
import _ from 'underscore'
import ClassNames from 'classnames'

import { library } from '@fortawesome/fontawesome-svg-core'
import { fas, IconName, IconPack, IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { withTranslation } from 'react-i18next'
import { Translated } from './ReactMeteorData/ReactMeteorData.js'
import { Manager, Popper, Reference } from 'react-popper'
import Form from 'react-bootstrap/esm/Form'

library.add(fas)

export interface IconPickerEvent {
	selectedValue: IconName | ''
}

interface IProps {
	availableOptions: Array<string>
	placeholder?: string
	className?: string
	value?: IconName
	disabled?: boolean
	onChange?: (event: IconPickerEvent) => void
}

interface IState {
	selectedValue: IconName | ''
	expanded: boolean
	iconPack: IconPack
	searchText: string
}

export const IconPicker = withTranslation()(
	class IconPicker extends React.Component<Translated<IProps>, IState> {
		private _popperRef: HTMLElement | null = null
		private _popperUpdate: (() => Promise<any>) | undefined

		constructor(props: Translated<IProps>) {
			super(props)

			delete fas['faFontAwesomeLogoFull']

			this.state = {
				selectedValue: '',
				expanded: false,
				iconPack: fas,
				searchText: '',
			}
		}

		componentDidMount(): void {
			this.refreshChecked()
		}

		async componentDidUpdate(prevProps: IProps) {
			if (this.props.value !== prevProps.value) {
				this.refreshChecked()
			}

			if (this.state.expanded && typeof this._popperUpdate === 'function') {
				await this._popperUpdate()
			}
		}

		refreshChecked() {
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

		handleChange = (value: IconName | '') => {
			if (this.props.disabled) return

			this.setState({
				selectedValue: value,
				expanded: false,
			})

			if (this.props.onChange && typeof this.props.onChange === 'function') {
				this.props.onChange({ selectedValue: value })
			}
		}

		handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
			this.setState({
				searchText: event.target.value,
			})
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

		getFilteredIcons() {
			return this.state.searchText
				? _.pick(this.state.iconPack, (value: IconDefinition) => {
						return value.iconName.includes(this.state.searchText)
					})
				: this.state.iconPack
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
			const { t } = this.props
			return (
				<Manager>
					<Reference>
						{({ ref }) => (
							<div
								ref={ref}
								className={ClassNames(
									'expco form-select iconpicker',
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
									{this.state.selectedValue && <FontAwesomeIcon icon={this.state.selectedValue} />}
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
										'expco expco-popper iconpicker',
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
											<Form.Control
												type="text"
												className="search-input"
												placeholder={t('Search...')}
												onChange={this.handleSearchChange}
											/>
											<div className="expco-list">
												{!this.state.searchText && (
													<div className="expco-item">
														<label className="action-btn" onClick={() => this.handleChange('')}>
															&nbsp;
														</label>
													</div>
												)}
												{Object.entries<IconDefinition | undefined>(this.getFilteredIcons()).map(([key, value]) => {
													if (value) {
														return (
															<div className="expco-item" key={key}>
																<label
																	className="action-btn"
																	title={value.iconName}
																	onClick={() => this.handleChange(value.iconName)}
																>
																	<FontAwesomeIcon icon={value.iconName} />
																</label>
															</div>
														)
													} else {
														return ''
													}
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
)
