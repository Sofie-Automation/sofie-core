import React, { ReactNode } from 'react'
import ClassNames from 'classnames'
import { Manager, Popper, Reference } from 'react-popper'

interface IProps {
	selectedKey: string
	className?: string
	options?: SplitDropdownItemObj[]
}

interface SplitDropdownItemObj {
	key?: string
	node?: ReactNode
}

export function SplitDropdownItem(props: Readonly<SplitDropdownItemObj>): SplitDropdownItemObj {
	return {
		key: props.key,
		node: props.node,
	}
}

interface IState {
	expanded: boolean
}

export class SplitDropdown extends React.Component<IProps, IState> {
	private _popperRef: HTMLElement | null = null
	private _popperUpdate: (() => Promise<any>) | undefined

	constructor(props: IProps) {
		super(props)

		this.state = {
			expanded: false,
		}
	}

	async componentDidUpdate(_prevProps: IProps): Promise<void> {
		if (this.state.expanded && typeof this._popperUpdate === 'function') {
			await this._popperUpdate()
		}
	}

	private toggleExpco = async (e: React.MouseEvent<HTMLElement>) => {
		e.preventDefault()
		e.stopPropagation()

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
		const getSelected = () => {
			const selectedChild =
				this.props.options &&
				Array.isArray(this.props.options) &&
				this.props.options.find((element) => element.key === this.props.selectedKey)?.node
			return selectedChild ? <>{selectedChild}</> : <div className="expco-item"></div>
		}

		return (
			<Manager>
				<Reference>
					{({ ref }) => (
						<div
							ref={ref}
							className={ClassNames(
								'expco button subtle form-select',
								{
									'expco-expanded': this.state.expanded,
								},
								this.props.className
							)}
						>
							<div className="expco-title focusable-main">{getSelected()}</div>
							<div className="action-btn expco-expand subtle" onClick={this.toggleExpco}>
								&nbsp;
							</div>
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
									'expco expco-popper split-dropdown',
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
										{this.props.options?.map((child, index) => (
											<React.Fragment key={child.key || index}>{child.node}</React.Fragment>
										))}
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
