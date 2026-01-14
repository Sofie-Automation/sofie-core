import { setupDefaultJobEnvironment } from '../../../__mocks__/context.js'
import { WatchedPackagesHelper } from '../watchedPackages.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { ExpectedPackageDB, ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { PackageInfo } from '@sofie-automation/blueprints-integration'
import {
	ExpectedPackageId,
	RundownId,
	BucketId,
	PeripheralDeviceId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'

describe('WatchedPackagesHelper', () => {
	const mockDeviceId = protectString<PeripheralDeviceId>('device1')
	describe('empty', () => {
		it('creates an empty helper', () => {
			const context = setupDefaultJobEnvironment()
			const helper = WatchedPackagesHelper.empty(context)

			expect(helper.hasPackage(protectString('pkg1'))).toBe(false)
			expect(helper.getPackageInfo('pkg1')).toEqual([])
		})
	})

	describe('create', () => {
		it('creates helper with no matching packages', async () => {
			const context = setupDefaultJobEnvironment()

			const helper = await WatchedPackagesHelper.create(context, protectString<RundownId>('rundown1'), null, {
				fromPieceType: ExpectedPackageDBType.PIECE,
				pieceId: protectString('piece1'),
			})

			expect(helper.hasPackage(protectString('pkg1'))).toBe(false)
		})

		it('creates helper with packages from rundown', async () => {
			const context = setupDefaultJobEnvironment()
			const rundownId = protectString<RundownId>('rundown1')
			const packageId = protectString<ExpectedPackageId>('pkg1')

			// Add expected package to the database
			await context.mockCollections.ExpectedPackages.insertOne(
				literal<ExpectedPackageDB>({
					_id: packageId,
					studioId: context.studioId,
					rundownId: rundownId,
					bucketId: null,
					package: {
						_id: 'package1',
						listenToPackageInfoUpdates: true,
					} as any,
					ingestSources: [
						{ fromPieceType: ExpectedPackageDBType.PIECE, pieceId: protectString('piece1') } as any,
					],
					created: 1000,
				})
			)

			// Add package info
			await context.mockCollections.PackageInfos.insertOne(
				literal<PackageInfoDB>({
					_id: protectString('info1'),
					studioId: context.studioId,
					packageId: packageId,
					deviceId: mockDeviceId,
					type: PackageInfo.Type.SCAN,
					expectedContentVersionHash: 'abc123',
					actualContentVersionHash: 'abc123',
					payload: {} as any,
				})
			)

			const helper = await WatchedPackagesHelper.create(context, rundownId, null, {
				fromPieceType: ExpectedPackageDBType.PIECE,
				pieceId: protectString('piece1'),
			})

			expect(helper.hasPackage(packageId)).toBe(true)
			expect(helper.getPackageInfo('package1')).toHaveLength(1)
			expect(helper.getPackageInfo('package1')[0].type).toBe(PackageInfo.Type.SCAN)
		})

		it('creates helper with packages from bucket', async () => {
			const context = setupDefaultJobEnvironment()
			const bucketId = protectString<BucketId>('bucket1')
			const packageId = protectString<ExpectedPackageId>('pkg1')

			await context.mockCollections.ExpectedPackages.insertOne(
				literal<ExpectedPackageDB>({
					_id: packageId,
					studioId: context.studioId,
					rundownId: null,
					bucketId: bucketId,
					package: {
						_id: 'package1',
						listenToPackageInfoUpdates: true,
					} as any,
					ingestSources: [
						{ fromPieceType: ExpectedPackageDBType.PIECE, pieceId: protectString('piece1') } as any,
					],
					created: 1000,
				})
			)

			const helper = await WatchedPackagesHelper.create(context, null, bucketId, {
				fromPieceType: ExpectedPackageDBType.PIECE,
				pieceId: protectString('piece1'),
			})

			expect(helper.hasPackage(packageId)).toBe(true)
		})

		it('filters packages by ingest source', async () => {
			const context = setupDefaultJobEnvironment()
			const rundownId = protectString<RundownId>('rundown1')

			// Package with matching source
			await context.mockCollections.ExpectedPackages.insertOne(
				literal<ExpectedPackageDB>({
					_id: protectString('pkg1'),
					studioId: context.studioId,
					rundownId: rundownId,
					bucketId: null,
					package: { _id: 'package1', listenToPackageInfoUpdates: true } as any,
					ingestSources: [
						{ fromPieceType: ExpectedPackageDBType.PIECE, pieceId: protectString('piece1') } as any,
					],
					created: 1000,
				})
			)

			// Package with non-matching source
			await context.mockCollections.ExpectedPackages.insertOne(
				literal<ExpectedPackageDB>({
					_id: protectString('pkg2'),
					studioId: context.studioId,
					rundownId: rundownId,
					bucketId: null,
					package: { _id: 'package2', listenToPackageInfoUpdates: true } as any,
					ingestSources: [
						{ fromPieceType: ExpectedPackageDBType.PIECE, pieceId: protectString('piece2') } as any,
					],
					created: 1000,
				})
			)

			const helper = await WatchedPackagesHelper.create(context, rundownId, null, {
				fromPieceType: ExpectedPackageDBType.PIECE,
				pieceId: protectString('piece1'),
			})

			expect(helper.hasPackage(protectString('pkg1'))).toBe(true)
			expect(helper.hasPackage(protectString('pkg2'))).toBe(false)
		})

		it('splits packages with multiple ingest sources', async () => {
			const context = setupDefaultJobEnvironment()
			const rundownId = protectString<RundownId>('rundown1')
			const packageId = protectString<ExpectedPackageId>('pkg1')

			await context.mockCollections.ExpectedPackages.insertOne(
				literal<ExpectedPackageDB>({
					_id: packageId,
					studioId: context.studioId,
					rundownId: rundownId,
					bucketId: null,
					package: { _id: 'package1', listenToPackageInfoUpdates: true } as any,
					ingestSources: [
						{ fromPieceType: ExpectedPackageDBType.PIECE, pieceId: protectString('piece1') } as any,
						{ fromPieceType: ExpectedPackageDBType.PIECE, pieceId: protectString('piece2') } as any,
					] as any,
					created: 1000,
				})
			)

			// Should match both sources
			const helper1 = await WatchedPackagesHelper.create(context, rundownId, null, {
				fromPieceType: ExpectedPackageDBType.PIECE,
				pieceId: protectString('piece1'),
			})
			expect(helper1.hasPackage(packageId)).toBe(true)

			const helper2 = await WatchedPackagesHelper.create(context, rundownId, null, {
				fromPieceType: ExpectedPackageDBType.PIECE,
				pieceId: protectString('piece2'),
			})
			expect(helper2.hasPackage(packageId)).toBe(true)
		})
	})

	describe('filter', () => {
		it('filters packages based on predicate', async () => {
			const context = setupDefaultJobEnvironment()
			const rundownId = protectString<RundownId>('rundown1')

			// Add multiple packages
			await context.mockCollections.ExpectedPackages.insertOne(
				literal<ExpectedPackageDB>({
					_id: protectString('pkg1'),
					studioId: context.studioId,
					rundownId: rundownId,
					bucketId: null,
					package: { _id: 'package1', listenToPackageInfoUpdates: true } as any,
					ingestSources: [
						{ fromPieceType: ExpectedPackageDBType.PIECE, pieceId: protectString('piece1') } as any,
					],
					created: 1000,
				})
			)

			await context.mockCollections.ExpectedPackages.insertOne(
				literal<ExpectedPackageDB>({
					_id: protectString('pkg2'),
					studioId: context.studioId,
					rundownId: rundownId,
					bucketId: null,
					package: { _id: 'package2', listenToPackageInfoUpdates: true } as any,
					ingestSources: [
						{ fromPieceType: ExpectedPackageDBType.PIECE, pieceId: protectString('piece1') } as any,
					],
					created: 1000,
				})
			)

			const helper = await WatchedPackagesHelper.create(context, rundownId, null, {
				fromPieceType: ExpectedPackageDBType.PIECE,
				pieceId: protectString('piece1'),
			})

			// Filter to only keep pkg1
			const filtered = helper.filter(context, (pkg) => pkg._id === protectString('pkg1'))

			expect(filtered.hasPackage(protectString('pkg1'))).toBe(true)
			expect(filtered.hasPackage(protectString('pkg2'))).toBe(false)
		})

		it('filters package infos along with packages', async () => {
			const context = setupDefaultJobEnvironment()
			const rundownId = protectString<RundownId>('rundown1')

			await context.mockCollections.ExpectedPackages.insertOne(
				literal<ExpectedPackageDB>({
					_id: protectString('pkg1'),
					studioId: context.studioId,
					rundownId: rundownId,
					bucketId: null,
					package: { _id: 'package1', listenToPackageInfoUpdates: true } as any,
					ingestSources: [
						{ fromPieceType: ExpectedPackageDBType.PIECE, pieceId: protectString('piece1') } as any,
					],
					created: 1000,
				})
			)

			await context.mockCollections.ExpectedPackages.insertOne(
				literal<ExpectedPackageDB>({
					_id: protectString('pkg2'),
					studioId: context.studioId,
					rundownId: rundownId,
					bucketId: null,
					package: { _id: 'package2', listenToPackageInfoUpdates: true } as any,
					ingestSources: [
						{ fromPieceType: ExpectedPackageDBType.PIECE, pieceId: protectString('piece1') } as any,
					],
					created: 1000,
				})
			)

			await context.mockCollections.PackageInfos.insertOne(
				literal<PackageInfoDB>({
					_id: protectString('info1'),
					studioId: context.studioId,
					packageId: protectString('pkg1'),
					deviceId: mockDeviceId,
					type: PackageInfo.Type.SCAN,
					expectedContentVersionHash: 'abc123',
					actualContentVersionHash: 'abc123',
					payload: {} as any,
				})
			)

			await context.mockCollections.PackageInfos.insertOne(
				literal<PackageInfoDB>({
					_id: protectString('info2'),
					studioId: context.studioId,
					packageId: protectString('pkg2'),
					deviceId: mockDeviceId,
					type: PackageInfo.Type.SCAN,
					expectedContentVersionHash: 'def456',
					actualContentVersionHash: 'def456',
					payload: {} as any,
				})
			)

			const helper = await WatchedPackagesHelper.create(context, rundownId, null, {
				fromPieceType: ExpectedPackageDBType.PIECE,
				pieceId: protectString('piece1'),
			})

			const filtered = helper.filter(context, (pkg) => pkg._id === protectString('pkg1'))

			// Should only have info for pkg1
			expect(filtered.getPackageInfo('package1')).toHaveLength(1)
			expect(filtered.getPackageInfo('package2')).toHaveLength(0)
		})
	})

	describe('hasPackage', () => {
		it('returns true for existing package', async () => {
			const context = setupDefaultJobEnvironment()
			const rundownId = protectString<RundownId>('rundown1')
			const packageId = protectString<ExpectedPackageId>('pkg1')

			await context.mockCollections.ExpectedPackages.insertOne(
				literal<ExpectedPackageDB>({
					_id: packageId,
					studioId: context.studioId,
					rundownId: rundownId,
					bucketId: null,
					package: { _id: 'package1', listenToPackageInfoUpdates: true } as any,
					ingestSources: [
						{ fromPieceType: ExpectedPackageDBType.PIECE, pieceId: protectString('piece1') } as any,
					],
					created: 1000,
				})
			)

			const helper = await WatchedPackagesHelper.create(context, rundownId, null, {
				fromPieceType: ExpectedPackageDBType.PIECE,
				pieceId: protectString('piece1'),
			})

			expect(helper.hasPackage(packageId)).toBe(true)
		})

		it('returns false for non-existing package', async () => {
			const context = setupDefaultJobEnvironment()

			const helper = await WatchedPackagesHelper.create(context, protectString<RundownId>('rundown1'), null, {
				fromPieceType: ExpectedPackageDBType.PIECE,
				pieceId: protectString('piece1'),
			})

			expect(helper.hasPackage(protectString('nonexistent'))).toBe(false)
		})
	})

	describe('getPackageInfo', () => {
		it('returns empty array for unknown package', async () => {
			const context = setupDefaultJobEnvironment()

			const helper = await WatchedPackagesHelper.create(context, protectString<RundownId>('rundown1'), null, {
				fromPieceType: ExpectedPackageDBType.PIECE,
				pieceId: protectString('piece1'),
			})

			expect(helper.getPackageInfo('unknown')).toEqual([])
		})

		it('returns package info for known package', async () => {
			const context = setupDefaultJobEnvironment()
			const rundownId = protectString<RundownId>('rundown1')
			const packageId = protectString<ExpectedPackageId>('pkg1')

			await context.mockCollections.ExpectedPackages.insertOne(
				literal<ExpectedPackageDB>({
					_id: packageId,
					studioId: context.studioId,
					rundownId: rundownId,
					bucketId: null,
					package: { _id: 'package1', listenToPackageInfoUpdates: true } as any,
					ingestSources: [
						{ fromPieceType: ExpectedPackageDBType.PIECE, pieceId: protectString('piece1') } as any,
					],
					created: 1000,
				})
			)

			await context.mockCollections.PackageInfos.insertOne(
				literal<PackageInfoDB>({
					_id: protectString('info1'),
					studioId: context.studioId,
					packageId: packageId,
					deviceId: mockDeviceId,
					type: PackageInfo.Type.SCAN,
					expectedContentVersionHash: 'abc123',
					actualContentVersionHash: 'abc123',
					payload: {} as any,
				})
			)

			const helper = await WatchedPackagesHelper.create(context, rundownId, null, {
				fromPieceType: ExpectedPackageDBType.PIECE,
				pieceId: protectString('piece1'),
			})

			const infos = helper.getPackageInfo('package1')
			expect(infos).toHaveLength(1)
			expect(infos[0].type).toBe(PackageInfo.Type.SCAN)
		})

		it('returns multiple package infos for a package', async () => {
			const context = setupDefaultJobEnvironment()
			const rundownId = protectString<RundownId>('rundown1')
			const packageId = protectString<ExpectedPackageId>('pkg1')

			await context.mockCollections.ExpectedPackages.insertOne(
				literal<ExpectedPackageDB>({
					_id: packageId,
					studioId: context.studioId,
					rundownId: rundownId,
					bucketId: null,
					package: { _id: 'package1', listenToPackageInfoUpdates: true } as any,
					ingestSources: [
						{ fromPieceType: ExpectedPackageDBType.PIECE, pieceId: protectString('piece1') } as any,
					],
					created: 1000,
				})
			)

			await context.mockCollections.PackageInfos.insertOne(
				literal<PackageInfoDB>({
					_id: protectString('info1'),
					studioId: context.studioId,
					packageId: packageId,
					deviceId: mockDeviceId,
					type: PackageInfo.Type.SCAN,
					expectedContentVersionHash: 'abc123',
					actualContentVersionHash: 'abc123',
					payload: {} as any,
				})
			)

			await context.mockCollections.PackageInfos.insertOne(
				literal<PackageInfoDB>({
					_id: protectString('info2'),
					studioId: context.studioId,
					packageId: packageId,
					deviceId: mockDeviceId,
					type: PackageInfo.Type.DEEPSCAN,
					expectedContentVersionHash: 'abc123',
					actualContentVersionHash: 'abc123',
					payload: {} as any,
				})
			)

			const helper = await WatchedPackagesHelper.create(context, rundownId, null, {
				fromPieceType: ExpectedPackageDBType.PIECE,
				pieceId: protectString('piece1'),
			})

			const infos = helper.getPackageInfo('package1')
			expect(infos).toHaveLength(2)
			expect(infos.map((i) => i.type)).toContain(PackageInfo.Type.SCAN)
			expect(infos.map((i) => i.type)).toContain(PackageInfo.Type.DEEPSCAN)
		})

		it('returns empty array for package with no info', async () => {
			const context = setupDefaultJobEnvironment()
			const rundownId = protectString<RundownId>('rundown1')
			const packageId = protectString<ExpectedPackageId>('pkg1')

			await context.mockCollections.ExpectedPackages.insertOne(
				literal<ExpectedPackageDB>({
					_id: packageId,
					studioId: context.studioId,
					rundownId: rundownId,
					bucketId: null,
					package: { _id: 'package1', listenToPackageInfoUpdates: true } as any,
					ingestSources: [
						{ fromPieceType: ExpectedPackageDBType.PIECE, pieceId: protectString('piece1') } as any,
					],
					created: 1000,
				})
			)

			const helper = await WatchedPackagesHelper.create(context, rundownId, null, {
				fromPieceType: ExpectedPackageDBType.PIECE,
				pieceId: protectString('piece1'),
			})

			expect(helper.getPackageInfo('package1')).toEqual([])
		})
	})
})
