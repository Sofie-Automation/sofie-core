export function LiveSpeakInputIcon({ abbreviation }: { abbreviation?: string }): JSX.Element {
	return (
		<svg className="piece-icon" version="1.1" viewBox="0 0 126.5 89" xmlns="http://www.w3.org/2000/svg">
			<rect width="126.5" height="89" className="piece-icon-bkg live-speak" />
			<linearGradient id="background-gradient" gradientTransform="rotate(90)">
				<stop className="stop1" offset={0.5} />
				<stop className="stop2" offset={0.5} />
			</linearGradient>
			<text x="63.25" y="71.513954" textAnchor="middle" className="piece-icon-text" xmlSpace="preserve">
				<tspan className="label">{abbreviation !== undefined ? abbreviation : 'LSK'}</tspan>
			</text>
		</svg>
	)
}
