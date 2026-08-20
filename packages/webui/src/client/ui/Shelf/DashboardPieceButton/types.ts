import type { IOutputLayer, ISourceLayer } from '@sofie-automation/blueprints-integration'
import type { UIStudio } from '@sofie-automation/corelib/src/dataModel/Studio.js'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { PieceDisplayStyle } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import type React from 'react'
import type { IAdLibListItem } from '../AdLibListItem.js'

export interface IDashboardButtonProps {
	piece: IAdLibListItem
	studio: UIStudio
	layer?: ISourceLayer
	outputLayer?: IOutputLayer
	onToggleAdLib: (aSLine: IAdLibListItem, queue: boolean, context: React.SyntheticEvent) => void
	onSelectAdLib: (aSLine: IAdLibListItem, context: React.SyntheticEvent) => void
	playlist: DBRundownPlaylist
	isOnAir?: boolean
	isNext?: boolean
	widthScale?: number
	heightScale?: number
	disabled?: boolean
	displayStyle: PieceDisplayStyle
	isSelected?: boolean
	queueAllAdlibs?: boolean
	showThumbnailsInList?: boolean
	disableHoverInspector?: boolean
	editableName?: boolean
	onNameChanged?: (e: any, value: string) => void
	toggleOnSingleClick?: boolean
	canOverflowHorizontally?: boolean
	lineBreak?: string
}

export const DEFAULT_BUTTON_WIDTH = 6.40625
export const DEFAULT_BUTTON_HEIGHT = 5.625
export const HOVER_TIMEOUT = 5000
