// @todo: use dynamic data for camera number
export function CamInputIcon({
	inputNumber,
	abbreviation,
}: {
	inputNumber?: string
	abbreviation?: string
}): JSX.Element {
	return (
		<svg className="piece-icon" version="1.1" viewBox="0 0 126.5 89" xmlns="http://www.w3.org/2000/svg">
			<rect width="126.5" height="89" className="piece-icon-bkg camera" />
			<text x="63.25" y="71.513954" textAnchor="middle" className="piece-icon-text" xmlSpace="preserve">
				<tspan className="label">
					{abbreviation !== undefined ? abbreviation : 'C'}
					<tspan className="input-number">{inputNumber !== undefined ? inputNumber : ''}</tspan>
				</tspan>
			</text>
		</svg>
	)
}
