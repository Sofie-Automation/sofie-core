import { PeripheralDevice, PERIPHERAL_SUBTYPE_PROCESS } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import type { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import { getCurrentTime } from '../lib/lib'
import {
	parseVersion,
	parseCoreIntegrationCompatabilityRange,
	stripVersion,
	compareSemverVersions,
	isPrerelease,
} from './semverUtils'
import {
	StatusResponse,
	CheckObj,
	ExternalStatus,
	CheckError,
	SystemInstanceId,
	Component,
} from '@sofie-automation/meteor-lib/dist/api/systemStatus'
import { RelevantSystemVersions } from '../coreSystem'
import { StatusCode } from '@sofie-automation/blueprints-integration'
import { PeripheralDevices, Workers, WorkerThreadStatuses } from '../collections'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ServerPeripheralDeviceAPI } from '../api/peripheralDevice'
import { MethodContext } from '../api/methodContext'
import { getBlueprintVersions } from './blueprintVersions'
import { getUpgradeSystemStatusMessages } from './blueprintUpgradeStatus'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import { assertConnectionHasOneOfPermissions, RequestCredentials } from '../security/auth'

const PackageInfo = require('../../package.json')
const integrationVersionRange = parseCoreIntegrationCompatabilityRange(PackageInfo.version)
const integrationVersionAllowPrerelease = isPrerelease(PackageInfo.version)

// Any libraries that if a gateway uses should match a certain version
const expectedLibraryVersions: { [libName: string]: string } = {
	'superfly-timeline': stripVersion(require('superfly-timeline/package.json').version),
	'@mos-connection/helper': stripVersion(require('@mos-connection/helper/package.json').version),
}

/**
 * Handling of system statuses
 */

export interface StatusObject {
	studioId?: StudioId
	statusCode: StatusCode
	messages?: Array<string>
}
export interface StatusObjectInternal {
	studioId?: StudioId
	statusCode: StatusCode
	/** Timestamp when statusCode was last changed */
	timestamp: Time
	messages: Array<{
		message: string
		/** Timestamp when message appeared first */
		timestamp: Time
	}>
}

function getSystemStatusForDevice(device: PeripheralDevice): StatusResponse {
	const deviceStatus: StatusCode = device.status.statusCode
	const deviceStatusMessages: Array<string> = device.status.messages || []

	const checks: Array<CheckObj> = []
	const pushStatusAsCheck = (name: string, statusCode: StatusCode, messages: string[]) => {
		checks.push({
			description: `expectedVersion.${name}`,
			status: status2ExternalStatus(statusCode),
			updated: new Date(device.lastSeen).toISOString(),
			_status: statusCode,
			errors: messages.map((message: string): CheckError => {
				return {
					type: 'version-differ',
					time: new Date(device.lastSeen).toISOString(),
					message: message,
				}
			}),
		})
	}

	if (deviceStatus === StatusCode.GOOD && !device.disableVersionChecks) {
		if (!device.versions) device.versions = {}
		const deviceVersions = device.versions

		// Check core-integration version is as expected
		if (
			device.subType === PERIPHERAL_SUBTYPE_PROCESS ||
			deviceVersions['@sofie-automation/server-core-integration']
		) {
			const integrationVersion = parseVersion(deviceVersions['@sofie-automation/server-core-integration'])
			const checkMessage = compareSemverVersions(
				integrationVersion,
				integrationVersionRange,
				integrationVersionAllowPrerelease,
				`Device has to be updated`,
				`Device "${device.name}"`,
				'@sofie-automation/server-core-integration'
			)
			pushStatusAsCheck(
				'@sofie-automation/server-core-integration',
				checkMessage.statusCode,
				checkMessage.messages
			)
		}

		// Check blueprint-integration version is as expected, if it exposes that
		if (deviceVersions['@sofie-automation/blueprint-integration']) {
			const integrationVersion = parseVersion(deviceVersions['@sofie-automation/blueprint-integration'])
			const checkMessage = compareSemverVersions(
				integrationVersion,
				integrationVersionRange,
				integrationVersionAllowPrerelease,
				`Device has to be updated`,
				`Device "${device.name}"`,
				'@sofie-automation/blueprint-integration'
			)
			pushStatusAsCheck('@sofie-automation/blueprint-integration', checkMessage.statusCode, checkMessage.messages)
		}

		// check for any known libraries
		for (const [libName, targetVersion] of Object.entries<string>(expectedLibraryVersions)) {
			if (deviceVersions[libName] && targetVersion !== '0.0.0') {
				const deviceLibVersion = parseVersion(deviceVersions[libName])
				const checkMessage = compareSemverVersions(
					deviceLibVersion,
					targetVersion,
					integrationVersionAllowPrerelease,
					`Device has mismatched library version`,
					`Device "${device.name}"`,
					libName
				)
				pushStatusAsCheck(libName, checkMessage.statusCode, checkMessage.messages)
			}
		}
	}
	const so: StatusResponse = {
		name: device.name,
		instanceId: device._id,
		parentId: device.parentDeviceId ?? undefined,
		status: 'UNDEFINED',
		updated: new Date(device.lastSeen).toISOString(),
		_status: deviceStatus,
		documentation: '',
		statusMessage: deviceStatusMessages.length ? deviceStatusMessages.join(', ') : undefined,
		_internal: {
			// statusCode: deviceStatus,
			statusCodeString: StatusCode[deviceStatus],
			messages: deviceStatusMessages,
			versions: device.versions || {},
		},
		checks: checks,
	}

	so.documentation = device.documentationUrl ?? ''

	return so
}

