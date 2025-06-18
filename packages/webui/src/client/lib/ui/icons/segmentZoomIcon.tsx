export const ZoomOutIcon = (): JSX.Element => (
	<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" role="presentation">
		<circle cx="11.5" cy="11.5" r="7.5" fill="#5C5C5C" className="btn-bkg" />
		<rect x="6.5" y="10.5" width="10" height="2" fill="white" />
	</svg>
)

export const ZoomInIcon = (): JSX.Element => (
	<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" role="presentation">
		<circle cx="11" cy="11" r="11" fill="#5C5C5C" className="btn-bkg" />
		<rect x="12" y="5" width="12" height="2" transform="rotate(90 12 5)" fill="white" />
		<rect x="5" y="10" width="12" height="2" fill="white" />
	</svg>
)

export const ZoomShowAll = (): JSX.Element => (
	<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" role="presentation">
		<circle cx="11" cy="11" r="9" fill="#5C5C5C" className="btn-bkg" />
		<rect x="4.5" y="10" width="13" height="2" fill="white" />
		<path d="M8 6L4 11L8 16" stroke="white" />
		<path d="M14 16L18 11L14 6" stroke="white" />
	</svg>
)
