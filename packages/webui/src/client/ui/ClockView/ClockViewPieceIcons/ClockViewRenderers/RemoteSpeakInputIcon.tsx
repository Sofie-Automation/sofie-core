export function RemoteSpeakInputIcon({ abbreviation }: { abbreviation?: string }): JSX.Element {
	return (
		<div className="clock-view-piece-icon">
			<span className="remote-speak">{abbreviation !== undefined ? abbreviation : 'RSK'}</span>
		</div>
	)
}
