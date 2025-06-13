import { JSX } from 'react'

export function MediaStatusPopUpSegmentRule(): JSX.Element {
	return (
		<tr className="media-status-popup-segment-rule">
			<td className="media-status-popup-segment-rule__spacer"></td>
			<td className="media-status-popup-segment-rule__line" colSpan={5}></td>
		</tr>
	)
}
