import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import ClassNames from 'classnames'
import { PieceDisplayStyle } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownUtils } from '../../../lib/rundown.js'
import type { ReadonlyDeep } from 'type-fest'
import type { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import { PreviewPopUpContext } from '../../PreviewPopUp/PreviewPopUpContext.js'
import { useContentStatusForItem } from '../../SegmentTimeline/withMediaObjectStatus.js'
import { DEFAULT_BUTTON_HEIGHT, DEFAULT_BUTTON_WIDTH, type IDashboardButtonProps } from './types.js'
import { DashboardButtonTagStrip } from './subcomponents/DashboardButtonTagStrip.js'
import { HotkeyBadge } from './subcomponents/HotkeyBadge.js'
import { EditableLabel } from './subcomponents/EditableLabel.js'
import { MediaBox } from './subcomponents/MediaBox.js'
import { useDashboardButtonInteractions } from './useDashboardButtonInteractions.js'

export type DashboardPieceButtonProps = React.PropsWithChildren<IDashboardButtonProps> & {
	compact?: boolean
	showHotkey?: boolean
}

export const DashboardPieceButton = React.forwardRef<HTMLDivElement, DashboardPieceButtonProps>(
	function DashboardPieceButton(props, forwardedRef): JSX.Element {
		const contentStatus = useContentStatusForItem(props.piece)
		const previewContext = useContext(PreviewPopUpContext)

		const {
			piece,
			layer,
			displayStyle,
			widthScale,
			heightScale,
			isOnAir,
			isNext,
			isSelected,
			disabled,
			showThumbnailsInList,
			disableHoverInspector,
			toggleOnSingleClick,
			queueAllAdlibs,
			canOverflowHorizontally,
			editableName,
			onNameChanged,
			studio,
			compact,
			showHotkey = true,
		} = props

		const [label, setLabel] = useState(piece.name)
		const [active] = useState(false)

		useEffect(() => {
			setLabel(piece.name)
		}, [piece.name])

		const labelElRef = useRef<HTMLTextAreaElement | null>(null)

		const layerTypeClassName = useMemo(
			() => (layer ? RundownUtils.getSourceLayerClassName(layer.type) : undefined),
			[layer]
		)

		const interactions = useDashboardButtonInteractions({
			piece,
			layer,
			contentStatus,
			previewContext,
			disableHoverInspector,
			toggleOnSingleClick,
			queueAllAdlibs,
			canOverflowHorizontally,
			onToggleAdLib: props.onToggleAdLib,
			onSelectAdLib: props.onSelectAdLib,
		})

		useEffect(() => {
			if (editableName && labelElRef.current) {
				labelElRef.current.focus()
				labelElRef.current.setSelectionRange(0, labelElRef.current.value.length)
			}
		}, [editableName])

		const onLabelChange = useCallback(
			(e: React.ChangeEvent<HTMLTextAreaElement>) => setLabel(e.currentTarget.value || ''),
			[]
		)

		const onLabelBlur = useCallback(
			(e: React.FocusEvent<HTMLTextAreaElement>) => {
				if (!label.trim()) {
					e.persist()
					setLabel(piece.name)
					interactions.deferredNameChange(() => onNameChanged?.(e, piece.name))
				} else {
					onNameChanged?.(e, label)
				}
			},
			[interactions, label, onNameChanged, piece.name]
		)

		const onLabelKeyUp = useCallback(
			(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (e.key === 'Escape') {
					setLabel(piece.name)
					labelElRef.current?.blur()
					e.preventDefault()
					e.stopPropagation()
				} else if (e.key === 'Enter') {
					labelElRef.current?.blur()
					e.preventDefault()
					e.stopPropagation()
				}
			},
			[piece.name]
		)

		const isList = displayStyle === PieceDisplayStyle.LIST
		const hasMediaBox = useMemo(() => {
			if (!layer) return false
			if (!(layer.type === SourceLayerType.VT || layer.type === SourceLayerType.LIVE_SPEAK)) return false

			const isButtons = displayStyle === PieceDisplayStyle.BUTTONS
			const shouldRenderThumbnail = isButtons || (isList && showThumbnailsInList)
			if (!shouldRenderThumbnail) return false

			const chosenUrl = contentStatus?.thumbnailUrl || contentStatus?.previewUrl
			if (chosenUrl) return true

			switch (contentStatus?.status) {
				case PieceStatusCode.SOURCE_BROKEN:
				case PieceStatusCode.SOURCE_MISSING:
				case PieceStatusCode.SOURCE_UNKNOWN_STATE:
				case PieceStatusCode.SOURCE_NOT_READY:
				case PieceStatusCode.UNKNOWN:
				case undefined:
					return true
				default:
					return false
			}
		}, [
			layer,
			displayStyle,
			isList,
			showThumbnailsInList,
			contentStatus?.previewUrl,
			contentStatus?.thumbnailUrl,
			contentStatus?.status,
		])

		return (
			<div
				className={ClassNames('dashboard-panel__panel__button-wrapper', {
					live: isOnAir,
					next: isNext,
					selected: isNext || isSelected,
				})}
			>
				<div
					className={ClassNames(
						'dashboard-panel__panel__button',
						{
							'dashboard-panel__panel__button--compact': Boolean(compact),
							invalid: piece.invalid,
							floated: piece.floated,
							active,
							live: isOnAir,
							disabled: disabled,
							list: isList,
							selected: isNext || isSelected,
							'dashboard-panel__panel__button--has-hotkey': showHotkey && Boolean(piece.hotkey),
							'dashboard-panel__panel__button--no-media': showHotkey && Boolean(piece.hotkey) && !hasMediaBox,
							'dashboard-panel__panel__button--no-thumbnail': !hasMediaBox,
						},
						RundownUtils.getPieceStatusClassName(contentStatus?.status),
						...(piece.tags ? piece.tags.map((tag) => `piece-tag--${tag}`) : [])
					)}
					style={{
						width: isList ? 'calc(100% - 8px)' : widthScale ? widthScale * DEFAULT_BUTTON_WIDTH + 'em' : undefined,
						height: !isList && heightScale ? heightScale * DEFAULT_BUTTON_HEIGHT + 'em' : undefined,
					}}
					onClick={interactions.onClick}
					onDoubleClick={interactions.onDoubleClick}
					ref={(node) => {
						interactions.elementRef.current = node
						if (typeof forwardedRef === 'function') {
							forwardedRef(node)
						} else if (forwardedRef) {
							;(forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node
						}
					}}
					onMouseDown={interactions.onMouseDown}
					onPointerEnter={interactions.onPointerEnter}
					onPointerLeave={interactions.onPointerLeave}
					onMouseMove={interactions.onMouseMove}
					onPointerDown={interactions.onPointerDown}
					onPointerOut={interactions.onPointerOut}
					onPointerUp={interactions.onPointerUp}
					onTouchStart={interactions.onTouchStart}
					onTouchEnd={interactions.onTouchEnd}
					onTouchMove={interactions.onTouchMove}
					data-obj-id={piece._id}
				>
					<div className="dashboard-panel__panel__button__content">
						{showHotkey ? <HotkeyBadge hotkey={piece.hotkey} /> : null}
						<DashboardButtonTagStrip className={layerTypeClassName}>
							<MediaBox
								piece={piece}
								layer={layer}
								studio={studio}
								displayStyle={displayStyle}
								showThumbnailsInList={showThumbnailsInList}
								disableHoverInspector={disableHoverInspector}
								contentStatus={contentStatus as ReadonlyDeep<PieceContentStatusObj> | undefined}
							/>
							<DashboardButtonTagStrip
								className={ClassNames(layerTypeClassName, 'dashboard-panel__panel__button__tag-container--inner')}
							>
								<div className="dashboard-panel__panel__button__label-container">
									<EditableLabel
										editable={editableName}
										label={label}
										labelRef={(el) => {
											labelElRef.current = el
										}}
										onChange={onLabelChange}
										onBlur={onLabelBlur}
										onKeyUp={onLabelKeyUp}
									/>
								</div>
							</DashboardButtonTagStrip>
						</DashboardButtonTagStrip>
					</div>
				</div>
			</div>
		)
	}
)
