import ClassNames from 'classnames'
import { ISourceLayer, IBlueprintActionTriggerMode } from '@sofie-automation/blueprints-integration'
import { unprotectString } from '../../lib/tempLib.js'
import renderItem from './Renderers/ItemRendererFactory.js'
import { useContentStatusForAdlibPiece } from '../SegmentTimeline/withMediaObjectStatus.js'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { contextMenuHoldToDisplayTime } from '../../lib/lib.js'
import { setShelfContextMenuContext, ContextType as MenuContextType } from './ShelfContextMenu.js'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { IAdLibListItem } from '@sofie-automation/meteor-lib/dist/uiTypes/Adlib'

export type { IAdLibListItem } from '@sofie-automation/meteor-lib/dist/uiTypes/Adlib'

interface IListViewItemProps {
	piece: IAdLibListItem
	studio: UIStudio
	layer: ISourceLayer | undefined
	selected: boolean
	disabled?: boolean
	onSelectAdLib?: (aSLine: IAdLibListItem) => void
	onToggleAdLib?: (aSLine: IAdLibListItem, queue: boolean, context: any, mode?: IBlueprintActionTriggerMode) => void
}

export function AdLibListItem({
	piece,
	studio,
	layer,
	selected,
	disabled,
	onSelectAdLib,
	onToggleAdLib,
}: IListViewItemProps): JSX.Element {
	const contentStatus = useContentStatusForAdlibPiece(piece)

	return (
		<ContextMenuTrigger
			id="shelf-context-menu"
			attributes={{
				className: ClassNames('adlib-panel__list-view__list__segment__item', {
					selected: selected,
					invalid: piece.invalid,
					floated: piece.floated,
					disabled: disabled,
				}),
				//@ts-expect-error React.HTMLAttributes does not list data attributes, but that's fine
				'data-obj-id': piece._id,
				onClick: () => onSelectAdLib?.(piece),
				onContextMenu: () => onSelectAdLib?.(piece),
				onDoubleClick: (e) => !disabled && onToggleAdLib?.(piece, e.shiftKey, e),
			}}
			collect={() =>
				setShelfContextMenuContext({
					type: MenuContextType.ADLIB,
					details: {
						adLib: piece,
						onToggle: !disabled ? onToggleAdLib : undefined,
						disabled: disabled,
					},
				})
			}
			holdToDisplay={contextMenuHoldToDisplayTime()}
			renderTag="tr"
			key={unprotectString(piece._id)}
		>
			{renderItem({
				adLibListItem: piece,
				contentStatus: contentStatus,
				layer: layer,
				outputLayer: piece.outputLayer,
				selected: selected,
				status: contentStatus?.status,
				messages: contentStatus?.messages,
				studio: studio,
			})}
		</ContextMenuTrigger>
	)
}
