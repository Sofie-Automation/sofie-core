import { SerializedUserError, UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { UserAction } from '@sofie-automation/meteor-lib/dist/userAction'
import { doUserAction } from '../../../lib/clientUserAction'
import { MeteorCall } from '../../../lib/meteorApi'
import { doModalDialog } from '../../../lib/ModalDialog'
import { useTranslation } from 'react-i18next'
import React, { useContext, useEffect, useMemo } from 'react'
import { UserPermissions, UserPermissionsContext } from '../../UserPermissions'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../../lib/logging'
import * as i18next from 'i18next'
import { NoticeLevel, Notification, NotificationCenter } from '../../../lib/notifications/notifications'
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import RundownViewEventBus, { RundownViewEvents } from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { handleRundownPlaylistReloadResponse } from './RundownReloadResponse'
import { scrollToPartInstance } from '../../../lib/viewPort'
import { hashSingleUseToken } from '../../../lib/lib'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { getCurrentTime } from '../../../lib/systemTime'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { REHEARSAL_MARGIN } from '../WarningDisplay'
import { RundownPlaylistTiming } from '@sofie-automation/blueprints-integration'

class RundownPlaylistOperationsService {
	constructor(
		public studio: UIStudio,
		public playlist: DBRundownPlaylist,
		public currentRundown: Rundown | undefined,
		public userPermissions: UserPermissions,
		public onActivate?: (isRehearsal: boolean) => void
	) {}

	public executeTake(t: i18next.TFunction, e: EventLike): void {
		if (!this.userPermissions.studio) return

		if (!this.playlist.activationId) {
			const onSuccess = () => {
				if (typeof this.onActivate === 'function') this.onActivate(false)
			}
			const handleResult = (err: any) => {
				if (!err) {
					onSuccess()
				} else if (ClientAPI.isClientResponseError(err)) {
					if (err.error.key === UserErrorMessage.RundownAlreadyActiveNames) {
						this.handleAnotherPlaylistActive(t, this.playlist._id, true, err.error, onSuccess)
						return false
					}
				}
			}
			// ask to activate
			doModalDialog({
				title: t('Failed to execute take'),
				message: t(
					'The rundown you are trying to execute a take on is inactive, would you like to activate this rundown?'
				),
				acceptOnly: false,
				warning: true,
				yes: t('Activate "On Air"'),
				no: t('Cancel'),
				discardAsPrimary: true,
				onDiscard: () => {
					// Do nothing
				},
				actions: [
					{
						label: t('Activate "Rehearsal"'),
						classNames: 'btn-secondary',
						on: (e) => {
							doUserAction(
								t,
								e,
								UserAction.DEACTIVATE_OTHER_RUNDOWN_PLAYLIST,
								async (e, ts) => MeteorCall.userAction.forceResetAndActivate(e, ts, this.playlist._id, true),
								handleResult
							)
						},
					},
				],
				onAccept: () => {
					// nothing
					doUserAction(
						t,
						e,
						UserAction.ACTIVATE_RUNDOWN_PLAYLIST,
						async (e, ts) => MeteorCall.userAction.activate(e, ts, this.playlist._id, false),
						handleResult
					)
				},
			})
		} else {
			doUserAction(t, e, UserAction.TAKE, async (e, ts) =>
				MeteorCall.userAction.take(e, ts, this.playlist._id, this.playlist.currentPartInfo?.partInstanceId ?? null)
			)
		}
	}

	private handleAnotherPlaylistActive(
		t: i18next.TFunction,
		playlistId: RundownPlaylistId,
		rehersal: boolean,
		err: SerializedUserError,
		clb?: (response: void) => void
	): void {
		function handleResult(err: any, response: void) {
			if (!err) {
				if (typeof clb === 'function') clb(response)
			} else {
				logger.error(err)
				doModalDialog({
					title: t('Failed to activate'),
					message: t('Something went wrong, please contact the system administrator if the problem persists.'),
					acceptOnly: true,
					warning: true,
					yes: t('OK'),
					onAccept: () => {
						// nothing
					},
				})
			}
		}

		doModalDialog({
			title: t('Another Rundown is Already Active!'),
			message: t(
				'The rundown: "{{rundownName}}" will need to be deactivated in order to activate this one.\n\nAre you sure you want to activate this one anyway?',
				{
					// TODO: this is a bit of a hack, could a better string sent from the server instead?
					rundownName: err.userMessage.args?.names ?? '',
				}
			),
			yes: t('Activate "On Air"'),
			no: t('Cancel'),
			discardAsPrimary: true,
			actions: [
				{
					label: t('Activate "Rehearsal"'),
					classNames: 'btn-secondary',
					on: (e) => {
						doUserAction(
							t,
							e,
							UserAction.DEACTIVATE_OTHER_RUNDOWN_PLAYLIST,
							async (e, ts) => MeteorCall.userAction.forceResetAndActivate(e, ts, playlistId, rehersal),
							handleResult
						)
					},
				},
			],
			warning: true,
			onAccept: (e) => {
				doUserAction(
					t,
					e,
					UserAction.DEACTIVATE_OTHER_RUNDOWN_PLAYLIST,
					async (e, ts) => MeteorCall.userAction.forceResetAndActivate(e, ts, playlistId, false),
					handleResult
				)
			},
		})
	}

	public executeHold(t: i18next.TFunction, e: EventLike): void {
		if (this.userPermissions.studio && this.playlist.activationId) {
			doUserAction(t, e, UserAction.ACTIVATE_HOLD, async (e, ts) =>
				MeteorCall.userAction.activateHold(e, ts, this.playlist._id, false)
			)
		}
	}

	public executeClearQuickLoop(t: i18next.TFunction, e: EventLike) {
		if (this.userPermissions.studio && this.playlist.activationId) {
			doUserAction(t, e, UserAction.CLEAR_QUICK_LOOP, async (e, ts) =>
				MeteorCall.userAction.clearQuickLoop(e, ts, this.playlist._id)
			)
		}
	}

	public executeActivate(t: i18next.TFunction, e: EventLike) {
		if ('persist' in e) e.persist()

		if (
			this.userPermissions.studio &&
			(!this.playlist.activationId || (this.playlist.activationId && this.playlist.rehearsal))
		) {
			const onSuccess = () => {
				this.deferFlushAndRewindSegments()
				if (typeof this.onActivate === 'function') this.onActivate(false)
			}
			const doActivate = () => {
				doUserAction(
					t,
					e,
					UserAction.ACTIVATE_RUNDOWN_PLAYLIST,
					async (e, ts) => MeteorCall.userAction.activate(e, ts, this.playlist._id, false),
					(err) => {
						if (!err) {
							if (typeof this.onActivate === 'function') this.onActivate(false)
						} else if (ClientAPI.isClientResponseError(err)) {
							if (err.error.key === UserErrorMessage.RundownAlreadyActiveNames) {
								this.handleAnotherPlaylistActive(t, this.playlist._id, false, err.error, () => {
									if (typeof this.onActivate === 'function') this.onActivate(false)
								})
								return false
							}
						}
					}
				)
			}

			const doActivateAndReset = () => {
				this.rewindSegments()
				doUserAction(
					t,
					e,
					UserAction.RESET_AND_ACTIVATE_RUNDOWN_PLAYLIST,
					async (e, ts) => MeteorCall.userAction.resetAndActivate(e, ts, this.playlist._id),
					(err) => {
						if (!err) {
							onSuccess()
						} else if (ClientAPI.isClientResponseError(err)) {
							if (err.error.key === UserErrorMessage.RundownAlreadyActiveNames) {
								this.handleAnotherPlaylistActive(t, this.playlist._id, false, err.error, onSuccess)
								return false
							}
						}
					}
				)
			}

			if (!checkRundownTimes(this.playlist.timing).shouldHaveStarted) {
				// The broadcast hasn't started yet
				doModalDialog({
					title: 'Activate "On Air"',
					message: t('Do you want to activate this Rundown?'),
					yes: 'Reset and Activate "On Air"',
					no: t('Cancel'),
					actions: [
						{
							label: 'Activate "On Air"',
							classNames: 'btn-secondary',
							on: () => {
								doActivate() // this one activates without resetting
							},
						},
					],
					acceptOnly: false,
					onAccept: () => {
						doUserAction(
							t,
							e,
							UserAction.RESET_AND_ACTIVATE_RUNDOWN_PLAYLIST,
							async (e, ts) => MeteorCall.userAction.resetAndActivate(e, ts, this.playlist._id),
							(err) => {
								if (!err) {
									onSuccess()
								} else if (ClientAPI.isClientResponseError(err)) {
									if (err.error.key === UserErrorMessage.RundownAlreadyActiveNames) {
										this.handleAnotherPlaylistActive(t, this.playlist._id, false, err.error, onSuccess)
										return false
									}
								}
							}
						)
					},
				})
			} else if (!checkRundownTimes(this.playlist.timing).shouldHaveEnded) {
				// The broadcast has started
				doActivate()
			} else {
				// The broadcast has ended, going into active mode is probably not what you want to do
				doModalDialog({
					title: 'Activate "On Air"',
					message: t('The planned end time has passed, are you sure you want to activate this Rundown?'),
					yes: 'Reset and Activate "On Air"',
					no: t('Cancel'),
					actions: [
						{
							label: 'Activate "On Air"',
							classNames: 'btn-secondary',
							on: () => {
								doActivate() // this one activates without resetting
							},
						},
					],
					acceptOnly: false,
					onAccept: () => {
						doActivateAndReset()
					},
				})
			}
		}
	}

	public executeActivateRehearsal = (t: i18next.TFunction, e: EventLike) => {
		if ('persist' in e) e.persist()

		if (
			this.userPermissions.studio &&
			(!this.playlist.activationId || (this.playlist.activationId && !this.playlist.rehearsal))
		) {
			const onSuccess = () => {
				if (typeof this.onActivate === 'function') this.onActivate(false)
			}
			const doActivateRehersal = () => {
				doUserAction(
					t,
					e,
					UserAction.ACTIVATE_RUNDOWN_PLAYLIST,
					async (e, ts) => MeteorCall.userAction.activate(e, ts, this.playlist._id, true),
					(err) => {
						if (!err) {
							onSuccess()
						} else if (ClientAPI.isClientResponseError(err)) {
							if (err.error.key === UserErrorMessage.RundownAlreadyActiveNames) {
								this.handleAnotherPlaylistActive(t, this.playlist._id, true, err.error, onSuccess)
								return false
							}
						}
					}
				)
			}
			if (!checkRundownTimes(this.playlist.timing).shouldHaveStarted) {
				// The broadcast hasn't started yet
				if (!this.playlist.activationId) {
					// inactive, do the full preparation:
					doUserAction(
						t,
						e,
						UserAction.PREPARE_FOR_BROADCAST,
						async (e, ts) => MeteorCall.userAction.prepareForBroadcast(e, ts, this.playlist._id),
						(err) => {
							if (!err) {
								onSuccess()
							} else if (ClientAPI.isClientResponseError(err)) {
								if (err.error.key === UserErrorMessage.RundownAlreadyActiveNames) {
									this.handleAnotherPlaylistActive(t, this.playlist._id, true, err.error, onSuccess)
									return false
								}
							}
						}
					)
				} else if (!this.playlist.rehearsal) {
					// Active, and not in rehearsal
					doModalDialog({
						title: 'Activate "Rehearsal"',
						message: t('Are you sure you want to activate Rehearsal Mode?'),
						yes: 'Activate "Rehearsal"',
						no: t('Cancel'),
						onAccept: () => {
							doActivateRehersal()
						},
					})
				} else {
					// Already in rehearsal, do nothing
				}
			} else {
				// The broadcast has started
				if (!checkRundownTimes(this.playlist.timing).shouldHaveEnded) {
					// We are in the broadcast
					doModalDialog({
						title: 'Activate "Rehearsal"',
						message: t('Are you sure you want to activate Rehearsal Mode?'),
						yes: 'Activate "Rehearsal"',
						no: t('Cancel'),
						onAccept: () => {
							doActivateRehersal()
						},
					})
				} else {
					// The broadcast has ended
					doActivateRehersal()
				}
			}
		}
	}

	public executeDeactivate = (t: i18next.TFunction, e: EventLike) => {
		if ('persist' in e) e.persist()

		if (this.userPermissions.studio && this.playlist.activationId) {
			if (checkRundownTimes(this.playlist.timing).shouldHaveStarted) {
				if (this.playlist.rehearsal) {
					// We're in rehearsal mode
					doUserAction(t, e, UserAction.DEACTIVATE_RUNDOWN_PLAYLIST, async (e, ts) =>
						MeteorCall.userAction.deactivate(e, ts, this.playlist._id)
					)
				} else {
					doModalDialog({
						title: 'Deactivate "On Air"',
						message: t('Are you sure you want to deactivate this rundown?\n(This will clear the outputs.)'),
						warning: true,
						yes: t('Deactivate "On Air"'),
						no: t('Cancel'),
						onAccept: () => {
							doUserAction(t, e, UserAction.DEACTIVATE_RUNDOWN_PLAYLIST, async (e, ts) =>
								MeteorCall.userAction.deactivate(e, ts, this.playlist._id)
							)
						},
					})
				}
			} else {
				// Do it right away
				doUserAction(t, e, UserAction.DEACTIVATE_RUNDOWN_PLAYLIST, async (e, ts) =>
					MeteorCall.userAction.deactivate(e, ts, this.playlist._id)
				)
			}
		}
	}

	public executeActivateAdlibTesting = (t: i18next.TFunction, e: EventLike) => {
		if ('persist' in e) e.persist()

		if (
			this.userPermissions.studio &&
			this.studio.settings.allowAdlibTestingSegment &&
			this.playlist.activationId &&
			this.currentRundown
		) {
			const rundownId = this.currentRundown._id
			doUserAction(t, e, UserAction.ACTIVATE_ADLIB_TESTING, async (e, ts) =>
				MeteorCall.userAction.activateAdlibTestingMode(e, ts, this.playlist._id, rundownId)
			)
		}
	}

	public executeResetRundown = (t: i18next.TFunction, e: EventLike) => {
		if ('persist' in e) e.persist()

		const doReset = () => {
			this.rewindSegments() // Do a rewind right away
			doUserAction(
				t,
				e,
				UserAction.RESET_RUNDOWN_PLAYLIST,
				async (e, ts) => MeteorCall.userAction.resetRundownPlaylist(e, ts, this.playlist._id),
				() => {
					this.deferFlushAndRewindSegments()
				}
			)
		}
		if (this.playlist.activationId && !this.playlist.rehearsal && !this.studio.settings.allowRundownResetOnAir) {
			// The rundown is active and not in rehearsal
			doModalDialog({
				title: 'Reset Rundown',
				message: t('The rundown can not be reset while it is active'),
				onAccept: () => {
					// nothing
				},
				acceptOnly: true,
				yes: 'OK',
			})
		} else {
			doReset()
		}
	}

	public executeReloadRundownPlaylist = (t: i18next.TFunction, e: EventLike) => {
		if (!this.userPermissions.studio) return

		doUserAction(
			t,
			e,
			UserAction.RELOAD_RUNDOWN_PLAYLIST_DATA,
			async (e, ts) => MeteorCall.userAction.resyncRundownPlaylist(e, ts, this.playlist._id),
			(err, reloadResponse) => {
				if (!err && reloadResponse) {
					if (!handleRundownPlaylistReloadResponse(t, this.userPermissions, reloadResponse)) {
						if (this.playlist && this.playlist.nextPartInfo) {
							scrollToPartInstance(this.playlist.nextPartInfo.partInstanceId).catch((error) => {
								if (!error.toString().match(/another scroll/)) console.warn(error)
							})
						}
					}
				}
			}
		)
	}

	public executeTakeRundownSnapshot = (t: i18next.TFunction, e: EventLike) => {
		if (!this.userPermissions.studio) return

		const doneMessage = t('A snapshot of the current Running\xa0Order has been created for troubleshooting.')
		doUserAction(
			t,
			e,
			UserAction.CREATE_SNAPSHOT_FOR_DEBUG,
			async (e, ts) =>
				MeteorCall.system.generateSingleUseToken().then(async (tokenResponse) => {
					if (ClientAPI.isClientResponseError(tokenResponse)) {
						throw UserError.fromSerialized(tokenResponse.error)
					} else if (!tokenResponse.result) {
						throw new Error(`Internal Error: No token.`)
					}
					return MeteorCall.userAction.storeRundownSnapshot(
						e,
						ts,
						hashSingleUseToken(tokenResponse.result),
						this.playlist._id,
						'Taken by user',
						false
					)
				}),
			() => {
				NotificationCenter.push(
					new Notification(
						undefined,
						NoticeLevel.NOTIFICATION,
						doneMessage,
						'userAction',
						undefined,
						false,
						undefined,
						undefined,
						5000
					)
				)
				return false
			},
			doneMessage
		)
	}

	public executeActivateRundown = (t: i18next.TFunction, e: EventLike) => {
		// Called from the ModalDialog, 1 minute before broadcast starts
		if (!this.userPermissions.studio) return

		this.rewindSegments() // Do a rewind right away

		doUserAction(
			t,
			e,
			UserAction.ACTIVATE_RUNDOWN_PLAYLIST,
			async (e, ts) => MeteorCall.userAction.activate(e, ts, this.playlist._id, false),
			(err) => {
				if (!err) {
					if (typeof this.onActivate === 'function') this.onActivate(false)
				} else if (ClientAPI.isClientResponseError(err)) {
					if (err.error.key === UserErrorMessage.RundownAlreadyActiveNames) {
						this.handleAnotherPlaylistActive(t, this.playlist._id, false, err.error, () => {
							if (typeof this.onActivate === 'function') this.onActivate(false)
						})
						return false
					}
				}
			}
		)
	}

	public executeResetAndActivateRundown = (t: i18next.TFunction, e: EventLike) => {
		// Called from the ModalDialog, 1 minute before broadcast starts
		if (!this.userPermissions.studio) return

		this.rewindSegments() // Do a rewind right away

		doUserAction(
			t,
			e,
			UserAction.RESET_AND_ACTIVATE_RUNDOWN_PLAYLIST,
			async (e, ts) => MeteorCall.userAction.resetAndActivate(e, ts, this.playlist._id),
			(err) => {
				if (!err) {
					this.deferFlushAndRewindSegments()
					if (typeof this.onActivate === 'function') this.onActivate(false)
				}
			}
		)
	}

	private deferFlushAndRewindSegments = () => {
		// Do a rewind later, when the UI has updated
		Meteor.defer(() => {
			Tracker.flush()
			Meteor.setTimeout(() => {
				this.rewindSegments()
				RundownViewEventBus.emit(RundownViewEvents.GO_TO_TOP)
			}, 500)
		})
	}

	private rewindSegments = () => {
		RundownViewEventBus.emit(RundownViewEvents.REWIND_SEGMENTS)
	}
}

export interface RundownPlaylistOperations {
	take: (e: EventLike) => void
	hold: (e: EventLike) => void
	clearQuickLoop: (e: EventLike) => void
	activate: (e: EventLike) => void
	activateRehearsal: (e: EventLike) => void
	deactivate: (e: EventLike) => void
	activateAdlibTesting: (e: EventLike) => void
	resetRundown: (e: EventLike) => void
	reloadRundownPlaylist: (e: EventLike) => void
	takeRundownSnapshot: (e: EventLike) => void
	activateRundown: (e: EventLike) => void
	resetAndActivateRundown: (e: EventLike) => void
}

const RundownPlaylistOperationsContext = React.createContext<RundownPlaylistOperations | null>(null)

export function RundownPlaylistOperationsContextProvider({
	children,
	currentRundown,
	playlist,
	studio,
	onActivate,
}: React.PropsWithChildren<{
	studio: UIStudio
	playlist: DBRundownPlaylist
	currentRundown: Rundown | undefined
	onActivate?: (isRehearsal: boolean) => void
}>): React.JSX.Element | null {
	const { t } = useTranslation()

	const userPermissions = useContext(UserPermissionsContext)

	const service = useMemo<RundownPlaylistOperationsService>(
		() => new RundownPlaylistOperationsService(studio, playlist, currentRundown, userPermissions, onActivate),
		[]
	)

	useEffect(() => {
		service.studio = studio
		service.playlist = playlist
		service.currentRundown = currentRundown
		service.userPermissions = userPermissions
		service.onActivate = onActivate
	}, [currentRundown, playlist, studio, userPermissions, onActivate])

	const apiObject = useMemo(
		() =>
			({
				take: (e) => service.executeTake(t, e),
				hold: (e) => service.executeHold(t, e),
				clearQuickLoop: (e) => service.executeClearQuickLoop(t, e),
				activate: (e) => service.executeActivate(t, e),
				activateRehearsal: (e) => service.executeActivateRehearsal(t, e),
				deactivate: (e) => service.executeDeactivate(t, e),
				activateAdlibTesting: (e) => service.executeActivateAdlibTesting(t, e),
				resetRundown: (e) => service.executeResetRundown(t, e),
				reloadRundownPlaylist: (e) => service.executeReloadRundownPlaylist(t, e),
				takeRundownSnapshot: (e) => service.executeTakeRundownSnapshot(t, e),
				activateRundown: (e) => service.executeActivateRundown(t, e),
				resetAndActivateRundown: (e) => service.executeResetAndActivateRundown(t, e),
			}) satisfies RundownPlaylistOperations,
		[service, t]
	)

	return (
		<RundownPlaylistOperationsContext.Provider value={apiObject}>{children}</RundownPlaylistOperationsContext.Provider>
	)
}

export function useRundownPlaylistOperations(): RundownPlaylistOperations {
	const context = useContext(RundownPlaylistOperationsContext)

	if (!context)
		throw new Error('This component must be a child of a `RundownPlaylistOperationsContextProvider` component.')

	return context
}

interface RundownTimesInfo {
	shouldHaveStarted: boolean
	willShortlyStart: boolean
	shouldHaveEnded: boolean
}

type EventLike =
	| {
			persist(): void
	  }
	| {}

export function checkRundownTimes(playlistTiming: RundownPlaylistTiming): RundownTimesInfo {
	const currentTime = getCurrentTime()

	const shouldHaveEnded =
		currentTime >
		(PlaylistTiming.getExpectedStart(playlistTiming) || 0) + (PlaylistTiming.getExpectedDuration(playlistTiming) || 0)

	return {
		shouldHaveStarted: currentTime > (PlaylistTiming.getExpectedStart(playlistTiming) || 0),
		willShortlyStart:
			!shouldHaveEnded && currentTime > (PlaylistTiming.getExpectedStart(playlistTiming) || 0) - REHEARSAL_MARGIN,
		shouldHaveEnded,
	}
}
