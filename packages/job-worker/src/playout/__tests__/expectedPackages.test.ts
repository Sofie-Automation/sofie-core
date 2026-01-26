import {
	ExpectedPackageId,
	PieceInstanceId,
	RundownId,
	RundownPlaylistId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString, protectStringArray } from '@sofie-automation/corelib/dist/protectedString'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { setupDefaultRundownPlaylist, setupMockShowStyleCompound } from '../../__mocks__/presetCollections.js'
import { handleCleanupOrphanedExpectedPackageReferences } from '../expectedPackages.js'
import { ExpectedPackageDB, ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { getCurrentTime } from '../../lib/index.js'

describe('handleCleanupOrphanedExpectedPackageReferences', () => {
	let context: MockJobContext
	let rundownId: RundownId
	let playlistId: RundownPlaylistId

	beforeEach(async () => {
		context = setupDefaultJobEnvironment()

		// Setup showstyle so we can create a rundown
		await setupMockShowStyleCompound(context)
		const result = await setupDefaultRundownPlaylist(context)
		rundownId = result.rundownId
		playlistId = result.playlistId
	})

	function createMockExpectedPackage(
		id: string,
		pieceInstanceIds: string[],
		ingestSourceCount: number = 0
	): ExpectedPackageDB {
		const ingestSources = []
		for (let i = 0; i < ingestSourceCount; i++) {
			ingestSources.push({
				fromPieceType: ExpectedPackageDBType.PIECE,
				blueprintPackageId: `blueprint_${id}_${i}`,
				listenToPackageInfoUpdates: false,
				pieceId: protectString(`piece_${id}_${i}`),
				partId: protectString(`part_${id}_${i}`),
				segmentId: protectString(`segment_${id}_${i}`),
			})
		}

		return {
			_id: protectString<ExpectedPackageId>(id),
			studioId: context.studioId,
			rundownId: rundownId,
			bucketId: null,
			created: getCurrentTime(),
			package: {
				_id: id,
				contentVersionHash: 'hash1',
				type: 'media_file' as any,
				content: {},
				version: {},
				sources: [],
				layers: [],
				sideEffect: {},
			},
			ingestSources: ingestSources as ExpectedPackageDB['ingestSources'],
			playoutSources: {
				pieceInstanceIds: protectStringArray(pieceInstanceIds),
			},
		}
	}

	function createMockPieceInstance(
		id: string,
		neededPackageIds: string[] = [],
		reset: boolean = false
	): Partial<PieceInstance> {
		return {
			_id: protectString<PieceInstanceId>(id),
			rundownId: rundownId,
			partInstanceId: protectString('partInstance_0'),
			playlistActivationId: protectString('activation_0'),
			reset: reset,
			neededExpectedPackageIds: protectStringArray(neededPackageIds),
			piece: {
				_id: protectString(`piece_${id}`),
				startPartId: protectString('part_0'),
				externalId: `MOCK_PIECE_${id}`,
				name: `Piece ${id}`,
				lifespan: 'WithinPart' as any,
				invalid: false,
				enable: { start: 0 },
				sourceLayerId: 'source0',
				outputLayerId: 'output0',
				content: {},
				timelineObjectsString: '' as any,
				pieceType: 'Normal' as any,
			},
		}
	}

	test('does nothing when there are no expected packages', async () => {
		await handleCleanupOrphanedExpectedPackageReferences(context, {
			playlistId: playlistId,
			rundownId: rundownId,
		})

		// Verify the operations performed on ExpectedPackages
		const ops = context.mockCollections.ExpectedPackages.operations
		expect(ops[0].type).toBe('findFetch')
		expect(ops.slice(1)).toEqual([])
	})

	test('does nothing when all package references are valid', async () => {
		// Create piece instances that reference expected packages
		await context.mockCollections.PieceInstances.insertOne(
			createMockPieceInstance('pieceInstance1', ['package1']) as any
		)
		await context.mockCollections.PieceInstances.insertOne(
			createMockPieceInstance('pieceInstance2', ['package2']) as any
		)

		// Create expected packages that are referenced by valid piece instances
		await context.mockCollections.ExpectedPackages.insertOne(
			createMockExpectedPackage('package1', ['pieceInstance1'])
		)
		await context.mockCollections.ExpectedPackages.insertOne(
			createMockExpectedPackage('package2', ['pieceInstance2'])
		)

		// Clear operations from setup
		context.mockCollections.ExpectedPackages.clearOpLog()

		await handleCleanupOrphanedExpectedPackageReferences(context, {
			playlistId: playlistId,
			rundownId: rundownId,
		})

		// Verify the operations performed on ExpectedPackages (only read, no writes)
		const ops = context.mockCollections.ExpectedPackages.operations
		expect(ops[0].type).toBe('findFetch')
		expect(ops.slice(1)).toEqual([])

		// Verify packages remain unchanged
		const packages = await context.directCollections.ExpectedPackages.findFetch({})
		expect(packages).toHaveLength(2)
		expect(packages.find((p) => p._id === protectString('package1'))?.playoutSources.pieceInstanceIds).toEqual([
			protectString('pieceInstance1'),
		])
		expect(packages.find((p) => p._id === protectString('package2'))?.playoutSources.pieceInstanceIds).toEqual([
			protectString('pieceInstance2'),
		])
	})

	test('removes orphaned package reference when piece instance no longer exists', async () => {
		// Create expected package that references a piece instance that doesn't exist
		await context.mockCollections.ExpectedPackages.insertOne(
			createMockExpectedPackage('package1', ['nonExistentPieceInstance'], 1) // has ingest source
		)

		// Clear operations from setup
		context.mockCollections.ExpectedPackages.clearOpLog()

		await handleCleanupOrphanedExpectedPackageReferences(context, {
			playlistId: playlistId,
			rundownId: rundownId,
		})

		// Verify the operations performed on ExpectedPackages
		const ops = context.mockCollections.ExpectedPackages.operations
		expect(ops[0].type).toBe('findFetch')
		expect(ops.slice(1)).toEqual([
			{ type: 'bulkWrite', args: [1] },
			{ type: 'update', args: [{ _id: 'package1' }, { $set: { 'playoutSources.pieceInstanceIds': [] } }] },
		])
	})

	test('deletes package when all references are orphaned and no ingest sources', async () => {
		// Create expected package with no ingest sources and orphaned piece instance
		await context.mockCollections.ExpectedPackages.insertOne(
			createMockExpectedPackage('package1', ['nonExistentPieceInstance'], 0) // no ingest sources
		)

		// Clear operations from setup
		context.mockCollections.ExpectedPackages.clearOpLog()

		await handleCleanupOrphanedExpectedPackageReferences(context, {
			playlistId: playlistId,
			rundownId: rundownId,
		})

		// Verify the operations performed on ExpectedPackages
		const ops = context.mockCollections.ExpectedPackages.operations
		expect(ops[0].type).toBe('findFetch')
		expect(ops.slice(1)).toEqual([
			{ type: 'bulkWrite', args: [1] },
			{ type: 'removeOne', args: [{ _id: 'package1' }] },
		])
	})

	test('removes only orphaned references when partial removal is needed', async () => {
		// Create a valid piece instance
		await context.mockCollections.PieceInstances.insertOne(
			createMockPieceInstance('validPieceInstance', ['package1']) as any
		)

		// Create expected package that references both valid and invalid piece instances
		await context.mockCollections.ExpectedPackages.insertOne(
			createMockExpectedPackage('package1', ['validPieceInstance', 'orphanedPieceInstance'])
		)

		// Clear operations from setup
		context.mockCollections.ExpectedPackages.clearOpLog()

		await handleCleanupOrphanedExpectedPackageReferences(context, {
			playlistId: playlistId,
			rundownId: rundownId,
		})

		// Verify the operations performed on ExpectedPackages
		const ops = context.mockCollections.ExpectedPackages.operations
		expect(ops[0].type).toBe('findFetch')
		expect(ops.slice(1)).toEqual([
			{ type: 'bulkWrite', args: [1] },
			{
				type: 'update',
				args: [
					{ _id: 'package1' },
					{ $pull: { 'playoutSources.pieceInstanceIds': { $in: ['orphanedPieceInstance'] } } },
				],
			},
		])

		// Verify the result - only valid reference remains
		const packages = await context.directCollections.ExpectedPackages.findFetch({})
		expect(packages).toHaveLength(1)
		expect(packages[0].playoutSources.pieceInstanceIds).toEqual([protectString('validPieceInstance')])
	})

	test('removes reference when piece instance exists but does not reference the package', async () => {
		// Create piece instance that references a different package
		await context.mockCollections.PieceInstances.insertOne(
			createMockPieceInstance('pieceInstance1', ['differentPackage']) as any
		)

		// Create expected package that references the piece instance, but piece instance doesn't reference it back
		await context.mockCollections.ExpectedPackages.insertOne(
			createMockExpectedPackage('package1', ['pieceInstance1'], 1) // has ingest source
		)

		// Clear operations from setup
		context.mockCollections.ExpectedPackages.clearOpLog()

		await handleCleanupOrphanedExpectedPackageReferences(context, {
			playlistId: playlistId,
			rundownId: rundownId,
		})

		// Verify the operations performed on ExpectedPackages
		const ops = context.mockCollections.ExpectedPackages.operations
		expect(ops[0].type).toBe('findFetch')
		expect(ops.slice(1)).toEqual([
			{ type: 'bulkWrite', args: [1] },
			{ type: 'update', args: [{ _id: 'package1' }, { $set: { 'playoutSources.pieceInstanceIds': [] } }] },
		])
	})

	test('deletes package when reset piece instance references the package', async () => {
		// Create a reset piece instance
		await context.mockCollections.PieceInstances.insertOne(
			createMockPieceInstance('resetPieceInstance', ['package1'], true) as any
		)

		// Create expected package that references the reset piece instance
		await context.mockCollections.ExpectedPackages.insertOne(
			createMockExpectedPackage('package1', ['resetPieceInstance'], 0) // no ingest sources
		)

		// Clear operations from setup
		context.mockCollections.ExpectedPackages.clearOpLog()

		await handleCleanupOrphanedExpectedPackageReferences(context, {
			playlistId: playlistId,
			rundownId: rundownId,
		})

		// Verify the operations performed on ExpectedPackages
		const ops = context.mockCollections.ExpectedPackages.operations
		expect(ops[0].type).toBe('findFetch')
		expect(ops.slice(1)).toEqual([
			{ type: 'bulkWrite', args: [1] },
			{ type: 'removeOne', args: [{ _id: 'package1' }] },
		])
	})

	test('handles multiple packages with mixed scenarios', async () => {
		// Create valid piece instances
		await context.mockCollections.PieceInstances.insertOne(
			createMockPieceInstance('pieceInstance1', ['package1', 'package3']) as any
		)
		await context.mockCollections.PieceInstances.insertOne(
			createMockPieceInstance('pieceInstance2', ['package2']) as any
		)

		// Package1: valid reference, should be kept as-is
		await context.mockCollections.ExpectedPackages.insertOne(
			createMockExpectedPackage('package1', ['pieceInstance1'])
		)

		// Package2: valid reference, should be kept as-is
		await context.mockCollections.ExpectedPackages.insertOne(
			createMockExpectedPackage('package2', ['pieceInstance2'])
		)

		// Package3: valid + orphaned reference, should have orphaned removed
		await context.mockCollections.ExpectedPackages.insertOne(
			createMockExpectedPackage('package3', ['pieceInstance1', 'orphanedInstance'])
		)

		// Package4: all orphaned, no ingest sources, should be deleted
		await context.mockCollections.ExpectedPackages.insertOne(
			createMockExpectedPackage('package4', ['orphanedInstance1', 'orphanedInstance2'], 0)
		)

		// Package5: all orphaned, has ingest sources, should be kept with empty pieceInstanceIds
		await context.mockCollections.ExpectedPackages.insertOne(
			createMockExpectedPackage('package5', ['orphanedInstance3'], 1)
		)

		// Clear operations from setup
		context.mockCollections.ExpectedPackages.clearOpLog()

		await handleCleanupOrphanedExpectedPackageReferences(context, {
			playlistId: playlistId,
			rundownId: rundownId,
		})

		// Verify the operations performed on ExpectedPackages
		const ops = context.mockCollections.ExpectedPackages.operations
		expect(ops[0].type).toBe('findFetch')
		expect(ops.slice(1)).toEqual([
			{ type: 'bulkWrite', args: [3] },
			{
				type: 'update',
				args: [
					{ _id: 'package3' },
					{ $pull: { 'playoutSources.pieceInstanceIds': { $in: ['orphanedInstance'] } } },
				],
			},
			{ type: 'removeOne', args: [{ _id: 'package4' }] },
			{ type: 'update', args: [{ _id: 'package5' }, { $set: { 'playoutSources.pieceInstanceIds': [] } }] },
		])

		const packages = await context.directCollections.ExpectedPackages.findFetch({})
		expect(packages).toHaveLength(4) // package4 is deleted

		const package1Id = protectString<ExpectedPackageId>('package1')
		const package2Id = protectString<ExpectedPackageId>('package2')
		const package3Id = protectString<ExpectedPackageId>('package3')
		const package4Id = protectString<ExpectedPackageId>('package4')
		const package5Id = protectString<ExpectedPackageId>('package5')

		const package1 = packages.find((p) => p._id === package1Id)
		const package2 = packages.find((p) => p._id === package2Id)
		const package3 = packages.find((p) => p._id === package3Id)
		const package4 = packages.find((p) => p._id === package4Id)
		const package5 = packages.find((p) => p._id === package5Id)

		// Packages with only valid references should be unchanged
		expect(package1?.playoutSources.pieceInstanceIds).toEqual([protectString('pieceInstance1')])
		expect(package2?.playoutSources.pieceInstanceIds).toEqual([protectString('pieceInstance2')])
		// Package3 should have orphaned reference removed, valid one kept
		expect(package3?.playoutSources.pieceInstanceIds).toEqual([protectString('pieceInstance1')])
		// Package4 should be deleted
		expect(package4).toBeUndefined()
		// Package5 should have pieceInstanceIds cleared
		expect(package5?.playoutSources.pieceInstanceIds).toEqual([])
	})

	test('deletes rundown package when orphaned while keeping bucket and other rundown packages', async () => {
		const otherRundownId = protectString<RundownId>('otherRundown')

		// Create expected package for a different rundown (should not be affected)
		const otherRundownPackage = createMockExpectedPackage('packageOther', ['orphanedPieceInstance'])
		otherRundownPackage.rundownId = otherRundownId
		await context.mockCollections.ExpectedPackages.insertOne(otherRundownPackage)

		// Create expected package for current rundown with orphaned reference
		await context.mockCollections.ExpectedPackages.insertOne(
			createMockExpectedPackage('packageCurrent', ['orphanedPieceInstance'], 0)
		)

		// Clear operations from setup
		context.mockCollections.ExpectedPackages.clearOpLog()

		await handleCleanupOrphanedExpectedPackageReferences(context, {
			playlistId: playlistId,
			rundownId: rundownId,
		})

		// Verify the operations performed on ExpectedPackages
		const ops = context.mockCollections.ExpectedPackages.operations
		expect(ops[0].type).toBe('findFetch')
		expect(ops.slice(1)).toEqual([
			{ type: 'bulkWrite', args: [1] },
			{ type: 'removeOne', args: [{ _id: 'packageCurrent' }] },
		])

		const packages = await context.directCollections.ExpectedPackages.findFetch({})
		// packageCurrent is deleted, packageOther remains
		expect(packages).toHaveLength(1)

		const packageOther = packages.find((p) => p._id === protectString<ExpectedPackageId>('packageOther'))
		const packageCurrent = packages.find((p) => p._id === protectString<ExpectedPackageId>('packageCurrent'))

		// packageOther should be untouched (has different rundownId)
		expect(packageOther?.playoutSources.pieceInstanceIds).toEqual([protectString('orphanedPieceInstance')])
		// packageCurrent should be deleted
		expect(packageCurrent).toBeUndefined()
	})

	test('deletes rundown package when orphaned while keeping bucket packages', async () => {
		// Create a bucket package (should not be affected since it has bucketId set)
		const bucketPackage = createMockExpectedPackage('bucketPackage', ['orphanedPieceInstance'])
		bucketPackage.rundownId = null
		bucketPackage.bucketId = protectString('bucket1')
		await context.mockCollections.ExpectedPackages.insertOne(bucketPackage)

		// Create expected package for current rundown with orphaned reference
		await context.mockCollections.ExpectedPackages.insertOne(
			createMockExpectedPackage('rundownPackage', ['orphanedPieceInstance'], 0)
		)

		// Clear operations from setup
		context.mockCollections.ExpectedPackages.clearOpLog()

		await handleCleanupOrphanedExpectedPackageReferences(context, {
			playlistId: playlistId,
			rundownId: rundownId,
		})

		// Verify the operations performed on ExpectedPackages
		const ops = context.mockCollections.ExpectedPackages.operations
		expect(ops[0].type).toBe('findFetch')
		expect(ops.slice(1)).toEqual([
			{ type: 'bulkWrite', args: [1] },
			{ type: 'removeOne', args: [{ _id: 'rundownPackage' }] },
		])

		const packages = await context.directCollections.ExpectedPackages.findFetch({})
		// rundownPackage is deleted, bucketPackage remains
		expect(packages).toHaveLength(1)

		const bucketPkg = packages.find((p) => p._id === protectString<ExpectedPackageId>('bucketPackage'))
		const rundownPkg = packages.find((p) => p._id === protectString<ExpectedPackageId>('rundownPackage'))

		// bucketPackage should be untouched (has different bucketId, not matched by query)
		expect(bucketPkg?.playoutSources.pieceInstanceIds).toEqual([protectString('orphanedPieceInstance')])
		// rundownPackage should be deleted
		expect(rundownPkg).toBeUndefined()
	})

	test('handles package with no piece instance references', async () => {
		// Create expected package with no piece instance references
		await context.mockCollections.ExpectedPackages.insertOne(createMockExpectedPackage('package1', [], 1))

		// Clear operations from setup
		context.mockCollections.ExpectedPackages.clearOpLog()

		await handleCleanupOrphanedExpectedPackageReferences(context, {
			playlistId: playlistId,
			rundownId: rundownId,
		})

		// Verify the operations performed on ExpectedPackages
		// The function updates even if pieceInstanceIds is already empty
		const ops = context.mockCollections.ExpectedPackages.operations
		expect(ops[0].type).toBe('findFetch')
		expect(ops.slice(1)).toEqual([
			{ type: 'bulkWrite', args: [1] },
			{ type: 'update', args: [{ _id: 'package1' }, { $set: { 'playoutSources.pieceInstanceIds': [] } }] },
		])
	})

	test('handles piece instance with no neededExpectedPackageIds', async () => {
		// Create piece instance with no neededExpectedPackageIds
		const pieceInstance = createMockPieceInstance('pieceInstance1', [])
		delete pieceInstance.neededExpectedPackageIds
		await context.mockCollections.PieceInstances.insertOne(pieceInstance as any)

		// Create expected package that references this piece instance
		await context.mockCollections.ExpectedPackages.insertOne(
			createMockExpectedPackage('package1', ['pieceInstance1'], 1)
		)

		// Clear operations from setup
		context.mockCollections.ExpectedPackages.clearOpLog()

		await handleCleanupOrphanedExpectedPackageReferences(context, {
			playlistId: playlistId,
			rundownId: rundownId,
		})

		// Verify the operations performed on ExpectedPackages
		const ops = context.mockCollections.ExpectedPackages.operations
		expect(ops[0].type).toBe('findFetch')
		expect(ops.slice(1)).toEqual([
			{ type: 'bulkWrite', args: [1] },
			{ type: 'update', args: [{ _id: 'package1' }, { $set: { 'playoutSources.pieceInstanceIds': [] } }] },
		])
	})
})
