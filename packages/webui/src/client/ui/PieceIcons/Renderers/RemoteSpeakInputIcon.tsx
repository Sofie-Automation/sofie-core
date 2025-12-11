export function RemoteSpeakInputIcon({ abbreviation }: { abbreviation?: string }): JSX.Element {
	return (
		<svg className="piece_icon" version="1.1" viewBox="0 0 126.5 89" xmlns="http://www.w3.org/2000/svg">
			<rect width="126.5" height="89" className="piece-icon-bkg remote-speak" />
			<linearGradient id="background-gradient" gradientTransform="rotate(90)">
				<stop className="stop1" offset={0.5} />
				<stop className="stop2" offset={0.5} />
			</linearGradient>
			<text
				x="5"
				y="66.514"
				style={{
					fill: '#ffffff',
					fontFamily: 'open-sans',
					fontSize: '40px',
					letterSpacing: '0px',
					lineHeight: '1.25',
					wordSpacing: '0px',
					textShadow: '0 2px 9px rgba(0, 0, 0, 0.5)',
				}}
				xmlSpace="preserve"
			>
				<tspan
					x="5"
					y="66.514"
					style={{ fill: '#ffffff', fontFamily: 'Roboto', fontSize: '62px', fontWeight: 100 }}
					className="label"
				>
					{abbreviation !== undefined ? abbreviation : 'RSK'}
				</tspan>
			</text>
		</svg>
	)
}
