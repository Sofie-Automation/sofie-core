import * as React from 'react'
import * as _ from 'underscore'
import renderItem from './ItemRenderers/ItemRendererFactory'
import { PieceUi } from '../../SegmentTimeline/SegmentTimelineContainer'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { contextMenuHoldToDisplayTime } from '../../../lib/lib'
import { BucketAdLibItem } from '../RundownViewBuckets'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { IAdLibListItem } from '../AdLibListItem'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { useContentStatusForItem } from '../../SegmentTimeline/withMediaObjectStatus'

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
