export function LiveSpeakInputIcon({ abbreviation }: { abbreviation?: string }): JSX.Element {
	return (
		<div className="clock-view-piece-icon">
			<span className="live-speak">{abbreviation !== undefined ? abbreviation : 'LSK'}</span>
		</div>
	)
}
