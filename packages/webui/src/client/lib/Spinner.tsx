import * as React from 'react'

interface SpinnerProps {
	size?: 'large' | 'medium' | 'small'
	color?: string
	className?: string
}

export const Spinner: React.FunctionComponent<SpinnerProps> = (props: SpinnerProps) => (
	<div className={props.className !== undefined ? props.className : 'mod mhl mvl alc'}>
		<div className={'origo-spinner sp-' + (props.color || 'blue') + ' sp-' + (props.size || 'large')}>
			<svg className="origo-spinner-svg" version="1.1" xmlns="http://www.w3.org/2000/svg">
				<circle className="origo-spin-circle" cx="17" cy="17" r="15"></circle>
			</svg>
		</div>
	</div>
)
