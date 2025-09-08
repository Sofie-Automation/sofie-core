import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer.js'
import { IAdLibListItem } from '../../AdLibListItem.js'
import { RundownUtils } from '../../../../lib/rundown.js'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import InspectorTitle from './InspectorTitle.js'
import { BucketAdLibUi } from '../../RundownViewBuckets.js'
import { AdLibPieceUi } from '../../../../lib/shelf.js'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'

export default function DefaultItemRenderer(
	props: Readonly<{
		piece: PieceUi | IAdLibListItem | BucketAdLibUi
		contentStatus: ReadonlyDeep<PieceContentStatusObj> | undefined
		showStyleBase: UIShowStyleBase
		studio: UIStudio
	}>
): JSX.Element {
	if (RundownUtils.isAdLibPiece(props.piece)) {
		const piece = props.piece as IAdLibListItem

		const packageName = props.contentStatus?.packageName ?? null

		return (
			<>
				<InspectorTitle piece={props.piece} showStyleBase={props.showStyleBase} studio={props.studio} />
				{packageName}
				<dl>
					<dd>name</dd>
					<dt>{piece.name}</dt>
					<dd>externalId</dd>
					<dt>{piece.externalId}</dt>
					{(piece as AdLibPieceUi).partId ? (
						<>
							<dd>partId</dd>
							<dt>{unprotectString((piece as AdLibPieceUi).partId)}</dt>
						</>
					) : null}
					<dd>sourceLayerId</dd>
					<dt>{piece.sourceLayerId}</dt>
					<dd>outputLayerId</dd>
					<dt>{piece.outputLayerId}</dt>
					<dd>publicData</dd>
					<dt>{JSON.stringify(piece.publicData || {})}</dt>
				</dl>
			</>
		)
	} else {
		const piece = props.piece.instance.piece as Piece

		const packageName = props.contentStatus?.packageName ?? null

		return (
			<>
				<InspectorTitle piece={props.piece} showStyleBase={props.showStyleBase} studio={props.studio} />
				{packageName}
				<dl>
					<dd>name</dd>
					<dt>{piece.name}</dt>
					<dd>externalId</dd>
					<dt>{piece.externalId}</dt>
					<dd>startPartId</dd>
					<dt>{unprotectString(piece.startPartId)}</dt>
					<dd>sourceLayerId</dd>
					<dt>{piece.sourceLayerId}</dt>
					<dd>outputLayerId</dd>
					<dt>{piece.outputLayerId}</dt>
					<dd>publicData</dd>
					<dt>{JSON.stringify(piece.publicData || {})}</dt>
				</dl>
			</>
		)
	}
}
