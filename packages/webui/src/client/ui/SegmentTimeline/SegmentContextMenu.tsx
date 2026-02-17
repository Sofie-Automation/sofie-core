import * as React from 'react'
import Escape from './../../lib/Escape.js'
import { useTranslation } from 'react-i18next'
import { ContextMenu, MenuItem } from '@jstarpl/react-contextmenu'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import {
	DBRundownPlaylist,
	QuickLoopMarker,
	QuickLoopMarkerType,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownUtils } from '../../lib/rundown.js'
import { IContextMenuContext } from '../RundownView.js'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { UserEditOperationMenuItems } from '../UserEditOperations/RenderUserEditOperations.js'
import { CoreUserEditingDefinition } from '@sofie-automation/corelib/dist/dataModel/UserEditingDefinitions'
import * as RundownResolver from '../../lib/RundownResolver.js'
import { SelectedElement } from '../RundownView/SelectedElementsContext.js'

interface IProps {
	onSetNext: (part: DBPart | undefined, e: any, offset?: number, take?: boolean) => void
	onSetNextSegment: (segmentId: SegmentId, e: any) => void
	onQueueNextSegment: (segmentId: SegmentId | null, e: any) => void
	onSetQuickLoopStart: (marker: QuickLoopMarker | null, e: any) => void
	onSetQuickLoopEnd: (marker: QuickLoopMarker | null, e: any) => void
	onEditProps: (element: SelectedElement) => void
	playlist?: DBRundownPlaylist
	studioMode: boolean
	contextMenuContext: IContextMenuContext | null
	enablePlayFromAnywhere: boolean
	enableQuickLoop: boolean
	enableUserEdits: boolean
}

