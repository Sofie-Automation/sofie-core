import * as React from 'react'
import type { Sorensen } from '@sofie-automation/sorensen'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Escape from './../../../Escape.js'

import { SorensenContext } from '../../../SorensenContext.js'
import { DEFAULT_CONFIRM_KEY_CODE } from '@sofie-automation/shared-lib/dist/core/constants'
import { getCoreSystemSettings } from '../../../../collections/index.js'

export interface IModalAttributes {
	show?: boolean
	title: string
	onDiscard?: (e: SomeEvent) => void
}

export type SomeEvent = Event | React.SyntheticEvent<object>

export class Modal extends React.Component<React.PropsWithChildren<IModalAttributes>> {
	boundKeys: Array<string> = []
	sorensen: typeof Sorensen | undefined
	/** Captured at bind time so that unbind uses the exact same key, even if the setting changes in between */
	private confirmKeyCode: string = DEFAULT_CONFIRM_KEY_CODE

	constructor(props: IModalAttributes) {
		super(props)
	}

	componentDidMount(): void {
		this.sorensen = this.context as typeof Sorensen
		this.bindKeys()
	}

	componentWillUnmount(): void {
		this.unbindKeys()
	}

	componentDidUpdate(prevProps: IModalAttributes): void {
		if (prevProps.show !== this.props.show) this.bindKeys()
	}

	private bindKeys = () => {
		if (!this.sorensen) return

		if (this.props.show) {
			this.confirmKeyCode = getCoreSystemSettings()?.confirmKeyCode ?? DEFAULT_CONFIRM_KEY_CODE
			this.sorensen.bind(this.confirmKeyCode, this.preventDefault, {
				up: false,
				prepend: true,
			})
			this.sorensen.bind(this.confirmKeyCode, this.handleKey, {
				up: true,
				prepend: true,
			})
			this.sorensen.bind('Escape', this.preventDefault, {
				up: false,
				prepend: true,
			})
			this.sorensen.bind('Escape', this.handleKey, {
				up: true,
				prepend: true,
			})
		} else {
			this.unbindKeys()
		}
	}

	private unbindKeys = () => {
		if (!this.sorensen) return
		this.sorensen.unbind(this.confirmKeyCode, this.preventDefault)
		this.sorensen.unbind(this.confirmKeyCode, this.handleKey)
		this.sorensen.unbind('Escape', this.preventDefault)
		this.sorensen.unbind('Escape', this.handleKey)
	}

	private handleKey = (e: KeyboardEvent) => {
		if (this.props.show) {
			if (e.code === 'Escape') {
				this.handleDiscard(e)
			}
			e.preventDefault()
			e.stopImmediatePropagation()
		}
	}

	private handleDiscard = (e: SomeEvent) => {
		if (this.props.onDiscard && typeof this.props.onDiscard === 'function') {
			this.props.onDiscard(e)
		}
	}

	render(): JSX.Element | null {
		if (!this.props.show) {
			return null
		}

		return (
			<Escape to="viewport">
				<div className="glass-pane">
					<div className="glass-pane-content">
						<dialog className="border-box">
							<div className="flex-row info vertical-align-stretch tight-s">
								<div className="flex-col c12">
									<h2>{this.props.title}</h2>
								</div>
								<div className="flex-col horizontal-align-right vertical-align-middle">
									<p>
										<button className="action-btn" onClick={this.handleDiscard}>
											<FontAwesomeIcon icon="close" size="xl" className="mt-2" />
										</button>
									</p>
								</div>
							</div>
							<div className="title-box-content">{this.props.children}</div>
							<div className="m-1 me-2 text-end">
								<button className="btn btn-primary" onClick={this.handleDiscard}>
									OK
								</button>
							</div>
						</dialog>
					</div>
				</div>
			</Escape>
		)
	}

	private preventDefault(e: KeyboardEvent) {
		e.preventDefault()
		e.stopPropagation()
		e.stopImmediatePropagation()
	}
}

Modal.contextType = SorensenContext
