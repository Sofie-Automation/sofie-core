import React, { useMemo } from 'react'
import { useSubscriptionIfEnabled, useTracker } from '../../../lib/ReactMeteorData/react-meteor-data'
import { ExpectedPackageWorkStatus } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackageWorkStatuses'
import { normalizeArrayToMap, unprotectString } from '../../../lib/tempLib'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { MeteorCall } from '../../../lib/meteorApi'
import { doUserAction, UserAction } from '../../../lib/clientUserAction'
import { Meteor } from 'meteor/meteor'
import { PackageStatus } from './PackageStatus'
import { PackageContainerStatus } from './PackageContainerStatus'
import { Spinner } from '../../../lib/Spinner'
import { useTranslation } from 'react-i18next'
import { UIStudios } from '../../Collections'
import {
	ExpectedPackages,
	ExpectedPackageWorkStatuses,
	PackageContainerStatuses,
	PeripheralDevices,
} from '../../../collections'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

export const ExpectedPackagesStatus: React.FC<{}> = function ExpectedPackagesStatus(_props: {}) {
	const { t } = useTranslation()

	const studioIds = useTracker(
		() =>
			UIStudios.find()
				.fetch()
				.map((studio) => studio._id),
		[],
		[]
	)

	const allSubsReady: boolean =
		[
			useSubscriptionIfEnabled(CorelibPubSub.expectedPackageWorkStatuses, studioIds.length > 0, studioIds),
			useSubscriptionIfEnabled(CorelibPubSub.expectedPackages, studioIds.length > 0, studioIds),
			useSubscriptionIfEnabled(CorelibPubSub.packageContainerStatuses, studioIds.length > 0, studioIds),
			studioIds.length > 0,
		].reduce((memo, value) => memo && value, true) || false

	const expectedPackageWorkStatuses = useTracker(() => ExpectedPackageWorkStatuses.find({}).fetch(), [], [])
	const expectedPackages = useTracker(() => ExpectedPackages.find({}).fetch(), [], [])
	const packageContainerStatuses = useTracker(() => PackageContainerStatuses.find().fetch(), [], [])

	const deviceIds = useMemo(() => {
		const devices = new Set<PeripheralDeviceId>()
		packageContainerStatuses.forEach((pcs) => devices.add(pcs.deviceId))
		expectedPackageWorkStatuses.forEach((epws) => devices.add(epws.deviceId))
		return Array.from(devices)
	}, [packageContainerStatuses, expectedPackageWorkStatuses])
	const peripheralDeviceSubReady = useSubscriptionIfEnabled(
		CorelibPubSub.peripheralDevices,
		deviceIds.length > 0,
		deviceIds
	)
	const peripheralDevices = useTracker(() => PeripheralDevices.find().fetch(), [], [])
	const peripheralDevicesMap = normalizeArrayToMap(peripheralDevices, '_id')

	function restartAllExpectations(e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
		const studio = UIStudios.findOne()
		if (!studio) throw new Meteor.Error(404, `No studio found!`)

		doUserAction(t, e, UserAction.PACKAGE_MANAGER_RESTART_WORK, (e, ts) =>
			MeteorCall.userAction.packageManagerRestartAllExpectations(e, ts, studio._id)
		)
	}
	function renderExpectedPackageStatuses() {
		const packageRef: { [packageId: string]: ExpectedPackageDB } = {}
		for (const expPackage of expectedPackages) {
			packageRef[unprotectString(expPackage._id)] = expPackage
		}

		const packagesWithWorkStatuses: {
			[packageId: string]: {
				package: ExpectedPackageDB | undefined
				statuses: ExpectedPackageWorkStatus[]
				device: PeripheralDevice | undefined
			}
		} = {}
		for (const work of expectedPackageWorkStatuses) {
			const device = peripheralDevicesMap.get(work.deviceId)
			// todo: make this better:
			const key = unprotectString(work.fromPackages[0]?.id) || 'unknown_work_' + work._id
			// const referencedPackage = packageRef[packageId]
			let packageWithWorkStatus = packagesWithWorkStatuses[key]
			if (!packageWithWorkStatus) {
				packagesWithWorkStatuses[key] = packageWithWorkStatus = {
					package: packageRef[key] || undefined,
					statuses: [],
					device,
				}
			}
			packageWithWorkStatus.statuses.push(work)
		}

		for (const id of Object.keys(packagesWithWorkStatuses)) {
			packagesWithWorkStatuses[id].statuses.sort(compareWorkStatus)
		}
		// sort, so that incompleted packages are put first:
		const keys: { packageId: string; incompleteRank: number; created: number }[] = []
		Object.keys(packagesWithWorkStatuses).forEach((packageId) => {
			const p = packagesWithWorkStatuses[packageId]

			let incompleteRank = 999
			for (const status of p.statuses) {
				if (status.status !== 'fulfilled') {
					if (status.requiredForPlayout) {
						incompleteRank = Math.min(incompleteRank, 0)
					} else {
						incompleteRank = Math.min(incompleteRank, 1)
					}
				}
			}
			keys.push({
				packageId,
				created: p.package?.created ?? 0,
				incompleteRank,
			})
		})

		keys.sort((a, b) => {
			// Incomplete first:
			if (a.incompleteRank > b.incompleteRank) return 1
			if (a.incompleteRank < b.incompleteRank) return -1

			if (a.created < b.created) return 1
			if (a.created > b.created) return -1

			if (a.packageId < b.packageId) return 1
			if (a.packageId > b.packageId) return -1

			return 0
		})

		return keys.map(({ packageId }) => {
			const p = packagesWithWorkStatuses[packageId]

			return p.package ? (
				<PackageStatus key={packageId} package={p.package} statuses={p.statuses} device={p.device} />
			) : (
				<tr className="package" key={packageId}>
					<td colSpan={99}>{t('Unknown Package "{{packageId}}"', { packageId })}</td>
				</tr>
			)
		})
	}
	function renderPackageContainerStatuses() {
		return packageContainerStatuses.map((packageContainerStatus) => {
			const device = peripheralDevicesMap.get(packageContainerStatus.deviceId)
			return (
				<PackageContainerStatus
					key={unprotectString(packageContainerStatus._id)}
					packageContainerStatus={packageContainerStatus}
					device={device}
				/>
			)
		})
	}

	return (
		<div className="mhl gutter package-status">
			<header className="mbs">
				<h1>{t('Package Status')}</h1>
			</header>

			{allSubsReady && peripheralDeviceSubReady ? (
				<>
					<div className="mod row">
						<div className="col c12 rl-c6">
							<header className="mbs">
								<b>{t('Container Status')}</b>
							</header>
						</div>
					</div>
					<table className="mod packageContainer-status-list">
						<tbody>
							<tr className="packageContainer-status__header">
								<th className="indent"></th>
								<th>{t('Id')}</th>
								<th colSpan={2}>{t('Status')}</th>
								<th></th>
							</tr>
							{renderPackageContainerStatuses()}
						</tbody>
					</table>

					<div className="mod row mtl">
						<div className="col c12 rl-c6">
							<header className="mbs">
								<b>{t('Job Status')}</b>
							</header>
						</div>
						<div className="col c12 rl-c6 alright">
							<button className="btn btn-secondary mls" onClick={(e) => restartAllExpectations(e)}>
								{t('Restart All Jobs')}
							</button>
						</div>
					</div>

					<table className="mod package-status-list">
						<tbody>
							<tr className="package-status__header">
								<th className="indent"></th>
								<th>{t('Status')}</th>
								<th>{t('Name')}</th>
								<th>{t('Created')}</th>
								<th></th>
							</tr>
							{renderExpectedPackageStatuses()}
						</tbody>
					</table>
				</>
			) : (
				<Spinner />
			)}
		</div>
	)
}

function compareWorkStatus(a: ExpectedPackageWorkStatus, b: ExpectedPackageWorkStatus): number {
	if ((a.displayRank || 0) > (b.displayRank || 0)) return 1
	if ((a.displayRank || 0) < (b.displayRank || 0)) return -1

	if (a.requiredForPlayout && !b.requiredForPlayout) return 1
	if (!a.requiredForPlayout && b.requiredForPlayout) return -1

	if (a.label > b.label) return 1
	if (a.label < b.label) return -1

	return 0
}
