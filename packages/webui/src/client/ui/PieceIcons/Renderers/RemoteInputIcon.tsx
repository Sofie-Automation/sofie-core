import React from 'react'

export function BaseRemoteInputIcon(props: Readonly<React.PropsWithChildren<{ className: string }>>): JSX.Element {
	return (
		<svg className="piece-icon" version="1.1" viewBox="0 0 126.5 89" xmlns="http://www.w3.org/2000/svg">
			<rect width="126.5" height="89" className={`piece-icon-bkg ${props.className}`} />
			<text x="63.25" y="71.513954" textAnchor="middle" className="piece-icon-text" xmlSpace="preserve">
				<tspan className="label">{props.children}</tspan>
			</text>
		</svg>
	)
}

export function RemoteInputIcon({
	inputNumber,
	abbreviation,
}: {
	inputNumber?: string
	abbreviation?: string
}): JSX.Element {
	return (
		<BaseRemoteInputIcon className="remote">
			{abbreviation !== undefined ? abbreviation : 'LIVE'}
			<tspan className="input-number">{inputNumber ?? ''}</tspan>
		</BaseRemoteInputIcon>
	)
}
