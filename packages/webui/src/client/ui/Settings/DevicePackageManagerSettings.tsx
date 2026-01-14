import React, { useCallback, useEffect, useRef, useState } from 'react'

import { useTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'
import { Spinner } from '../../lib/Spinner.js'
import { doModalDialog } from '../../lib/ModalDialog.js'
import { Meteor } from 'meteor/meteor'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { useTranslation } from 'react-i18next'
import { MeteorCall } from '../../lib/meteorApi.js'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevices } from '../../collections/index.js'
import { eventContextForLog } from '../../lib/clientUserAction.js'
import { logger } from '../../lib/logging.js'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'

interface IDevicePackageManagerSettingsProps {
	deviceId: PeripheralDeviceId
}

export const DevicePackageManagerSettings: React.FC<IDevicePackageManagerSettingsProps> =
	function DevicePackageManagerSettings({ deviceId }: IDevicePackageManagerSettingsProps) {
		const { t } = useTranslation()
		const device = useTracker(() => PeripheralDevices.findOne(deviceId), [deviceId], undefined)
		const reloadingNow = useRef<PeripheralDeviceId | null>(null)
		const [status, setStatus] = useState<Status | undefined>(undefined)

		const reloadStatus = useCallback(
			(silent = false) => {
				if (reloadingNow.current === deviceId) return // if there is a method currently being executed, skip

				reloadingNow.current = deviceId

				MeteorCall.client
					.callBackgroundPeripheralDeviceFunction(deviceId, 1000, 'getExpetationManagerStatus')
					.then((result: Status) => {
						if (reloadingNow.current !== deviceId) return // if the deviceId has changed, abort

						setStatus(result)
					})
					.catch((error) => {
						if (reloadingNow.current !== deviceId) return // if the deviceId has changed, abort

						if (silent) {
							logger.error('callBackgroundPeripheralDeviceFunction getExpetationManagerStatus', error)
							return
						}

						doModalDialog({
							message: t('There was an error: {{error}}', { error: error.toString() }),
							title: t('Error'),
							warning: true,
							onAccept: () => {
								// Do nothing
							},
						})
					})
					.finally(() => {
						reloadingNow.current = null
					})
			},
			[deviceId]
		)

		useEffect(() => {
			// Clear cached status when deviceId changes
			setStatus(undefined)

			// Trigger a load now
			reloadStatus(true)

			const reloadInterval = Meteor.setInterval(() => {
				if (deviceId) {
					reloadStatus(true)
				}
			}, 1000)

			return () => {
				Meteor.clearInterval(reloadInterval)
			}
		}, [deviceId, reloadStatus])

		function killApp(e: string, appId: string) {
			MeteorCall.client
				.callPeripheralDeviceFunction(e, deviceId, 1000, 'debugKillApp', appId)
				.then(() => {
					reloadStatus()
				})
				.catch((error) => {
					doModalDialog({
						message: t('There was an error: {{error}}', { error: error.toString() }),
						title: t('Error'),
						warning: true,
						onAccept: () => {
							// Do nothing
						},
					})
				})
		}

		if (!device) {
			return <Spinner />
		}

		return (
			<Row>
				<Col xs={12}>
					<h2 className="my-4">{t('Package Manager status')}</h2>
					<Button variant="outline-secondary" size="sm" className="mb-2" onClick={() => reloadStatus()}>
						{t('Reload statuses')}
					</Button>
					{status?.updated ? (
						<p>
							{t('Updated')}: {new Date(status.updated).toLocaleString()}
						</p>
					) : null}
				</Col>

				{status ? (
					<>
						<Col xs={12} xxl={6}>
							<h3 className="">{t('Package Manager')}</h3>
							<table className="table">
								<tbody>
									{Object.entries<any>(status.packageManager || {}).map(([key, value]) => {
										return (
											<tr key={key}>
												<td>{key}</td>
												<td>{JSON.stringify(value)}</td>
											</tr>
										)
									})}
								</tbody>
							</table>
						</Col>
						<Col xs={12} xxl={6}>
							<h3 className="">{t('Expectation Manager')}</h3>
							<div>Id: {status.expectationManager?.id}</div>
							{status.expectationManager?.updated ? (
								<div>
									{t('Updated')}: {new Date(status.expectationManager.updated).toLocaleString()}
								</div>
							) : null}

							<h4 className="">{t('Statistics')}</h4>
							<table className="table">
								<tbody>
									{Object.entries<any>(status.expectationManager?.expectationStatistics || {}).map(([key, value]) => {
										return (
											<tr key={key}>
												<td>{key}</td>
												<td>{JSON.stringify(value)}</td>
											</tr>
										)
									})}
								</tbody>
							</table>

							<h4 className="">{t('Times')}</h4>
							<table className="table">
								<tbody>
									{Object.entries<any>(status.expectationManager?.times || {}).map(([key, value]) => {
										return (
											<tr key={key}>
												<td>{key}</td>
												<td>{JSON.stringify(value)}</td>
											</tr>
										)
									})}
								</tbody>
							</table>

							<h4 className="">{t('Connected Workers')}</h4>
							<TableFromObjectArray dataObjs={status.expectationManager?.workerAgents} />
						</Col>

						<Col xs={12}>
							<h4 className="">{t('Work-in-progress')}</h4>
							<TableFromObjectArray dataObjs={status.expectationManager?.worksInProgress} />
						</Col>

						<Col xs={12}>
							<h3 className="">{t('WorkForce')}</h3>

							<h4 className="">{t('Connected Workers')}</h4>
							<TableFromObjectArray
								dataObjs={status.workforce?.workerAgents}
								rowFcn={(workerAgent) => (
									<Button
										variant="outline-secondary"
										size="sm"
										onClick={(e) => killApp(eventContextForLog(e)[0], workerAgent.id)}
									>
										{t('Kill (debug)')}
									</Button>
								)}
							/>
						</Col>

						<Col xs={12}>
							<h4 className="">{t('Connected Expectation Managers')}</h4>
							<TableFromObjectArray dataObjs={status.workforce?.expectationManagers} />
						</Col>

						<Col xs={12}>
							<h4 className="">{t('Connected App Containers')}</h4>
							<table className="table">
								<tbody>
									<tr>
										<th>Id</th>
										<th>Initialized</th>
										<th>Available apps</th>
									</tr>
									{status.workforce?.appContainers?.map((appContainer) => {
										return (
											<tr key={appContainer.id}>
												<td>{appContainer.id}</td>
												<td>{appContainer.initialized ? 'true' : 'false'}</td>
												<td>
													<ul>
														{appContainer.availableApps.map((availableApp, index) => {
															return <li key={index}>{availableApp.appType}</li>
														})}
													</ul>
												</td>
											</tr>
										)
									})}
								</tbody>
							</table>
						</Col>
					</>
				) : (
					<Col xs={12}>{t('No status loaded')}</Col>
				)}
			</Row>
		)
	}

