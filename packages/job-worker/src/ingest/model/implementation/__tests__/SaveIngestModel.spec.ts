import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import {
	ExpectedPackageDB,
	ExpectedPackageDBType,
	ExpectedPackageIngestSourcePiece,
	getExpectedPackageId,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { PartId, PieceId, PieceInstanceId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { setupDefaultJobEnvironment } from '../../../../__mocks__/context.js'
import { IngestExpectedPackage } from '../../IngestExpectedPackage.js'
import { writeExpectedPackagesChangesForRundown } from '../SaveIngestModel.js'

describe('SaveIngestModel', () => {
	describe('writeExpectedPackagesChangesForRundown', () => {
		const rundownId = protectString<RundownId>('rundown0')

		function createMockExpectedPackage(id: string): ExpectedPackage.ExpectedPackageMediaFile {
			return {
				_id: id,
				type: ExpectedPackage.PackageType.MEDIA_FILE,
				layers: ['layer0'],
				content: { filePath: `/media/${id}.mp4` },
				version: {},
				contentVersionHash: `hash_${id}`,
				sources: [],
				sideEffect: {},
			}
		}

		function createIngestExpectedPackage(
			pkg: ExpectedPackage.Base,
			pieceId: string,
			partId = 'part0',
			segmentId = 'segment0'
		): IngestExpectedPackage<ExpectedPackageIngestSourcePiece> {
			return {
				packageId: getExpectedPackageId(rundownId, pkg),
				package: pkg,
				source: {
					fromPieceType: ExpectedPackageDBType.PIECE,
					pieceId: protectString<PieceId>(pieceId),
					partId: protectString<PartId>(partId),
					segmentId: protectString<SegmentId>(segmentId),
					blueprintPackageId: pkg._id,
					listenToPackageInfoUpdates: false,
				},
			}
		}

		async function createExistingPackage(
			context: ReturnType<typeof setupDefaultJobEnvironment>,
			pkg: ExpectedPackage.Base,
			options?: {
				rundownId?: RundownId
				ingestSource?: {
					pieceId: string
					partId?: string
					segmentId?: string
				}
				playoutInstanceIds?: PieceInstanceId[]
				created?: number
			}
		): Promise<ExpectedPackageDB> {
			const packageId = getExpectedPackageId(options?.rundownId ?? rundownId, pkg)
			const doc: ExpectedPackageDB = {
				_id: packageId,
				studioId: context.studioId,
				rundownId: options?.rundownId ?? rundownId,
				bucketId: null,
				created: options?.created ?? Date.now(),
				package: pkg,
				ingestSources: options?.ingestSource
					? [
							{
								fromPieceType: ExpectedPackageDBType.PIECE,
								pieceId: protectString<PieceId>(options.ingestSource.pieceId),
								partId: protectString<PartId>(options.ingestSource.partId ?? 'part0'),
								segmentId: protectString<SegmentId>(options.ingestSource.segmentId ?? 'segment0'),
								blueprintPackageId: pkg._id,
								listenToPackageInfoUpdates: false,
							},
						]
					: [],
				playoutSources: {
					pieceInstanceIds: options?.playoutInstanceIds ?? [],
				},
			}
			await context.directCollections.ExpectedPackages.insertOne(doc)
			return doc
		}

		it('no documents to save and no existing packages', async () => {
			const context = setupDefaultJobEnvironment()

			await writeExpectedPackagesChangesForRundown(context, rundownId, [])

			// Should only findFetch, no bulkWrite needed
			expect(context.mockCollections.ExpectedPackages.operations).toHaveLength(1)
			expect(context.mockCollections.ExpectedPackages.operations[0].type).toBe('findFetch')
		})

		it('inserts new ExpectedPackage when none exist', async () => {
			const context = setupDefaultJobEnvironment()

			const expectedPkg = createMockExpectedPackage('pkg0')
			const ingestPackage = createIngestExpectedPackage(expectedPkg, 'piece0')

			await writeExpectedPackagesChangesForRundown(context, rundownId, [ingestPackage])

			// Verify operations: findFetch + bulkWrite + insertOne
			expect(context.mockCollections.ExpectedPackages.operations).toHaveLength(3)
			expect(context.mockCollections.ExpectedPackages.operations[0].type).toBe('findFetch')
			expect(context.mockCollections.ExpectedPackages.operations[1].type).toBe('bulkWrite')
			expect(context.mockCollections.ExpectedPackages.operations[2].type).toBe('insertOne')

			// Verify the inserted package
			const insertedDoc = await context.directCollections.ExpectedPackages.findOne(ingestPackage.packageId)
			expect(insertedDoc).toMatchObject({
				_id: ingestPackage.packageId,
				studioId: context.studioId,
				rundownId: rundownId,
				bucketId: null,
				package: expectedPkg,
				ingestSources: [ingestPackage.source],
				playoutSources: {
					pieceInstanceIds: [],
				},
			} satisfies Omit<ExpectedPackageDB, 'created'>)
			expect(insertedDoc?.created).toBeGreaterThan(0)
		})

		it('updates existing ExpectedPackage ingestSources', async () => {
			const context = setupDefaultJobEnvironment()

			const expectedPkg = createMockExpectedPackage('pkg0')
			const packageId = getExpectedPackageId(rundownId, expectedPkg)
			const originalCreated = Date.now() - 10000

			// Pre-populate with existing package
			await createExistingPackage(context, expectedPkg, {
				created: originalCreated,
				ingestSource: { pieceId: 'oldPiece', partId: 'oldPart', segmentId: 'oldSegment' },
				playoutInstanceIds: [protectString<PieceInstanceId>('existingPieceInstance')],
			})
			context.mockCollections.ExpectedPackages.clearOpLog()

			// Create new ingest source
			const newIngestPackage = createIngestExpectedPackage(expectedPkg, 'newPiece', 'newPart', 'newSegment')

			await writeExpectedPackagesChangesForRundown(context, rundownId, [newIngestPackage])

			// Verify operations: findFetch + bulkWrite + update
			expect(context.mockCollections.ExpectedPackages.operations).toHaveLength(3)
			expect(context.mockCollections.ExpectedPackages.operations[0].type).toBe('findFetch')
			expect(context.mockCollections.ExpectedPackages.operations[1].type).toBe('bulkWrite')
			expect(context.mockCollections.ExpectedPackages.operations[2].type).toBe('update')

			// Verify the update
			const updatedDoc = await context.directCollections.ExpectedPackages.findOne(packageId)
			expect(updatedDoc?.ingestSources).toEqual([newIngestPackage.source])
			// Verify created timestamp was preserved
			expect(updatedDoc?.created).toBe(originalCreated)
			// Verify playoutSources were preserved
			expect(updatedDoc?.playoutSources.pieceInstanceIds).toHaveLength(1)
		})

		it('deletes ExpectedPackage when no longer referenced by ingest or playout', async () => {
			const context = setupDefaultJobEnvironment()

			const expectedPkg = createMockExpectedPackage('pkg0')
			const packageId = getExpectedPackageId(rundownId, expectedPkg)

			// Pre-populate with existing package (no playout references)
			await createExistingPackage(context, expectedPkg, {
				ingestSource: { pieceId: 'piece0' },
			})
			context.mockCollections.ExpectedPackages.clearOpLog()

			// Call with empty documentsToSave
			await writeExpectedPackagesChangesForRundown(context, rundownId, [])

			// Verify operations: findFetch + bulkWrite + remove
			expect(context.mockCollections.ExpectedPackages.operations).toHaveLength(3)
			expect(context.mockCollections.ExpectedPackages.operations[0].type).toBe('findFetch')
			expect(context.mockCollections.ExpectedPackages.operations[1].type).toBe('bulkWrite')
			expect(context.mockCollections.ExpectedPackages.operations[2].type).toBe('remove')

			// Verify it was deleted
			expect(await context.directCollections.ExpectedPackages.findOne(packageId)).toBeUndefined()
		})

		it('clears ingestSources but preserves package when still referenced by playout', async () => {
			const context = setupDefaultJobEnvironment()

			const expectedPkg = createMockExpectedPackage('pkg0')
			const packageId = getExpectedPackageId(rundownId, expectedPkg)

			// Pre-populate with existing package that has playout references
			await createExistingPackage(context, expectedPkg, {
				ingestSource: { pieceId: 'piece0' },
				playoutInstanceIds: [protectString<PieceInstanceId>('pieceInstance0')],
			})
			context.mockCollections.ExpectedPackages.clearOpLog()

			// Call with empty documentsToSave
			await writeExpectedPackagesChangesForRundown(context, rundownId, [])

			// Verify operations: findFetch + bulkWrite + update
			expect(context.mockCollections.ExpectedPackages.operations).toHaveLength(3)
			expect(context.mockCollections.ExpectedPackages.operations[0].type).toBe('findFetch')
			expect(context.mockCollections.ExpectedPackages.operations[1].type).toBe('bulkWrite')
			expect(context.mockCollections.ExpectedPackages.operations[2].type).toBe('update')

			// Verify ingestSources were cleared but document still exists
			const updatedDoc = await context.directCollections.ExpectedPackages.findOne(packageId)
			expect(updatedDoc).toBeDefined()
			expect(updatedDoc?.ingestSources).toEqual([])
			expect(updatedDoc?.playoutSources.pieceInstanceIds).toHaveLength(1)
		})

		it('merges multiple ingest sources for the same package', async () => {
			const context = setupDefaultJobEnvironment()

			const expectedPkg = createMockExpectedPackage('sharedPkg')
			const packageId = getExpectedPackageId(rundownId, expectedPkg)

			// Create two sources for the same package
			const ingestPackage1 = createIngestExpectedPackage(expectedPkg, 'piece1', 'part1', 'segment1')
			const ingestPackage2 = createIngestExpectedPackage(expectedPkg, 'piece2', 'part2', 'segment2')

			await writeExpectedPackagesChangesForRundown(context, rundownId, [ingestPackage1, ingestPackage2])

			// Verify only one insert (sources should be merged)
			expect(context.mockCollections.ExpectedPackages.operations).toHaveLength(3)
			expect(context.mockCollections.ExpectedPackages.operations[0].type).toBe('findFetch')
			expect(context.mockCollections.ExpectedPackages.operations[1].type).toBe('bulkWrite')
			expect(context.mockCollections.ExpectedPackages.operations[1].args[0]).toBe(1) // 1 operation
			expect(context.mockCollections.ExpectedPackages.operations[2].type).toBe('insertOne')

			// Verify both sources are present
			const insertedDoc = await context.directCollections.ExpectedPackages.findOne(packageId)
			expect(insertedDoc?.ingestSources).toHaveLength(2)
			expect(insertedDoc?.ingestSources).toContainEqual(ingestPackage1.source)
			expect(insertedDoc?.ingestSources).toContainEqual(ingestPackage2.source)
		})

		it('handles mix of insert, update, delete, and clear operations', async () => {
			const context = setupDefaultJobEnvironment()

			const pkg1 = createMockExpectedPackage('pkg1') // Will be updated
			const pkg2 = createMockExpectedPackage('pkg2') // Will be deleted (no playout refs)
			const pkg3 = createMockExpectedPackage('pkg3') // Will have sources cleared (has playout refs)
			const pkg4 = createMockExpectedPackage('pkg4') // Will be inserted
			const packageId1 = getExpectedPackageId(rundownId, pkg1)
			const packageId2 = getExpectedPackageId(rundownId, pkg2)
			const packageId3 = getExpectedPackageId(rundownId, pkg3)
			const packageId4 = getExpectedPackageId(rundownId, pkg4)

			// Setup existing packages
			await createExistingPackage(context, pkg1, {
				ingestSource: { pieceId: 'oldPiece1', partId: 'oldPart1', segmentId: 'oldSegment1' },
			})
			await createExistingPackage(context, pkg2, {
				ingestSource: { pieceId: 'piece2', partId: 'part2', segmentId: 'segment2' },
			})
			await createExistingPackage(context, pkg3, {
				ingestSource: { pieceId: 'piece3', partId: 'part3', segmentId: 'segment3' },
				playoutInstanceIds: [protectString<PieceInstanceId>('pi3')],
			})
			context.mockCollections.ExpectedPackages.clearOpLog()

			// documentsToSave contains: updated pkg1 and new pkg4
			const ingestPackage1 = createIngestExpectedPackage(pkg1, 'newPiece1', 'newPart1', 'newSegment1')
			const ingestPackage4 = createIngestExpectedPackage(pkg4, 'piece4', 'part4', 'segment4')

			await writeExpectedPackagesChangesForRundown(context, rundownId, [ingestPackage1, ingestPackage4])

			// Verify final state
			// pkg1: updated
			const doc1 = await context.directCollections.ExpectedPackages.findOne(packageId1)
			expect(doc1).toBeDefined()
			expect((doc1?.ingestSources[0] as ExpectedPackageIngestSourcePiece).pieceId).toBe(
				protectString<PieceId>('newPiece1')
			)

			// pkg2: deleted
			const doc2 = await context.directCollections.ExpectedPackages.findOne(packageId2)
			expect(doc2).toBeUndefined()

			// pkg3: sources cleared but preserved
			const doc3 = await context.directCollections.ExpectedPackages.findOne(packageId3)
			expect(doc3).toBeDefined()
			expect(doc3?.ingestSources).toEqual([])
			expect(doc3?.playoutSources.pieceInstanceIds).toHaveLength(1)

			// pkg4: inserted
			const doc4 = await context.directCollections.ExpectedPackages.findOne(packageId4)
			expect(doc4).toBeDefined()
			expect(doc4?.package).toEqual(pkg4)
		})

		it('preserves playoutSources when updating ingestSources', async () => {
			const context = setupDefaultJobEnvironment()

			const expectedPkg = createMockExpectedPackage('pkg0')
			const packageId = getExpectedPackageId(rundownId, expectedPkg)

			// Pre-populate with package that has both ingest and playout sources
			await createExistingPackage(context, expectedPkg, {
				ingestSource: { pieceId: 'oldPiece', partId: 'oldPart', segmentId: 'oldSegment' },
				playoutInstanceIds: [
					protectString<PieceInstanceId>('pieceInstance1'),
					protectString<PieceInstanceId>('pieceInstance2'),
				],
			})
			context.mockCollections.ExpectedPackages.clearOpLog()

			// Update with new ingest source
			const newIngestPackage = createIngestExpectedPackage(expectedPkg, 'newPiece', 'newPart', 'newSegment')

			await writeExpectedPackagesChangesForRundown(context, rundownId, [newIngestPackage])

			// Verify playoutSources were preserved
			const updatedDoc = await context.directCollections.ExpectedPackages.findOne(packageId)
			expect(updatedDoc?.ingestSources).toEqual([newIngestPackage.source])
			expect(updatedDoc?.playoutSources.pieceInstanceIds).toHaveLength(2)
			expect(updatedDoc?.playoutSources.pieceInstanceIds).toContain(
				protectString<PieceInstanceId>('pieceInstance1')
			)
			expect(updatedDoc?.playoutSources.pieceInstanceIds).toContain(
				protectString<PieceInstanceId>('pieceInstance2')
			)
		})

		it('only affects packages for the specified rundown', async () => {
			const context = setupDefaultJobEnvironment()
			const otherRundownId = protectString<RundownId>('otherRundown')

			const pkg = createMockExpectedPackage('pkg0')
			const packageIdForRundown = getExpectedPackageId(rundownId, pkg)
			const packageIdForOtherRundown = getExpectedPackageId(otherRundownId, pkg)

			// Create packages in both rundowns
			await createExistingPackage(context, pkg, {
				ingestSource: { pieceId: 'piece0' },
			})
			await createExistingPackage(context, pkg, {
				rundownId: otherRundownId,
				ingestSource: { pieceId: 'piece0' },
			})
			context.mockCollections.ExpectedPackages.clearOpLog()

			// Delete all packages for rundownId by passing empty array
			await writeExpectedPackagesChangesForRundown(context, rundownId, [])

			// Verify package for rundownId was deleted
			expect(await context.directCollections.ExpectedPackages.findOne(packageIdForRundown)).toBeUndefined()

			// Verify package for otherRundownId still exists
			expect(await context.directCollections.ExpectedPackages.findOne(packageIdForOtherRundown)).toBeDefined()
		})
	})
})