/**
 * Returns system status
 * @param studioId (Optional) If provided, limits the status to what's affecting the studio
 */
export async function getSystemStatus(_cred: RequestCredentials | null, studioId?: StudioId): Promise<StatusResponse> {
	// Future: this should consider the studioId
	// For now, all users should have access to all statuses
	triggerWriteAccessBecauseNoCheckNecessary()

	const checks: Array<CheckObj> = []

	// Check systemStatuses:
	for (const [key, status] of Object.entries<StatusObjectInternal>(systemStatuses)) {
		checks.push({
			description: key,
			status: status2ExternalStatus(status.statusCode),
			updated: new Date(status.timestamp).toISOString(),
			_status: status.statusCode,
			errors: status.messages.map((m): CheckError => {
				return {
					type: 'message',
					time: new Date(m.timestamp).toISOString(),
					message: m.message,
				}
			}),
		})
	}

	const statusObj: StatusResponse = {
		name: 'Sofie Automation system',
		instanceId: instanceId,
		updated: new Date(getCurrentTime()).toISOString(),
		status: 'UNDEFINED',
		_status: StatusCode.UNKNOWN,
		documentation: 'https://github.com/Sofie-Automation/sofie-core',
		_internal: {
			// this _internal is set later
			statusCodeString: StatusCode[StatusCode.UNKNOWN],
			messages: [],
			versions: {},
		},
		checks: checks,
	}
	if (!statusObj.components) statusObj.components = []

	// Check status of workers
	const workerStatuses = await Workers.findFetchAsync({})
	if (workerStatuses.length) {
		for (const workerStatus of workerStatuses) {
			const status = workerStatus.connected ? StatusCode.GOOD : StatusCode.BAD
			statusObj.components.push(
				literal<Component>({
					name: `worker-${workerStatus.name}`,
					status: workerStatus.connected ? 'OK' : 'FAIL',
					updated: new Date().toISOString(),
					_status: status,
					_internal: {
						statusCodeString: StatusCode[status],
						messages: [workerStatus.status],
						versions: {},
					},
				})
			)

			const statuses = await WorkerThreadStatuses.findFetchAsync({ workerId: workerStatus._id })
			for (const wts of statuses) {
				statusObj.components.push(
					literal<Component>({
						name: `worker-${wts.name}`,
						status: status2ExternalStatus(wts.statusCode),
						updated: new Date().toISOString(),
						_status: wts.statusCode,
						_internal: {
							statusCodeString: StatusCode[status],
							messages: [wts.reason],
							versions: {},
						},
					})
				)
			}
		}
	}

	const blueprintUpgradeMessages = await getUpgradeSystemStatusMessages()
	statusObj.components.push(...blueprintUpgradeMessages)

	// Check status of devices:
	let devices: PeripheralDevice[] = []
	if (studioId) {
		// Check status for a certain studio:

		devices = await PeripheralDevices.findFetchAsync({ 'studioAndConfigId.studioId': studioId })
	} else {
		// Check status for all studios:

		devices = await PeripheralDevices.findFetchAsync({})
	}
	for (const device of devices) {
		const so = getSystemStatusForDevice(device)

		if (!statusObj.components) statusObj.components = []
		statusObj.components.push(so)
	}

	const versions: { [name: string]: string } = {
		...(await RelevantSystemVersions),
	}

	for (const [blueprintId, blueprint] of Object.entries<{ name: string; version: string }>(
		await getBlueprintVersions()
	)) {
		// Use the name as key to make it easier to read for a human:
		let key = 'blueprint_' + blueprint.name

		// But if the name isn't unique, append the blueprintId to make it unique:
		if (versions[key]) key += blueprintId

		versions[key] = blueprint.version
	}

	const systemStatus: StatusCode = setStatus(statusObj)
	statusObj._internal = {
		// statusCode: systemStatus,
		statusCodeString: StatusCode[systemStatus],
		messages: collectMesages(statusObj),
		versions,
	}
	statusObj.statusMessage = statusObj._internal.messages.join(', ')

	return statusObj
}
export function setSystemStatus(type: string, status: StatusObject): void {
	let systemStatus: StatusObjectInternal = systemStatuses[type]
	if (!systemStatus) {
		systemStatus = {
			statusCode: StatusCode.UNKNOWN,
			timestamp: 0,
			messages: [],
		}
		systemStatuses[type] = systemStatus
	}

	if (systemStatus.statusCode !== status.statusCode) {
		systemStatus.statusCode = status.statusCode
		systemStatus.timestamp = getCurrentTime()
	}

	const messages: Array<{
		message: string
		timestamp: Time
	}> = []
	if (status.messages) {
		for (const message of status.messages) {
			const existingMessage = systemStatus.messages.find((m) => m.message === message)
			if (existingMessage) {
				messages.push(existingMessage)
			} else {
				messages.push({
					message: message,
					timestamp: getCurrentTime(),
				})
			}
		}
	}
	systemStatus.messages = messages
}
export function removeSystemStatus(type: string): void {
	delete systemStatuses[type]
}
/** Random id for this running instance of core */
const instanceId: SystemInstanceId = getRandomId()
/** Map of surrent system statuses */
const systemStatuses: { [key: string]: StatusObjectInternal } = {}
function setStatus(statusObj: StatusResponse | Component): StatusCode {
	let s: StatusCode = statusObj._status

	if (statusObj.checks) {
		for (const check of statusObj.checks) {
			if (check._status > s) s = check._status
		}
	}
	if (statusObj.components) {
		for (const component of statusObj.components) {
			const s2: StatusCode = setStatus(component)
			if (s2 > s) s = s2
		}
	}
	statusObj.status = status2ExternalStatus(s)
	statusObj._status = s
	return s
}
function collectMesages(statusObj: StatusResponse | Component): Array<string> {
	const allMessages: Array<string> = []

	if (statusObj._internal) {
		allMessages.push(...statusObj._internal.messages)
	}
	if (statusObj.checks) {
		for (const check of statusObj.checks) {
			if (check._status !== StatusCode.GOOD && check.errors) {
				for (const errMsg of check.errors) {
					allMessages.push(`check ${check.description}: ${errMsg.message}`)
				}
			}
		}
	}
	if (statusObj.components) {
		for (const component of statusObj.components) {
			const messages = collectMesages(component)

			for (const msg of messages) {
				allMessages.push(`${component.name}: ${msg}`)
			}
		}
	}
	return allMessages
}
export function status2ExternalStatus(statusCode: StatusCode): ExternalStatus {
	if (statusCode === StatusCode.GOOD) {
		return 'OK'
	} else if (statusCode === StatusCode.WARNING_MINOR || statusCode === StatusCode.WARNING_MAJOR) {
		return 'WARNING'
	} else if (statusCode === StatusCode.BAD || statusCode === StatusCode.FATAL) {
		return 'FAIL'
	}
	return 'UNDEFINED'
}
export async function getDebugStates(
	methodContext: MethodContext,
	peripheralDeviceId: PeripheralDeviceId
): Promise<object> {
	assertConnectionHasOneOfPermissions(methodContext.connection, 'developer')

	return ServerPeripheralDeviceAPI.getDebugStates(peripheralDeviceId)
}
