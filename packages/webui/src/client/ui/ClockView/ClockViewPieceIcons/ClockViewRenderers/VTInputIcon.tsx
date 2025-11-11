export function VTInputIcon({ abbreviation }: { abbreviation?: string }): JSX.Element {
	return (
		<div className="clock-view-piece-icon">
			<span className="vt">{abbreviation !== undefined ? abbreviation : 'VT'}</span>
		</div>
	)
}
