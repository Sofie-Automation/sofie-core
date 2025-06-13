import * as React from 'react'

interface IState {
	error: {
		error: Error
		info: React.ErrorInfo
	} | null
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, IState> {
	static commonStyle: React.CSSProperties = {
		// Override any inherited styles to ensure readability in any context:
		fontSize: '1rem',
		lineHeight: '1.2em',
		fontFamily: 'Roboto, sans-serif',
		fontWeight: 300,
		overflow: 'visible',
	}
	static style: { [key: string]: React.CSSProperties } = {
		container: {
			...ErrorBoundary.commonStyle,

			position: 'relative',
			display: 'block',
			margin: '10px',
			padding: '10px',
			textDecoration: 'none',
			height: 'auto',
			overflow: 'visible',
			background: '#ffdddd',
			color: 'black',
			border: '2px solid red',
			cursor: 'text',
		},
		h1: {
			...ErrorBoundary.commonStyle,

			fontSize: '18px',
			fontWeight: 'bold',

			margin: '10px',
			padding: '0',

			color: 'red',
		},
		friendlyMessage: {
			...ErrorBoundary.commonStyle,

			margin: '10px',
			padding: '0',

			fontWeight: 'bold',
		},
		errorDescription: {
			...ErrorBoundary.commonStyle,

			padding: '10px',

			border: '1px solid red',
			boxShadow: '0px 0px 10px inset #e00',
			backgroundColor: '#ebebeb',

			overflow: 'auto',
			minHeight: '5em',
			fontSize: '12px',
			fontFamily: 'monospace',
		},
		stack: {
			...ErrorBoundary.commonStyle,

			display: 'block',
			whiteSpace: 'pre',
			margin: '0',
			padding: '0',

			fontFamily: 'monospace',
		},
		resetButton: {
			...ErrorBoundary.commonStyle,

			display: 'block',
			margin: '10px 0',
			fontWeight: 'normal',
		},
	}

	constructor(props: {}) {
		super(props)
		this.state = {
			error: null,
		}
	}

	componentDidCatch(error: Error, info: React.ErrorInfo): void {
		this.setState({
			error: { error, info },
		})
	}

	// toggleComponentStack = () => {
	// 	this.setState({ expandedComponentStack: !this.state.expandedComponentStack })
	// }

	// toggleStack = () => {
	// 	this.setState({ expandedStack: !this.state.expandedStack })
	// }

	private resetComponent = () => {
		this.setState({ error: null })
	}

	render(): React.ReactNode {
		if (this.state.error) {
			const error = this.state.error.error
			const info = this.state.error.info
			return (
				<div className="error-boundary" style={ErrorBoundary.style.container}>
					<h1 style={ErrorBoundary.style.h1}>Whoops, something went wrong!</h1>

					<div style={ErrorBoundary.style.friendlyMessage}>
						There was an error in the Sofie GUI which caused it to crash.
						<br />
						Please copy the error description below and report it to your tech support.
						<br />
						<button style={ErrorBoundary.style.resetButton} onClick={this.resetComponent}>
							Click here to try to restart component
						</button>
					</div>

					<div style={ErrorBoundary.style.errorDescription}>
						<b>{error.name}</b>
						<br />
						<p style={ErrorBoundary.style.stack}>{error.message}</p>
						<p style={ErrorBoundary.style.stack}>{error.stack ?? ''}</p>
						<p style={ErrorBoundary.style.stack}>{info.componentStack}</p>
					</div>
				</div>
			)
		} else {
			return this.props.children || null
		}
	}
}
