import React, { useMemo } from 'react'
import ClassNames from 'classnames'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import {
	PeripheralDevice,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { Rundown, getRundownNrcsName } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { Time, unprotectString } from '../../lib/tempLib.js'
import { useTranslation } from 'react-i18next'
import { StatusCode } from '@sofie-automation/blueprints-integration'
import { RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevices } from '../../collections/index.js'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { useCurrentTime } from '../../lib/lib.js'

interface IMOSStatusProps {
	lastUpdate: Time
}

const MOSLastUpdateStatus = React.memo(function MOSLastUpdateStatus({ lastUpdate }: Readonly<IMOSStatusProps>) {
	const { t } = useTranslation()

	const currentTime = useCurrentTime(5000)
	const timeDiff = currentTime - lastUpdate

	return (
		<span>
			{timeDiff < 3000 && t('Just now')}
			{timeDiff >= 3000 && timeDiff < 60 * 1000 && t('Less than a minute ago')}
			{timeDiff >= 60 * 1000 && timeDiff < 5 * 60 * 1000 && t('Less than five minutes ago')}
			{timeDiff >= 5 * 60 * 1000 && timeDiff < 10 * 60 * 1000 && t('Around 10 minutes ago')}
			{timeDiff >= 10 * 60 * 1000 && timeDiff < 30 * 60 * 1000 && t('More than 10 minutes ago')}
			{timeDiff >= 30 * 60 * 1000 && timeDiff < 2 * 60 * 60 * 1000 && t('More than 30 minutes ago')}
			{timeDiff >= 2 * 60 * 60 * 1000 && timeDiff < 5 * 60 * 60 * 1000 && t('More than 2 hours ago')}
			{timeDiff >= 5 * 60 * 60 * 1000 && timeDiff < 24 * 60 * 60 * 1000 && t('More than 5 hours ago')}
			{timeDiff >= 24 * 60 * 60 * 1000 && t('More than a day ago')}
		</span>
	)
})

interface IProps {
	studioId: StudioId
	playlistId: RundownPlaylistId
	firstRundown: Pick<Rundown, 'source'> | undefined
}

interface OnLineOffLineList {
	onLine: PeripheralDevice[]
	offLine: PeripheralDevice[]
}

interface ITrackedProps {
	mosStatus: StatusCode
	mosLastUpdate: Time
	mosDevices: OnLineOffLineList
	playoutStatus: StatusCode
	playoutDevices: OnLineOffLineList
}

function calculateStatusForDevices(devices: PeripheralDevice[]) {
	const status = devices
		.filter((i) => !i.ignore)
		.reduce((memo: StatusCode, device: PeripheralDevice) => {
			if (device.connected && memo.valueOf() < device.status.statusCode.valueOf()) {
				return device.status.statusCode
			} else if (!device.connected) {
				return StatusCode.FATAL
			} else {
				return memo
			}
		}, StatusCode.UNKNOWN)

	const onlineOffline: OnLineOffLineList = {
		onLine: devices.filter((device) => device.connected && device.status.statusCode < StatusCode.WARNING_MINOR),
		offLine: devices.filter((device) => !device.connected || device.status.statusCode >= StatusCode.WARNING_MINOR),
	}
	const lastUpdate = devices.reduce((memo, device) => Math.max(device.lastDataReceived || 0, memo), 0)
	return {
		status: status,
		lastUpdate: lastUpdate,
		onlineOffline: onlineOffline,
	}
}

export const RundownSystemStatus = React.memo(
	function RundownSystemStatus(props: Readonly<IProps>): JSX.Element {
		useSubscription(CorelibPubSub.peripheralDevicesAndSubDevices, props.studioId)

		const parentDevices = useTracker(
			() =>
				PeripheralDevices.find({
					'studioAndConfigId.studioId': props.studioId,
				}).fetch(),
			[],
			[]
		)
		const parentDeviceIds = useMemo(() => parentDevices.map((pd) => pd._id), [parentDevices])
		const subDevices = useTracker(
			() =>
				PeripheralDevices.find({
					parentDeviceId: { $in: parentDeviceIds },
				}).fetch(),
			[parentDeviceIds],
			[]
		)

		const ingest = useMemo(() => {
			const attachedDevices = [...parentDevices, ...subDevices]

			const ingestDevices = attachedDevices.filter(
				(i) => i.category === PeripheralDeviceCategory.INGEST || i.category === PeripheralDeviceCategory.MEDIA_MANAGER
			)

			return calculateStatusForDevices(ingestDevices)
		}, [parentDevices, subDevices])

		const playout = useMemo(() => {
			const attachedDevices = [...parentDevices, ...subDevices]

			const playoutDevices = attachedDevices.filter((i) => i.type === PeripheralDeviceType.PLAYOUT)

			return calculateStatusForDevices(playoutDevices)
		}, [parentDevices, subDevices])

		const trackedProps: ITrackedProps = {
			mosStatus: ingest.status,
			mosDevices: ingest.onlineOffline,
			mosLastUpdate: ingest.lastUpdate,

			playoutStatus: playout.status,
			playoutDevices: playout.onlineOffline,
		}

		return <RundownSystemStatusContent {...props} {...trackedProps} />
	},
	(props: IProps, nextProps: IProps) => {
		if (props.playlistId === nextProps.playlistId && props.studioId === nextProps.studioId) return false
		return true
	}
)

function RundownSystemStatusContent({
	firstRundown,

	mosStatus,
	mosLastUpdate,
	mosDevices,
	playoutStatus,
	playoutDevices,
}: Readonly<IProps & ITrackedProps>) {
	const { t } = useTranslation()

	const playoutDevicesIssues = playoutDevices.offLine.filter((dev) => dev.connected)
	const mosDevicesIssues = mosDevices.offLine.filter((dev) => dev.connected)
	const mosDisconnected = mosDevices.offLine.filter((dev) => !dev.connected)
	const playoutDisconnected = playoutDevices.offLine.filter((dev) => !dev.connected)

	return (
		<div className="rundown-system-status">
			<div className="rundown-system-status__indicators">
				<div
					className={ClassNames('indicator', 'mos', {
						good: mosStatus === StatusCode.GOOD,
						minor: mosStatus === StatusCode.WARNING_MINOR,
						major: mosStatus === StatusCode.WARNING_MAJOR,
						bad: mosStatus === StatusCode.BAD,
						fatal: mosStatus === StatusCode.FATAL,
					})}
				>
					<div className="indicator__tooltip">
						<h4>
							{t('{{nrcsName}} Connection', {
								nrcsName: getRundownNrcsName(firstRundown),
							})}
						</h4>
						<div>
							<h5>{t('Last update')}</h5>
							<MOSLastUpdateStatus lastUpdate={mosLastUpdate} />
						</div>
						<div>
							{mosDevices.offLine.length > 0 ? (
								<React.Fragment>
									{mosDisconnected.length ? (
										<React.Fragment>
											<h5>{t('Off-line devices')}</h5>
											<ul>
												{mosDisconnected.map((device) => {
													return <li key={unprotectString(device._id)}>{device.name}</li>
												})}
											</ul>
										</React.Fragment>
									) : null}
									{mosDevicesIssues.length ? (
										<React.Fragment>
											<h5>{t('Devices with issues')}</h5>
											<ul>
												{mosDevicesIssues.map((device) => {
													return <li key={unprotectString(device._id)}>{device.name}</li>
												})}
											</ul>
										</React.Fragment>
									) : null}
								</React.Fragment>
							) : (
								<span>{t('All connections working correctly')}</span>
							)}
						</div>
					</div>
				</div>
				<div
					className={ClassNames('indicator', 'playout', {
						good: playoutStatus === StatusCode.GOOD,
						minor: playoutStatus === StatusCode.WARNING_MINOR,
						major: playoutStatus === StatusCode.WARNING_MAJOR,
						bad: playoutStatus === StatusCode.BAD,
						fatal: playoutStatus === StatusCode.FATAL,
					})}
				>
					<div className="indicator__tooltip">
						<h4>{t('Play-out')}</h4>
						<div>
							{playoutDevices.offLine.length > 0 ? (
								<React.Fragment>
									{playoutDisconnected.length ? (
										<React.Fragment>
											<h5>{t('Off-line devices')}</h5>
											<ul>
												{playoutDisconnected.map((device) => {
													return <li key={unprotectString(device._id)}>{device.name}</li>
												})}
											</ul>
										</React.Fragment>
									) : null}
									{playoutDevicesIssues.length ? (
										<React.Fragment>
											<h5>{t('Devices with issues')}</h5>
											<ul>
												{playoutDevicesIssues.map((device) => {
													return <li key={unprotectString(device._id)}>{device.name}</li>
												})}
											</ul>
										</React.Fragment>
									) : null}
								</React.Fragment>
							) : (
								<span>{t('All devices working correctly')}</span>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
