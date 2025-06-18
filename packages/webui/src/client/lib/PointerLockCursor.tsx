import * as React from 'react'
import Escape from './Escape'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowsAltH } from '@fortawesome/free-solid-svg-icons'

interface IState {
	showCursor: boolean
	pointerX: number
	pointerY: number
}

let PointerLockCursorSingleton: PointerLockCursor

export class PointerLockCursor extends React.Component<{}, IState> {
	constructor(props: {}) {
		super(props)

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		PointerLockCursorSingleton = this

		this.state = {
			showCursor: false,
			pointerX: 0,
			pointerY: 0,
		}
	}

	render(): JSX.Element {
		return (
			<Escape to="viewport">
				<div
					style={{
						position: 'absolute',
						left: this.state.pointerX + 'px',
						top: this.state.pointerY + 'px',
						transform: 'translate(-50%, -50%)',
						filter:
							'drop-shadow(black 1px -1px 0) ' +
							'drop-shadow(black 0 1px 0) ' +
							'drop-shadow(black 1px 1px 0) ' +
							'drop-shadow(black -1px 0 0) ' +
							'drop-shadow(rgba(0, 0, 0, 0.2) 2px 2px 2px)',
						display: this.state.showCursor ? 'block' : 'none',
					}}
				>
					<FontAwesomeIcon icon={faArrowsAltH} size="lg" />
				</div>
			</Escape>
		)
	}

	show = (left: number, top: number): void => {
		this.setState({
			showCursor: true,
			pointerX: left,
			pointerY: top,
		})
	}

	hide = (): void => {
		this.setState({
			showCursor: false,
		})
	}
}

export function showPointerLockCursor(left: number, top: number): void {
	if (!PointerLockCursorSingleton) return
	PointerLockCursorSingleton.show(left, top)
}

export function hidePointerLockCursor(): void {
	if (!PointerLockCursorSingleton) return
	PointerLockCursorSingleton.hide()
}
