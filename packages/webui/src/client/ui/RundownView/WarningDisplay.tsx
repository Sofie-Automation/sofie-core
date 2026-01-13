import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ModalDialog } from '../../lib/ModalDialog'
import { useCurrentTime } from '../../lib/lib'

export const REHEARSAL_MARGIN = 1 * 60 * 1000

interface ITimingWarningProps {
	playlist: Pick<DBRundownPlaylist, '_id' | 'rehearsal' | 'activationId' | 'timing'>
	inActiveRundownView?: boolean
	studioMode: boolean
	oneMinuteBeforeAction: (e: Event, noResetOnActivate: boolean) => void
}

export function WarningDisplay({
	playlist,
	inActiveRundownView,
	studioMode,
	oneMinuteBeforeAction,
}: ITimingWarningProps): JSX.Element | null {
	const { t } = useTranslation()

	const currentTime = useCurrentTime(5000)

	const [plannedStartCloseShow, setPlannedStartCloseShow] = useState(false)
	const [plannedStartCloseShown, setPlannedStartCloseShown] = useState(false)

	const discard = () => {
		setPlannedStartCloseShow(false)
	}

	const oneMinuteBeforeAction2 = (e: any, noResetOnActivate: boolean) => {
		setPlannedStartCloseShow(false)

		oneMinuteBeforeAction(e, noResetOnActivate)
	}

	const prevPlaylist = React.useRef(playlist)
	useEffect(() => {
		if (
			(playlist.activationId && !prevPlaylist.current.activationId && playlist.rehearsal) ||
			playlist.rehearsal !== prevPlaylist.current.rehearsal
		) {
			setPlannedStartCloseShown(false)
		}

		const expectedStart = PlaylistTiming.getExpectedStart(playlist.timing)
		const expectedDuration = PlaylistTiming.getExpectedDuration(playlist.timing)

		if (
			playlist.activationId &&
			playlist.rehearsal &&
			expectedStart &&
			// the expectedStart is near
			currentTime + REHEARSAL_MARGIN > expectedStart &&
			// but it's not horribly in the past
			currentTime < expectedStart + (expectedDuration || 60 * 60 * 1000) &&
			!inActiveRundownView &&
			!plannedStartCloseShown
		) {
			setPlannedStartCloseShow(true)
			setPlannedStartCloseShown(true)
		}

		prevPlaylist.current = playlist
	}, [playlist, inActiveRundownView, plannedStartCloseShown])

	if (!playlist) return null

	return (
		<ModalDialog
			title={t('Start time is close')}
			acceptText={t('Reset and Activate "On Air"')}
			secondaryText={t('Cancel')}
			actions={[
				{
					label: t('Activate "On Air"'),
					classNames: 'btn-secondary',
					on: (e) => {
						oneMinuteBeforeAction2(e as Event, true) // this one activates without resetting
					},
				},
			]}
			onAccept={(e) => oneMinuteBeforeAction2(e as Event, false)}
			onDiscard={discard}
			onSecondary={discard}
			show={
				studioMode &&
				plannedStartCloseShow &&
				!(playlist.activationId && !playlist.rehearsal) &&
				!!playlist.activationId
			}
		>
			<p>
				{t(
					'You are in rehearsal mode, the broadcast starts in less than 1 minute. Do you want to go into On-Air mode?'
				)}
			</p>
		</ModalDialog>
	)
}
