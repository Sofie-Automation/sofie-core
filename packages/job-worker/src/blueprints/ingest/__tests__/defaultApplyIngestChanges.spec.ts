import { IngestRundownWithSource } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import { MutableIngestRundownImpl } from '../MutableIngestRundownImpl.js'
import { defaultApplyIngestChanges } from '../defaultApplyIngestChanges.js'
import {
	NrcsIngestChangeDetails,
	NrcsIngestPartChangeDetails,
	NrcsIngestRundownChangeDetails,
	NrcsIngestSegmentChangeDetailsEnum,
	IngestDefaultChangesOptions,
	IngestRundown,
	MutableIngestPart,
	MutableIngestRundown,
	MutableIngestSegment,
	IngestChangeType,
} from '@sofie-automation/blueprints-integration'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { toSofieIngestRundown } from './util.js'

describe('defaultApplyIngestChanges', () => {
	function createBasicIngestRundown(): IngestRundownWithSource {
		return {
			externalId: 'rd0',
			name: 'my rundown',
			type: 'mock',
			rundownSource: { type: 'http' },
			payload: {
				myData: 'data',
			},
			segments: [
				{
					externalId: 'seg0',
					rank: 0,
					name: 'my segment',
					payload: {
						segmentData: 'data',
					},
					parts: [
						{
							externalId: 'part0',
							rank: 0,
							name: 'my part',
							payload: {
								partData: 'data',
							},
						},
					],
				},
			],
		}
	}
	function createMediumIngestRundown(): IngestRundownWithSource {
		return {
			externalId: 'rd0',
			name: 'my rundown',
			type: 'mock',
			rundownSource: { type: 'http' },
			payload: {
				myData: 'data',
			},
			segments: [
				{
					externalId: 'seg0',
					rank: 0,
					name: 'my segment',
					payload: {
						segmentData: 'data',
					},
					parts: [
						{
							externalId: 'part0',
							rank: 0,
							name: 'my part',
							payload: {
								partData: 'data',
							},
						},
						{
							externalId: 'part1',
							rank: 1,
							name: 'my part',
							payload: {
								partData: 'data',
							},
						},
					],
				},
				{
					externalId: 'seg1',
					rank: 1,
					name: 'my segment',
					payload: {
						segmentData: 'data',
					},
					parts: [
						{
							externalId: 'part2',
							rank: 0,
							name: 'my part',
							payload: {
								partData: 'data',
							},
						},
					],
				},
				{
					externalId: 'seg2',
					rank: 2,
					name: 'my segment',
					payload: {
						segmentData: 'data',
					},
					parts: [
						{
							externalId: 'part3',
							rank: 0,
							name: 'my part',
							payload: {
								partData: 'data',
							},
						},
						{
							externalId: 'part4',
							rank: 1,
							name: 'my part',
							payload: {
								partData: 'data',
							},
						},
						{
							externalId: 'part5',
							rank: 1,
							name: 'my part',
							payload: {
								partData: 'data',
							},
						},
					],
				},
			],
		}
	}
	function createIngestRundownWithManySegments(): IngestRundownWithSource {
		return {
			externalId: 'rd0',
			name: 'my rundown',
			type: 'mock',
			rundownSource: { type: 'http' },
			payload: {
				myData: 'data',
			},
			segments: [
				{
					externalId: 'seg0',
					rank: 0,
					name: 'my segment',
					payload: {
						segmentData: 'data',
					},
					parts: [],
				},
				{
					externalId: 'seg1',
					rank: 1,
					name: 'my segment',
					payload: {
						segmentData: 'data',
					},
					parts: [],
				},
				{
					externalId: 'seg2',
					rank: 2,
					name: 'my segment',
					payload: {
						segmentData: 'data',
					},
					parts: [],
				},
				{
					externalId: 'seg3',
					rank: 3,
					name: 'my segment',
					payload: {
						segmentData: 'data',
					},
					parts: [],
				},
				{
					externalId: 'seg4',
					rank: 4,
					name: 'my segment',
					payload: {
						segmentData: 'data',
					},
					parts: [],
				},
			],
		}
	}

	/**
	 * This creates a MutableIngestRundownImpl from an IngestRundown, and wraps all methods to record the mutation calls made to the rundown and its contents
	 */
	function createMutableIngestRundown(nrcsRundown: IngestRundownWithSource) {
		const mutableIngestRundown = new MutableIngestRundownImpl(toSofieIngestRundown(nrcsRundown), true)

		const mockCalls: Array<{ target: string; name: string; args: any[] }> = []

		const defaultOptions: IngestDefaultChangesOptions<unknown, unknown, unknown> = {
			transformRundownPayload: jest.fn((payload, oldPayload) => {
				mockCalls.push({ target: 'options', name: 'transformRundownPayload', args: [!!oldPayload] })
				return payload
			}),
			transformSegmentPayload: jest.fn((payload, oldPayload) => {
				mockCalls.push({ target: 'options', name: 'transformSegmentPayload', args: [!!oldPayload] })
				return payload
			}),
			transformPartPayload: jest.fn((payload, oldPayload) => {
				mockCalls.push({ target: 'options', name: 'transformPartPayload', args: [!!oldPayload] })
				return payload
			}),
		}

		function wrapMethod<TObj, TName extends keyof TObj & string>(
			target: string,
			name: TName,
			obj: TObj,
			interceptReturn?: (val: ReturnType<any>) => ReturnType<any>
		) {
			const rawMethod = obj[name]
			if (typeof rawMethod !== 'function') throw new Error(`Cant wrap non-method ${name}`)
			const origMethod = rawMethod.bind(obj)

			const mockMethod = jest.fn((...args) => {
				mockCalls.push({ target, name, args })
				const returnVal = origMethod(...args)
				if (interceptReturn) {
					return interceptReturn(returnVal)
				} else {
					return returnVal
				}
			})
			obj[name] = mockMethod as any

			return mockMethod
		}

		function wrapPart(part: MutableIngestPart) {
			const target = `part ${part.externalId}`
			wrapMethod(target, 'setName', part)
			wrapMethod(target, 'replacePayload', part)
			wrapMethod(target, 'setPayloadProperty', part)
		}

		function wrapSegment(segment: MutableIngestSegment) {
			const target = `segment ${segment.externalId}`
			wrapMethod(target, 'movePartBefore', segment)
			wrapMethod(target, 'movePartAfter', segment)
			wrapMethod(target, 'replacePart', segment, (part: MutableIngestPart) => {
				wrapPart(part)
				return part
			})
			wrapMethod(target, 'removePart', segment)
			wrapMethod(target, 'setName', segment)
			wrapMethod(target, 'replacePayload', segment)
			wrapMethod(target, 'setPayloadProperty', segment)

			segment.parts.forEach(wrapPart)
		}

		wrapMethod('rundown', 'moveSegmentAfter', mutableIngestRundown)
		wrapMethod('rundown', 'moveSegmentBefore', mutableIngestRundown)
		wrapMethod('rundown', 'removeAllSegments', mutableIngestRundown)
		wrapMethod('rundown', 'replaceSegment', mutableIngestRundown, (segment: MutableIngestSegment) => {
			wrapSegment(segment)
			return segment
		})
		wrapMethod('rundown', 'changeSegmentExternalId', mutableIngestRundown)
		wrapMethod('rundown', 'changeSegmentOriginalExternalId', mutableIngestRundown)
		wrapMethod('rundown', 'removeSegment', mutableIngestRundown)
		wrapMethod('rundown', 'forceFullRegenerate', mutableIngestRundown)
		wrapMethod('rundown', 'setName', mutableIngestRundown)
		wrapMethod('rundown', 'replacePayload', mutableIngestRundown)
		wrapMethod('rundown', 'setPayloadProperty', mutableIngestRundown)

		mutableIngestRundown.segments.forEach(wrapSegment)

		return {
			mutableIngestRundown: mutableIngestRundown as MutableIngestRundown,
			defaultOptions,
			mockCalls,
		}
	}

	describe('rundown changes', () => {
		it('no changes', async () => {
			const nrcsRundown = createBasicIngestRundown()
			const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(clone(nrcsRundown))

			const changes: NrcsIngestChangeDetails = { source: IngestChangeType.Ingest }

			defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

			expect(mockCalls).toHaveLength(0)
		})
		it('rundown name and payload change', async () => {
			const nrcsRundown = createBasicIngestRundown()
			const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(clone(nrcsRundown))

			const changes: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				rundownChanges: NrcsIngestRundownChangeDetails.Payload,
			}

			defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

			expect(mockCalls).toHaveLength(3)
			expect(mockCalls[0]).toEqual({ target: 'options', name: 'transformRundownPayload', args: [true] })
			expect(mockCalls[1]).toEqual({ target: 'rundown', name: 'replacePayload', args: [nrcsRundown.payload] })
			expect(mockCalls[2]).toEqual({ target: 'rundown', name: 'setName', args: [nrcsRundown.name] })
		})
		it('rundown regenerate', async () => {
			const nrcsRundown = createBasicIngestRundown()
			const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(clone(nrcsRundown))

			const changes: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				rundownChanges: NrcsIngestRundownChangeDetails.Regenerate,
				segmentOrderChanged: true, // will be ignored
				segmentChanges: {}, // will be ignored
			}

			defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

			// Ensure the segments were regenerated
			expect(mockCalls).toHaveLength(8)
			expect(mockCalls[0]).toEqual({ target: 'options', name: 'transformRundownPayload', args: [true] })
			expect(mockCalls[1]).toEqual({ target: 'rundown', name: 'replacePayload', args: [nrcsRundown.payload] })
			expect(mockCalls[2]).toEqual({ target: 'rundown', name: 'setName', args: [nrcsRundown.name] })
			expect(mockCalls[3]).toEqual({ target: 'rundown', name: 'removeAllSegments', args: [] })
			expect(mockCalls[4]).toEqual({ target: 'rundown', name: 'forceFullRegenerate', args: [] })
			expect(mockCalls[5]).toEqual({ target: 'options', name: 'transformSegmentPayload', args: [true] })
			expect(mockCalls[6]).toEqual({ target: 'options', name: 'transformPartPayload', args: [true] })
			expect(mockCalls[7]).toMatchObject({ target: 'rundown', name: 'replaceSegment' })
			expect(mutableIngestRundown.segments).toHaveLength(1)
		})
	})

	describe('segment order changes', () => {
		function createIngestRundownWithManySegmentsAlternateOrder(): IngestRundown {
			const ingestRundown = createIngestRundownWithManySegments()

			// reorder segments
			ingestRundown.segments = [
				ingestRundown.segments[3],
				ingestRundown.segments[1],
				ingestRundown.segments[4],
				ingestRundown.segments[0],
				ingestRundown.segments[2],
			]

			return ingestRundown
		}

		it('no changes', async () => {
			const nrcsRundown = createIngestRundownWithManySegments()
			const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(nrcsRundown)

			const changes: NrcsIngestChangeDetails = { source: IngestChangeType.Ingest, segmentOrderChanged: true }

			defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

			// always ensures the order is sane
			expect(mockCalls).toHaveLength(5)
			expect(mockCalls[0]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg4', null] })
			expect(mockCalls[1]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg3', 'seg4'] })
			expect(mockCalls[2]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg2', 'seg3'] })
			expect(mockCalls[3]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg1', 'seg2'] })
			expect(mockCalls[4]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg0', 'seg1'] })
		})

		it('good changes', async () => {
			const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(
				createIngestRundownWithManySegments()
			)

			// include some changes, which should be ignored
			const modifiedRundown = createIngestRundownWithManySegmentsAlternateOrder()

			const changes: NrcsIngestChangeDetails = { source: IngestChangeType.Ingest, segmentOrderChanged: true }

			defaultApplyIngestChanges(mutableIngestRundown, modifiedRundown, changes, defaultOptions)

			// performs reorder
			expect(mockCalls).toHaveLength(5)
			expect(mockCalls[0]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg2', null] })
			expect(mockCalls[1]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg0', 'seg2'] })
			expect(mockCalls[2]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg4', 'seg0'] })
			expect(mockCalls[3]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg1', 'seg4'] })
			expect(mockCalls[4]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg3', 'seg1'] })
		})

		it('missing segment in new order', async () => {
			const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(
				createIngestRundownWithManySegments()
			)

			// include some changes
			const modifiedRundown = createIngestRundownWithManySegmentsAlternateOrder()
			modifiedRundown.segments.splice(2, 1) // remove seg4

			const changes: NrcsIngestChangeDetails = { source: IngestChangeType.Ingest, segmentOrderChanged: true }

			defaultApplyIngestChanges(mutableIngestRundown, modifiedRundown, changes, defaultOptions)

			// performs reorder
			expect(mockCalls).toHaveLength(5)
			expect(mockCalls[0]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg2', null] })
			expect(mockCalls[1]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg0', 'seg2'] })
			expect(mockCalls[2]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg1', 'seg0'] })
			expect(mockCalls[3]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg3', 'seg1'] })
			expect(mockCalls[4]).toEqual({ target: 'rundown', name: 'moveSegmentAfter', args: ['seg4', 'seg3'] }) // follows original order
		})

		it('extra segment in new order', async () => {
			const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(
				createIngestRundownWithManySegments()
			)

			// include some changes
			const modifiedRundown = createIngestRundownWithManySegmentsAlternateOrder()
			modifiedRundown.segments.splice(2, 0, {
				externalId: 'segX',
				rank: 2,
				name: 'my segment',
				payload: {
					segmentData: 'data',
				},
				parts: [],
			})

			const changes: NrcsIngestChangeDetails = { source: IngestChangeType.Ingest, segmentOrderChanged: true }

			defaultApplyIngestChanges(mutableIngestRundown, modifiedRundown, changes, defaultOptions)

			// performs reorder, ignoring segX
			expect(mockCalls).toHaveLength(5)
			expect(mockCalls[0]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg2', null] })
			expect(mockCalls[1]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg0', 'seg2'] })
			expect(mockCalls[2]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg4', 'seg0'] })
			expect(mockCalls[3]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg1', 'seg4'] })
			expect(mockCalls[4]).toEqual({ target: 'rundown', name: 'moveSegmentBefore', args: ['seg3', 'seg1'] })
		})
	})

	describe('segment changes', () => {
		it('mix of operations', async () => {
			const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(
				createIngestRundownWithManySegments()
			)

			// include some changes, which should be ignored
			const modifiedRundown = createIngestRundownWithManySegments()
			modifiedRundown.segments[1].externalId = 'segX' // replace seg1
			modifiedRundown.segments[2].externalId = 'segY' // repalce seg2
			modifiedRundown.segments.splice(4, 1) // remove seg4

			const changes: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					seg1: NrcsIngestSegmentChangeDetailsEnum.Deleted,
					segX: NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
					seg3: {
						payloadChanged: true,
					},
					seg4: NrcsIngestSegmentChangeDetailsEnum.Deleted,
					segY: NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
					seg2: NrcsIngestSegmentChangeDetailsEnum.Deleted,
				},
			}

			defaultApplyIngestChanges(mutableIngestRundown, modifiedRundown, changes, defaultOptions)

			// performs deletes and inserts
			expect(mockCalls).toHaveLength(10)

			// Note: this happens in the order of the changes object, but that is not guaranteed in the future

			// remove and update first
			expect(mockCalls[0]).toEqual({ target: 'rundown', name: 'removeSegment', args: ['seg1'] })
			expect(mockCalls[1]).toEqual({ target: 'options', name: 'transformSegmentPayload', args: [true] })
			expect(mockCalls[2]).toMatchObject({ target: 'segment seg3', name: 'replacePayload' })
			expect(mockCalls[3]).toMatchObject({ target: 'segment seg3', name: 'setName' })
			expect(mockCalls[4]).toEqual({ target: 'rundown', name: 'removeSegment', args: ['seg4'] })
			expect(mockCalls[5]).toEqual({ target: 'rundown', name: 'removeSegment', args: ['seg2'] })

			// insert new ones in order starting at the end
			expect(mockCalls[6]).toEqual({ target: 'options', name: 'transformSegmentPayload', args: [false] })
			expect(mockCalls[7]).toMatchObject({
				target: 'rundown',
				name: 'replaceSegment',
				args: [{ externalId: 'segY' }, 'seg3'],
			})
			expect(mockCalls[8]).toEqual({ target: 'options', name: 'transformSegmentPayload', args: [false] })
			expect(mockCalls[9]).toMatchObject({
				target: 'rundown',
				name: 'replaceSegment',
				args: [{ externalId: 'segX' }, 'segY'],
			})
		})

		it('insert missing', async () => {
			const nrcsRundown = createIngestRundownWithManySegments()
			const { mutableIngestRundown, defaultOptions } = createMutableIngestRundown(clone(nrcsRundown))

			const changes: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					segX: NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
				},
			}

			expect(() => defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)).toThrow(
				/Segment(.*)not found/
			)
		})

		it('delete missing', async () => {
			const nrcsRundown = createIngestRundownWithManySegments()
			const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(clone(nrcsRundown))

			const changes: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					segX: NrcsIngestSegmentChangeDetailsEnum.Deleted,
				},
			}

			// should run without error
			defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

			expect(mockCalls).toHaveLength(1)
			expect(mockCalls[0]).toEqual({ target: 'rundown', name: 'removeSegment', args: ['segX'] })
		})

		it('update missing', async () => {
			const nrcsRundown = createIngestRundownWithManySegments()
			const { mutableIngestRundown, defaultOptions } = createMutableIngestRundown(clone(nrcsRundown))

			const changes: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					segX: {
						payloadChanged: true,
					},
				},
			}

			// should run without error
			expect(() => defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)).toThrow(
				/Segment(.*)not found/
			)
		})

		it('update without changes', async () => {
			const nrcsRundown = createIngestRundownWithManySegments()
			const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(clone(nrcsRundown))

			const changes: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					seg1: {},
				},
			}

			// should run without error
			defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

			expect(mockCalls).toHaveLength(0)
		})

		it('change segment id', async () => {
			const nrcsRundown = createIngestRundownWithManySegments()
			const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(clone(nrcsRundown))

			const changes: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					segX: NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
				},
				changedSegmentExternalIds: {
					seg1: 'segX',
				},
			}

			nrcsRundown.segments[1].externalId = 'segX'

			// should run without error
			defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

			expect(mockCalls).toHaveLength(3)
			expect(mockCalls[0]).toEqual({ target: 'rundown', name: 'changeSegmentExternalId', args: ['seg1', 'segX'] })
			expect(mockCalls[1]).toEqual({ target: 'options', name: 'transformSegmentPayload', args: [true] })
			expect(mockCalls[2]).toMatchObject({
				target: 'rundown',
				name: 'replaceSegment',
				args: [{ externalId: 'segX' }, 'seg2'],
			})
		})

		it('change unknown segment id', async () => {
			const nrcsRundown = createIngestRundownWithManySegments()
			const { mutableIngestRundown, defaultOptions } = createMutableIngestRundown(clone(nrcsRundown))

			const changes: NrcsIngestChangeDetails = {
				source: IngestChangeType.Ingest,
				segmentChanges: {
					segX: NrcsIngestSegmentChangeDetailsEnum.InsertedOrUpdated,
				},
				changedSegmentExternalIds: {
					segY: 'segX',
				},
			}

			nrcsRundown.segments[1].externalId = 'segX'

			// should run without error
			expect(() => defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)).toThrow(
				/Segment(.*)not found/
			)
		})

		describe('partOrderChanged', () => {
			it('with single part', async () => {
				const nrcsRundown = createMediumIngestRundown()
				const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(
					clone(nrcsRundown)
				)

				const changes: NrcsIngestChangeDetails = {
					source: IngestChangeType.Ingest,
					segmentChanges: {
						seg1: {
							partOrderChanged: true,
						},
					},
				}

				// should run without error
				defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

				expect(mockCalls).toHaveLength(1)
				expect(mockCalls[0]).toEqual({ target: 'segment seg1', name: 'movePartBefore', args: ['part2', null] })
			})
			it('with multiple parts', async () => {
				const nrcsRundown = createMediumIngestRundown()
				const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(
					clone(nrcsRundown)
				)

				// reorder parts
				const origParts = nrcsRundown.segments[2].parts
				nrcsRundown.segments[2].parts = [origParts[1], origParts[0], origParts[2]]

				const changes: NrcsIngestChangeDetails = {
					source: IngestChangeType.Ingest,
					segmentChanges: {
						seg2: {
							partOrderChanged: true,
						},
					},
				}

				// should run without error
				defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

				expect(mockCalls).toHaveLength(3)
				expect(mockCalls[0]).toEqual({ target: 'segment seg2', name: 'movePartBefore', args: ['part5', null] })
				expect(mockCalls[1]).toEqual({
					target: 'segment seg2',
					name: 'movePartBefore',
					args: ['part3', 'part5'],
				})
				expect(mockCalls[2]).toEqual({
					target: 'segment seg2',
					name: 'movePartBefore',
					args: ['part4', 'part3'],
				})
			})

			it('missing part in new order', async () => {
				const nrcsRundown = createMediumIngestRundown()
				const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(
					clone(nrcsRundown)
				)

				// remove a part
				nrcsRundown.segments[2].parts.splice(1, 1)

				const changes: NrcsIngestChangeDetails = {
					source: IngestChangeType.Ingest,
					segmentChanges: {
						seg2: {
							partOrderChanged: true,
						},
					},
				}

				// should run without error
				defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

				expect(mockCalls).toHaveLength(3)
				expect(mockCalls[0]).toEqual({ target: 'segment seg2', name: 'movePartBefore', args: ['part5', null] })
				expect(mockCalls[1]).toEqual({
					target: 'segment seg2',
					name: 'movePartBefore',
					args: ['part3', 'part5'],
				})
				expect(mockCalls[2]).toEqual({
					target: 'segment seg2',
					name: 'movePartAfter',
					args: ['part4', 'part3'],
				})
			})

			it('extra segment in new order', async () => {
				const nrcsRundown = createMediumIngestRundown()
				const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(
					clone(nrcsRundown)
				)

				// add an extra nrcs part
				nrcsRundown.segments[2].parts.splice(1, 0, {
					externalId: 'partX',
					rank: 0,
					name: 'my part',
					payload: {
						partData: 'data',
					},
				})

				const changes: NrcsIngestChangeDetails = {
					source: IngestChangeType.Ingest,
					segmentChanges: {
						seg2: {
							partOrderChanged: true,
						},
					},
				}

				// should run without error
				defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

				// performs reorder, ignoring segX
				expect(mockCalls).toHaveLength(3)
				expect(mockCalls[0]).toEqual({ target: 'segment seg2', name: 'movePartBefore', args: ['part5', null] })
				expect(mockCalls[1]).toEqual({
					target: 'segment seg2',
					name: 'movePartBefore',
					args: ['part4', 'part5'],
				})
				expect(mockCalls[2]).toEqual({
					target: 'segment seg2',
					name: 'movePartBefore',
					args: ['part3', 'part4'],
				})
			})
		})

		describe('partsChanges', () => {
			it('mix of operations', async () => {
				const { mutableIngestRundown, defaultOptions, mockCalls } =
					createMutableIngestRundown(createMediumIngestRundown())

				// include some changes, which should be ignored
				const modifiedRundown = createMediumIngestRundown()
				const segment0 = modifiedRundown.segments[0]
				segment0.parts[0].externalId = 'partX' // replace part0
				const segment2 = modifiedRundown.segments[2]
				segment2.parts[0].externalId = 'partY' // replace part3
				segment2.parts.splice(1, 1) // remove part4

				const changes: NrcsIngestChangeDetails = {
					source: IngestChangeType.Ingest,
					segmentChanges: {
						seg0: {
							partChanges: {
								part0: NrcsIngestPartChangeDetails.Deleted,
								partX: NrcsIngestPartChangeDetails.Inserted,
								part1: NrcsIngestPartChangeDetails.Updated,
							},
						},
						seg2: {
							partChanges: {
								part3: NrcsIngestPartChangeDetails.Deleted,
								partY: NrcsIngestPartChangeDetails.Inserted,
								part4: NrcsIngestPartChangeDetails.Deleted,
							},
						},
					},
				}

				defaultApplyIngestChanges(mutableIngestRundown, modifiedRundown, changes, defaultOptions)

				// performs deletes and inserts
				expect(mockCalls).toHaveLength(10)

				// Note: this happens in the order of the changes object, but that is not guaranteed in the future

				// first segment
				expect(mockCalls[0]).toEqual({ target: 'segment seg0', name: 'removePart', args: ['part0'] })
				expect(mockCalls[1]).toEqual({ target: 'options', name: 'transformPartPayload', args: [true] })
				expect(mockCalls[2]).toMatchObject({ target: 'part part1', name: 'replacePayload' })
				expect(mockCalls[3]).toMatchObject({ target: 'part part1', name: 'setName' })
				expect(mockCalls[4]).toEqual({ target: 'options', name: 'transformPartPayload', args: [false] })
				expect(mockCalls[5]).toMatchObject({
					target: 'segment seg0',
					name: 'replacePart',
					args: [{ externalId: 'partX' }, 'part1'],
				})

				// second segment
				expect(mockCalls[6]).toEqual({ target: 'segment seg2', name: 'removePart', args: ['part3'] })
				expect(mockCalls[7]).toEqual({ target: 'segment seg2', name: 'removePart', args: ['part4'] })
				expect(mockCalls[8]).toEqual({ target: 'options', name: 'transformPartPayload', args: [false] })
				expect(mockCalls[9]).toMatchObject({
					target: 'segment seg2',
					name: 'replacePart',
					args: [{ externalId: 'partY' }, 'part5'],
				})
			})

			it('insert missing', async () => {
				const nrcsRundown = createMediumIngestRundown()
				const { mutableIngestRundown, defaultOptions } = createMutableIngestRundown(clone(nrcsRundown))

				const changes: NrcsIngestChangeDetails = {
					source: IngestChangeType.Ingest,
					segmentChanges: {
						seg0: {
							partChanges: {
								partX: NrcsIngestPartChangeDetails.Inserted,
							},
						},
					},
				}

				expect(() =>
					defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)
				).toThrow(/Part(.*)not found/)
			})

			it('delete missing', async () => {
				const nrcsRundown = createMediumIngestRundown()
				const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(
					clone(nrcsRundown)
				)

				const changes: NrcsIngestChangeDetails = {
					source: IngestChangeType.Ingest,
					segmentChanges: {
						seg0: {
							partChanges: {
								partX: NrcsIngestPartChangeDetails.Deleted,
							},
						},
					},
				}

				// should run without error
				defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

				expect(mockCalls).toHaveLength(1)
				expect(mockCalls[0]).toEqual({ target: 'segment seg0', name: 'removePart', args: ['partX'] })
			})

			it('update missing', async () => {
				const nrcsRundown = createMediumIngestRundown()
				const { mutableIngestRundown, defaultOptions } = createMutableIngestRundown(clone(nrcsRundown))

				const changes: NrcsIngestChangeDetails = {
					source: IngestChangeType.Ingest,
					segmentChanges: {
						seg0: {
							partChanges: {
								partX: NrcsIngestPartChangeDetails.Updated,
							},
						},
					},
				}

				// should run without error
				expect(() =>
					defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)
				).toThrow(/Part(.*)not found/)
			})

			it('update without changes', async () => {
				const nrcsRundown = createMediumIngestRundown()
				const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(
					clone(nrcsRundown)
				)

				const changes: NrcsIngestChangeDetails = {
					source: IngestChangeType.Ingest,
					segmentChanges: {
						seg0: {
							partChanges: {},
						},
					},
				}

				// should run without error
				defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

				expect(mockCalls).toHaveLength(0)
			})

			it('move part across segments', async () => {
				const nrcsRundown = createMediumIngestRundown()
				const { mutableIngestRundown, defaultOptions, mockCalls } = createMutableIngestRundown(
					clone(nrcsRundown)
				)

				// Move the part
				const removed = nrcsRundown.segments[0].parts.splice(0, 1)
				nrcsRundown.segments[1].parts.unshift(...removed)

				const changes: NrcsIngestChangeDetails = {
					source: IngestChangeType.Ingest,
					segmentChanges: {
						seg0: {
							partChanges: {
								part0: NrcsIngestPartChangeDetails.Deleted,
							},
						},
						seg1: {
							partChanges: {
								part0: NrcsIngestPartChangeDetails.Inserted,
							},
						},
					},
				}

				// should run without error
				defaultApplyIngestChanges(mutableIngestRundown, nrcsRundown, changes, defaultOptions)

				expect(mockCalls).toHaveLength(3)
				expect(mockCalls[0]).toEqual({ target: 'segment seg0', name: 'removePart', args: ['part0'] })
				expect(mockCalls[1]).toEqual({ target: 'options', name: 'transformPartPayload', args: [true] })
				expect(mockCalls[2]).toMatchObject({
					target: 'segment seg1',
					name: 'replacePart',
					args: [{ externalId: 'part0' }, 'part2'],
				})
			})
		})
	})
})
