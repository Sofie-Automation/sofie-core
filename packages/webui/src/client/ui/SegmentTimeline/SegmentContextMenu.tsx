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
import { PartInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { UserEditOperationMenuItems } from '../UserEditOperations/RenderUserEditOperations.js'
import { CoreUserEditingDefinition } from '@sofie-automation/corelib/dist/dataModel/UserEditingDefinitions'
import { SelectedElement } from '../RundownView/SelectedElementsContext.js'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance.js'
import { hasUserEditableContent } from '../UserEditOperations/PropertiesPanel.js'
import {
	isLoopLocked,
	isQuickLoopEnd,
	isQuickLoopStart,
} from '@sofie-automation/corelib/src/playout/stateCacheResolver.js'

interface IProps {
	onSetNext: (partInstance: DBPartInstance | DBPart | undefined, e: any, offset?: number, take?: boolean) => void
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

	const getIsPlayFromHereDisabled = (take: boolean = false): boolean => {
		const offset = getTimePosition() ?? 0
		const partInstance = part?.instance
		const isSelectedTimeWithinBounds =
			(partInstance?.part.expectedDuration ??
				partInstance?.part.displayDuration ??
				partInstance?.part.expectedDurationWithTransition ??
				0) < offset

		if (playlist && playlist?.activationId && (!take || !!partInstance?.orphaned)) {
			if (!partInstance) return true
			else {
				return (
					(isSelectedTimeWithinBounds && partInstance._id === playlist.currentPartInfo?.partInstanceId) ||
					(!!partInstance.orphaned && partInstance._id === playlist.currentPartInfo?.partInstanceId)
				)
			}
		}
		return false
	}

	const onSetAsNextFromHere = (
		partInstance: DBPartInstance,
		nextPartInstanceId: PartInstanceId | null,
		currentPartInstanceId: PartInstanceId | null,
		e: React.MouseEvent | React.TouchEvent,
		take: boolean = false
	) => {
		const partInstanceAvailableForPlayout = partInstance.timings?.take !== undefined
		const isCurrentPartInstance = partInstance._id === currentPartInstanceId
		const isNextInstance = partInstance._id === nextPartInstanceId
		const offset = getTimePosition()
		onSetNext(
			(partInstanceAvailableForPlayout && !isCurrentPartInstance) || isNextInstance ? partInstance : partInstance.part,
			e,
			offset || 0,
			take
		)
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
		part?.instance._id !== playlist.previousPartsInfo?.[0]?.partInstanceId

	const segmentHasEditableContent = hasUserEditableContent(segment)
	const partHasEditableContent = hasUserEditableContent(part?.instance.part)
	const pieceHasEditableContent = hasUserEditableContent(piece?.instance.piece)

	const isPartOrphaned: boolean | undefined = part ? part.instance.orphaned !== undefined : undefined

	const isPartNext: boolean | undefined = part ? playlist.nextPartInfo?.partInstanceId === part.instance._id : undefined

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
						{enableUserEdits && segmentHasEditableContent && (
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
				{part &&
					isPartNext !== undefined &&
					isPartOrphaned !== undefined &&
					!part.instance.part.invalid &&
					timecode !== null && (
						<>
							<MenuItem
								onClick={(e) => onSetNext(part.instance.part, e)}
								disabled={!!part.instance.orphaned || !canSetAsNext}
							>
								<span
									dangerouslySetInnerHTML={{
										__html: t(`Set part as <strong>Next</strong>`),
									}}
								></span>
							</MenuItem>
							{startsAt !== undefined && part && enablePlayFromAnywhere ? (
								<>
									<MenuItem
										onClick={(e) =>
											onSetAsNextFromHere(
												part.instance,
												playlist?.nextPartInfo?.partInstanceId ?? null,
												playlist?.currentPartInfo?.partInstanceId ?? null,
												e
											)
										}
										disabled={getIsPlayFromHereDisabled()}
									>
										<span
											dangerouslySetInnerHTML={{
												__html: t(
													`Set part from ${RundownUtils.formatTimeToShortTime(
														Math.floor(timecode / 1000) * 1000
													)} as <strong>Next</strong>`
												),
											}}
										></span>
									</MenuItem>
									<MenuItem
										onClick={(e) =>
											onSetAsNextFromHere(
												part.instance,
												playlist?.nextPartInfo?.partInstanceId ?? null,
												playlist?.currentPartInfo?.partInstanceId ?? null,
												e,
												true
											)
										}
										disabled={getIsPlayFromHereDisabled(true)}
									>
										<span>
											{t(`Play part from ${RundownUtils.formatTimeToShortTime(Math.floor(timecode / 1000) * 1000)}`)}
										</span>
									</MenuItem>
								</>
							) : null}
							{enableQuickLoop && !isLoopLocked(playlist) && (
								<>
									{isQuickLoopStart(part.partId, playlist) ? (
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
									{isQuickLoopEnd(part.partId, playlist) ? (
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
									userEditOperations={
										piece.instance.piece.userEditOperations as CoreUserEditingDefinition[] | undefined
									}
									isFormEditable={isPartEditAble}
								/>
							)}

							{enableUserEdits && (segmentHasEditableContent || partHasEditableContent || pieceHasEditableContent) && (
								<>
									<hr />
									{segmentHasEditableContent && (
										<MenuItem onClick={() => onEditProps({ type: 'segment', elementId: part.instance.segmentId })}>
											<span>{t('Edit Segment Properties')}</span>
										</MenuItem>
									)}
									{partHasEditableContent && (
										<MenuItem onClick={() => onEditProps({ type: 'part', elementId: part.instance.part._id })}>
											<span>{t('Edit Part Properties')}</span>
										</MenuItem>
									)}
									{pieceHasEditableContent && piece && (
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
