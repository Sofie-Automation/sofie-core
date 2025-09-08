import React from 'react'
import { PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { RundownUtils } from '../../../lib/rundown.js'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { TFunction, useTranslation } from 'react-i18next'
import { Time } from '../../../lib/tempLib.js'
import Moment from 'react-moment'
import { ReadonlyDeep } from 'type-fest'

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
			? getLifeSpanText(t, props.piece)
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

function getLifeSpanText(t: TFunction, piece: ReadonlyDeep<Omit<PieceInstancePiece, 'timelineObjectsString'>>): string {
	switch (piece.lifespan) {
		case PieceLifespan.WithinPart:
			return t('Until next take')
		case PieceLifespan.OutOnSegmentChange:
			return t('Until next segment')
		case PieceLifespan.OutOnSegmentEnd:
			return t('Until end of segment')
		case PieceLifespan.OutOnRundownChange:
			return t('Until next rundown')
		case PieceLifespan.OutOnRundownEnd:
			return t('Until end of rundown')
		case PieceLifespan.OutOnShowStyleEnd:
			return t('Until end of showstyle')
		default:
			return ''
	}
}

function getDuration(
	piece: ReadonlyDeep<Omit<PieceInstancePiece, 'timelineObjectsString'>>,
	pieceRenderedDuration: number | null
): string {
	return RundownUtils.formatTimeToShortTime(
		pieceRenderedDuration || (typeof piece.enable.duration === 'number' ? piece.enable.duration : 0)
	)
}
