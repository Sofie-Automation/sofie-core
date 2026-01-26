import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PlayoutSegmentModelImpl } from '../PlayoutSegmentModelImpl.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PlayoutRundownModelImpl } from '../PlayoutRundownModelImpl.js'
import { setupDefaultJobEnvironment } from '../../../../__mocks__/context.js'
import {
	writePartInstancesAndPieceInstances,
	writeAdlibTestingSegments,
	writeExpectedPackagesForPlayoutSources,
} from '../SavePlayoutModel.js'
import { PlayoutPartInstanceModelImpl } from '../PlayoutPartInstanceModelImpl.js'
import {
	PartInstanceId,
	PieceInstanceId,
	RundownId,
	RundownPlaylistId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { mock } from 'jest-mock-extended'
import { QuickLoopService } from '../../services/QuickLoopService.js'
import { ExpectedPackageDB, getExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPackage } from '@sofie-automation/blueprints-integration'

describe('SavePlayoutModel', () => {
	function createRundownModel(segments?: DBSegment[]): PlayoutRundownModelImpl {
		const rundown: DBRundown = {
			_id: protectString('rd0'),
			studioId: protectString('studio0'),
			showStyleBaseId: protectString('ssb0'),
			showStyleVariantId: protectString('ssv0'),
			created: 0,
			modified: 0,
			externalId: 'rd0',
			name: `my rundown`,
			importVersions: null as any,
			timing: null as any,
			playlistId: protectString('playlist0'),
			source: {
				type: 'http',
			},
		}

		const segmentModels = (segments ?? []).map((s) => new PlayoutSegmentModelImpl(s, []))
		return new PlayoutRundownModelImpl(rundown, segmentModels, [])
	}

	describe('writeAdlibTestingSegments', () => {
		it('no rundowns', async () => {
			const context = setupDefaultJobEnvironment()

			await writeAdlibTestingSegments(context, [])

			expect(context.mockCollections.Segments.operations).toHaveLength(0)
		})

		it('no AdlibTesting segment', async () => {
			const context = setupDefaultJobEnvironment()

			const rundown0 = createRundownModel()
			const rundown1 = createRundownModel()
			rundown1.insertAdlibTestingSegment()
			rundown1.clearAdlibTestingSegmentChangedFlag()

			await writeAdlibTestingSegments(context, [rundown0, rundown1])

			expect(context.mockCollections.Segments.operations).toHaveLength(0)
		})

		it('AdlibTestings with changes', async () => {
			const context = setupDefaultJobEnvironment()

			// create a rundown with an inserted AdlibTesting segment
			const rundown0 = createRundownModel()
			rundown0.insertAdlibTestingSegment()

			// create a rundown with a removed AdlibTesting segment
			const rundown1 = createRundownModel()
			rundown1.insertAdlibTestingSegment()
			rundown1.clearAdlibTestingSegmentChangedFlag()
			rundown1.removeAdlibTestingSegment()

			// create a rundown with no changes
			const rundown2 = createRundownModel()
			rundown2.insertAdlibTestingSegment()
			rundown2.clearAdlibTestingSegmentChangedFlag()

			await writeAdlibTestingSegments(context, [rundown0, rundown1, rundown2])

			expect(context.mockCollections.Segments.operations).toMatchInlineSnapshot(`
			[
			  {
			    "args": [
			      3,
			    ],
			    "type": "bulkWrite",
			  },
			  {
			    "args": [
			      {
			        "_id": {
			          "$ne": "randomId9001",
			        },
			        "orphaned": "adlib-testing",
			        "rundownId": "rd0",
			      },
			    ],
			    "type": "remove",
			  },
			  {
			    "args": [
			      "randomId9001",
			    ],
			    "type": "replace",
			  },
			  {
			    "args": [
			      {
			        "_id": {
			          "$ne": "",
			        },
			        "orphaned": "adlib-testing",
			        "rundownId": "rd0",
			      },
			    ],
			    "type": "remove",
			  },
			]
		`)
		})
	})

	describe('writePartInstancesAndPieceInstances', () => {
		it('no PartInstances', async () => {
			const context = setupDefaultJobEnvironment()

			await Promise.all(writePartInstancesAndPieceInstances(context, new Map()))

			expect(context.mockCollections.PartInstances.operations).toHaveLength(0)
			expect(context.mockCollections.PieceInstances.operations).toHaveLength(0)
		})

		it('delete PartInstances', async () => {
			const context = setupDefaultJobEnvironment()

			const partInstances = new Map<PartInstanceId, PlayoutPartInstanceModelImpl | null>()
			partInstances.set(protectString('id0'), null)
			partInstances.set(protectString('id1'), null)

			await Promise.all(writePartInstancesAndPieceInstances(context, partInstances))

			expect(context.mockCollections.PartInstances.operations).toHaveLength(2)
			expect(context.mockCollections.PartInstances.operations).toMatchInlineSnapshot(`
			[
			  {
			    "args": [
			      1,
			    ],
			    "type": "bulkWrite",
			  },
			  {
			    "args": [
			      {
			        "_id": {
			          "$in": [
			            "id0",
			            "id1",
			          ],
			        },
			      },
			    ],
			    "type": "remove",
			  },
			]
		`)
			expect(context.mockCollections.PieceInstances.operations).toHaveLength(2)
			expect(context.mockCollections.PieceInstances.operations).toMatchInlineSnapshot(`
			[
			  {
			    "args": [
			      1,
			    ],
			    "type": "bulkWrite",
			  },
			  {
			    "args": [
			      {
			        "partInstanceId": {
			          "$in": [
			            "id0",
			            "id1",
			          ],
			        },
			      },
			    ],
			    "type": "remove",
			  },
			]
		`)
		})

		it('delete PieceInstances', async () => {
			const context = setupDefaultJobEnvironment()

			const pieceInstance = { _id: 'test0' } as unknown as PieceInstance
			const partInstanceModel = new PlayoutPartInstanceModelImpl(
				null as any,
				[pieceInstance],
				false,
				mock<QuickLoopService>()
			)
			expect(partInstanceModel.removePieceInstance(pieceInstance._id)).toBeTruthy()

			const partInstances = new Map<PartInstanceId, PlayoutPartInstanceModelImpl | null>()
			partInstances.set(protectString('id0'), partInstanceModel)

			await Promise.all(writePartInstancesAndPieceInstances(context, partInstances))

			expect(context.mockCollections.PartInstances.operations).toHaveLength(0)

			expect(context.mockCollections.PieceInstances.operations).toHaveLength(2)
			expect(context.mockCollections.PieceInstances.operations).toMatchInlineSnapshot(`
			[
			  {
			    "args": [
			      1,
			    ],
			    "type": "bulkWrite",
			  },
			  {
			    "args": [
			      {
			        "_id": {
			          "$in": [
			            "test0",
			          ],
			        },
			      },
			    ],
			    "type": "remove",
			  },
			]
		`)
		})

		it('update PartInstance', async () => {
			const context = setupDefaultJobEnvironment()

			const partInstanceModel = new PlayoutPartInstanceModelImpl(
				{ _id: 'id0' } as any,
				[],
				false,
				mock<QuickLoopService>()
			)
			expect(partInstanceModel.partInstance.blockTakeUntil).toBeUndefined()
			partInstanceModel.blockTakeUntil(10000)
			expect(partInstanceModel.partInstance.blockTakeUntil).toEqual(10000)

			const partInstances = new Map<PartInstanceId, PlayoutPartInstanceModelImpl | null>()
			partInstances.set(protectString('id0'), partInstanceModel)

			await Promise.all(writePartInstancesAndPieceInstances(context, partInstances))

			expect(context.mockCollections.PartInstances.operations).toHaveLength(2)
			expect(context.mockCollections.PartInstances.operations).toMatchInlineSnapshot(`
			[
			  {
			    "args": [
			      1,
			    ],
			    "type": "bulkWrite",
			  },
			  {
			    "args": [
			      "id0",
			    ],
			    "type": "replace",
			  },
			]
		`)
		})

		it('update PieceInstance', async () => {
			const context = setupDefaultJobEnvironment()

			const pieceInstance = { _id: 'test0' } as unknown as PieceInstance
			const partInstanceModel = new PlayoutPartInstanceModelImpl(
				null as any,
				[pieceInstance],
				false,
				mock<QuickLoopService>()
			)
			expect(
				partInstanceModel.mergeOrInsertPieceInstance({
					...pieceInstance,
					adLibSourceId: protectString('adlib0'),
				})
			).toBeTruthy()

			const partInstances = new Map<PartInstanceId, PlayoutPartInstanceModelImpl | null>()
			partInstances.set(protectString('id0'), partInstanceModel)

			await Promise.all(writePartInstancesAndPieceInstances(context, partInstances))

			expect(context.mockCollections.PartInstances.operations).toHaveLength(0)

			expect(context.mockCollections.PieceInstances.operations).toHaveLength(2)
			expect(context.mockCollections.PieceInstances.operations).toMatchInlineSnapshot(`
			[
			  {
			    "args": [
			      1,
			    ],
			    "type": "bulkWrite",
			  },
			  {
			    "args": [
			      "test0",
			    ],
			    "type": "replace",
			  },
			]
		`)
		})

		it('combination of all ops', async () => {
			const context = setupDefaultJobEnvironment()

			const pieceInstance = { _id: 'test0' } as unknown as PieceInstance
			const pieceInstance2 = { _id: 'test1' } as unknown as PieceInstance
			const partInstanceModel = new PlayoutPartInstanceModelImpl(
				{ _id: 'id0' } as any,
				[pieceInstance, pieceInstance2],
				false,
				mock<QuickLoopService>()
			)
			expect(
				partInstanceModel.mergeOrInsertPieceInstance({
					...pieceInstance,
					adLibSourceId: protectString('adlib0'),
				})
			).toBeTruthy()
			expect(partInstanceModel.removePieceInstance(pieceInstance2._id)).toBeTruthy()
			partInstanceModel.blockTakeUntil(10000)

			const partInstances = new Map<PartInstanceId, PlayoutPartInstanceModelImpl | null>()
			partInstances.set(protectString('id0'), partInstanceModel)
			partInstances.set(protectString('id1'), null)

			await Promise.all(writePartInstancesAndPieceInstances(context, partInstances))

			expect(context.mockCollections.PartInstances.operations).toHaveLength(3)
			expect(context.mockCollections.PartInstances.operations).toMatchInlineSnapshot(`
			[
			  {
			    "args": [
			      2,
			    ],
			    "type": "bulkWrite",
			  },
			  {
			    "args": [
			      "id0",
			    ],
			    "type": "replace",
			  },
			  {
			    "args": [
			      {
			        "_id": {
			          "$in": [
			            "id1",
			          ],
			        },
			      },
			    ],
			    "type": "remove",
			  },
			]
		`)

			expect(context.mockCollections.PieceInstances.operations).toHaveLength(4)
			expect(context.mockCollections.PieceInstances.operations).toMatchInlineSnapshot(`
			[
			  {
			    "args": [
			      3,
			    ],
			    "type": "bulkWrite",
			  },
			  {
			    "args": [
			      "test0",
			    ],
			    "type": "replace",
			  },
			  {
			    "args": [
			      {
			        "partInstanceId": {
			          "$in": [
			            "id1",
			          ],
			        },
			      },
			    ],
			    "type": "remove",
			  },
			  {
			    "args": [
			      {
			        "_id": {
			          "$in": [
			            "test1",
			          ],
			        },
			      },
			    ],
			    "type": "remove",
			  },
			]
		`)
		})
	})

	describe('writeExpectedPackagesForPlayoutSources', () => {
		const rundownId = protectString<RundownId>('rundown0')
		const playlistId = protectString<RundownPlaylistId>('playlist0')

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

		function createPartInstanceWithPieceInstances(
			partInstanceId: string,
			pieceInstances: PieceInstance[],
			hasExpectedPackageChanges: boolean
		): PlayoutPartInstanceModelImpl {
			const partInstanceModel = new PlayoutPartInstanceModelImpl(
				{ _id: partInstanceId, rundownId } as any,
				pieceInstances,
				hasExpectedPackageChanges,
				mock<QuickLoopService>()
			)
			return partInstanceModel
		}

		function createPieceInstanceWithExpectedPackages(
			pieceInstanceId: string,
			expectedPackages: ExpectedPackage.Base[]
		): PieceInstance {
			return {
				_id: protectString<PieceInstanceId>(pieceInstanceId),
				rundownId: rundownId,
				partInstanceId: protectString<PartInstanceId>('partInstance0'),
				piece: {
					_id: protectString(`piece_${pieceInstanceId}`),
					expectedPackages,
				},
			} as unknown as PieceInstance
		}

		it('no PartInstances', async () => {
			const context = setupDefaultJobEnvironment()

			await writeExpectedPackagesForPlayoutSources(context, playlistId, rundownId, [])

			expect(context.mockCollections.ExpectedPackages.operations).toHaveLength(1)
			expect(context.mockCollections.ExpectedPackages.operations[0].type).toBe('findFetch')
		})

		it('PieceInstance with no expected package changes', async () => {
			const context = setupDefaultJobEnvironment()

			const expectedPkg = createMockExpectedPackage('pkg0')
			const pieceInstance = createPieceInstanceWithExpectedPackages('pieceInstance0', [expectedPkg])
			// hasExpectedPackageChanges = false means no updatedExpectedPackages will be set
			const partInstance = createPartInstanceWithPieceInstances('partInstance0', [pieceInstance], false)

			await writeExpectedPackagesForPlayoutSources(context, playlistId, rundownId, [partInstance])

			expect(context.mockCollections.ExpectedPackages.operations).toHaveLength(1)
			expect(context.mockCollections.ExpectedPackages.operations[0].type).toBe('findFetch')
		})

		it('inserts new ExpectedPackage when PieceInstance has expected packages', async () => {
			const context = setupDefaultJobEnvironment()

			const expectedPkg = createMockExpectedPackage('pkg0')
			const pieceInstance = createPieceInstanceWithExpectedPackages('pieceInstance0', [expectedPkg])
			// hasExpectedPackageChanges = true sets up updatedExpectedPackages
			const partInstance = createPartInstanceWithPieceInstances('partInstance0', [pieceInstance], true)

			await writeExpectedPackagesForPlayoutSources(context, playlistId, rundownId, [partInstance])

			// Should have findFetch, bulkWrite, and insertOne (bulkWrite logs itself then calls insertOne which also logs)
			expect(context.mockCollections.ExpectedPackages.operations).toHaveLength(3)
			expect(context.mockCollections.ExpectedPackages.operations[0].type).toBe('findFetch')
			expect(context.mockCollections.ExpectedPackages.operations[1].type).toBe('bulkWrite')
			expect(context.mockCollections.ExpectedPackages.operations[1].args[0]).toBe(1) // 1 operation
			expect(context.mockCollections.ExpectedPackages.operations[2].type).toBe('insertOne')

			// Verify the inserted package has correct structure
			const insertedPackageId = context.mockCollections.ExpectedPackages.operations[2].args[0]
			const insertedPackage = await context.directCollections.ExpectedPackages.findOne(insertedPackageId)
			expect(insertedPackage).toMatchObject({
				_id: insertedPackageId,
				studioId: context.studioId,
				rundownId: rundownId,
				bucketId: null,
				package: expectedPkg,
				ingestSources: [],
				playoutSources: {
					pieceInstanceIds: [protectString<PieceInstanceId>('pieceInstance0')],
				},
			} satisfies Omit<ExpectedPackageDB, 'created'>)
			expect(insertedPackage?.created).toBeGreaterThan(0)
		})

		it('does not add pieceInstanceId if reference already exists in package', async () => {
			const context = setupDefaultJobEnvironment()

			const expectedPkg = createMockExpectedPackage('pkg0')
			const packageId = getExpectedPackageId(rundownId, expectedPkg)
			const pieceInstanceId = protectString<PieceInstanceId>('pieceInstance0')

			// Pre-populate with package that already has this pieceInstanceId
			const existingPackage: ExpectedPackageDB = {
				_id: packageId,
				studioId: context.studioId,
				rundownId: rundownId,
				bucketId: null,
				created: Date.now(),
				package: expectedPkg,
				ingestSources: [],
				playoutSources: {
					pieceInstanceIds: [pieceInstanceId],
				},
			}
			await context.directCollections.ExpectedPackages.insertOne(existingPackage)
			context.mockCollections.ExpectedPackages.clearOpLog()

			const pieceInstance = createPieceInstanceWithExpectedPackages('pieceInstance0', [expectedPkg])
			const partInstance = createPartInstanceWithPieceInstances('partInstance0', [pieceInstance], true)

			await writeExpectedPackagesForPlayoutSources(context, playlistId, rundownId, [partInstance])

			// Should only have findFetch, no bulkWrite since reference already exists
			expect(context.mockCollections.ExpectedPackages.operations).toHaveLength(1)
			expect(context.mockCollections.ExpectedPackages.operations[0].type).toBe('findFetch')
		})

		it('handles multiple PieceInstances with different packages', async () => {
			const context = setupDefaultJobEnvironment()

			const expectedPkg1 = createMockExpectedPackage('pkg1')
			const expectedPkg2 = createMockExpectedPackage('pkg2')

			const pieceInstance1 = createPieceInstanceWithExpectedPackages('pieceInstance1', [expectedPkg1])
			const pieceInstance2 = createPieceInstanceWithExpectedPackages('pieceInstance2', [expectedPkg2])

			const partInstance = createPartInstanceWithPieceInstances(
				'partInstance0',
				[pieceInstance1, pieceInstance2],
				true
			)

			await writeExpectedPackagesForPlayoutSources(context, playlistId, rundownId, [partInstance])

			// Should have findFetch, bulkWrite, and 2 insertOne ops
			expect(context.mockCollections.ExpectedPackages.operations).toHaveLength(4)
			expect(context.mockCollections.ExpectedPackages.operations[0].type).toBe('findFetch')
			expect(context.mockCollections.ExpectedPackages.operations[1].type).toBe('bulkWrite')
			expect(context.mockCollections.ExpectedPackages.operations[1].args[0]).toBe(2) // 2 operations
			expect(context.mockCollections.ExpectedPackages.operations[2].type).toBe('insertOne')
			expect(context.mockCollections.ExpectedPackages.operations[3].type).toBe('insertOne')
		})

		it('handles multiple PieceInstances referencing the same package', async () => {
			const context = setupDefaultJobEnvironment()

			const expectedPkg = createMockExpectedPackage('sharedPkg')

			const pieceInstance1 = createPieceInstanceWithExpectedPackages('pieceInstance1', [expectedPkg])
			const pieceInstance2 = createPieceInstanceWithExpectedPackages('pieceInstance2', [expectedPkg])

			const partInstance = createPartInstanceWithPieceInstances(
				'partInstance0',
				[pieceInstance1, pieceInstance2],
				true
			)

			await writeExpectedPackagesForPlayoutSources(context, playlistId, rundownId, [partInstance])

			// Should have findFetch, bulkWrite, and insertOne
			expect(context.mockCollections.ExpectedPackages.operations).toHaveLength(3)
			expect(context.mockCollections.ExpectedPackages.operations[0].type).toBe('findFetch')
			expect(context.mockCollections.ExpectedPackages.operations[1].type).toBe('bulkWrite')
			expect(context.mockCollections.ExpectedPackages.operations[1].args[0]).toBe(1) // Only 1 insert for the shared package
			expect(context.mockCollections.ExpectedPackages.operations[2].type).toBe('insertOne')

			// Verify the package has both pieceInstanceIds
			const insertedPackageId = context.mockCollections.ExpectedPackages.operations[2].args[0]
			const insertedPackage = await context.directCollections.ExpectedPackages.findOne(insertedPackageId)
			expect(insertedPackage?.playoutSources.pieceInstanceIds).toHaveLength(2)
			expect(insertedPackage?.playoutSources.pieceInstanceIds).toContain(
				protectString<PieceInstanceId>('pieceInstance1')
			)
			expect(insertedPackage?.playoutSources.pieceInstanceIds).toContain(
				protectString<PieceInstanceId>('pieceInstance2')
			)
		})

		it('handles multiple PartInstances', async () => {
			const context = setupDefaultJobEnvironment()

			const expectedPkg1 = createMockExpectedPackage('pkg1')
			const expectedPkg2 = createMockExpectedPackage('pkg2')

			const pieceInstance1 = createPieceInstanceWithExpectedPackages('pieceInstance1', [expectedPkg1])
			const pieceInstance2 = createPieceInstanceWithExpectedPackages('pieceInstance2', [expectedPkg2])

			const partInstance1 = createPartInstanceWithPieceInstances('partInstance1', [pieceInstance1], true)
			const partInstance2 = createPartInstanceWithPieceInstances('partInstance2', [pieceInstance2], true)

			await writeExpectedPackagesForPlayoutSources(context, playlistId, rundownId, [partInstance1, partInstance2])

			expect(context.mockCollections.ExpectedPackages.operations).toHaveLength(4)
			expect(context.mockCollections.ExpectedPackages.operations[0].type).toBe('findFetch')
			expect(context.mockCollections.ExpectedPackages.operations[1].type).toBe('bulkWrite')
			expect(context.mockCollections.ExpectedPackages.operations[1].args[0]).toBe(2) // 2 insert operations
			expect(context.mockCollections.ExpectedPackages.operations[2].type).toBe('insertOne')
			expect(context.mockCollections.ExpectedPackages.operations[3].type).toBe('insertOne')
		})

		it('handles deleted PieceInstance triggering cleanup job', async () => {
			const context = setupDefaultJobEnvironment()

			const partInstance = createPartInstanceWithPieceInstances('partInstance0', [], false)
			// Simulate a deleted pieceInstance by setting null in the map
			partInstance.pieceInstancesImpl.set(protectString<PieceInstanceId>('deletedPiece'), null)

			await writeExpectedPackagesForPlayoutSources(context, playlistId, rundownId, [partInstance])

			// No writes expected since there are no packages to insert/update
			// But the cleanup job should still be queued (which is handled silently in mock)
			expect(context.mockCollections.ExpectedPackages.operations).toHaveLength(1)
			expect(context.mockCollections.ExpectedPackages.operations[0].type).toBe('findFetch')
		})

		it('handles PieceInstance with multiple expected packages', async () => {
			const context = setupDefaultJobEnvironment()

			const expectedPkg1 = createMockExpectedPackage('pkg1')
			const expectedPkg2 = createMockExpectedPackage('pkg2')
			const expectedPkg3 = createMockExpectedPackage('pkg3')

			const pieceInstance = createPieceInstanceWithExpectedPackages('pieceInstance0', [
				expectedPkg1,
				expectedPkg2,
				expectedPkg3,
			])
			const partInstance = createPartInstanceWithPieceInstances('partInstance0', [pieceInstance], true)

			await writeExpectedPackagesForPlayoutSources(context, playlistId, rundownId, [partInstance])

			expect(context.mockCollections.ExpectedPackages.operations).toHaveLength(5)
			expect(context.mockCollections.ExpectedPackages.operations[0].type).toBe('findFetch')
			expect(context.mockCollections.ExpectedPackages.operations[1].type).toBe('bulkWrite')
			expect(context.mockCollections.ExpectedPackages.operations[1].args[0]).toBe(3) // 3 insert operations
			expect(context.mockCollections.ExpectedPackages.operations[2].type).toBe('insertOne')
			expect(context.mockCollections.ExpectedPackages.operations[3].type).toBe('insertOne')
			expect(context.mockCollections.ExpectedPackages.operations[4].type).toBe('insertOne')
		})
	})
})