// Note: These interfaces are copied from Package Manager. To be replaced with shared types later..
interface Status {
	packageManager?: PackageManagerStatus
	workforce?: WorkforceStatus
	expectationManager?: ExpectationManagerStatus
	updated?: number
}
interface PackageManagerStatus {
	workforceURL: string
	lastUpdated: number
	countExpectedPackages: number
	countPackageContainers: number
	countExpectations: number
	countPackageContainerExpectations: number
}

interface WorkforceStatus {
	workerAgents: {
		id: string
	}[]
	expectationManagers: {
		id: string
		url?: string
	}[]
	appContainers: {
		id: string
		initialized: boolean

		availableApps: {
			appType: string
		}[]
	}[]
}
interface ExpectationManagerStatus {
	id: string
	updated: number
	expectationStatistics: {
		countTotal: number

		countNew: number
		countWaiting: number
		countReady: number
		countWorking: number
		countFulfilled: number
		countRemoved: number
		countRestarted: number
		countAborted: number

		countNoAvailableWorkers: number
		countError: number
	}
	times: { [key: string]: number }
	workerAgents: {
		workerId: string
	}[]
	worksInProgress: {
		id: string
		lastUpdated: number
		workerId: string
		cost: number
		expectationId: string
	}[]
}

interface TableFromObjectArrayData<T> {
	dataObjs: { [key: string]: T }[] | undefined
	rowFcn?: (dataObj: T) => JSX.Element
}

const TableFromObjectArray: React.FC<TableFromObjectArrayData<any>> = function TableFromObject({ dataObjs, rowFcn }) {
	if (!dataObjs) return <i>No data</i>
	if (typeof dataObjs !== 'object') return <i>{dataObjs}</i>

	const setOfKeys = new Set<string>()
	for (const dataObj of Object.values<any>(dataObjs)) {
		for (const key of Object.keys(dataObj)) {
			setOfKeys.add(key)
		}
	}
	const keys = Array.from(setOfKeys.keys())

	function displayValue(val: any) {
		if (typeof val === 'object') return JSON.stringify(val)
		return val
	}

	return (
		<table className="table">
			<tbody>
				<tr>
					{keys.map((key) => {
						return <th key={key}>{key}</th>
					})}
				</tr>
				{dataObjs.map((dataObj, index) => {
					if (typeof dataObj === 'object') {
						return (
							<tr key={dataObj.id || `__index${index}`}>
								{keys.map((key) => {
									const value = dataObj[key]
									let returnValue
									if (Array.isArray(value)) {
										returnValue = <TableFromObjectArray dataObjs={value} />
									} else if (typeof value === 'object') {
										try {
											returnValue = JSON.stringify(value)
										} catch (e) {
											returnValue = `>Error parsing: ${stringifyError(e, true)}<`
										}
									} else if (value === true) {
										returnValue = 'true'
									} else if (value === false) {
										returnValue = 'false'
									} else {
										returnValue = `${value}`
									}
									return <td key={key}>{returnValue}</td>
								})}

								{rowFcn ? <td>{rowFcn(dataObj)}</td> : null}
							</tr>
						)
					} else {
						return (
							<tr key={`__index${index}`}>
								<td colSpan={keys.length}>{displayValue(dataObj)}</td>
							</tr>
						)
					}
				})}
			</tbody>
		</table>
	)
}
