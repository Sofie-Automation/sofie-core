import * as React from 'react'
import _ from 'underscore'
import renderItem from './ItemRenderers/ItemRendererFactory.js'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { contextMenuHoldToDisplayTime } from '../../../lib/lib.js'
import type { BucketAdLibItem } from '../RundownViewBuckets.js'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { IAdLibListItem } from '../AdLibListItem.js'
import { useContentStatusForItem } from '../../SegmentTimeline/withMediaObjectStatus.js'
import type { UIShowStyleBase } from '@sofie-automation/corelib/src/dataModel/ShowStyleBase.js'
import type { UIStudio } from '@sofie-automation/corelib/src/dataModel/Studio.js'
import type { PieceUi } from '@sofie-automation/corelib/src/dataModel/Piece.js'

interface IShelfInspectorProps {
	selected: BucketAdLibItem | IAdLibListItem | PieceUi | undefined
	showStyleBase: UIShowStyleBase
	studio: UIStudio
	rundownPlaylist: DBRundownPlaylist
	onSelectPiece: (piece: BucketAdLibItem | IAdLibListItem | PieceUi | undefined) => void
}

export const ShelfInspector = React.memo(
	function ShelfInspector({ selected, showStyleBase, studio, rundownPlaylist, onSelectPiece }: IShelfInspectorProps) {
		const contentStatus = useContentStatusForItem(selected)

		const content =
			selected && renderItem(selected, contentStatus, showStyleBase, studio, rundownPlaylist, onSelectPiece)

		return (
			<ContextMenuTrigger
				id="shelf-context-menu"
				attributes={{
					className: 'rundown-view__shelf__contents__pane shelf-inspector',
				}}
				holdToDisplay={contextMenuHoldToDisplayTime()}
			>
				{content || false}
			</ContextMenuTrigger>
		)
	},
	(prevProps, nextProps) => {
		return _.isEqual(nextProps, prevProps)
	}
)
