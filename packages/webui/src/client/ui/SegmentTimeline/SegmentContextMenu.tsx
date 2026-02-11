import * as React from 'react'
import Escape from './../../lib/Escape.js'
import { withTranslation } from 'react-i18next'
import { ContextMenu, MenuItem } from '@jstarpl/react-contextmenu'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import {
	DBRundownPlaylist,
	QuickLoopMarker,
	QuickLoopMarkerType,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { RundownUtils } from '../../lib/rundown.js'
import { IContextMenuContext } from '../RundownView.js'
import { PartUi, SegmentUi } from './SegmentTimelineContainer.js'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { UserEditOperationMenuItems } from '../UserEditOperations/RenderUserEditOperations.js'
import * as RundownResolver from '../../lib/RundownResolver.js'
import { SelectedElement } from '../RundownView/SelectedElementsContext.js'
import { PieceExtended } from '../../lib/RundownResolver.js'

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
interface IState {}

export const SegmentContextMenu = withTranslation()(
	class SegmentContextMenu extends React.Component<Translated<IProps>, IState> {
		constructor(props: Translated<IProps>) {
			super(props)
		}

		render(): JSX.Element | null {
			const { t } = this.props

			if (
				!this.props.studioMode ||
				!this.props.playlist ||
				(!this.props.enableUserEdits && !this.props.playlist.activationId)
			)
				return null

			const piece = this.getPieceFromContext()
			const part = this.getPartFromContext()
			const segment = this.getSegmentFromContext()
			const timecode = this.getTimePosition()
			const startsAt = this.getPartStartsAt()

			const isCurrentPart =
				(part && this.props.playlist && part.instance._id === this.props.playlist.currentPartInfo?.partInstanceId) ||
				undefined

			const isSegmentEditAble = segment?._id !== this.props.playlist.queuedSegmentId

			const isPartEditAble =
				isSegmentEditAble &&
				part?.instance._id !== this.props.playlist.currentPartInfo?.partInstanceId &&
				part?.instance._id !== this.props.playlist.nextPartInfo?.partInstanceId &&
				part?.instance._id !== this.props.playlist.previousPartInfo?.partInstanceId

			const segmentHasEditableContent = !!(
				segment?.userEditOperations?.length ||
				segment?.userEditProperties?.pieceTypeProperties ||
				segment?.userEditProperties?.globalProperties ||
				segment?.userEditProperties?.operations?.length
			)
			const partHasEditableContent = !!(
				part?.instance.part.userEditOperations?.length ||
				part?.instance.part.userEditProperties?.pieceTypeProperties ||
				part?.instance.part.userEditProperties?.globalProperties ||
				part?.instance.part.userEditProperties?.operations?.length
			)
			const pieceHasEditableContent = !!(
				piece?.instance.piece.userEditOperations?.length ||
				piece?.instance.piece.userEditProperties?.pieceTypeProperties ||
				piece?.instance.piece.userEditProperties?.globalProperties ||
				piece?.instance.piece.userEditProperties?.operations?.length
			)

			const canSetAsNext = !!this.props.playlist?.activationId

			return segment?.orphaned !== SegmentOrphanedReason.ADLIB_TESTING ? (
				<Escape to="document">
					<ContextMenu id="segment-timeline-context-menu">
						{part && timecode === null && (
							<>
								<MenuItem
									onClick={(e) => this.props.onSetNextSegment(part.instance.segmentId, e)}
									disabled={isCurrentPart || !canSetAsNext}
								>
									<span dangerouslySetInnerHTML={{ __html: t('Set segment as <strong>Next</strong>') }}></span>
								</MenuItem>
								{part.instance.segmentId !== this.props.playlist.queuedSegmentId ? (
									<MenuItem
										onClick={(e) => this.props.onQueueNextSegment(part.instance.segmentId, e)}
										disabled={!canSetAsNext}
									>
										<span>{t('Queue segment')}</span>
									</MenuItem>
								) : (
									<MenuItem onClick={(e) => this.props.onQueueNextSegment(null, e)} disabled={!canSetAsNext}>
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
								<hr />
								{this.props.enableUserEdits && segmentHasEditableContent && (
									<>
										<hr />
										<MenuItem
											onClick={() => this.props.onEditProps({ type: 'segment', elementId: part.instance.segmentId })}
										>
											<span>{t('Edit Segment Properties')}</span>
										</MenuItem>
									</>
								)}
							</>
						)}
						{part && !part.instance.part.invalid && timecode !== null && (
							<>
								<MenuItem
									onClick={(e) => this.props.onSetNext(part.instance.part, e)}
									disabled={!!part.instance.orphaned || !canSetAsNext}
								>
									<span dangerouslySetInnerHTML={{ __html: t('Set this part as <strong>Next</strong>') }}></span>
									{startsAt !== null &&
										'\u00a0(' + RundownUtils.formatTimeToShortTime(Math.floor(startsAt / 1000) * 1000) + ')'}
								</MenuItem>
								{startsAt !== null && part && this.props.enablePlayFromAnywhere ? (
									<>
										{/* <MenuItem
											onClick={(e) => this.onSetAsNextFromHere(part.instance.part, e)}
											disabled={isCurrentPart || !!part.instance.orphaned || !canSetAsNext}
										>
											<span dangerouslySetInnerHTML={{ __html: t('Set <strong>Next</strong> Here') }}></span> (
											{RundownUtils.formatTimeToShortTime(Math.floor((startsAt + timecode) / 1000) * 1000)})
										</MenuItem> */}
										<MenuItem
											onClick={(e) => this.onPlayFromHere(part.instance.part, e)}
											disabled={!!part.instance.orphaned || !canSetAsNext}
										>
											<span>{t('Play from Here')}</span> (
											{RundownUtils.formatTimeToShortTime(Math.floor((startsAt + timecode) / 1000) * 1000)})
										</MenuItem>
									</>
								) : null}
								{this.props.enableQuickLoop && !RundownResolver.isLoopLocked(this.props.playlist) && (
									<>
										{RundownResolver.isQuickLoopStart(part.partId, this.props.playlist) ? (
											<MenuItem onClick={(e) => this.props.onSetQuickLoopStart(null, e)}>
												<span>{t('Clear QuickLoop Start')}</span>
											</MenuItem>
										) : (
											<MenuItem
												onClick={(e) =>
													this.props.onSetQuickLoopStart(
														{ type: QuickLoopMarkerType.PART, id: part.instance.part._id },
														e
													)
												}
												disabled={!!part.instance.orphaned || !canSetAsNext}
											>
												<span>{t('Set as QuickLoop Start')}</span>
											</MenuItem>
										)}
										{RundownResolver.isQuickLoopEnd(part.partId, this.props.playlist) ? (
											<MenuItem onClick={(e) => this.props.onSetQuickLoopEnd(null, e)}>
												<span>{t('Clear QuickLoop End')}</span>
											</MenuItem>
										) : (
											<MenuItem
												onClick={(e) =>
													this.props.onSetQuickLoopEnd(
														{ type: QuickLoopMarkerType.PART, id: part.instance.part._id },
														e
													)
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

								{this.props.enableUserEdits &&
									(segmentHasEditableContent || partHasEditableContent || pieceHasEditableContent) && (
										<>
											<hr />
											{segmentHasEditableContent && (
												<MenuItem
													onClick={() =>
														this.props.onEditProps({ type: 'segment', elementId: part.instance.segmentId })
													}
												>
													<span>{t('Edit Segment Properties')}</span>
												</MenuItem>
											)}
											{partHasEditableContent && (
												<MenuItem
													onClick={() => this.props.onEditProps({ type: 'part', elementId: part.instance.part._id })}
												>
													<span>{t('Edit Part Properties')}</span>
												</MenuItem>
											)}
											{pieceHasEditableContent && (
												<MenuItem
													onClick={() => this.props.onEditProps({ type: 'piece', elementId: piece.instance.piece._id })}
												>
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

		getSegmentFromContext = (): SegmentUi | null => {
			if (this.props.contextMenuContext && this.props.contextMenuContext.segment) {
				return this.props.contextMenuContext.segment
			}

			return null
		}

		getPartFromContext = (): PartUi | null => {
			if (this.props.contextMenuContext && this.props.contextMenuContext.part) {
				return this.props.contextMenuContext.part
			} else {
				return null
			}
		}

		getPieceFromContext = (): PieceExtended | null => {
			if (this.props.contextMenuContext && this.props.contextMenuContext.piece) {
				return this.props.contextMenuContext.piece
			} else {
				return null
			}
		}

		// private onSetAsNextFromHere = (part: DBPart, e) => {
		// 	const offset = this.getTimePosition()
		// 	this.props.onSetNext(part, e, offset || 0)
		// }

		private onPlayFromHere = (part: DBPart, e: React.MouseEvent | React.TouchEvent) => {
			const offset = this.getTimePosition()
			this.props.onSetNext(part, e, offset || 0, true)
		}

		private getPartStartsAt = (): number | null => {
			if (this.props.contextMenuContext && this.props.contextMenuContext.partStartsAt !== undefined) {
				return this.props.contextMenuContext.partStartsAt
			}
			return null
		}

		private getTimePosition = (): number | null => {
			let offset = 0
			if (this.props.contextMenuContext && this.props.contextMenuContext.partDocumentOffset) {
				const left = this.props.contextMenuContext.partDocumentOffset.left || 0
				const timeScale = this.props.contextMenuContext.timeScale || 1
				const menuPosition = this.props.contextMenuContext.mousePosition || { left }
				offset = (menuPosition.left - left) / timeScale
				return offset
			}
			return null
		}
	}
)
