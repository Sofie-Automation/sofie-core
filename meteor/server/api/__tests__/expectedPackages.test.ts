import { PackageInfo, StatusCode, ExpectedPackageStatusAPI } from '@sofie-automation/blueprints-integration'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { getPackageContainerId } from '@sofie-automation/corelib/dist/dataModel/PackageContainerStatus'
import { getPackageContainerPackageId } from '@sofie-automation/corelib/dist/dataModel/PackageContainerPackageStatus'
import { getPackageInfoId } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { setupDefaultStudioEnvironment } from '../../../__mocks__/helpers/database'
import { getMethodContext } from '../../../__mocks__/helpers/methods'
import {
	ExpectedPackages,
	ExpectedPackageWorkStatuses,
	PackageContainerPackageStatuses,
	PackageContainerStatuses,
	PackageInfos,
} from '../../collections'
import { PackageManagerIntegration } from '../integration/expectedPackages'

describe('PackageManagerIntegration', () => {
	let env: Awaited<ReturnType<typeof setupDefaultStudioEnvironment>>
	const context = getMethodContext()

	beforeEach(async () => {
		env = await setupDefaultStudioEnvironment()
	})

	test('updates and cleans expected package work statuses for a device', async () => {
		const packageId = protectString('expectedPackage_1')
		await ExpectedPackages.mutableCollection.insertAsync({
			_id: packageId,
			studioId: env.studio._id,
			rundownId: null,
			bucketId: null,
			created: 1,
			package: {} as any,
			ingestSources: [],
			playoutSources: {
				pieceInstanceIds: [],
			},
		})

		const workStatusId1 = protectString('work_status_1')
		const workStatusId2 = protectString('work_status_2')

		const baseStatus = {
			label: 'Copy package',
			description: 'Copies package to destination',
			fromPackages: [
				{
					id: String(packageId),
					expectedContentVersionHash: 'expected-hash',
					actualContentVersionHash: 'actual-hash',
				},
			],
			status: ExpectedPackageStatusAPI.WorkStatusState.WORKING,
			statusReason: { user: 'Transferring', tech: 'Transfer in progress' },
			statusChanged: 10,
			priority: 3,
		} satisfies ExpectedPackageStatusAPI.WorkStatus

		await PackageManagerIntegration.updateExpectedPackageWorkStatuses(
			context,
			env.ingestDevice._id,
			env.ingestDevice.token,
			[
				{ id: workStatusId1, type: 'insert', status: baseStatus },
				{ id: workStatusId2, type: 'insert', status: { ...baseStatus, label: 'Validate', priority: 5 } },
			]
		)

		const workStatuses = await ExpectedPackageWorkStatuses.findFetchAsync({
			_id: { $in: [workStatusId1, workStatusId2] },
		})
		expect(workStatuses).toHaveLength(2)
		expect(workStatuses.every((status) => status.studioId === env.studio._id)).toBe(true)
		expect(workStatuses.every((status) => status.deviceId === env.ingestDevice._id)).toBe(true)

		await PackageManagerIntegration.updateExpectedPackageWorkStatuses(
			context,
			env.ingestDevice._id,
			env.ingestDevice.token,
			[
				{
					id: workStatusId1,
					type: 'update',
					status: {
						status: ExpectedPackageStatusAPI.WorkStatusState.FULFILLED,
						statusReason: { user: 'Done', tech: 'Transfer completed' },
						statusChanged: 20,
						priority: 1,
						label: 'Copy package',
						description: 'Copies package to destination',
						fromPackages: baseStatus.fromPackages,
					},
				},
			]
		)

		const updated = await ExpectedPackageWorkStatuses.findOneAsync(workStatusId1)
		expect(updated?.status).toBe(ExpectedPackageStatusAPI.WorkStatusState.FULFILLED)
		expect(updated?.modified).toBeGreaterThan(0)

		await PackageManagerIntegration.removeAllExpectedPackageWorkStatusOfDeviceNotInList(
			context,
			env.ingestDevice._id,
			env.ingestDevice.token,
			[workStatusId1]
		)

		const remaining = await ExpectedPackageWorkStatuses.findFetchAsync({})
		expect(remaining.map((status) => status._id)).toEqual([workStatusId1])
	})

	test('updates package container statuses and metadata', async () => {
		const packageId = protectString('expectedPackage_2')
		const containerId = 'container-a'
		const packageInfoType = PackageInfo.Type.JSON
		const packageContainerPackageId = getPackageContainerPackageId(env.studio._id, containerId, packageId)
		const packageContainerId = getPackageContainerId(env.studio._id, containerId)

		await PackageManagerIntegration.updatePackageContainerPackageStatuses(
			context,
			env.ingestDevice._id,
			env.ingestDevice.token,
			[
				{
					containerId,
					packageId: String(packageId),
					type: 'update',
					status: {
						status: 'ready',
						isPlaceholder: false,
						contentVersionHash: 'content-hash',
						progress: 1,
						expectedLeft: 0,
						statusReason: { user: 'Ready', tech: 'Ready' },
					} as any,
				},
			]
		)

		const savedPackageStatus = await PackageContainerPackageStatuses.findOneAsync(packageContainerPackageId)
		expect(savedPackageStatus?.containerId).toBe(containerId)
		expect(savedPackageStatus?.packageId).toBe(packageId)
		expect(savedPackageStatus?.status.status).toBe('ready')

		await PackageManagerIntegration.updatePackageContainerStatuses(
			context,
			env.ingestDevice._id,
			env.ingestDevice.token,
			[
				{
					containerId,
					type: 'update',
					status: {
						status: StatusCode.GOOD,
						statusReason: { user: 'Healthy', tech: 'All good' },
						statusChanged: 123,
						monitors: {},
					} as any,
				},
			]
		)

		const savedContainerStatus = await PackageContainerStatuses.findOneAsync(packageContainerId)
		expect(savedContainerStatus?.containerId).toBe(containerId)
		expect(savedContainerStatus?.status.status).toBe(StatusCode.GOOD)

		await PackageManagerIntegration.updatePackageInfo(
			context,
			env.ingestDevice._id,
			env.ingestDevice.token,
			packageInfoType,
			packageId,
			'expected-hash',
			'actual-hash',
			{ foo: 'bar' }
		)

		const metadata = await PackageManagerIntegration.fetchPackageInfoMetadata(
			context,
			env.ingestDevice._id,
			env.ingestDevice.token,
			packageInfoType,
			[packageId]
		)

		expect(metadata).toEqual([
			{
				packageId,
				expectedContentVersionHash: 'expected-hash',
				actualContentVersionHash: 'actual-hash',
			},
		])

		await PackageManagerIntegration.removePackageInfo(
			context,
			env.ingestDevice._id,
			env.ingestDevice.token,
			packageInfoType,
			packageId
		)

		expect(await PackageInfos.findOneAsync(getPackageInfoId(packageId, packageInfoType))).toBeUndefined()
	})
})
