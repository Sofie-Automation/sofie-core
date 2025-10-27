import * as React from 'react'

import {
	DashboardLayoutActionButton,
	ActionButtonType,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { DashboardActionButton } from './DashboardActionButton.js'
import { doUserAction, UserAction } from '../../lib/clientUserAction.js'
import { withTranslation } from 'react-i18next'
import { Translated } from '../../lib/ReactMeteorData/react-meteor-data.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { MeteorCall } from '../../lib/meteorApi.js'
import { doModalDialog } from '../../lib/ModalDialog.js'
import { NoticeLevel, Notification, NotificationCenter } from '../../lib/notifications/notifications.js'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { hashSingleUseToken } from '../../lib/lib.js'
import { UserError } from '@sofie-automation/corelib/dist/error'

export interface IDashboardButtonGroupProps {
	buttons: DashboardLayoutActionButton[]
	studioMode: boolean
	playlist: DBRundownPlaylist

	onChangeQueueAdLib?: (isQueue: boolean, e: any) => void
}

export const DashboardActionButtonGroup = withTranslation()(
	class DashboardActionButtonGroup extends React.Component<Translated<IDashboardButtonGroupProps>> {
		private take = (e: any) => {
			if (this.props.studioMode) {
				const { t } = this.props
				doUserAction(t, e, UserAction.TAKE, (e, ts) =>
					MeteorCall.userAction.take(
						e,
						ts,
						this.props.playlist._id,
						this.props.playlist.currentPartInfo?.partInstanceId ?? null
					)
				)
			}
		}

		moveNext = (e: any, horizontalDelta: number, verticalDelta: number, ignoreQuickLoop?: boolean) => {
			const { t } = this.props
			if (this.props.studioMode) {
				doUserAction(t, e, UserAction.MOVE_NEXT, (e, ts) =>
					MeteorCall.userAction.moveNext(
						e,
						ts,
						this.props.playlist._id,
						horizontalDelta,
						verticalDelta,
						ignoreQuickLoop
					)
				)
			}
		}

		hold = (e: any) => {
			const { t } = this.props
			if (this.props.studioMode && this.props.playlist.activationId) {
				doUserAction(t, e, UserAction.ACTIVATE_HOLD, (e, ts) =>
					MeteorCall.userAction.activateHold(
						e,
						ts,
						this.props.playlist._id,
						this.props.playlist.holdState === RundownHoldState.PENDING
					)
				)
			}
		}

		onButtonDown = (button: DashboardLayoutActionButton, e: React.SyntheticEvent<HTMLElement>) => {
			switch (button.type) {
				case ActionButtonType.QUEUE_ADLIB:
					this.props.onChangeQueueAdLib?.(true, e)
					break
			}
		}

		readyOnAirAction = (e: any) => {
			const { t } = this.props
			if (this.props.studioMode) {
				if (this.props.playlist.activationId) {
					doModalDialog({
						title: this.props.playlist.name,
						message: t('Are you sure you want to deactivate this Rundown\n(This will clear the outputs)'),
						warning: true,
						onAccept: () => {
							doUserAction(t, e, UserAction.DEACTIVATE_RUNDOWN_PLAYLIST, (e, ts) =>
								MeteorCall.userAction.deactivate(e, ts, this.props.playlist._id)
							)
						},
					})
				} else {
					doUserAction(t, e, UserAction.RESET_AND_ACTIVATE_RUNDOWN_PLAYLIST, (e, ts) =>
						MeteorCall.userAction.resetAndActivate(e, ts, this.props.playlist._id)
					)
					doUserAction(t, e, UserAction.TAKE, (e, ts) =>
						MeteorCall.userAction.take(
							e,
							ts,
							this.props.playlist._id,
							this.props.playlist.currentPartInfo?.partInstanceId ?? null
						)
					)
				}
			}
		}

		storeSnapshot = (e: React.SyntheticEvent<HTMLElement>) => {
			const { t } = this.props
			const playlistId: RundownPlaylistId = this.props.playlist._id
			const reason = 'Taken by user'
			doUserAction(
				t,
				e,
				UserAction.CREATE_SNAPSHOT_FOR_DEBUG,
				(e, ts) =>
					MeteorCall.system.generateSingleUseToken().then((tokenResult) => {
						if (ClientAPI.isClientResponseError(tokenResult)) throw UserError.fromSerialized(tokenResult.error)
						if (!tokenResult.result) throw new Error('Failed to generate token')
						return MeteorCall.userAction.storeRundownSnapshot(
							e,
							ts,
							hashSingleUseToken(tokenResult.result),
							playlistId,
							reason,
							false
						)
					}),
				(err, snapshotId) => {
					if (!err && snapshotId) {
						const noticeLevel: NoticeLevel = NoticeLevel.NOTIFICATION
						const message: string = t('Successfully stored snapshot')
						const notification: Notification = new Notification(undefined, noticeLevel, message, 'StoreSnapshot')
						NotificationCenter.push(notification)
					}
				}
			)
		}

		private onButtonUp = (button: DashboardLayoutActionButton, e: React.SyntheticEvent<HTMLElement>) => {
			switch (button.type) {
				case ActionButtonType.TAKE:
					this.take(e)
					break
				case ActionButtonType.QUEUE_ADLIB:
					this.props.onChangeQueueAdLib?.(false, e)
					break
				case ActionButtonType.MOVE_NEXT_PART:
					this.moveNext(e, 1, 0)
					break
				case ActionButtonType.MOVE_NEXT_SEGMENT:
					this.moveNext(e, 0, 1)
					break
				case ActionButtonType.MOVE_PREVIOUS_PART:
					this.moveNext(e, -1, 0)
					break
				case ActionButtonType.MOVE_PREVIOUS_SEGMENT:
					this.moveNext(e, 0, -1)
					break
				case ActionButtonType.HOLD:
					this.hold(e)
					break
				case ActionButtonType.READY_ON_AIR:
					this.readyOnAirAction(e)
					break
				case ActionButtonType.STORE_SNAPSHOT:
					this.storeSnapshot(e)
					break
			}
		}

		render(): JSX.Element[] {
			return this.props.buttons.map((button: DashboardLayoutActionButton) => (
				<DashboardActionButton
					key={button._id}
					playlist={this.props.playlist}
					onButtonDown={this.onButtonDown}
					onButtonUp={this.onButtonUp}
					button={button}
					studioMode={this.props.studioMode}
				/>
			))
		}
	}
)
