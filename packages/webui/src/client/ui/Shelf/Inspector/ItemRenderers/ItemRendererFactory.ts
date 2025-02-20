import * as React from 'react'
import DefaultItemRenderer from './DefaultItemRenderer'
import { NoraItemRenderer, isNoraItem } from './NoraItemRenderer'
import ActionItemRenderer, { isActionItem } from './ActionItemRenderer'

import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { BucketAdLibItem } from '../../RundownViewBuckets'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { IAdLibListItem } from '../../AdLibListItem'
import { AdLibPieceUi } from '../../../../lib/shelf'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { ReadonlyDeep } from 'type-fest'
import { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'

export default function renderItem(
	piece: BucketAdLibItem | IAdLibListItem | PieceUi,
	contentStatus: ReadonlyDeep<PieceContentStatusObj> | undefined,
	showStyleBase: UIShowStyleBase,
	studio: UIStudio,
	rundownPlaylist: DBRundownPlaylist,
	onSelectPiece: (piece: BucketAdLibItem | IAdLibListItem | PieceUi | undefined) => void
): JSX.Element {
	if ((!('isAction' in piece) || !piece['isAction']) && isNoraItem(piece as AdLibPieceUi | PieceUi)) {
		const noraPiece = piece as AdLibPieceUi | PieceUi
		return React.createElement(NoraItemRenderer, { piece: noraPiece, showStyleBase, studio })
	} else if (isActionItem(piece)) {
		return React.createElement(ActionItemRenderer, {
			piece,
			showStyleBase,
			studio,
			rundownPlaylist,
			onSelectPiece,
		})
	}

	return React.createElement(DefaultItemRenderer, { piece, contentStatus, showStyleBase, studio })
}
