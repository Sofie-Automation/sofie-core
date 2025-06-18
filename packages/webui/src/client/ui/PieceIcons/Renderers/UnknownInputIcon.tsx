export function UnknownInputIcon(): JSX.Element {
	return (
		<svg className="piece_icon" version="1.1" viewBox="0 0 126.5 89" xmlns="http://www.w3.org/2000/svg">
			<rect width="126.5" height="89" className="unknown" />
			<text
				x="37.5"
				y="71.513954"
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
				className="label"
			>
				<tspan
					x="45.5"
					y="71.513954"
					style={{ fill: '#ffffff', fontFamily: 'Roboto', fontSize: '75px', fontWeight: 500 }}
				>
					?
				</tspan>
			</text>
		</svg>
	)
}
