import type { PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { RundownUtils } from '../../../lib/rundown.js'
import { getPieceLifespanText } from '../../../lib/ui/pieceLifespanText.js'
import { useTranslation } from 'react-i18next'
import type { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import Moment from 'react-moment'
import type { ReadonlyDeep } from 'type-fest'

interface IProps {
	piece: ReadonlyDeep<Omit<PieceInstancePiece, 'timelineObjectsString'>>
	pieceRenderedDuration: number | null
	pieceRenderedIn: number | null
	changed?: Time
}

export const FloatingInspectorTimeInformationRow: React.FunctionComponent<IProps> = (props: IProps) => {
	const { t } = useTranslation()
	const durationText: string =
		!props.pieceRenderedDuration && !props.piece.enable.duration
			? getPieceLifespanText(t, props.piece.lifespan)
			: getDuration(props.piece, props.pieceRenderedDuration)

	return (
		<tr>
			<td className="mini-inspector__row--timing" />
			<td className="mini-inspector__row--timing">
				<span className="mini-inspector__in-point">
					{RundownUtils.formatTimeToShortTime(props.pieceRenderedIn || 0)}
				</span>
				<span className="mini-inspector__duration">{durationText}</span>

				{props.changed && (
					<span className="mini-inspector__changed">
						<Moment date={props.changed} calendar={true} />
					</span>
				)}
			</td>
		</tr>
	)
}

function getDuration(
	piece: ReadonlyDeep<Omit<PieceInstancePiece, 'timelineObjectsString'>>,
	pieceRenderedDuration: number | null
): string {
	return RundownUtils.formatTimeToShortTime(
		pieceRenderedDuration || (typeof piece.enable.duration === 'number' ? piece.enable.duration : 0)
	)
}