export function SegmentContextMenu({
	onSetNext,
	onSetNextSegment,
	onQueueNextSegment,
	onSetQuickLoopStart,
	onSetQuickLoopEnd,
	onEditProps,
	playlist,
	studioMode,
	contextMenuContext,
	enablePlayFromAnywhere,
	enableQuickLoop,
	enableUserEdits,
}: IProps): JSX.Element | null {
	const { t } = useTranslation()

	if (!studioMode || !playlist || (!enableUserEdits && !playlist.activationId)) return null

	const getTimePosition = (): number | null => {
		let offset = 0
		if (contextMenuContext && contextMenuContext.partDocumentOffset) {
			const left = contextMenuContext.partDocumentOffset.left || 0
			const timeScale = contextMenuContext.timeScale || 1
			const menuPosition = contextMenuContext.mousePosition || { left }
			offset = (menuPosition.left - left) / timeScale
			return offset
		}
		return null
	}

	// private onSetAsNextFromHere = (part: DBPart, e) => {
	// 	const offset = this.getTimePosition()
	// 	onSetNext(part, e, offset || 0)
	// }

	const onPlayFromHere = (part: DBPart, e: React.MouseEvent | React.TouchEvent) => {
		const offset = getTimePosition()
		onSetNext(part, e, offset || 0, true)
	}

	const piece = contextMenuContext?.piece
	const part = contextMenuContext?.part
	const segment = contextMenuContext?.segment
	const timecode = getTimePosition()
	const startsAt = contextMenuContext?.partStartsAt

	const isCurrentPart =
		(part && playlist && part.instance._id === playlist.currentPartInfo?.partInstanceId) || undefined

	const isSegmentEditAble = segment?._id !== playlist.queuedSegmentId

	const isPartEditAble =
		isSegmentEditAble &&
		part?.instance._id !== playlist.currentPartInfo?.partInstanceId &&
		part?.instance._id !== playlist.nextPartInfo?.partInstanceId &&
		part?.instance._id !== playlist.previousPartInfo?.partInstanceId

	const canSetAsNext = !!playlist?.activationId

	return segment?.orphaned !== SegmentOrphanedReason.ADLIB_TESTING ? (
		<Escape to="document">
			<ContextMenu id="segment-timeline-context-menu">
				{part && timecode === null && (
					<>
						<MenuItem
							onClick={(e) => onSetNextSegment(part.instance.segmentId, e)}
							disabled={isCurrentPart || !canSetAsNext}
						>
							<span dangerouslySetInnerHTML={{ __html: t('Set segment as <strong>Next</strong>') }}></span>
						</MenuItem>
						{part.instance.segmentId !== playlist.queuedSegmentId ? (
							<MenuItem onClick={(e) => onQueueNextSegment(part.instance.segmentId, e)} disabled={!canSetAsNext}>
								<span>{t('Queue segment')}</span>
							</MenuItem>
						) : (
							<MenuItem onClick={(e) => onQueueNextSegment(null, e)} disabled={!canSetAsNext}>
								<span>{t('Clear queued segment')}</span>
							</MenuItem>
						)}
						{segment && (
							<UserEditOperationMenuItems
								rundownId={segment.rundownId}
								targetName={segment.name}
								operationTarget={{
									segmentExternalId: segment.externalId,
									partExternalId: undefined,
									pieceExternalId: undefined,
								}}
								userEditOperations={segment.userEditOperations}
								isFormEditable={isSegmentEditAble}
							/>
						)}
						{enableUserEdits && (
							<>
								<hr />
								<MenuItem onClick={() => onEditProps({ type: 'segment', elementId: part.instance.segmentId })}>
									<span>{t('Edit Segment Properties')}</span>
								</MenuItem>
							</>
						)}
						<hr />
					</>
				)}
				{part && !part.instance.part.invalid && timecode !== null && (
					<>
						<MenuItem
							onClick={(e) => onSetNext(part.instance.part, e)}
							disabled={!!part.instance.orphaned || !canSetAsNext}
						>
							<span dangerouslySetInnerHTML={{ __html: t('Set this part as <strong>Next</strong>') }}></span>
							{startsAt !== undefined &&
								'\u00a0(' + RundownUtils.formatTimeToShortTime(Math.floor(startsAt / 1000) * 1000) + ')'}
						</MenuItem>
						{startsAt !== undefined && part && enablePlayFromAnywhere ? (
							<>
								{/* <MenuItem
											onClick={(e) => this.onSetAsNextFromHere(part.instance.part, e)}
											disabled={isCurrentPart || !!part.instance.orphaned || !canSetAsNext}
										>
											<span dangerouslySetInnerHTML={{ __html: t('Set <strong>Next</strong> Here') }}></span> (
											{RundownUtils.formatTimeToShortTime(Math.floor((startsAt + timecode) / 1000) * 1000)})
										</MenuItem> */}
								<MenuItem
									onClick={(e) => onPlayFromHere(part.instance.part, e)}
									disabled={!!part.instance.orphaned || !canSetAsNext}
								>
									<span>{t('Play from Here')}</span> (
									{RundownUtils.formatTimeToShortTime(Math.floor((startsAt + timecode) / 1000) * 1000)})
								</MenuItem>
							</>
						) : null}
						{enableQuickLoop && !RundownResolver.isLoopLocked(playlist) && (
							<>
								{RundownResolver.isQuickLoopStart(part.partId, playlist) ? (
									<MenuItem onClick={(e) => onSetQuickLoopStart(null, e)}>
										<span>{t('Clear QuickLoop Start')}</span>
									</MenuItem>
								) : (
									<MenuItem
										onClick={(e) =>
											onSetQuickLoopStart({ type: QuickLoopMarkerType.PART, id: part.instance.part._id }, e)
										}
										disabled={!!part.instance.orphaned || !canSetAsNext}
									>
										<span>{t('Set as QuickLoop Start')}</span>
									</MenuItem>
								)}
								{RundownResolver.isQuickLoopEnd(part.partId, playlist) ? (
									<MenuItem onClick={(e) => onSetQuickLoopEnd(null, e)}>
										<span>{t('Clear QuickLoop End')}</span>
									</MenuItem>
								) : (
									<MenuItem
										onClick={(e) =>
											onSetQuickLoopEnd({ type: QuickLoopMarkerType.PART, id: part.instance.part._id }, e)
										}
										disabled={!!part.instance.orphaned || !canSetAsNext}
									>
										<span>{t('Set as QuickLoop End')}</span>
									</MenuItem>
								)}
							</>
						)}

						<UserEditOperationMenuItems
							rundownId={part.instance.rundownId}
							targetName={part.instance.part.title}
							operationTarget={{
								segmentExternalId: segment?.externalId,
								partExternalId: part.instance.part.externalId,
								pieceExternalId: undefined,
							}}
							userEditOperations={part.instance.part.userEditOperations}
							isFormEditable={isPartEditAble}
						/>

						{piece && piece.instance.piece.userEditOperations && (
							<UserEditOperationMenuItems
								rundownId={part.instance.rundownId}
								targetName={piece.instance.piece.name}
								operationTarget={{
									segmentExternalId: segment?.externalId,
									partExternalId: part.instance.part.externalId,
									pieceExternalId: piece.instance.piece.externalId,
								}}
								userEditOperations={piece.instance.piece.userEditOperations as CoreUserEditingDefinition[] | undefined}
								isFormEditable={isPartEditAble}
							/>
						)}

						{enableUserEdits && (
							<>
								<hr />
								<MenuItem onClick={() => onEditProps({ type: 'segment', elementId: part.instance.segmentId })}>
									<span>{t('Edit Segment Properties')}</span>
								</MenuItem>
								<MenuItem onClick={() => onEditProps({ type: 'part', elementId: part.instance.part._id })}>
									<span>{t('Edit Part Properties')}</span>
								</MenuItem>
								{piece && piece.instance.piece.userEditProperties && (
									<MenuItem onClick={() => onEditProps({ type: 'piece', elementId: piece.instance.piece._id })}>
										<span>{t('Edit Piece Properties')}</span>
									</MenuItem>
								)}
							</>
						)}
					</>
				)}
			</ContextMenu>
		</Escape>
	) : null
}
