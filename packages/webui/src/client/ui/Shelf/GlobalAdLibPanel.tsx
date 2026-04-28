import { useMemo } from 'react'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { IAdLibListItem } from './AdLibListItem.js'
import { AdLibPanel } from './AdLibPanel.js'
import type { BucketAdLibActionUi, BucketAdLibUi } from './RundownViewBuckets.js'
import { literal } from '@sofie-automation/corelib/dist/lib'
import {
	PieceDisplayStyle,
	RundownLayoutElementType,
	type RundownLayoutFilter,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { ShelfTabs } from './Shelf.js'
import { useTranslation } from 'react-i18next'
import type { AdLibPieceUi } from '../../lib/shelf.js'
import type { UIShowStyleBase } from '@sofie-automation/corelib/src/dataModel/ShowStyleBase.js'
import type { UIStudio } from '@sofie-automation/corelib/src/dataModel/Studio.js'
import type { PieceUi } from '@sofie-automation/corelib/src/dataModel/Piece.js'

interface IProps {
	playlist: DBRundownPlaylist
	showStyleBase: UIShowStyleBase
	studio: UIStudio
	visible: boolean
	studioMode: boolean
	selectedPiece: BucketAdLibActionUi | BucketAdLibUi | IAdLibListItem | PieceUi | undefined

	onSelectPiece?: (piece: AdLibPieceUi | PieceUi) => void
}

export function GlobalAdLibPanel({
	playlist,
	studio,
	showStyleBase,
	selectedPiece,
	studioMode,
	visible,
	onSelectPiece,
}: Readonly<IProps>): JSX.Element {
	const { t } = useTranslation()

	const GLOBAL_ADLIB_FILTER: RundownLayoutFilter = useMemo(
		() =>
			literal<RundownLayoutFilter>({
				_id: ShelfTabs.GLOBAL_ADLIB,
				rundownBaseline: 'only',
				name: t('Global AdLib'),
				sourceLayerIds: undefined,
				outputLayerIds: undefined,
				type: RundownLayoutElementType.FILTER,
				default: false,
				sourceLayerTypes: undefined,
				label: undefined,
				tags: undefined,
				displayStyle: PieceDisplayStyle.LIST,
				currentSegment: false,
				hideDuplicates: false,
				rank: 1,
				nextInCurrentPart: false,
				oneNextPerSourceLayer: false,
				showThumbnailsInList: false,
				disableHoverInspector: false,
			}),
		[t]
	)

	return (
		<AdLibPanel
			playlist={playlist}
			studio={studio}
			showStyleBase={showStyleBase}
			selectedPiece={selectedPiece}
			onSelectPiece={onSelectPiece}
			studioMode={studioMode}
			visible={visible}
			includeGlobalAdLibs={true}
			filter={GLOBAL_ADLIB_FILTER}
		/>
	)
}
