import React from 'react'

export function BaseRemoteInputIcon(props: Readonly<React.PropsWithChildren<{ className: string }>>): JSX.Element {
	return <div className="clock-view-piece-icon">{props.children}</div>
}

export function RemoteInputIcon({
	inputIndex,
	abbreviation,
}: {
	inputIndex?: string
	abbreviation?: string
}): JSX.Element {
	return (
		<BaseRemoteInputIcon className="clock-view-piece-icon">
			<span className="remote">
				{abbreviation !== undefined ? abbreviation : 'LIVE'}
				{inputIndex ?? ''}
			</span>
		</BaseRemoteInputIcon>
	)
}
