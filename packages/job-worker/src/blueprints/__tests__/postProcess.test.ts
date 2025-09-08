import _ from 'underscore'
import {
	postProcessAdLibPieces,
	postProcessPieces,
	postProcessRundownBaselineItems,
	postProcessStudioBaselineObjects,
} from '../postProcess.js'
import {
	IBlueprintAdLibPiece,
	IBlueprintPiece,
	PieceLifespan,
	TimelineObjectCoreExt,
	TSR,
	IBlueprintPieceType,
} from '@sofie-automation/blueprints-integration'
import { setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { clone, literal, omit } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { TimelineObjGeneric, TimelineObjType } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import {
	deserializePieceTimelineObjectsBlob,
	EmptyPieceTimelineObjectsBlob,
	Piece,
} from '@sofie-automation/corelib/dist/dataModel/Piece'

// Setup the mocks
import * as hashlib from '@sofie-automation/corelib/dist/hash'
const getHashOrig = hashlib.getHash
const getHashMock = jest.spyOn(hashlib, 'getHash')

describe('Test blueprint post-process', () => {
	afterEach(() => {
		getHashMock.mockReset()
		getHashMock.mockImplementation(getHashOrig)
	})

	function ensureAllKeysDefined<T>(template: T, objects: T[]) {
		const errs: string[] = []
		objects.forEach((obj, i) => {
			for (const key of Object.keys(template as any)) {
				const key2 = key as keyof T
				if (obj[key2] === undefined) {
					errs.push(`${i}.${String(key2)}`)
				}
			}
		})

		expect(errs).toEqual([])
	}

	describe('postProcessStudioBaselineObjects', () => {
		const context = setupDefaultJobEnvironment()
		test('no objects', () => {
			// Ensure that an empty array works ok
			const res = postProcessStudioBaselineObjects(context.studio.blueprintId, [])
			expect(res).toHaveLength(0)
		})

		test('some no ids', () => {
			const rawObjects = literal<TimelineObjectCoreExt<any>[]>([
				{
					id: 'testObj',
					enable: { while: 1 },
					layer: 'one',
					priority: 0,
					content: {
						deviceType: TSR.DeviceType.ABSTRACT,
					},
				},
				{
					id: '',
					enable: { while: 1 },
					layer: 'two',
					priority: 0,
					content: {
						deviceType: TSR.DeviceType.CASPARCG,
					},
				},
				{
					id: 'finalObj',
					enable: { while: 1 },
					layer: 'three',
					priority: 0,
					content: {
						deviceType: TSR.DeviceType.ATEM,
					},
				},
				{
					id: '',
					enable: { while: 1 },
					layer: 'four',
					priority: 0,
					content: {
						deviceType: TSR.DeviceType.HYPERDECK,
					},
				},
			])

			// TODO - mock getHash?

			const res = postProcessStudioBaselineObjects(context.studio.blueprintId, clone(rawObjects))

			// Nothing should have been overridden (yet)
			for (const obj of rawObjects) {
				// 'Hack' off the invalid fields to make the MatchObject pass
				// @ts-expect-error
				if (obj.id === '') delete obj.id
			}
			expect(res).toMatchObject(rawObjects)

			// Certain fields should be defined by simple rules
			expect(res.filter((r) => r.id === '')).toHaveLength(0)
			expect(res.filter((r) => r.objectType !== TimelineObjType.RUNDOWN)).toHaveLength(0)

			// Ensure no ids were duplicates
			const ids = res.map((obj) => obj.id)
			expect(ids).toHaveLength(_.uniq(ids).length)
		})
		test('duplicate ids', () => {
			const blueprintId = context.studio.blueprintId

			const rawObjects = literal<TimelineObjectCoreExt<any>[]>([
				{
					id: 'testObj',
					enable: { while: 1 },
					layer: 'one',
					priority: 0,
					content: {
						deviceType: TSR.DeviceType.ABSTRACT,
					},
				},
				{
					id: '',
					enable: { while: 1 },
					layer: 'two',
					priority: 0,
					content: {
						deviceType: TSR.DeviceType.CASPARCG,
					},
				},
				{
					id: 'testObj',
					enable: { while: 1 },
					layer: 'three',
					priority: 0,
					content: {
						deviceType: TSR.DeviceType.ATEM,
					},
				},
				{
					id: '',
					enable: { while: 1 },
					layer: 'four',
					priority: 0,
					content: {
						deviceType: TSR.DeviceType.HYPERDECK,
					},
				},
			])

			expect(() => postProcessStudioBaselineObjects(context.studio.blueprintId, clone(rawObjects))).toThrow(
				`Error in blueprint "${blueprintId}": ids of timelineObjs must be unique! ("testObj")`
			)
		})
	})

	describe('postProcessRundownBaselineItems', () => {
		test('no objects', async () => {
			// Ensure that an empty array works ok
			const res = postProcessRundownBaselineItems(protectString('some-blueprints'), [])
			expect(res).toHaveLength(0)
		})

		test('some no ids', () => {
			const rawObjects = literal<TimelineObjectCoreExt<any>[]>([
				{
					id: 'testObj',
					enable: { while: 1 },
					layer: 'one',
					content: {
						deviceType: TSR.DeviceType.ABSTRACT,
					},
					priority: 0,
				},
				{
					id: '',
					enable: { while: 1 },
					layer: 'two',
					content: {
						deviceType: TSR.DeviceType.CASPARCG,
					},
					priority: 0,
				},
				{
					id: 'finalObj',
					enable: { while: 1 },
					layer: 'three',
					content: {
						deviceType: TSR.DeviceType.ATEM,
					},
					priority: 0,
				},
				{
					id: '',
					enable: { while: 1 },
					layer: 'four',
					content: {
						deviceType: TSR.DeviceType.HYPERDECK,
					},
					priority: 0,
				},
			])

			// mock getHash, to track the returned ids
			const mockedIds = ['mocked1', 'mocked2']
			const expectedIds = _.compact(rawObjects.map((obj) => obj.id)).concat(mockedIds)
			getHashMock.mockImplementation(() => mockedIds.shift() ?? '')

			const res = postProcessRundownBaselineItems(protectString('some-blueprints'), clone(rawObjects))

			// Nothing should have been overridden (yet)
			for (const obj of rawObjects) {
				// 'Hack' off the invalid fields to make the MatchObject pass
				// @ts-expect-error
				if (obj.id === '') delete obj.id
			}
			expect(res).toMatchObject(rawObjects)

			// Certain fields should be defined by simple rules
			expect(res.filter((r) => r.id === '')).toHaveLength(0)
			expect(res.filter((r) => r.objectType !== TimelineObjType.RUNDOWN)).toHaveLength(0)

			// Ensure getHash was called as expected
			expect(getHashMock).toHaveBeenCalledTimes(2)
			expect(getHashMock).toHaveBeenNthCalledWith(1, 'baseline_1')
			expect(getHashMock).toHaveBeenNthCalledWith(2, 'baseline_3')

			// Ensure no ids were duplicates
			const ids = res.map((obj) => obj.id).sort((a, b) => a.localeCompare(b))
			expect(ids).toEqual(expectedIds.sort((a, b) => a.localeCompare(b)))

			// Ensure all required keys are defined
			const tmpObj = literal<TimelineObjGeneric>({
				id: '',
				layer: '',
				enable: { while: 1 },
				content: {} as any,
				objectType: TimelineObjType.RUNDOWN,
				priority: 0,
			})
			ensureAllKeysDefined(tmpObj, res)
		})

		test('duplicate ids', () => {
			const rawObjects = literal<TimelineObjectCoreExt<any>[]>([
				{
					id: 'testObj',
					enable: { while: 1 },
					layer: 'one',
					priority: 0,
					content: {
						deviceType: TSR.DeviceType.ABSTRACT,
					},
				},
				{
					id: '',
					enable: { while: 1 },
					layer: 'two',
					priority: 0,
					content: {
						deviceType: TSR.DeviceType.CASPARCG,
					},
				},
				{
					id: 'testObj',
					enable: { while: 1 },
					layer: 'three',
					priority: 0,
					content: {
						deviceType: TSR.DeviceType.ATEM,
					},
				},
				{
					id: '',
					enable: { while: 1 },
					layer: 'four',
					priority: 0,
					content: {
						deviceType: TSR.DeviceType.HYPERDECK,
					},
				},
			])

			const blueprintId = 'some-blueprints'
			expect(() => postProcessRundownBaselineItems(protectString(blueprintId), clone(rawObjects))).toThrow(
				`Error in blueprint "${blueprintId}": ids of timelineObjs must be unique! ("testObj")`
			)
		})
	})

	describe('postProcessAdLibPieces', () => {
		test('no pieces', () => {
			const jobContext = setupDefaultJobEnvironment()

			const blueprintId = protectString('blueprint0')
			const rundownId = protectString('rundown1')

			// Ensure that an empty array works ok
			const res = postProcessAdLibPieces(jobContext, blueprintId, rundownId, undefined, [])
			expect(res).toHaveLength(0)
		})

		test('various pieces', () => {
			const jobContext = setupDefaultJobEnvironment()

			const blueprintId = protectString('blueprint9')
			const rundownId = protectString('rundown1')

			const pieces = literal<Array<IBlueprintAdLibPiece>>([
				{
					_rank: 2,
					name: 'test',
					externalId: 'eid1',
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0',
					content: {
						timelineObjects: [],
					},
					lifespan: PieceLifespan.WithinPart,
				},
				{
					_rank: 1,
					name: 'test2',
					externalId: 'eid2',
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0',
					content: {
						timelineObjects: [],
					},
					lifespan: PieceLifespan.WithinPart,
				},
				{
					_rank: 9,
					name: 'test2',
					externalId: 'eid2',
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0',
					content: {
						timelineObjects: [],
					},
					lifespan: PieceLifespan.WithinPart,
				},
			])

			// mock getHash, to track the returned ids
			const mockedIds = ['mocked1', 'mocked2', 'mocked3']
			const expectedIds = clone(mockedIds)
			getHashMock.mockImplementation(() => mockedIds.shift() || '')

			const res = postProcessAdLibPieces(jobContext, blueprintId, rundownId, undefined, pieces)
			// expect(res).toHaveLength(3)
			expect(res).toMatchObject(
				pieces.map((p) => ({
					...p,
					content: {
						...omit(p.content, 'timelineObjects'),
					},
				}))
			)

			// Ensure all required keys are defined
			const tmpObj = literal<AdLibPiece>({
				_id: protectString(''),
				_rank: 0,
				name: '',
				externalId: '',
				sourceLayerId: '',
				outputLayerId: '',
				rundownId: protectString(''),
				content: {},
				timelineObjectsString: EmptyPieceTimelineObjectsBlob,
				lifespan: PieceLifespan.WithinPart,
			})
			ensureAllKeysDefined(tmpObj, res)

			// Ensure getHash was called as expected
			expect(getHashMock).toHaveBeenCalledTimes(3)
			expect(getHashMock).toHaveBeenNthCalledWith(1, 'rundown1_blueprint9_undefined_adlib_piece_sl0_eid1')
			expect(getHashMock).toHaveBeenNthCalledWith(2, 'rundown1_blueprint9_undefined_adlib_piece_sl0_eid2')
			expect(getHashMock).toHaveBeenNthCalledWith(3, 'rundown1_blueprint9_undefined_adlib_piece_sl0_eid2_0')

			// Ensure no ids were duplicates
			const ids = res.map((obj) => obj._id).sort((a, b) => a.toString().localeCompare(b.toString()))
			expect(ids).toEqual(expectedIds.sort((a, b) => a.localeCompare(b)))
		})

		test('piece with content', () => {
			const jobContext = setupDefaultJobEnvironment()

			const blueprintId = protectString('blueprint0')
			const rundownId = protectString('rundown1')

			const piece = literal<IBlueprintAdLibPiece>({
				_rank: 9,
				name: 'test2',
				externalId: 'eid2',
				sourceLayerId: 'sl0',
				outputLayerId: 'ol0',
				content: {
					timelineObjects: [
						literal<TimelineObjectCoreExt<any>>({
							id: '',
							enable: { while: 1 },
							layer: 'four',
							content: {
								deviceType: TSR.DeviceType.HYPERDECK,
							},
							priority: 0,
						}),
					],
				},
				lifespan: PieceLifespan.WithinPart,
			})

			const res = postProcessAdLibPieces(jobContext, blueprintId, rundownId, undefined, [piece])
			expect(res).toHaveLength(1)
			expect(res).toMatchObject([
				{
					...piece,
					content: omit(piece.content, 'timelineObjects'),
				},
			])

			const resObjects = deserializePieceTimelineObjectsBlob(res[0].timelineObjectsString)
			expect(resObjects[0].id).not.toEqual('')
		})
	})

	describe('postProcessPieces', () => {
		test('no pieces', () => {
			const jobContext = setupDefaultJobEnvironment()

			// Ensure that an empty array works ok
			const res = postProcessPieces(
				jobContext,
				[],
				protectString('blueprint9'),
				protectString('fakeRo'),
				protectString('segment5'),
				protectString('part8'),
				false
			)
			expect(res).toHaveLength(0)
		})

		test('various pieces', () => {
			const jobContext = setupDefaultJobEnvironment()

			const pieces = literal<Array<IBlueprintPiece>>([
				{
					name: 'test',
					externalId: 'eid1',
					enable: { start: 0 },
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0',
					content: {
						timelineObjects: [],
					},
					lifespan: PieceLifespan.OutOnSegmentEnd,
				},
				{
					name: 'test2',
					externalId: 'eid2',
					enable: { start: 0 },
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0',
					content: {
						timelineObjects: [],
					},
					lifespan: PieceLifespan.WithinPart,
				},
			])

			// mock getHash, to track the returned ids
			const mockedIds = ['mocked1', 'mocked2']
			const expectedIds = [...mockedIds]
			getHashMock.mockImplementation(() => mockedIds.shift() || '')

			const res = postProcessPieces(
				jobContext,
				pieces,
				protectString('blueprint9'),
				protectString('fakeRo'),
				protectString('segment5'),
				protectString('part8'),
				false
			)
			expect(res).toMatchObject(
				pieces.map((p) => ({
					...p,
					content: {
						...omit(p.content, 'timelineObjects'),
					},
				}))
			)

			// Ensure all required keys are defined
			const tmpObj = literal<Piece>({
				_id: protectString(''),
				name: '',
				externalId: '',
				enable: { start: 0 },
				sourceLayerId: '',
				outputLayerId: '',
				startPartId: protectString(''),
				startSegmentId: protectString(''),
				startRundownId: protectString(''),
				lifespan: PieceLifespan.WithinPart,
				pieceType: IBlueprintPieceType.Normal,
				content: {},
				timelineObjectsString: EmptyPieceTimelineObjectsBlob,
				invalid: false,
			})
			ensureAllKeysDefined(tmpObj, res)

			// Ensure getHash was called as expected
			expect(getHashMock).toHaveBeenCalledTimes(2)
			expect(getHashMock).toHaveBeenNthCalledWith(1, 'fakeRo_blueprint9_part8_piece_sl0_eid1')
			expect(getHashMock).toHaveBeenNthCalledWith(2, 'fakeRo_blueprint9_part8_piece_sl0_eid2')

			// Ensure no ids were duplicates
			const ids = res.map((obj) => obj._id).sort((a, b) => a.toString().localeCompare(b.toString()))
			expect(ids).toEqual(expectedIds.sort((a, b) => a.localeCompare(b)))
		})

		test('piece with content', () => {
			const jobContext = setupDefaultJobEnvironment()

			const piece = literal<IBlueprintPiece>({
				name: 'test2',
				externalId: 'eid2',
				enable: { start: 0 },
				sourceLayerId: 'sl0',
				outputLayerId: 'ol0',
				content: {
					timelineObjects: [
						literal<TimelineObjectCoreExt<any>>({
							id: '',
							enable: { while: 1 },
							layer: 'four',
							content: {
								deviceType: TSR.DeviceType.HYPERDECK,
							},
							priority: 0,
						}),
					],
				},
				lifespan: PieceLifespan.OutOnRundownEnd,
			})

			const res = postProcessPieces(
				jobContext,
				[piece],
				protectString('blueprint9'),
				protectString('fakeRo'),
				protectString('segment8'),
				protectString('part6'),
				false
			)
			expect(res).toHaveLength(1)
			expect(res).toMatchObject([
				{
					...piece,
					content: omit(piece.content, 'timelineObjects'),
				},
			])

			const resObjs = deserializePieceTimelineObjectsBlob(res[0].timelineObjectsString)
			expect(resObjs[0].id).not.toEqual('')
		})
		test('piece with bad Timeline', () => {
			const jobContext = setupDefaultJobEnvironment()

			const piece = literal<IBlueprintPiece>({
				name: 'test2',
				externalId: 'eid2',
				enable: { start: 0 },
				sourceLayerId: 'sl0',
				outputLayerId: 'ol0',
				content: {
					timelineObjects: [
						literal<TimelineObjectCoreExt<any>>({
							id: '',
							enable: { while: 1 },
							layer: 'four',
							classes: ['i-am-an-invalid-class'], // invalid since it contains "-"
							content: {
								deviceType: TSR.DeviceType.HYPERDECK,
							},
							priority: 0,
						}),
					],
				},
				lifespan: PieceLifespan.OutOnRundownEnd,
			})

			expect(() => {
				postProcessPieces(
					jobContext,
					[piece],
					protectString('blueprint9'),
					protectString('fakeRo'),
					protectString('segment8'),
					protectString('part6'),
					false
				)
				// Error in blueprint "blueprint9": Validation of timelineObjs failed:
				// Error: Object "IJ0Ud5lJhbIllA0_kWFIVz51eL4_": "classes[0]":
				// Error: Error in blueprint "blueprint9": Validation of timelineObjs failed: Error:  "classes[0]": Error: The string "i-am-an-invalid-class" contains characters which aren't allowed in Timeline: "-", "-", "-", "-" (is an operator)
			}).toThrow(/error in blueprint.*contains characters/i)
		})
	})
})
