import React, { useState, useEffect, useContext, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSubscription, useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData.js'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { faCaretDown, faCaretRight, faDownload, faPlus, faUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { TriggeredActionEntry, TRIGGERED_ACTION_ENTRY_DRAG_TYPE } from './TriggeredActionEntry.js'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { TriggersHandler } from '../../../../lib/triggers/TriggersHandler.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { MeteorCall } from '../../../../lib/meteorApi.js'
import { UploadButton } from '../../../../lib/uploadButton.js'
import { ErrorBoundary } from '../../../../lib/ErrorBoundary.js'
import { SorensenContext } from '../../../../lib/SorensenContext.js'
import Tooltip from 'rc-tooltip'
import { useDrop } from 'react-dnd'
import { TriggerType } from '@sofie-automation/blueprints-integration'
import { keyLabelsToCodes } from '../../../../lib/triggers/codesToKeyLabels.js'
import classNames from 'classnames'
import { catchError, fetchFrom } from '../../../../lib/lib.js'
import { NotificationCenter, Notification, NoticeLevel } from '../../../../lib/notifications/notifications.js'
import { doModalDialog } from '../../../../lib/ModalDialog.js'
import { PartId, RundownId, ShowStyleBaseId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylists, Rundowns, TriggeredActions } from '../../../../collections/index.js'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { SourceLayers, OutputLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { RundownPlaylistCollectionUtil } from '../../../../collections/rundownPlaylistUtil.js'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { UIPartInstances, UIParts } from '../../../Collections.js'
import Form from 'react-bootstrap/esm/Form'
import Button from 'react-bootstrap/esm/Button'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { createPrivateApiPath } from '../../../../url.js'

export interface PreviewContext {
	rundownPlaylist: DBRundownPlaylist | null
	currentRundownId: RundownId | null
	currentSegmentPartIds: PartId[]
	nextSegmentPartIds: PartId[]
	currentPartId: PartId | null
	nextPartId: PartId | null
}

interface IProps {
	showStyleBaseId: ShowStyleBaseId | null
	sourceLayers: SourceLayers
	outputLayers: OutputLayers
}

export const TriggeredActionsEditor: React.FC<IProps> = function TriggeredActionsEditor(
	props: IProps
): React.ReactElement | null {
	const sorensen = useContext(SorensenContext)
	const [systemWideCollapsed, setSystemWideCollapsed] = useState(true)
	const [selectedTriggeredActionId, setSelectedTriggeredActionId] = useState<null | TriggeredActionId>(null)
	const [triggerFilter, setTriggerFilter] = useState('')
	const [parsedTriggerFilter, setParsedTriggerFilter] = useState(triggerFilter)

	const [{ isOver: _isOver }, drop] = useDrop({
		// The type (or types) to accept - strings or symbols
		accept: TRIGGERED_ACTION_ENTRY_DRAG_TYPE,
		// Props to collect
		collect: (monitor) => ({
			isOver: monitor.isOver(),
			canDrop: monitor.canDrop(),
		}),
		canDrop: () => {
			return systemWideCollapsed
		},
		drop: () => undefined,
		hover: (_, monitor) => {
			if (monitor.canDrop() && systemWideCollapsed) {
				setSystemWideCollapsed(false)
			}
		},
	})

	const { showStyleBaseId, sourceLayers, outputLayers } = props

	useSubscription(MeteorPubSub.triggeredActions, showStyleBaseId ? [showStyleBaseId] : null)
	useSubscription(CorelibPubSub.rundownsWithShowStyleBases, showStyleBaseId ? [showStyleBaseId] : [])

	useEffect(() => {
		const debounce = setTimeout(() => {
			if (sorensen) {
				setParsedTriggerFilter(keyLabelsToCodes(triggerFilter, sorensen).replace(/\+/, '\\+'))
			} else {
				setParsedTriggerFilter(triggerFilter.replace(/\+/, '\\+'))
			}
		}, 150)

		return () => {
			clearTimeout(debounce)
		}
	}, [triggerFilter])

	const systemTriggeredActionIds = useTracker(
		() =>
			TriggeredActions.find(
				parsedTriggerFilter
					? {
							$or: [
								{
									triggersWithOverrides: {
										defaults: {
											0: {
												type: TriggerType.hotkey,
												keys: { $regex: `${parsedTriggerFilter}`, $options: 'i' },
											},
										},
									},
									showStyleBaseId: null,
								},
							],
						}
					: {
							showStyleBaseId: null,
						},
				{
					sort: {
						_rank: 1,
					},
					fields: {
						_id: 1,
					},
				}
			).map((triggeredAction) => triggeredAction._id),
		[parsedTriggerFilter]
	)
	const showTriggeredActionIds = useTracker(
		() =>
			TriggeredActions.find(
				parsedTriggerFilter
					? {
							$or: [
								{
									triggersWithOverrides: {
										defaults: {
											0: {
												type: TriggerType.hotkey,
												keys: { $regex: `${parsedTriggerFilter}`, $options: 'i' },
											},
										},
									},
									showStyleBaseId,
								},
							],
						}
					: {
							showStyleBaseId,
						},
				{
					sort: {
						_rank: 1,
					},
					fields: {
						_id: 1,
					},
				}
			).map((triggeredAction) => triggeredAction._id),
		[showStyleBaseId, parsedTriggerFilter]
	)

	useSubscription(CorelibPubSub.rundownPlaylists, null, null)

	const rundown = useTracker(() => {
		const activePlaylists = RundownPlaylists.find(
			{
				activationId: {
					$exists: true,
				},
			},
			{
				fields: {
					_id: 1,
					activationId: 1,
				},
			}
		).fetch()
		let selectedRundown: Rundown | undefined = undefined
		if (showStyleBaseId && activePlaylists) {
			selectedRundown = Rundowns.findOne({
				playlistId: {
					$in: activePlaylists.map((playlist) => playlist._id),
				},
				showStyleBaseId,
			})
		}
		if (!selectedRundown && showStyleBaseId) {
			selectedRundown = Rundowns.findOne({
				showStyleBaseId,
			})
		}
		return selectedRundown
	}, [showStyleBaseId])

	const rundownPlaylist = useTracker(
		() => RundownPlaylists.findOne(rundown?.playlistId) ?? null,
		[rundown?.playlistId],
		null
	)

	useSubscription(MeteorPubSub.uiPartInstances, rundownPlaylist?.activationId ?? null)
	useSubscription(MeteorPubSub.uiParts, rundownPlaylist?._id ?? null)

	const previewContext = useTracker(
		() => {
			let thisCurrentPart: DBPart | null = null
			let thisNextPart: DBPart | null = null
			let thisCurrentSegmentPartIds: PartId[] = []
			let thisNextSegmentPartIds: PartId[] = []
			if (rundownPlaylist) {
				if (rundownPlaylist.currentPartInfo) {
					const currentPartInstance = UIPartInstances.findOne(rundownPlaylist.currentPartInfo.partInstanceId)
					if (currentPartInstance) {
						thisCurrentPart = currentPartInstance.part
						thisCurrentSegmentPartIds = UIParts.find({
							segmentId: currentPartInstance.segmentId,
						}).map((part) => part._id)
					}
				}
				if (rundownPlaylist.nextPartInfo) {
					const nextPartInstance = UIPartInstances.findOne(rundownPlaylist.nextPartInfo.partInstanceId)
					if (nextPartInstance) {
						thisNextPart = nextPartInstance.part
						thisNextSegmentPartIds = UIParts.find({
							segmentId: nextPartInstance.segmentId,
						}).map((part) => part._id)
					}
				}
			}
			return literal<PreviewContext>({
				currentPartId: thisCurrentPart?._id ?? null,
				nextPartId: thisNextPart?._id ?? null,
				currentSegmentPartIds: thisCurrentSegmentPartIds,
				nextSegmentPartIds: thisNextSegmentPartIds,
				currentRundownId:
					thisCurrentPart?.rundownId ??
					thisNextPart?.rundownId ??
					(rundownPlaylist ? RundownPlaylistCollectionUtil.getRundownOrderedIDs(rundownPlaylist)[0] : null) ??
					null,
				rundownPlaylist: rundownPlaylist,
			})
		},
		[rundownPlaylist?.currentPartInfo?.partInstanceId, rundownPlaylist?.nextPartInfo?.partInstanceId],
		{
			currentPartId: null,
			nextPartId: null,
			currentSegmentPartIds: [],
			nextSegmentPartIds: [],
			currentRundownId: null,
			rundownPlaylist: rundownPlaylist,
		}
	)

	const { t } = useTranslation()

	const onEditEntry = useCallback(
		(triggeredActionId: TriggeredActionId) => {
			if (selectedTriggeredActionId === triggeredActionId) {
				setSelectedTriggeredActionId(null)
			} else {
				setSelectedTriggeredActionId(triggeredActionId)
			}
		},
		[selectedTriggeredActionId]
	)

	const onNewTriggeredAction = useCallback(() => {
		MeteorCall.triggeredActions
			.createTriggeredActions(props.showStyleBaseId ?? null, {
				_rank:
					(TriggeredActions.findOne(
						{
							showStyleBaseId: props.showStyleBaseId ?? null,
						},
						{
							sort: {
								_rank: -1,
							},
						}
					)?._rank ?? 0) + 1000,
			})
			.catch(catchError('triggeredActions.createTriggeredActions'))
	}, [props.showStyleBaseId])

	const onRemoveTriggeredAction = useCallback((triggeredActionId: TriggeredActionId) => {
		MeteorCall.triggeredActions
			.removeTriggeredActions(triggeredActionId)
			.catch(catchError('triggeredActions.removeTriggeredActions'))
	}, [])

	const onDuplicateEntry = useCallback(
		(triggeredActionId: TriggeredActionId) => {
			const triggeredAction = TriggeredActions.findOne(triggeredActionId)
			if (triggeredAction) {
				const nextTriggeredActionRank =
					TriggeredActions.find(
						{
							showStyleBaseId: triggeredAction.showStyleBaseId,
							_rank: {
								$gt: triggeredAction._rank,
							},
						},
						{
							sort: {
								_rank: 1,
							},
							limit: 1,
						}
					).fetch()[0]?._rank ?? triggeredAction._rank + 1000

				MeteorCall.triggeredActions
					.createTriggeredActions(triggeredAction.showStyleBaseId, {
						_rank: (triggeredAction._rank + nextTriggeredActionRank) / 2,
						name: triggeredAction.name,
						triggers: {},
						actions: applyAndValidateOverrides(triggeredAction.actionsWithOverrides).obj,
					})
					.then((duplicateTriggeredActionId) => setSelectedTriggeredActionId(duplicateTriggeredActionId))
					.catch(catchError('triggeredActions.createTriggeredActions'))
			}
		},
		[setSelectedTriggeredActionId]
	)

	const onDownloadActions = useCallback(() => {
		window.location.replace(createPrivateApiPath(`actionTriggers/download/${showStyleBaseId ?? ''}`))
	}, [showStyleBaseId])

	return (
		<div>
			{sorensen && previewContext.rundownPlaylist && showStyleBaseId && (
				<ErrorBoundary>
					<TriggersHandler
						sorensen={sorensen}
						simulateTriggerBinding={true}
						studioId={previewContext.rundownPlaylist.studioId}
						showStyleBaseId={showStyleBaseId}
						currentRundownId={previewContext.currentRundownId}
						rundownPlaylistId={previewContext.rundownPlaylist._id}
						currentPartId={previewContext.currentPartId}
						nextPartId={previewContext.nextPartId}
						currentSegmentPartIds={previewContext.currentSegmentPartIds}
						nextSegmentPartIds={previewContext.nextSegmentPartIds}
					/>
				</ErrorBoundary>
			)}
			<h2 className="mb-4">{t('Action Triggers')}</h2>
			<div className="my-2">
				<Form.Control
					placeholder={t('Find Trigger...')}
					value={triggerFilter}
					onChange={(e) => setTriggerFilter(e.target.value)}
				/>
			</div>
			{showTriggeredActionIds?.length === 0 && systemTriggeredActionIds?.length === 0 ? (
				parsedTriggerFilter ? (
					<p className="my-2 subtle">{t('No matching Action Trigger.')}</p>
				) : (
					<p className="my-2 subtle">{t('No Action Triggers set up.')}</p>
				)
			) : null}
			<div className={classNames('my-2', parsedTriggerFilter ? 'mb-0' : undefined)}>
				{showTriggeredActionIds?.map((triggeredActionId) => (
					<TriggeredActionEntry
						key={unprotectString(triggeredActionId)}
						triggeredActionId={triggeredActionId}
						selected={selectedTriggeredActionId === triggeredActionId}
						locked={!!parsedTriggerFilter}
						onEdit={onEditEntry}
						onRemove={onRemoveTriggeredAction}
						onDuplicate={onDuplicateEntry}
						sourceLayers={sourceLayers}
						outputLayers={outputLayers}
						previewContext={rundownPlaylist && selectedTriggeredActionId === triggeredActionId ? previewContext : null}
						onFocus={setSelectedTriggeredActionId}
					/>
				))}
			</div>
			{showStyleBaseId !== null ? (
				<>
					<div className={classNames('my-2', parsedTriggerFilter ? 'mt-0' : undefined)}>
						{!parsedTriggerFilter ? (
							<h3
								className="my-3 clickable disable-select"
								onClick={() => setSystemWideCollapsed(!systemWideCollapsed)}
								role="button"
								tabIndex={0}
								ref={drop}
							>
								<span className="icon action-item me-2">
									<FontAwesomeIcon icon={systemWideCollapsed ? faCaretRight : faCaretDown} />
								</span>
								{t('System-wide')}
							</h3>
						) : null}
						{!systemWideCollapsed || parsedTriggerFilter
							? systemTriggeredActionIds?.map((triggeredActionId) => (
									<TriggeredActionEntry
										key={unprotectString(triggeredActionId)}
										triggeredActionId={triggeredActionId}
										selected={selectedTriggeredActionId === triggeredActionId}
										locked={!!parsedTriggerFilter}
										onEdit={onEditEntry}
										onRemove={onRemoveTriggeredAction}
										onDuplicate={onDuplicateEntry}
										sourceLayers={sourceLayers}
										outputLayers={outputLayers}
										previewContext={
											rundownPlaylist && selectedTriggeredActionId === triggeredActionId ? previewContext : null
										}
										onFocus={setSelectedTriggeredActionId}
									/>
								))
							: null}

						{!systemWideCollapsed && !parsedTriggerFilter && systemTriggeredActionIds?.length === 0 && (
							<p className="my-2 subtle">{t('No Action Triggers set up.')}</p>
						)}
					</div>
				</>
			) : null}
			<div className="my-1 mx-2">
				<Tooltip overlay={t('Add Action Trigger')} placement="top">
					<Button variant="primary" className="mx-1" onClick={onNewTriggeredAction}>
						<FontAwesomeIcon icon={faPlus} />
					</Button>
				</Tooltip>
				<Tooltip overlay={t('Upload stored Action Triggers')} placement="top">
					<div className="d-inline-block">
						<ImportTriggeredActionsButton showStyleBaseId={showStyleBaseId} />
					</div>
				</Tooltip>
				<Tooltip overlay={t('Download Action Triggers')} placement="top">
					<Button variant="outline-secondary" className="mx-1" onClick={onDownloadActions}>
						<FontAwesomeIcon icon={faDownload} />
					</Button>
				</Tooltip>
			</div>
		</div>
	)
}

function ImportTriggeredActionsButton({ showStyleBaseId }: { showStyleBaseId: ShowStyleBaseId | null }) {
	const { t } = useTranslation()

	const onUploadActions = useCallback(
		(uploadFileContents: string) => {
			function uploadStoredTriggeredActions(replace?: boolean) {
				fetchFrom(createPrivateApiPath(`actionTriggers/upload/${showStyleBaseId ?? ''}${replace ? '?replace' : ''}`), {
					method: 'POST',
					body: uploadFileContents,
					headers: {
						'content-type': 'application/json',
						// authorization: 'id ' + Meteor.userId(),
					},
				})
					.then(() => {
						NotificationCenter.push(
							new Notification(
								undefined,
								NoticeLevel.NOTIFICATION,
								t('Triggered Actions uploaded successfully.'),
								'TriggeredActions'
							)
						)
					})
					.catch((err) => {
						NotificationCenter.push(
							new Notification(
								undefined,
								NoticeLevel.WARNING,
								t('Triggered Actions failed to upload: {{errorMessage}}', { errorMessage: err + '' }),
								'TriggeredActions'
							)
						)
					})
			}

			doModalDialog({
				title: t('Append or Replace'),
				message: t('Do you want to append these to existing Action Triggers, or do you want to replace them?'),
				no: t('Append'),
				yes: t('Replace'),
				warning: true,
				onAccept: () => {
					uploadStoredTriggeredActions(true)
				},
				onSecondary: () => {
					uploadStoredTriggeredActions(false)
				},
			})
		},
		[t, showStyleBaseId]
	)

	const onUploadError = useCallback(
		(err: Error) => {
			NotificationCenter.push(
				new Notification(
					undefined,
					NoticeLevel.WARNING,
					t('Triggered Actions failed to upload: {{errorMessage}}', { errorMessage: stringifyError(err) }),
					'TriggeredActions'
				)
			)
		},
		[t]
	)

	return (
		<UploadButton
			className="btn btn-outline-secondary mx-1"
			onUploadContents={onUploadActions}
			onUploadError={onUploadError}
			accept="application/json,.json"
		>
			<FontAwesomeIcon icon={faUpload} />
		</UploadButton>
	)
}
