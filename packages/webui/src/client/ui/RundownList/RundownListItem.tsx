import { useContext, useEffect } from 'react'
import classNames from 'classnames'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { confirmDeleteRundown, confirmReSyncRundown, getShowStyleBaseLink } from './util.js'
import { useDrag, useDrop } from 'react-dnd'
import { IRundownDragObject, IRundownPlaylistUiAction, RundownListDragDropTypes } from './DragAndDropTypes.js'
import { getEmptyImage } from 'react-dnd-html5-backend'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import RundownListItemView from './RundownListItemView.js'
import { RundownLayoutBase } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ShowStyleBases, ShowStyleVariants } from '../../collections/index.js'
import { useTranslation } from 'react-i18next'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { UserPermissionsContext } from '../UserPermissions.js'

export const HTML_ID_PREFIX = 'rundown-'

export function RundownListItem({
	isActive,
	rundown,
	rundownViewUrl,
	rundownLayouts,
	swapRundownOrder,
	isOnlyRundownInPlaylist,
}: Readonly<{
	isActive: boolean
	rundown: Rundown
	rundownViewUrl?: string
	rundownLayouts: Array<RundownLayoutBase>
	swapRundownOrder: (a: RundownId, b: RundownId) => void
	playlistId: RundownPlaylistId
	isOnlyRundownInPlaylist: boolean
	action?: IRundownPlaylistUiAction
}>): JSX.Element | null {
	const { t } = useTranslation()
	const userPermissions = useContext(UserPermissionsContext)

	const showStyleBase = useTracker(
		() =>
			ShowStyleBases.findOne(rundown.showStyleBaseId, { projection: { name: 1 } }) as
				| Pick<DBShowStyleBase, 'name'>
				| undefined,
		[rundown.showStyleBaseId]
	)
	const showStyleVariant = useTracker(
		() =>
			ShowStyleVariants.findOne(rundown.showStyleVariantId, { projection: { name: 1 } }) as
				| Pick<DBShowStyleVariant, 'name'>
				| undefined,
		[rundown.showStyleVariantId]
	)

	const [dragState, connectDragSource, connectDragPreview] = useDrag<IRundownDragObject, void, { isDragging: boolean }>(
		{
			type: RundownListDragDropTypes.RUNDOWN,
			collect: (monitor) => {
				return {
					isDragging: monitor.isDragging(),
				}
			},
			item: {
				id: rundown._id,
				rundownLayouts,
				isOnlyRundownInPlaylist,
			},
		},
		[rundown._id, rundownLayouts]
	)

	const [, connectDropTarget] = useDrop<IRundownDragObject, void, {}>(
		{
			accept: RundownListDragDropTypes.RUNDOWN,
			hover: (item, monitor) => {
				if (monitor.getItemType() === RundownListDragDropTypes.RUNDOWN) {
					// if that rundown is not this rundown
					if (item && rundown._id !== item.id) {
						swapRundownOrder(rundown._id, item.id)
					}
				}
			},
		},
		[rundown, swapRundownOrder]
	)

	useEffect(() => {
		connectDragPreview(getEmptyImage())
	}, [connectDragPreview])

	// rundown ids can start with digits, which is illegal for HTML id attributes
	const htmlElementId = `${HTML_ID_PREFIX}${unprotectString(rundown._id)}`

	const showStyleLabel =
		showStyleVariant && showStyleBase && showStyleVariant.name !== showStyleBase.name
			? t('{{showStyleVariant}} – {{showStyleBase}}', {
					showStyleVariant: showStyleVariant.name,
					showStyleBase: showStyleBase.name,
				})
			: (showStyleBase?.name ?? '')

	return (
		<RundownListItemView
			isActive={isActive}
			className={classNames({
				dragging: dragState.isDragging,
				orphaned: rundown.orphaned,
			})}
			connectDragSource={connectDragSource}
			connectDropTarget={connectDropTarget}
			htmlElementId={htmlElementId}
			isDragLayer={false}
			renderTooltips={dragState.isDragging !== true}
			rundownViewUrl={rundownViewUrl}
			rundown={rundown}
			isOnlyRundownInPlaylist={isOnlyRundownInPlaylist}
			rundownLayouts={rundownLayouts}
			showStyleName={showStyleLabel}
			showStyleBaseURL={userPermissions.configure ? getShowStyleBaseLink(rundown.showStyleBaseId) : undefined}
			confirmDeleteRundownHandler={
				(userPermissions.studio &&
					(rundown.orphaned || rundown.source.type === 'testing' || rundown.source.type === 'snapshot')) ||
				userPermissions.configure ||
				userPermissions.service
					? () => confirmDeleteRundown(rundown, t)
					: undefined
			}
			confirmReSyncRundownHandler={
				rundown.orphaned && userPermissions.studio ? () => confirmReSyncRundown(userPermissions, rundown, t) : undefined
			}
		/>
	)
}
