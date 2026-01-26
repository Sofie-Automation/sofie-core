import React, { useMemo } from 'react'
import { useSubscription, useTracker } from '../../../lib/ReactMeteorData/react-meteor-data.js'
import { ExpectedPackageWorkStatus } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackageWorkStatuses'
import { normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { MeteorCall } from '../../../lib/meteorApi.js'
import { doUserAction, UserAction } from '../../../lib/clientUserAction.js'
import { Meteor } from 'meteor/meteor'
import { PackageStatus } from './PackageStatus.js'
import { PackageContainerStatus } from './PackageContainerStatus.js'
import { Spinner } from '../../../lib/Spinner.js'
import { useTranslation } from 'react-i18next'
import { UIStudios } from '../../Collections.js'
import {
	ExpectedPackages,
	ExpectedPackageWorkStatuses,
	PackageContainerStatuses,
	PeripheralDevices,
} from '../../../collections/index.js'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'
import { ExpectedPackageStatusAPI } from '@sofie-automation/blueprints-integration'

export const ExpectedPackagesStatus: React.FC<{}> = function ExpectedPackagesStatus(_props: {}) {
	const { t } = useTranslation()

	const studioIds = useTracker(
		() =>
			UIStudios.find()
				.fetch()
				.map((studio) => studio._id),
		[]
	)

	const allSubsReady: boolean =
		[
			useSubscription(CorelibPubSub.expectedPackageWorkStatuses, studioIds ?? []),
			useSubscription(CorelibPubSub.expectedPackages, studioIds ?? []),
			useSubscription(CorelibPubSub.packageContainerStatuses, studioIds ?? []),
			studioIds && studioIds.length > 0,
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
	const peripheralDeviceSubReady = useSubscription(CorelibPubSub.peripheralDevices, deviceIds)
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
		const packagesWithWorkStatuses: {
			[packageId: string]: {
				package: ExpectedPackageDB | undefined
				statuses: ExpectedPackageWorkStatus[]
				device: PeripheralDevice | undefined
			}
		} = {}

		for (const expPackage of expectedPackages) {
			packagesWithWorkStatuses[unprotectString(expPackage._id)] = {
				package: expPackage,
				statuses: [],
				device: undefined,
			}
		}

		for (const work of expectedPackageWorkStatuses) {
			// todo: make this better:
			let fromPackageIds = work.fromPackages.map((p) => unprotectString(p.id))
			if (fromPackageIds.length === 0) fromPackageIds = ['unknown_work_' + work._id]

			for (const key of fromPackageIds) {
				// const referencedPackage = packageRef[packageId]
				let packageWithWorkStatus = packagesWithWorkStatuses[key]
				if (!packageWithWorkStatus) {
					packagesWithWorkStatuses[key] = packageWithWorkStatus = {
						package: undefined,
						statuses: [],
						device: undefined,
					}
				}
				packageWithWorkStatus.statuses.push(work)
				packageWithWorkStatus.device = peripheralDevicesMap.get(work.deviceId)
			}
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
				if (status.status !== ExpectedPackageStatusAPI.WorkStatusState.FULFILLED) {
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
			console.log(device, packageContainerStatus.deviceId)
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
		<div className="package-status">
			<header className="mb-4">
				<h1>{t('Package Status')}</h1>
			</header>

			{allSubsReady && peripheralDeviceSubReady ? (
				<>
					<header className="mb-4">{t('Container Status')}</header>

					<table className="packageContainer-status-list">
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

					<Row className="my-4">
						<Col xs={6}>
							<header>{t('Job Status')}</header>
						</Col>
						<Col xs={6} className="d-md-flex justify-content-md-end">
							<Button variant="outline-secondary" onClick={(e) => restartAllExpectations(e)}>
								{t('Restart All Jobs')}
							</Button>
						</Col>
					</Row>

					<table className="package-status-list">
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
