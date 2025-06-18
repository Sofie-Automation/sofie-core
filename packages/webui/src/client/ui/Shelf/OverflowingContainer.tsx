import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'

import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface IProps {
	className?: string
}

interface IState {
	overflowing: boolean
	overflowingLeft: boolean
	overflowingRight: boolean
}

export class OverflowingContainer extends React.Component<React.PropsWithChildren<IProps>, IState> {
	_element: HTMLDivElement | null = null
	_scrollFactor = 0

	constructor(props: IProps) {
		super(props)

		this.state = {
			overflowing: false,
			overflowingLeft: false,
			overflowingRight: false,
		}
	}

	componentDidMount(): void {
		window.addEventListener('resize', this.resizeHandler)
		this.resizeHandler()
	}

	componentWillUnmount(): void {
		window.removeEventListener('resize', this.resizeHandler)
	}

	UNSAFE_componentWillUpdate(): void {
		this.resizeHandler()
	}

	resizeHandler = _.throttle(() => {
		if (this._element) {
			this.setState({
				overflowing: this._element.clientWidth < this._element.scrollWidth,
				overflowingLeft: this._element.scrollLeft > 0,
				// on some high-DPI screens, the scrollLeft+clientWidth may be a non-integer value a little bit below scrollWidth
				overflowingRight: this._element.scrollLeft + this._element.clientWidth < this._element.scrollWidth - 1,
			})
		}
	}, 125)

	private startScroll = (by: number) => {
		if (this._element) {
			this._scrollFactor = by
		}
		this.scroll()
	}

	private scroll = () => {
		const clb = () => {
			if (this._scrollFactor === 0) return
			if (this._element) {
				this._element.scrollLeft = this._element.scrollLeft + this._scrollFactor
			}
			this.resizeHandler()
			window.requestAnimationFrame(clb)
		}

		window.requestAnimationFrame(clb)
	}

	private stopScroll = () => {
		this._scrollFactor = 0
	}

	render(): JSX.Element {
		return (
			<React.Fragment>
				{this.state.overflowing && (
					<button
						className={ClassNames('overflowing-container__left', {
							'overflowing-container--overflowing': this.state.overflowing,
							'overflowing-container--overflowing-left': this.state.overflowingLeft,
						})}
						onMouseDown={() => this.startScroll(-15)}
						onMouseUp={this.stopScroll}
					>
						<FontAwesomeIcon icon={faChevronLeft} />
					</button>
				)}
				<div
					className={ClassNames(this.props.className, 'overflowing-container', {
						'overflowing-container--overflowing': this.state.overflowing,
						'overflowing-container--overflowing-left': this.state.overflowingLeft,
						'overflowing-container--overflowing-right': this.state.overflowingRight,
					})}
					ref={(el) => (this._element = el)}
				>
					{this.props.children}
				</div>
				{this.state.overflowing && (
					<button
						className={ClassNames('overflowing-container__right', {
							'overflowing-container--overflowing': this.state.overflowing,
							'overflowing-container--overflowing-right': this.state.overflowingRight,
						})}
						onMouseDown={() => this.startScroll(15)}
						onMouseUp={this.stopScroll}
					>
						<FontAwesomeIcon icon={faChevronRight} />
					</button>
				)}
			</React.Fragment>
		)
	}
}
