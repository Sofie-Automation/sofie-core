import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'

import { library } from '@fortawesome/fontawesome-svg-core'
import { fas, faChevronUp, IconName, IconPack, IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { withTranslation } from 'react-i18next'
import { Translated } from './ReactMeteorData/ReactMeteorData'

library.add(fas)

export interface IconPickerEvent {
	selectedValue: IconName | ''
}

interface IProps {
	availableOptions: Array<string>
	placeholder?: string
	className?: string
	value?: IconName
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

		componentDidUpdate(prevProps: IProps) {
			if (this.props.value !== prevProps.value) {
				this.refreshChecked()
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
			this.setState({
				selectedValue: value,
			})

			if (this.props.onChange && typeof this.props.onChange === 'function') {
				this.props.onChange({ selectedValue: value })
			}
			this.toggleExpco()
		}

		handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
			this.setState({
				searchText: event.target.value,
			})
		}

		toggleExpco = () => {
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

		render(): JSX.Element {
			const { t } = this.props
			return (
				<div
					className={ClassNames(
						'expco focusable subtle iconpicker',
						{
							'expco-expanded': this.state.expanded,
						},
						this.props.className
					)}
				>
					<div className={ClassNames('expco-title focusable-main')} onClick={this.toggleExpco}>
						{this.state.selectedValue && <FontAwesomeIcon icon={this.state.selectedValue} />}
					</div>
					<a className="action-btn right expco-expand subtle" onClick={this.toggleExpco}>
						<FontAwesomeIcon icon={faChevronUp} />
					</a>
					<div className="expco-body bd">
						<input
							type="text"
							className="search-input"
							placeholder={t('Search...')}
							onChange={this.handleSearchChange}
						></input>
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
				</div>
			)
		}
	}
)
