import '../../../__mocks__/_extendJest'
import { setupDefaultStudioEnvironment, DefaultEnvironment } from '../../../__mocks__/helpers/database'
import { generateTranslation, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { MeteorMock } from '../../../__mocks__/meteor'
import { status2ExternalStatus, setSystemStatus } from '../systemStatus'
import { StatusResponse } from '@sofie-automation/meteor-lib/dist/api/systemStatus'
import { stripVersion } from '../semverUtils'
import semver from 'semver'
import { StatusCode } from '@sofie-automation/blueprints-integration'
import { MeteorCall } from '../../api/methods'
import { PeripheralDeviceStatusObject } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { PeripheralDevices } from '../../collections'
import { UIBlueprintUpgradeStatus } from '@sofie-automation/meteor-lib/dist/api/upgradeStatus'

// we don't want the deviceTriggers observer to start up at this time
jest.mock('../../api/deviceTriggers/observer')

require('../api')
const PackageInfo = require('../../../package.json')

import * as getServerBlueprintUpgradeStatuses from '../../publications/blueprintUpgradeStatus/systemStatus'
const getServerBlueprintUpgradeStatusesMock = jest.spyOn(
	getServerBlueprintUpgradeStatuses,
	'getServerBlueprintUpgradeStatuses'
)

describe('systemStatus', () => {
	beforeEach(() => {
		getServerBlueprintUpgradeStatusesMock.mockReturnValue(Promise.resolve(literal<UIBlueprintUpgradeStatus[]>([])))
	})
	afterEach(() => {
		getServerBlueprintUpgradeStatusesMock.mockReset()
	})

	let env: DefaultEnvironment
	test('getSystemStatus: before startup', async () => {
		// Before starting the system up, the system status will be unknown
		const expectedStatus0 = StatusCode.UNKNOWN
		const result0: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()
		expect(result0).toMatchObject({
			status: status2ExternalStatus(expectedStatus0),
			_status: expectedStatus0,
		})
		expect(result0.checks).toHaveLength(0)
	})
	test('getSystemStatus: after startup', async () => {
		env = await setupDefaultStudioEnvironment()
		await MeteorMock.mockRunMeteorStartup()
		await MeteorMock.sleepNoFakeTimers(200)

		const result0: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()

		// Intial expected status is BAD, because the databaseVersion doesn't match
		const expectedStatus0 = StatusCode.BAD
		expect(result0).toMatchObject({
			status: status2ExternalStatus(expectedStatus0),
			_status: expectedStatus0,
		})
		expect(result0.checks && result0.checks.length).toBeGreaterThan(0)

		const databaseVersionCheck = result0.checks && result0.checks.find((p) => p.description === 'databaseVersion')
		expect(databaseVersionCheck).toMatchObject({
			status: status2ExternalStatus(StatusCode.BAD),
		})
	})
	test('getSystemStatus: after all migrations completed', async () => {
		// simulate migrations completed
		setSystemStatus('databaseVersion', {
			statusCode: StatusCode.GOOD,
			messages: [`${'databaseVersion'} version: ${PackageInfo.version}`],
		})

		const result0: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()

		// Expected status is GOOD, because the databaseVersion matches
		const expectedStatus0 = StatusCode.GOOD
		expect(result0).toMatchObject({
			status: status2ExternalStatus(expectedStatus0),
			_status: expectedStatus0,
		})
		const databaseVersionCheck = result0.checks && result0.checks.find((p) => p.description === 'databaseVersion')
		expect(databaseVersionCheck).toMatchObject({
			status: status2ExternalStatus(StatusCode.GOOD),
		})
	})
	test('getSystemStatus: a component has a fault', async () => {
		// simulate device failure
		await PeripheralDevices.updateAsync(env.ingestDevice._id, {
			$set: {
				status: literal<PeripheralDeviceStatusObject>({
					statusCode: StatusCode.WARNING_MAJOR,
					messages: [],
				}),
			},
		})

		const result0: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()

		// Expected status is WARNING_MAJOR, because the device has a warning status
		const expectedStatus0 = StatusCode.WARNING_MAJOR
		expect(result0).toMatchObject({
			status: status2ExternalStatus(expectedStatus0),
			_status: expectedStatus0,
		})
		const component =
			result0.components &&
			result0.components.find((c) => unprotectString(c.instanceId) === unprotectString(env.ingestDevice._id))
		expect(component).toMatchObject({
			status: status2ExternalStatus(expectedStatus0),
		})
	})
	test('getSystemStatus: a component has a library version mismatch', async () => {
		// simulate device failure
		await PeripheralDevices.updateAsync(env.ingestDevice._id, {
			$set: {
				status: literal<PeripheralDeviceStatusObject>({
					statusCode: StatusCode.GOOD,
					messages: [],
				}),
			},
		})

		const result0: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()

		// Expected status is GOOD, because the device is GOOD, check that the system is reset
		const expectedStatus0 = StatusCode.GOOD
		expect(result0).toMatchObject({
			status: status2ExternalStatus(expectedStatus0),
			_status: expectedStatus0,
		})
		const component =
			result0.components &&
			result0.components.find((c) => unprotectString(c.instanceId) === unprotectString(env.ingestDevice._id))
		expect(component).toMatchObject({
			status: status2ExternalStatus(expectedStatus0),
		})

		{
			const coreVersion = semver.parse(stripVersion(PackageInfo.version)) as semver.SemVer
			expect(coreVersion).toBeTruthy()
			coreVersion.major = 99

			// Change integration lib versions, simulate a major version mismatch
			await PeripheralDevices.updateAsync(env.ingestDevice._id, {
				$set: {
					versions: {
						'@sofie-automation/server-core-integration': coreVersion.format(),
					},
				},
			})
			const result1: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()

			// Expected status is BAD, because the device expects a different major version
			const expectedStatus1 = StatusCode.BAD
			expect(result1).toMatchObject({
				status: status2ExternalStatus(expectedStatus1),
				_status: expectedStatus1,
			})
		}

		{
			const coreVersion = semver.parse(stripVersion(PackageInfo.version)) as semver.SemVer
			expect(coreVersion).toBeTruthy()
			coreVersion.minor = 999

			// Change integration lib versions, simulate a minor version mismatch
			await PeripheralDevices.updateAsync(env.ingestDevice._id, {
				$set: {
					versions: {
						'@sofie-automation/server-core-integration': coreVersion.format(),
					},
				},
			})
			const result2: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()

			// Expected status is BAD, because the device expects a different minor version
			const expectedStatus2 = StatusCode.BAD
			expect(result2).toMatchObject({
				status: status2ExternalStatus(expectedStatus2),
				_status: expectedStatus2,
			})
		}

		{
			const coreVersion = semver.parse(stripVersion(PackageInfo.version)) as semver.SemVer
			expect(coreVersion).toBeTruthy()
			coreVersion.patch = 999

			// Change integration lib versions, simulate a patch version mismatch
			await PeripheralDevices.updateAsync(env.ingestDevice._id, {
				$set: {
					versions: {
						'@sofie-automation/server-core-integration': coreVersion.format(),
					},
				},
			})
			const result3: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()

			// Expected status is GOOD, because this should have no effect
			const expectedStatus3 = StatusCode.GOOD
			expect(result3).toMatchObject({
				status: status2ExternalStatus(expectedStatus3),
				_status: expectedStatus3,
			})
		}

		// Try some silly version
		await PeripheralDevices.updateAsync(env.ingestDevice._id, {
			$set: {
				versions: {
					test: '0.1.2',
				},
			},
		})
		const result4: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()

		// Expected status is BAD, because the device expects a different version
		const expectedStatus4 = StatusCode.BAD
		expect(result4).toMatchObject({
			status: status2ExternalStatus(expectedStatus4),
			_status: expectedStatus4,
		})

		// disableVersion check
		await PeripheralDevices.updateAsync(env.ingestDevice._id, {
			$set: {
				disableVersionChecks: true,
			},
		})
		const result5: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()

		// Expected status is GOOD, as the check has been skipped
		const expectedStatus5 = StatusCode.GOOD
		expect(result5).toMatchObject({
			status: status2ExternalStatus(expectedStatus5),
			_status: expectedStatus5,
		})
	})

	test('getSystemStatus: blueprint upgrades need running', async () => {
		{
			// Ensure we start with a status of GOOD
			const result: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()
			const expectedStatus = StatusCode.GOOD
			expect(result).toMatchObject({
				status: status2ExternalStatus(expectedStatus),
				_status: expectedStatus,
			})
			expect(getServerBlueprintUpgradeStatusesMock).toHaveBeenCalledTimes(1)
		}

		// Fake some studio upgrade errors
		getServerBlueprintUpgradeStatusesMock.mockReturnValue(
			Promise.resolve(
				literal<UIBlueprintUpgradeStatus[]>([
					{
						_id: protectString('studio-studio0'),
						documentType: 'studio',
						documentId: protectString('studio0'),
						name: 'Test Studio #0',
						pendingRunOfFixupFunction: false,
						changes: [generateTranslation('something changed')],
					},
					{
						_id: protectString('studio-studio1'),
						documentType: 'studio',
						documentId: protectString('studio1'),
						name: 'Test Studio #1',
						invalidReason: generateTranslation('some invalid reason'),
						pendingRunOfFixupFunction: false,
						changes: [],
					},
				])
			)
		)

		{
			const result: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()
			// Expected status is BAD, because the studio upgrade has an invalidReason
			const expectedStatus = StatusCode.WARNING_MAJOR
			expect(result).toMatchObject({
				status: status2ExternalStatus(expectedStatus),
				_status: expectedStatus,
			})
			expect(getServerBlueprintUpgradeStatusesMock).toHaveBeenCalledTimes(2)
		}

		// Just a minor studio warning
		getServerBlueprintUpgradeStatusesMock.mockReturnValue(
			Promise.resolve(
				literal<UIBlueprintUpgradeStatus[]>([
					{
						_id: protectString('studio-studio0'),
						documentType: 'studio',
						documentId: protectString('studio0'),
						name: 'Test Studio #0',
						pendingRunOfFixupFunction: false,
						changes: [generateTranslation('something changed')],
					},
					{
						_id: protectString('studio-studio1'),
						documentType: 'studio',
						documentId: protectString('studio1'),
						name: 'Test Studio #1',
						pendingRunOfFixupFunction: false,
						changes: [],
					},
				])
			)
		)

		{
			const result: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()
			// Expected status is BAD, because the studio upgrade has a change
			const expectedStatus = StatusCode.WARNING_MINOR
			expect(result).toMatchObject({
				status: status2ExternalStatus(expectedStatus),
				_status: expectedStatus,
			})
			expect(getServerBlueprintUpgradeStatusesMock).toHaveBeenCalledTimes(3)
		}

		// Nothing wrong with a studio
		getServerBlueprintUpgradeStatusesMock.mockReturnValue(
			Promise.resolve(
				literal<UIBlueprintUpgradeStatus[]>([
					{
						_id: protectString('studio-studio0'),
						documentType: 'studio',
						documentId: protectString('studio0'),
						name: 'Test Studio #0',
						pendingRunOfFixupFunction: false,
						changes: [],
					},
					{
						_id: protectString('studio-studio1'),
						documentType: 'studio',
						documentId: protectString('studio1'),
						name: 'Test Studio #1',
						pendingRunOfFixupFunction: false,
						changes: [],
					},
				])
			)
		)

		{
			const result: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()
			// Expected status is GOOD, because the studios have no warnings
			const expectedStatus = StatusCode.GOOD
			expect(result).toMatchObject({
				status: status2ExternalStatus(expectedStatus),
				_status: expectedStatus,
			})
			expect(getServerBlueprintUpgradeStatusesMock).toHaveBeenCalledTimes(4)
		}

		// Fake some showStyleBase upgrade errors
		getServerBlueprintUpgradeStatusesMock.mockReturnValue(
			Promise.resolve(
				literal<UIBlueprintUpgradeStatus[]>([
					{
						_id: protectString('showStyle-showStyleBase0'),
						documentType: 'showStyle',
						documentId: protectString('showStyleBase0'),
						name: 'Test Show Style Base #0',
						pendingRunOfFixupFunction: false,
						changes: [generateTranslation('something changed')],
					},
					{
						_id: protectString('showStyle-showStyleBase1'),
						documentType: 'showStyle',
						documentId: protectString('showStyleBase1'),
						name: 'Test Show Style Base #1',
						invalidReason: generateTranslation('some invalid reason'),
						pendingRunOfFixupFunction: false,
						changes: [],
					},
				])
			)
		)

		{
			const result: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()
			// Expected status is BAD, because the showStyleBase upgrade has an invalidReason
			const expectedStatus = StatusCode.WARNING_MAJOR
			expect(result).toMatchObject({
				status: status2ExternalStatus(expectedStatus),
				_status: expectedStatus,
			})
			expect(getServerBlueprintUpgradeStatusesMock).toHaveBeenCalledTimes(5)
		}

		// Just a minor showStyleBase warning
		getServerBlueprintUpgradeStatusesMock.mockReturnValue(
			Promise.resolve(
				literal<UIBlueprintUpgradeStatus[]>([
					{
						_id: protectString('showStyle-showStyleBase0'),
						documentType: 'showStyle',
						documentId: protectString('showStyleBase0'),
						name: 'Test Show Style Base #0',
						pendingRunOfFixupFunction: false,
						changes: [generateTranslation('something changed')],
					},
					{
						_id: protectString('showStyle-showStyleBase1'),
						documentType: 'showStyle',
						documentId: protectString('showStyleBase1'),
						name: 'Test Show Style Base #1',
						pendingRunOfFixupFunction: false,
						changes: [],
					},
				])
			)
		)

		{
			const result: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()
			// Expected status is BAD, because the showStyleBase upgrade has a change
			const expectedStatus = StatusCode.WARNING_MINOR
			expect(result).toMatchObject({
				status: status2ExternalStatus(expectedStatus),
				_status: expectedStatus,
			})
			expect(getServerBlueprintUpgradeStatusesMock).toHaveBeenCalledTimes(6)
		}

		// Nothing wrong with a showStyleBase
		getServerBlueprintUpgradeStatusesMock.mockReturnValue(
			Promise.resolve(
				literal<UIBlueprintUpgradeStatus[]>([
					{
						_id: protectString('showStyle-showStyleBase0'),
						documentType: 'showStyle',
						documentId: protectString('showStyleBase0'),
						name: 'Test Show Style Base #0',
						pendingRunOfFixupFunction: false,
						changes: [],
					},
					{
						_id: protectString('showStyle-showStyleBase1'),
						documentType: 'showStyle',
						documentId: protectString('showStyleBase1'),
						name: 'Test Show Style Base #1',
						pendingRunOfFixupFunction: false,
						changes: [],
					},
				])
			)
		)

		{
			const result: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()
			// Expected status is GOOD, because the showStyleBase have no warnings
			const expectedStatus = StatusCode.GOOD
			expect(result).toMatchObject({
				status: status2ExternalStatus(expectedStatus),
				_status: expectedStatus,
			})
			expect(getServerBlueprintUpgradeStatusesMock).toHaveBeenCalledTimes(7)
		}
	})
})
