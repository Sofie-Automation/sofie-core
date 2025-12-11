// @todo: use dynamic data for camera number
export function CamInputIcon({
	inputIndex,
	abbreviation,
}: {
	inputIndex?: string
	abbreviation?: string
}): JSX.Element {
	return (
		<div className="clock-view-piece-icon">
			<span className="camera">
				{abbreviation !== undefined ? abbreviation : 'C'}
				{inputIndex !== undefined ? inputIndex : ''}
			</span>
		</div>
	)
}
