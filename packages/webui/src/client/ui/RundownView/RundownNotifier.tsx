import React, { useContext } from 'react'
import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import {
	NotificationCenter,
	NotificationList,
	NotifierHandle,
	Notification,
	NoticeLevel,
	getNoticeLevelForPieceStatus,
	NotificationsSource,
} from '../../lib/notifications/notifications'
import { WithManagedTracker } from '../../lib/reactiveData/reactiveDataHelper'
import { reactiveData } from '../../lib/reactiveData/reactiveData'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { getCurrentTime } from '../../lib/systemTime'
import { meteorSubscribe } from '../../lib/meteorApi'
import { ReactiveVar } from 'meteor/reactive-var'
import { Rundown, getRundownNrcsName } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { doModalDialog } from '../../lib/ModalDialog'
import { doUserAction, UserAction } from '../../lib/clientUserAction'
// import { withTranslation, getI18n, getDefaults } from 'react-i18next'
import { i18nTranslator as t } from '../i18n'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PeripheralDevicesAPI } from '../../lib/clientAPI'
import { handleRundownReloadResponse } from '../RundownView'
import { MeteorCall } from '../../lib/meteorApi'
import { UISegmentPartNote } from '@sofie-automation/meteor-lib/dist/api/rundownNotifications'
import { isTranslatableMessage, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { NoteSeverity, StatusCode } from '@sofie-automation/blueprints-integration'
import { getIgnorePieceContentStatus } from '../../lib/localStorage'
import { Notifications, RundownPlaylists } from '../../collections'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import {
	PartId,
	PeripheralDeviceId,
	PieceId,
	PieceInstanceId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UIPartInstances, UIPieceContentStatuses, UISegmentPartNotes } from '../Collections'
import { RundownPlaylistCollectionUtil } from '../../collections/rundownPlaylistUtil'
import { logger } from '../../lib/logging'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { UserPermissionsContext, UserPermissions } from '../UserPermissions'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { DBNotificationTargetType } from '@sofie-automation/corelib/dist/dataModel/Notifications'
import { UIPieceContentStatus } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'

export const onRONotificationClick = new ReactiveVar<((e: RONotificationEvent) => void) | undefined>(undefined)
export const reloadRundownPlaylistClick = new ReactiveVar<((e: any) => void) | undefined>(undefined)

export interface RONotificationEvent {
	sourceLocator: {
		name: string
		rundownId?: RundownId
		segmentId?: SegmentId
		partId?: PartId
		pieceId?: PieceId | PieceInstanceId
	}
}

const SEGMENT_DELIMITER = ' • '

function getNoticeLevelForNoteSeverity(type: NoteSeverity): NoticeLevel {
	switch (type) {
		case NoteSeverity.ERROR:
			return NoticeLevel.CRITICAL
		case NoteSeverity.WARNING:
			return NoticeLevel.WARNING
		case NoteSeverity.INFO:
			return NoticeLevel.NOTIFICATION
		default:
			return NoticeLevel.WARNING // this conforms with pre-existing behavior where anything that weren't an error was a warning
	}
}

class RundownViewNotifier extends WithManagedTracker {
	private readonly userPermissions: Readonly<UserPermissions>

	private _notificationList: NotificationList
	private _notifier: NotifierHandle

	private _mediaStatus: Record<string, Notification | undefined> = {}
	private _mediaStatusDep: Tracker.Dependency

	private _notes: Record<string, Notification | undefined> = {}
	private _notesDep: Tracker.Dependency

	private _rundownStatus: Record<string, Notification | undefined> = {}
	private _rundownStatusDep: Tracker.Dependency

	private _dbNotifications: Record<string, Notification | undefined> = {}
	private _dbNotificationsDep: Tracker.Dependency

	private _deviceStatus: Record<string, Notification | undefined> = {}
	private _deviceStatusDep: Tracker.Dependency

	private _rundownImportVersionStatus: Notification | undefined = undefined
	private _rundownShowStyleConfigStatuses: Record<string, Notification | undefined> = {}
	private _rundownStudioConfigStatus: Notification | undefined = undefined
	private _rundownImportVersionStatusDep: Tracker.Dependency
	private _rundownImportVersionAndConfigInterval: number | undefined = undefined

	private _unsentExternalMessagesStatus: Notification | undefined = undefined
	private _unsentExternalMessageStatusDep: Tracker.Dependency

	constructor(playlistId: RundownPlaylistId | undefined, studio: UIStudio, userPermissions: Readonly<UserPermissions>) {
		super()
		this.userPermissions = userPermissions

		this._notificationList = new NotificationList([])
		this._mediaStatusDep = new Tracker.Dependency()
		this._rundownStatusDep = new Tracker.Dependency()
		this._dbNotificationsDep = new Tracker.Dependency()
		this._deviceStatusDep = new Tracker.Dependency()
		this._rundownImportVersionStatusDep = new Tracker.Dependency()
		this._unsentExternalMessageStatusDep = new Tracker.Dependency()
		this._notesDep = new Tracker.Dependency()

		this._notifier = NotificationCenter.registerNotifier((): NotificationList => {
			return this._notificationList
		})

		this.autorun(() => {
			if (playlistId) {
				this.reactiveRundownStatus(playlistId)
				this.reactiveVersionAndConfigStatus(playlistId)
				this.reactiveDbNotifications(playlistId)

				this.autorun(() => {
					if (studio) {
						this.reactiveMediaStatus(playlistId)
						this.reactivePartNotes(playlistId)
						this.reactivePeripheralDeviceStatus(studio._id)
						this.reactiveQueueStatus(studio._id, playlistId)
					} else {
						this.cleanUpMediaStatus()
					}
				})
			} else {
				this._mediaStatus = {}
				this._deviceStatus = {}
				this._notes = {}
				this._rundownImportVersionStatus = undefined
				this._rundownStudioConfigStatus = undefined
				this._rundownShowStyleConfigStatuses = {}
				this._unsentExternalMessagesStatus = undefined
				this.cleanUpMediaStatus()
			}
		})

		this.autorun(() => {
			this._mediaStatusDep.depend()
			this._deviceStatusDep.depend()
			this._rundownStatusDep.depend()
			this._dbNotificationsDep.depend()
			this._notesDep.depend()
			this._rundownImportVersionStatusDep.depend()
			this._unsentExternalMessageStatusDep.depend()

			const notifications: Array<Notification | undefined> = [
				...Object.values<Notification | undefined>(this._mediaStatus),
				...Object.values<Notification | undefined>(this._deviceStatus),
				...Object.values<Notification | undefined>(this._notes),
				...Object.values<Notification | undefined>(this._rundownStatus),
				...Object.values<Notification | undefined>(this._dbNotifications),
				this._rundownImportVersionStatus,
				this._rundownStudioConfigStatus,
				...Object.values<Notification | undefined>(this._rundownShowStyleConfigStatuses),
				this._unsentExternalMessagesStatus,
			]

			this._notificationList.set(notifications.filter(Boolean) as Notification[])
		})
	}

	stop() {
		super.stop()

		if (this._rundownImportVersionAndConfigInterval) Meteor.clearInterval(this._rundownImportVersionAndConfigInterval)

		this._notifier.stop()
	}

	private reactiveRundownStatus(playlistId: RundownPlaylistId) {
		let oldNoteIds: Array<string> = []

		const rRundowns = reactiveData.getRRundowns(playlistId, {
			fields: {
				_id: 1,
				orphaned: 1,
				notes: 1,
				name: 1,
				source: 1,
			},
		}) as ReactiveVar<Pick<Rundown, '_id' | 'orphaned' | 'notes' | 'name' | 'source'>[]>
		this.autorun(() => {
			const newNoteIds: Array<string> = []

			const playlist = RundownPlaylists.findOne(playlistId)
			const rundowns = rRundowns.get()

			if (playlist?.notes) {
				const playlistNotesId = playlist._id + '_playlistnotes_'
				playlist.notes.forEach((note) => {
					const noteId = playlistNotesId + note.origin.name + '_' + note.message + '_' + note.type
					const notificationFromNote = new Notification(
						noteId,
						getNoticeLevelForNoteSeverity(note.type),
						note.message,
						'RundownPlaylist',
						getCurrentTime(),
						true,
						[],
						-1
					)
					if (!Notification.isEqual(this._rundownStatus[noteId], notificationFromNote)) {
						this._rundownStatus[noteId] = notificationFromNote
						this._rundownStatusDep.changed()
					}
					newNoteIds.push(noteId)
				})
			}

			if (playlist && rundowns) {
				rundowns.forEach((rundown) => {
					const unsyncedId = rundown._id + '_unsynced'
					let unsyncedNotification: Notification | undefined = undefined

					if (rundown.orphaned) {
						unsyncedNotification = new Notification(
							unsyncedId,
							NoticeLevel.CRITICAL,
							t(
								'The rundown "{{rundownName}}" is not published or activated in {{nrcsName}}! No data updates will currently come through.',
								{
									rundownName: rundown.name,
									nrcsName: getRundownNrcsName(rundown),
								}
							),
							rundown._id,
							getCurrentTime(),
							true,
							[
								{
									label: t('Re-sync'),
									type: 'primary',
									disabled: !this.userPermissions.studio,
									action: () => {
										doModalDialog({
											title: t('Re-sync Rundown'),
											message: t(
												'Are you sure you want to re-sync the Rundown?\n(If the currently playing Part has been changed, this can affect the output)'
											),
											yes: t('Re-sync'),
											no: t('Cancel'),
											onAccept: (event) => {
												doUserAction(
													t,
													event,
													UserAction.RESYNC_RUNDOWN_PLAYLIST,
													(e, ts) => MeteorCall.userAction.resyncRundown(e, ts, rundown._id),
													(err, reloadResult) => {
														if (!err && reloadResult) {
															handleRundownReloadResponse(t, this.userPermissions, rundown._id, reloadResult)
														}
													}
												)
											},
										})
									},
								},
								// {
								// 	label: t('Delete'),
								// 	type: 'delete'
								// }
							],
							-1
						)
						newNoteIds.push(unsyncedId)
					}
					if (unsyncedNotification && !Notification.isEqual(this._rundownStatus[unsyncedId], unsyncedNotification)) {
						this._rundownStatus[unsyncedId] = unsyncedNotification
						this._rundownStatusDep.changed()
					} else if (!unsyncedNotification && this._rundownStatus[unsyncedId]) {
						delete this._rundownStatus[unsyncedId]
						this._rundownStatusDep.changed()
					}

					const rundownNotesId = rundown._id + '_ronotes_'
					if (rundown.notes) {
						rundown.notes.forEach((note) => {
							const rundownNoteId = rundownNotesId + note.origin.name + '_' + note.message + '_' + note.type
							const notificationFromNote = new Notification(
								rundownNoteId,
								getNoticeLevelForNoteSeverity(note.type),
								note.message,
								'Rundown',
								getCurrentTime(),
								true,
								[],
								-1
							)
							if (!Notification.isEqual(this._rundownStatus[rundownNoteId], notificationFromNote)) {
								this._rundownStatus[rundownNoteId] = notificationFromNote
								this._rundownStatusDep.changed()
							}
							newNoteIds.push(rundownNoteId)
						})
					}
				})
			}

			_.difference(oldNoteIds, newNoteIds).forEach((item) => {
				delete this._rundownStatus[item]
				this._rundownStatusDep.changed()
			})

			oldNoteIds = newNoteIds
		})
	}

	private reactiveDbNotifications(playlistId: RundownPlaylistId) {
		let oldNoteIds: Array<string> = []

		const rRundowns = reactiveData.getRRundowns(playlistId, {
			fields: {
				_id: 1,
			},
		}) as ReactiveVar<Pick<Rundown, '_id'>[]>
		this.autorun(() => {
			const newNoteIds: Array<string> = []

			const dbNotifications = Notifications.find({
				$or: [
					{
						'relatedTo.rundownId': { $in: rRundowns.get().map((r) => r._id) },
					},
					{
						'relatedTo.playlistId': playlistId,
					},
				],
			}).fetch()

			for (const dbNotification of dbNotifications) {
				let source: NotificationsSource

				const relatedTo = dbNotification.relatedTo
				switch (relatedTo.type) {
					case DBNotificationTargetType.RUNDOWN:
						source = relatedTo.rundownId
						break
					case DBNotificationTargetType.PARTINSTANCE:
					case DBNotificationTargetType.PIECEINSTANCE: {
						const partInstanceDoc = UIPartInstances.findOne(relatedTo.partInstanceId, {
							fields: { segmentId: 1 },
						}) as Pick<PartInstance, 'segmentId'> | undefined
						source = partInstanceDoc?.segmentId ?? relatedTo.rundownId
						break
					}
					case DBNotificationTargetType.PLAYLIST:
						// No mapping
						source = undefined
						break
					default:
						assertNever(relatedTo)
						break
				}

				const id = `db_notification_${dbNotification._id}`
				const uiNotification = new Notification(
					id,
					getNoticeLevelForNoteSeverity(dbNotification.severity),
					dbNotification.message,
					source,
					dbNotification.created,
					true,
					[]
				)
				newNoteIds.push(id)

				if (!Notification.isEqual(this._dbNotifications[id], uiNotification)) {
					this._dbNotifications[id] = uiNotification
					this._dbNotificationsDep.changed()
				}
			}
			_.difference(oldNoteIds, newNoteIds).forEach((item) => {
				delete this._dbNotifications[item]
				this._dbNotificationsDep.changed()
			})
			oldNoteIds = newNoteIds
		})
	}

	private reactivePeripheralDeviceStatus(studioId: StudioId | undefined) {
		let oldDevItemIds: PeripheralDeviceId[] = []
		let reactivePeripheralDevices:
			| ReactiveVar<Pick<PeripheralDevice, '_id' | 'name' | 'ignore' | 'status' | 'connected' | 'parentDeviceId'>[]>
			| undefined
		if (studioId) {
			meteorSubscribe(CorelibPubSub.peripheralDevicesAndSubDevices, studioId)
			reactivePeripheralDevices = reactiveData.getRPeripheralDevices(studioId, {
				fields: {
					name: 1,
					ignore: 1,
					status: 1,
					connected: 1,
					parentDeviceId: 1,
				},
			}) as ReactiveVar<Pick<PeripheralDevice, '_id' | 'name' | 'ignore' | 'status' | 'connected' | 'parentDeviceId'>[]>
		}
		this.autorun(() => {
			const devices = reactivePeripheralDevices ? reactivePeripheralDevices.get() : []
			const newDevItemIds = devices.map((item) => item._id)

			devices
				.filter((i) => !i.ignore)
				.forEach((item) => {
					let newNotification: Notification | undefined = undefined

					const parent = devices.find((i) => i._id === item.parentDeviceId)

					if (item.status.statusCode !== StatusCode.GOOD || !item.connected) {
						newNotification = new Notification(
							item._id,
							this.convertDeviceStatus(item),
							this.makeDeviceMessage(item),
							'Devices',
							getCurrentTime(),
							true,
							parent && parent.connected && item.status.statusCode >= StatusCode.WARNING_MAJOR
								? [
										{
											label: t('Restart'),
											type: 'primary',
											disabled: !this.userPermissions.studio,
											action: () => {
												doModalDialog({
													title: t('Restart {{device}}', { device: parent.name }),
													message: t(
														'Fixing this problem requires a restart to the host device. Are you sure you want to restart {{device}}?\n(This might affect output)',
														{ device: parent.name }
													),
													yes: t('Restart'),
													no: t('Cancel'),
													onAccept: (e) => {
														PeripheralDevicesAPI.restartDevice(parent, e)
															.then(() => {
																NotificationCenter.push(
																	new Notification(
																		undefined,
																		NoticeLevel.NOTIFICATION,
																		t('Device "{{deviceName}}" restarting...', {
																			deviceName: parent.name,
																		}),
																		'RundownNotifier'
																	)
																)
															})
															.catch((err) => {
																NotificationCenter.push(
																	new Notification(
																		undefined,
																		NoticeLevel.WARNING,
																		t('Failed to restart device: "{{deviceName}}": {{errorMessage}}', {
																			deviceName: parent.name,
																			errorMessage: err + '',
																		}),
																		'RundownNotifier'
																	)
																)
															})
													},
												})
											},
										},
								  ]
								: undefined,
							-1
						)
					}
					if (
						newNotification &&
						!Notification.isEqual(this._deviceStatus[unprotectString(item._id)], newNotification)
					) {
						this._deviceStatus[unprotectString(item._id)] = newNotification
						this._deviceStatusDep.changed()
					} else if (!newNotification && this._deviceStatus[unprotectString(item._id)]) {
						delete this._deviceStatus[unprotectString(item._id)]
						this._deviceStatusDep.changed()
					}
				})

			_.difference(oldDevItemIds, newDevItemIds).forEach((deviceId) => {
				delete this._deviceStatus[unprotectString(deviceId)]
				this._deviceStatusDep.changed()
			})
			oldDevItemIds = newDevItemIds
		})
	}

	private reactivePartNotes(playlistId: RundownPlaylistId) {
		let oldNoteIds: Array<string> = []

		this.autorun(() => {
			const newNoteIds: Array<string> = []

			const rawNotes = UISegmentPartNotes.find(
				{ playlistId: playlistId },
				{
					// A crude sorting
					sort: {
						// @ts-expect-error deep property
						'note.rank': 1,
						_id: 1,
					},
				}
			).fetch()

			rawNotes.forEach((item: UISegmentPartNote) => {
				const { origin, message, type: itemType, rank } = item.note
				const { pieceId, partId, segmentId, rundownId, name, segmentName } = origin

				const translatedMessage = isTranslatableMessage(message) ? translateMessage(message, t) : String(message)

				const notificationId = `${translatedMessage}-${pieceId || partId || segmentId || rundownId}-${name}-${itemType}`

				const newNotification = new Notification(
					notificationId,
					getNoticeLevelForNoteSeverity(itemType),
					(
						<>
							{name || segmentName ? (
								<h5>
									{segmentName || name}
									{segmentName && name ? `${SEGMENT_DELIMITER}${name}` : null}
								</h5>
							) : null}
							<div>{translatedMessage || t('There is an unknown problem with the part.')}</div>
						</>
					),
					origin.segmentId || origin.rundownId || 'unknown',
					getCurrentTime(),
					true,
					[
						{
							label: t('Show issue'),
							type: 'default',
						},
					],
					rank * 1000
				)
				newNotification.on('action', (_notification, type) => {
					if (type === 'default') {
						const handler = onRONotificationClick.get()
						if (handler && typeof handler === 'function') {
							handler({
								sourceLocator: origin,
							})
						}
					}
				})
				newNoteIds.push(notificationId)

				if (!this._notes[notificationId] || !Notification.isEqual(newNotification, this._notes[notificationId])) {
					this._notes[notificationId] = newNotification
					this._notesDep.changed()
				}
			})

			_.difference(oldNoteIds, newNoteIds).forEach((item) => {
				delete this._notes[item]
				this._notesDep.changed()
			})
			oldNoteIds = newNoteIds
		})
	}

	private reactiveMediaStatus(playlistId: RundownPlaylistId) {
		const rRundowns = reactiveData.getRRundowns(playlistId, {
			fields: {
				_id: 1,
			},
		})

		let oldPieceIds: UIPieceContentStatus['pieceId'][] = []

		if (getIgnorePieceContentStatus()) return

		this.autorun(() => {
			const rundownIds = rRundowns.get().map((rd) => rd._id)
			const allIssues = UIPieceContentStatuses.find({ rundownId: { $in: rundownIds } }).fetch()

			const newPieceIds = _.unique(allIssues.map((item) => item.pieceId))
			allIssues.forEach((issue) => {
				const { status, messages } = issue.status

				let newNotification: Notification | undefined = undefined
				if (status !== PieceStatusCode.OK && status !== PieceStatusCode.UNKNOWN) {
					const issueName = typeof issue.name === 'string' ? issue.name : translateMessage(issue.name, t)
					let messageName = issue.segmentName || issueName
					if (issue.segmentName && issueName) {
						messageName += `${SEGMENT_DELIMITER}${issueName}`
					}

					newNotification = new Notification(
						issue.pieceId,
						getNoticeLevelForPieceStatus(status) || NoticeLevel.WARNING,
						(
							<>
								<h5>{messageName}</h5>
								<div>
									{messages.map((msg) => (
										<>
											{translateMessage(msg, t)}
											<br />
										</>
									))}
									{messages.length === 0 && t('There is an unspecified problem with the source.')}
								</div>
							</>
						),
						issue.segmentId ? issue.segmentId : 'line_' + issue.partId,
						getCurrentTime(),
						true,
						[
							{
								label: t('Show issue'),
								type: 'default',
							},
						],
						issue.segmentRank * 1000 + issue.partRank
					)
					newNotification.on('action', (_notification, type) => {
						if (type === 'default') {
							const handler = onRONotificationClick.get()
							if (handler && typeof handler === 'function') {
								handler({
									sourceLocator: {
										name: issueName,
										rundownId: issue.rundownId,
										pieceId: issue.pieceId as PieceId | PieceInstanceId,
										partId: issue.partId,
									},
								})
							}
						}
					})
				}

				if (
					newNotification &&
					!Notification.isEqual(this._mediaStatus[unprotectString(issue.pieceId)], newNotification)
				) {
					this._mediaStatus[unprotectString(issue.pieceId)] = newNotification
					this._mediaStatusDep.changed()
				} else if (!newNotification && this._mediaStatus[unprotectString(issue.pieceId)]) {
					delete this._mediaStatus[unprotectString(issue.pieceId)]
					this._mediaStatusDep.changed()
				}
			})

			const removedPieceIds = _.difference(oldPieceIds, newPieceIds)
			removedPieceIds.forEach((pieceId) => {
				const pId = unprotectString(pieceId)
				delete this._mediaStatus[pId]

				this._mediaStatusDep.changed()
			})
			oldPieceIds = newPieceIds
		})
	}

	private reactiveVersionAndConfigStatus(playlistId: RundownPlaylistId) {
		const updatePeriod = 30 * 1000 // every 30s

		if (this._rundownImportVersionAndConfigInterval) Meteor.clearInterval(this._rundownImportVersionAndConfigInterval)
		this._rundownImportVersionAndConfigInterval = playlistId
			? Meteor.setInterval(() => this.updateVersionAndConfigStatus(playlistId), updatePeriod)
			: undefined

		this.autorun(() => {
			// Track the rundown as a dependency of this autorun
			this.updateVersionAndConfigStatus(playlistId)
		})
	}

	private reactiveQueueStatus(studioId: StudioId, playlistId: RundownPlaylistId) {
		meteorSubscribe(CorelibPubSub.externalMessageQueue, { studioId: studioId, playlistId })
		const reactiveUnsentMessageCount = reactiveData.getUnsentExternalMessageCount(studioId, playlistId)
		this.autorun(() => {
			if (reactiveUnsentMessageCount.get() > 0 && this._unsentExternalMessagesStatus === undefined) {
				this._unsentExternalMessagesStatus = new Notification(
					`unsent_${studioId}`,
					NoticeLevel.WARNING,
					t('External message queue has unsent messages.'),
					'ExternalMessageQueue',
					getCurrentTime(),
					true,
					undefined,
					-1
				)
				this._unsentExternalMessageStatusDep.changed()
			}
			if (reactiveUnsentMessageCount.get() === 0 && this._unsentExternalMessagesStatus !== undefined) {
				this._unsentExternalMessagesStatus = undefined
				this._unsentExternalMessageStatusDep.changed()
			}
		})
	}

	private updateVersionAndConfigStatus(playlistId: RundownPlaylistId) {
		// Doing the check server side, to avoid needing to subscribe to the blueprint and showStyleVariant
		MeteorCall.rundown
			.rundownPlaylistNeedsResync(playlistId)
			.then((versionMismatch: string[]) => {
				let newNotification: Notification | undefined = undefined
				if (versionMismatch && versionMismatch.length) {
					const playlist = RundownPlaylists.findOne(playlistId)
					const firstRundown = playlist
						? _.first(RundownPlaylistCollectionUtil.getRundownsOrdered(playlist))
						: undefined

					newNotification = new Notification(
						'rundown_importVersions',
						NoticeLevel.WARNING,
						t('The system configuration has been changed since importing this rundown. It might not run correctly'),
						`rundownPlaylist_${playlistId}`,
						getCurrentTime(),
						true,

						[
							{
								label: t('Reload {{nrcsName}} Data', {
									nrcsName: getRundownNrcsName(firstRundown),
								}),
								type: 'primary',
								disabled: !this.userPermissions.studio,
								action: (e) => {
									const reloadFunc = reloadRundownPlaylistClick.get()
									if (reloadFunc) {
										reloadFunc(e)
									}
								},
							},
						],
						-1
					)
				}

				if (
					(newNotification && !Notification.isEqual(this._rundownImportVersionStatus, newNotification)) ||
					(!newNotification && this._rundownImportVersionStatus)
				) {
					this._rundownImportVersionStatus = newNotification
					this._rundownImportVersionStatusDep.changed()
				}
			})
			.catch((err) => {
				logger.error(err)
				const newNotification = new Notification(
					'rundown_importVersions',
					NoticeLevel.WARNING,
					t('Unable to check the system configuration for changes'),
					`rundownPlaylist_${playlistId}`,
					getCurrentTime(),
					true,
					undefined,
					-1
				)
				if (!Notification.isEqual(this._rundownImportVersionStatus, newNotification)) {
					this._rundownImportVersionStatus = newNotification
					this._rundownImportVersionStatusDep.changed()
				}
			})
	}

	private cleanUpMediaStatus() {
		this._mediaStatus = {}
		this._mediaStatusDep.changed()
	}

	private convertDeviceStatus(device: Pick<PeripheralDevice, '_id' | 'connected' | 'status'>): NoticeLevel {
		if (!device.connected) {
			return NoticeLevel.CRITICAL
		}
		switch (device.status.statusCode) {
			case StatusCode.GOOD:
				return NoticeLevel.NOTIFICATION
			case StatusCode.UNKNOWN:
				return NoticeLevel.CRITICAL
			case StatusCode.WARNING_MAJOR:
				return NoticeLevel.WARNING
			case StatusCode.WARNING_MINOR:
				return NoticeLevel.WARNING
			case StatusCode.BAD:
				return NoticeLevel.CRITICAL
			case StatusCode.FATAL:
				return NoticeLevel.CRITICAL
			default:
				return NoticeLevel.NOTIFICATION
		}
	}

	private makeDeviceMessage(device: Pick<PeripheralDevice, '_id' | 'connected' | 'name' | 'status'>): string {
		if (!device.connected) {
			return t('Device {{deviceName}} is disconnected', { deviceName: device.name })
		}
		return `${device.name}: ` + (device.status.messages || ['']).join(', ')
	}
}

interface RundownNotifierProps {
	// match?: {
	// 	params: {
	// 		rundownId?: RundownId
	// 		studioId?: StudioId
	// 	}
	// }
	playlistId: RundownPlaylistId
	studio: UIStudio
}

export function RundownNotifier({ playlistId, studio }: RundownNotifierProps): JSX.Element | null {
	const userPermissions = useContext(UserPermissionsContext)

	React.useEffect(() => {
		const notifier = new RundownViewNotifier(playlistId, studio, userPermissions)

		return () => {
			notifier.stop()
		}
	}, [playlistId, studio._id, userPermissions])

	return null
}
