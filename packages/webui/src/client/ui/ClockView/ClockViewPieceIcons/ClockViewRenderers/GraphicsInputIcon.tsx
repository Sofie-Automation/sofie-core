export function GraphicsInputIcon({ abbreviation }: { abbreviation?: string }): JSX.Element {
	return (
		<div className="clock-view-piece-icon">
			<span className="graphics">{abbreviation !== undefined ? abbreviation : 'G'}</span>
		</div>
	)
}
