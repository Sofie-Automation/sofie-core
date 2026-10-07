/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
	DBRundownPlaylist,
	SelectedPartInstance,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { setupDefaultJobEnvironment } from '../../../__mocks__/context.js'
import { buildTimelineObjsForRundown, RundownTimelineResult, RundownTimelineTimingContext } from '../rundown.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { SelectedPartInstancesTimelineInfo, SelectedPartInstanceTimelineInfo } from '../generate.js'
import { PartCalculatedTimings } from '@sofie-automation/corelib/dist/playout/timings'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { transformTimeline } from '@sofie-automation/corelib/dist/playout/timeline'
import { deleteAllUndefinedProperties, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	createPartCurrentTimes,
	PieceInstanceWithTimings,
} from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { IBlueprintPieceType, PieceLifespan } from '@sofie-automation/blueprints-integration'
import { getPartGroupId, getPieceControlObjectId } from '@sofie-automation/corelib/dist/playout/ids'

const DEFAULT_PART_TIMINGS: PartCalculatedTimings = Object.freeze({
	inTransitionStart: null,
	toPartDelay: 0,
	toPartPostroll: 0,
	fromPartRemaining: 0,
	fromPartPostroll: 0,
	fromPartKeepalive: 0,
})

function transformTimelineIntoSimplifiedForm(res: RundownTimelineResult) {
	const deepTimeline = transformTimeline(res.timeline)

	function simplifyTimelineObject(obj: any): any {
		const newObj = {
			id: obj.id,
			enable: obj.enable,
			layer: obj.layer,
			partInstanceId: obj.partInstanceId,
			priority: obj.priority,
			children: obj.children?.map(simplifyTimelineObject),
			isPieceTimeline: obj.metaData?.isPieceTimeline,
			classes: obj.classes?.length > 0 ? obj.classes : undefined,
		}

		deleteAllUndefinedProperties(newObj)

		return newObj
	}

	return {
		timeline: deepTimeline.map(simplifyTimelineObject),
		timingContext: res.timingContext
			? ({
					...res.timingContext,
					currentPartGroup: {
						...res.timingContext.currentPartGroup,
						children: res.timingContext.currentPartGroup.children.length as any,
					},
					nextPartGroup: res.timingContext.nextPartGroup
						? {
								...res.timingContext.nextPartGroup,
								children: res.timingContext.nextPartGroup.children.length as any,
							}
						: undefined,
				} satisfies RundownTimelineTimingContext)
			: undefined,
	}
}

/**
 * This is a set of tests to get a general overview of the shape of the generated timeline.
 * It is not intended to look in much detail at everything, it is expected that methods used
 * inside of this will have their own tests to stress difference scenarios.
 */
describe('buildTimelineObjsForRundown', () => {
	const currentTime = 5678

	function createMockPlaylist(selectedPartInfos: SelectedPartInstancesTimelineInfo): DBRundownPlaylist {
		function convertSelectedPartInstance(
			info: SelectedPartInstanceTimelineInfo | undefined
		): SelectedPartInstance | null {
			if (!info) return null
			return {
				partInstanceId: info.partInstance._id,
				rundownId: info.partInstance.rundownId,
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
		}
		return {
			_id: protectString('mockPlaylist'),
			nextPartInfo: convertSelectedPartInstance(selectedPartInfos.next),
			currentPartInfo: convertSelectedPartInstance(selectedPartInfos.current),
			previousPartsInfo: selectedPartInfos.previous
				.map((info) => convertSelectedPartInstance(info))
				.filter((info): info is SelectedPartInstance => info !== null),
			activationId: protectString('mockActivationId'),
			rehearsal: false,
		} as Partial<DBRundownPlaylist> as any
	}
	function createMockPartInstance(
		id: string,
		partProps?: Partial<DBPart>,
		partInstanceProps?: Partial<DBPartInstance>
	): DBPartInstance {
		return {
			_id: protectString(id),
			part: {
				...partProps,
			} as Partial<DBPart> as any,
			...partInstanceProps,
		} as Partial<DBPartInstance> as any
	}
	function createMockPieceInstance(
		id: string,
		pieceProps?: Partial<PieceInstancePiece>,
		pieceInstanceProps?: Partial<PieceInstance>
	): PieceInstanceWithTimings {
		return {
			_id: protectString(id),

			piece: {
				enable: { start: 0 },
				pieceType: IBlueprintPieceType.Normal,
				timelineObjectsString: EmptyPieceTimelineObjectsBlob,
				...pieceProps,
			} as Partial<PieceInstancePiece> as any,

			resolvedEndCap: undefined,
			priority: 5,

			...pieceInstanceProps,
		} as Partial<PieceInstanceWithTimings> as any
	}
	function createMockInfinitePieceInstance(
		id: string,
		pieceProps?: Partial<PieceInstancePiece>,
		pieceInstanceProps?: Partial<PieceInstance>,
		infiniteIndex = 0
	): PieceInstanceWithTimings {
		return createMockPieceInstance(
			id,
			{
				lifespan: PieceLifespan.OutOnSegmentEnd,
				...pieceProps,
			},
			{
				plannedStartedPlayback: 123,
				...pieceInstanceProps,
				infinite: {
					infinitePieceId: getRandomId(),
					infiniteInstanceId: getRandomId(),
					infiniteInstanceIndex: infiniteIndex,
					fromPreviousPart: infiniteIndex !== 0,
				},
			}
		)
	}
	function continueInfinitePiece(piece: PieceInstanceWithTimings): PieceInstanceWithTimings {
		if (!piece.infinite) throw new Error('Not an infinite piece!')
		return {
			...piece,
			_id: protectString(piece._id + 'b'),
			infinite: {
				...piece.infinite,
				fromPreviousPart: true,
				infiniteInstanceIndex: piece.infinite.infiniteInstanceIndex + 1,
			},
		}
	}

	it('playlist with no parts', () => {
		const context = setupDefaultJobEnvironment()

		const selectedPartInfos: SelectedPartInstancesTimelineInfo = { previous: [] }

		const playlist = createMockPlaylist(selectedPartInfos)
		const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

		expect(objs.timeline).toHaveLength(1)
		expect(objs.timingContext).toBeUndefined()
		expect(objs.timeline).toEqual([
			{
				classes: ['rundown_active', 'before_first_part', 'last_part'],
				content: {
					deviceType: 'ABSTRACT',
				},
				enable: {
					while: 1,
				},
				id: 'mockPlaylist_status',
				layer: 'rundown_status',
				metaData: undefined,
				objectType: 'rundown',
				partInstanceId: null,
				priority: 0,
			},
		])
	})

	it('with previous and but no current part', () => {
		const context = setupDefaultJobEnvironment()

		const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
			previous: [
				{
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0'),
					pieceInstances: [],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
			],
		}

		const playlist = createMockPlaylist(selectedPartInfos)
		const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

		expect(objs.timeline).toHaveLength(1)
		expect(objs.timingContext).toBeUndefined()
	})

	it('simple current part', () => {
		const context = setupDefaultJobEnvironment()

		const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
			previous: [],
			current: {
				partTimes: createPartCurrentTimes(currentTime, 5678),
				partInstance: createMockPartInstance('part0'),
				pieceInstances: [createMockPieceInstance('piece0')],
				calculatedTimings: DEFAULT_PART_TIMINGS,
				regenerateTimelineAt: undefined,
			},
		}

		const playlist = createMockPlaylist(selectedPartInfos)
		const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

		expect(objs.timeline).not.toHaveLength(0)
		expect(objs.timingContext).not.toBeUndefined()
		expect(transformTimelineIntoSimplifiedForm(objs)).toMatchSnapshot()

		expect(objs.timingContext?.currentPartGroup.enable).toEqual({
			start: 'now',
		})
	})

	it('current part with startedPlayback', () => {
		const context = setupDefaultJobEnvironment()

		const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
			previous: [],
			current: {
				partTimes: createPartCurrentTimes(currentTime, 5678),
				partInstance: createMockPartInstance(
					'part0',
					{},
					{
						timings: {
							plannedStartedPlayback: 5678,
						},
					}
				),
				pieceInstances: [createMockPieceInstance('piece0')],
				calculatedTimings: DEFAULT_PART_TIMINGS,
				regenerateTimelineAt: undefined,
			},
		}

		const playlist = createMockPlaylist(selectedPartInfos)
		const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

		expect(objs.timeline).not.toHaveLength(0)
		expect(objs.timingContext).not.toBeUndefined()
		expect(transformTimelineIntoSimplifiedForm(objs)).toMatchSnapshot()

		expect(objs.timingContext?.currentPartGroup.enable).toEqual({
			start: 5678,
		})
	})

	it('next part no autonext', () => {
		const context = setupDefaultJobEnvironment()

		const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
			previous: [],
			current: {
				partTimes: createPartCurrentTimes(currentTime, 5678),
				partInstance: createMockPartInstance('part0'),
				pieceInstances: [createMockPieceInstance('piece0')],
				calculatedTimings: DEFAULT_PART_TIMINGS,
				regenerateTimelineAt: undefined,
			},
			next: {
				partTimes: createPartCurrentTimes(currentTime, undefined),
				partInstance: createMockPartInstance('part1'),
				pieceInstances: [createMockPieceInstance('piece1')],
				calculatedTimings: DEFAULT_PART_TIMINGS,
				regenerateTimelineAt: undefined,
			},
		}

		const playlist = createMockPlaylist(selectedPartInfos)
		const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

		expect(objs.timeline).not.toHaveLength(0)
		expect(objs.timingContext).not.toBeUndefined()
		expect(transformTimelineIntoSimplifiedForm(objs)).toMatchSnapshot()

		// make sure the next part was not generated
		expect(objs.timingContext?.nextPartGroup).toBeUndefined()
		const nextPartGroupId = getPartGroupId(selectedPartInfos.next!.partInstance)
		expect(objs.timeline.find((obj) => obj.id === nextPartGroupId)).toBeUndefined()
	})

	it('next part with autonext', () => {
		const context = setupDefaultJobEnvironment()

		const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
			previous: [],
			current: {
				partTimes: createPartCurrentTimes(currentTime, 5678),
				partInstance: createMockPartInstance('part0', { autoNext: true, expectedDuration: 5000 }),
				pieceInstances: [createMockPieceInstance('piece0')],
				calculatedTimings: DEFAULT_PART_TIMINGS,
				regenerateTimelineAt: undefined,
			},
			next: {
				partTimes: createPartCurrentTimes(currentTime, undefined),
				partInstance: createMockPartInstance('part1'),
				pieceInstances: [createMockPieceInstance('piece1')],
				calculatedTimings: DEFAULT_PART_TIMINGS,
				regenerateTimelineAt: undefined,
			},
		}

		const playlist = createMockPlaylist(selectedPartInfos)
		const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

		expect(objs.timeline).not.toHaveLength(0)
		expect(objs.timingContext).toBeTruthy()
		expect(transformTimelineIntoSimplifiedForm(objs)).toMatchSnapshot()

		// make sure the next part was generated
		expect(objs.timingContext?.nextPartGroup).toBeTruthy()
		const nextPartGroupId = getPartGroupId(selectedPartInfos.next!.partInstance)
		expect(objs.timeline.find((obj) => obj.id === nextPartGroupId)).toBeTruthy()
	})

	it('current and previous parts', () => {
		const context = setupDefaultJobEnvironment()

		const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
			previous: [
				{
					partTimes: createPartCurrentTimes(currentTime, 1234),
					partInstance: createMockPartInstance(
						'part9',
						{ autoNext: true, expectedDuration: 5000 },
						{
							timings: {
								plannedStartedPlayback: 1235,
							},
						}
					),
					pieceInstances: [createMockPieceInstance('piece9')],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
			],
			current: {
				partTimes: createPartCurrentTimes(currentTime, 5678),
				partInstance: createMockPartInstance('part0'),
				pieceInstances: [createMockPieceInstance('piece0')],
				calculatedTimings: DEFAULT_PART_TIMINGS,
				regenerateTimelineAt: undefined,
			},
		}

		const playlist = createMockPlaylist(selectedPartInfos)
		const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

		expect(objs.timeline).not.toHaveLength(0)
		expect(objs.timingContext).not.toBeUndefined()
		expect(transformTimelineIntoSimplifiedForm(objs)).toMatchSnapshot()

		// make sure the previous part was generated
		const previousPartGroupId = getPartGroupId(selectedPartInfos.previous[0].partInstance)
		expect(objs.timeline.find((obj) => obj.id === previousPartGroupId)).toBeTruthy()
		expect(objs.timingContext?.previousPartOverlap).not.toBeUndefined()
	})

	describe('overlap and keepalive', () => {
		it('autonext with keepalive extends current part duration', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0', {
						autoNext: true,
						expectedDuration: 5000,
					}),
					pieceInstances: [createMockPieceInstance('piece0')],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
				next: {
					partTimes: createPartCurrentTimes(currentTime, undefined),
					partInstance: createMockPartInstance('part1'),
					pieceInstances: [createMockPieceInstance('piece1')],
					calculatedTimings: {
						inTransitionStart: 200,
						toPartDelay: 500,
						toPartPostroll: 0,
						fromPartRemaining: 500 + 400,
						fromPartPostroll: 400,
						fromPartKeepalive: 100,
					},
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timingContext?.currentPartGroup.enable).toEqual({
				start: 'now',
				duration: 5000,
			})
		})

		it('autonext with outTransition extends current part duration', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0', {
						autoNext: true,
						expectedDuration: 5000,
						outTransition: { type: 'additive', duration: 1200 },
					}),
					pieceInstances: [createMockPieceInstance('piece0')],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
				next: {
					partTimes: createPartCurrentTimes(currentTime, undefined),
					partInstance: createMockPartInstance('part1'),
					pieceInstances: [createMockPieceInstance('piece1')],
					calculatedTimings: {
						inTransitionStart: null,
						toPartDelay: 1200,
						toPartPostroll: 0,
						fromPartRemaining: 1200,
						fromPartPostroll: 0,
						fromPartKeepalive: 0,
					},
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timingContext?.currentPartGroup.enable).toEqual({
				start: 'now',
				duration: 5000,
			})
		})

		it('autonext does not extend current part duration for preroll-only overlap', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0', { autoNext: true, expectedDuration: 5000 }),
					pieceInstances: [createMockPieceInstance('piece0')],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
				next: {
					partTimes: createPartCurrentTimes(currentTime, undefined),
					partInstance: createMockPartInstance('part1'),
					pieceInstances: [createMockPieceInstance('piece1')],
					calculatedTimings: {
						inTransitionStart: null,
						toPartDelay: 1000,
						toPartPostroll: 0,
						fromPartRemaining: 1000,
						fromPartPostroll: 0,
						fromPartKeepalive: 0,
					},
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timingContext?.currentPartGroup.enable).toEqual({
				start: 'now',
				duration: 5000,
			})
		})

		it('autonext keepalive is capped by availablePostrollDuration = 0', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0', {
						autoNext: true,
						expectedDuration: 5000,
						availablePostrollDuration: 0,
					}),
					pieceInstances: [createMockPieceInstance('piece0')],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
				next: {
					partTimes: createPartCurrentTimes(currentTime, undefined),
					partInstance: createMockPartInstance('part1'),
					pieceInstances: [createMockPieceInstance('piece1')],
					calculatedTimings: {
						inTransitionStart: 200,
						toPartDelay: 500,
						toPartPostroll: 0,
						fromPartRemaining: 500 + 400,
						fromPartPostroll: 400,
						fromPartKeepalive: 100,
					},
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timingContext?.currentPartGroup.enable).toEqual({
				start: 'now',
				duration: 5000,
			})
		})

		it('autonext keepalive is capped when availablePostrollDuration is undefined', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0', {
						autoNext: true,
						expectedDuration: 5000,
					}),
					pieceInstances: [createMockPieceInstance('piece0')],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
				next: {
					partTimes: createPartCurrentTimes(currentTime, undefined),
					partInstance: createMockPartInstance('part1'),
					pieceInstances: [createMockPieceInstance('piece1')],
					calculatedTimings: {
						inTransitionStart: 200,
						toPartDelay: 500,
						toPartPostroll: 0,
						fromPartRemaining: 500 + 400,
						fromPartPostroll: 400,
						fromPartKeepalive: 100,
					},
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timingContext?.currentPartGroup.enable).toEqual({
				start: 'now',
				duration: 5000,
			})
		})

		it('autonext keepalive is partially capped by availablePostrollDuration', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0', {
						autoNext: true,
						expectedDuration: 5000,
						availablePostrollDuration: 50,
					}),
					pieceInstances: [createMockPieceInstance('piece0')],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
				next: {
					partTimes: createPartCurrentTimes(currentTime, undefined),
					partInstance: createMockPartInstance('part1'),
					pieceInstances: [createMockPieceInstance('piece1')],
					calculatedTimings: {
						inTransitionStart: 200,
						toPartDelay: 500,
						toPartPostroll: 0,
						fromPartRemaining: 500 + 400,
						fromPartPostroll: 400,
						fromPartKeepalive: 100,
					},
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timingContext?.currentPartGroup.enable).toEqual({
				start: 'now',
				duration: 5050,
			})
		})

		it('current and previous parts', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [
					{
						partTimes: createPartCurrentTimes(currentTime, 1234),
						partInstance: createMockPartInstance(
							'part9',
							{ autoNext: true, expectedDuration: 5000 },
							{
								timings: {
									plannedStartedPlayback: 1235,
								},
							}
						),
						pieceInstances: [createMockPieceInstance('piece9'), createMockPieceInstance('piece8')],
						calculatedTimings: DEFAULT_PART_TIMINGS,
						regenerateTimelineAt: undefined,
					},
				],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0'),
					pieceInstances: [createMockPieceInstance('piece0')],
					calculatedTimings: {
						inTransitionStart: 200,
						toPartDelay: 500,
						toPartPostroll: 0,
						fromPartRemaining: 500 + 400,
						fromPartPostroll: 400,
						fromPartKeepalive: 100,
					},
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timeline).not.toHaveLength(0)
			expect(objs.timingContext).not.toBeUndefined()
			expect(transformTimelineIntoSimplifiedForm(objs)).toMatchSnapshot()

			// make sure the previous part was generated
			const previousPartGroupId = getPartGroupId(selectedPartInfos.previous[0].partInstance)
			expect(objs.timeline.find((obj) => obj.id === previousPartGroupId)).toBeTruthy()
			expect(objs.timingContext?.previousPartOverlap).not.toBeUndefined()
		})

		it('current and previous parts with excludeDuringPartKeepalive', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [
					{
						partTimes: createPartCurrentTimes(currentTime, 1234),
						partInstance: createMockPartInstance(
							'part9',
							{ autoNext: true, expectedDuration: 5000 },
							{
								timings: {
									plannedStartedPlayback: 1235,
								},
							}
						),
						pieceInstances: [
							createMockPieceInstance('piece9'),
							createMockPieceInstance('piece8', {
								excludeDuringPartKeepalive: true,
							}),
						],
						calculatedTimings: DEFAULT_PART_TIMINGS,
						regenerateTimelineAt: undefined,
					},
				],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0'),
					pieceInstances: [createMockPieceInstance('piece0')],
					calculatedTimings: {
						inTransitionStart: 200,
						toPartDelay: 500,
						toPartPostroll: 0,
						fromPartRemaining: 500 + 400,
						fromPartPostroll: 400,
						fromPartKeepalive: 100,
					},
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timeline).not.toHaveLength(0)
			expect(objs.timingContext).not.toBeUndefined()
			expect(transformTimelineIntoSimplifiedForm(objs)).toMatchSnapshot()

			// make sure the previous part was generated
			const previousPartGroupId = getPartGroupId(selectedPartInfos.previous[0].partInstance)
			expect(objs.timeline.find((obj) => obj.id === previousPartGroupId)).toBeTruthy()
			expect(objs.timingContext?.previousPartOverlap).not.toBeUndefined()
		})

		it('autonext into next part', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0', { autoNext: true, expectedDuration: 5000 }),
					pieceInstances: [createMockPieceInstance('piece0')],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
				next: {
					partTimes: createPartCurrentTimes(currentTime, undefined),
					partInstance: createMockPartInstance('part1'),
					pieceInstances: [createMockPieceInstance('piece1')],
					calculatedTimings: {
						inTransitionStart: 200,
						toPartDelay: 500,
						toPartPostroll: 0,
						fromPartRemaining: 500 + 400,
						fromPartPostroll: 400,
						fromPartKeepalive: 100,
					},
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timeline).not.toHaveLength(0)
			expect(objs.timingContext).toBeTruthy()
			expect(transformTimelineIntoSimplifiedForm(objs)).toMatchSnapshot()

			// make sure the next part was generated
			expect(objs.timingContext?.nextPartGroup).toBeTruthy()
			const nextPartGroupId = getPartGroupId(selectedPartInfos.next!.partInstance)
			expect(objs.timeline.find((obj) => obj.id === nextPartGroupId)).toBeTruthy()
		})

		it('autonext into next part with excludeDuringPartKeepalive', () => {
			const context = setupDefaultJobEnvironment()

			jest.spyOn(global.Date, 'now').mockImplementation(() => 3000)

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance(
						'part0',
						{ autoNext: true, expectedDuration: 5000 },
						{
							timings: {
								plannedStartedPlayback: 1235,
							},
						}
					),
					pieceInstances: [
						createMockPieceInstance('piece0'),
						createMockPieceInstance('piece9', {
							excludeDuringPartKeepalive: true,
						}),
					],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
				next: {
					partTimes: createPartCurrentTimes(currentTime, undefined),
					partInstance: createMockPartInstance(
						'part1',
						{},
						{
							timings: {
								plannedStartedPlayback: 5000,
							},
						}
					),
					pieceInstances: [createMockPieceInstance('piece1')],
					calculatedTimings: {
						inTransitionStart: 200,
						toPartDelay: 500,
						toPartPostroll: 0,
						fromPartRemaining: 500 + 400,
						fromPartPostroll: 400,
						fromPartKeepalive: 100,
					},
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timeline).not.toHaveLength(0)
			expect(objs.timingContext).not.toBeUndefined()
			expect(transformTimelineIntoSimplifiedForm(objs)).toMatchSnapshot()

			// make sure the previous part was generated
			expect(objs.timingContext?.nextPartGroup).toBeTruthy()
			const nextPartGroupId = getPartGroupId(selectedPartInfos.next!.partInstance)
			expect(objs.timeline.find((obj) => obj.id === nextPartGroupId)).toBeTruthy()
		})
	})

	describe('out transitions', () => {
		const exclusiveOutTransition = {
			type: 'exclusive',
			blockTakeDuration: 0,
			partKeepaliveDuration: 800,
			nextPartContentDelayDuration: 0,
		} as const

		function createNextPartTimings(timings: Partial<PartCalculatedTimings>): PartCalculatedTimings {
			return {
				...DEFAULT_PART_TIMINGS,
				...timings,
			}
		}

		function buildWithCurrentAndNext(
			currentPartProps: Partial<DBPart>,
			currentPieces: PieceInstanceWithTimings[],
			nextPartTimings: PartCalculatedTimings
		) {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0', {
						autoNext: true,
						expectedDuration: 5000,
						...currentPartProps,
					}),
					pieceInstances: [createMockPieceInstance('piece0'), ...currentPieces],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
				next: {
					partTimes: createPartCurrentTimes(currentTime, undefined),
					partInstance: createMockPartInstance('part1'),
					pieceInstances: [createMockPieceInstance('piece1')],
					calculatedTimings: nextPartTimings,
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			const partGroupId = getPartGroupId(selectedPartInfos.current!.partInstance)
			const getControlObj = (piece: PieceInstanceWithTimings) =>
				objs.timeline.find((obj) => obj.id === getPieceControlObjectId(piece))

			return { objs, partGroupId, getControlObj }
		}

		it('additive OutTransition piece is anchored by the outTransition duration', () => {
			const outPiece = createMockPieceInstance('pieceOut', { pieceType: IBlueprintPieceType.OutTransition })
			const { partGroupId, getControlObj } = buildWithCurrentAndNext(
				{ outTransition: { type: 'additive', duration: 1200 } },
				[outPiece],
				createNextPartTimings({ toPartDelay: 1200, fromPartRemaining: 1200, transitionSource: 'none' })
			)

			expect(getControlObj(outPiece)?.enable).toEqual({ start: `#${partGroupId}.end - 1200` })
		})

		it('additive OutTransition piece is not played when replaced by the autoNextOutTransition', () => {
			const outPiece = createMockPieceInstance('pieceOut', { pieceType: IBlueprintPieceType.OutTransition })
			const { getControlObj } = buildWithCurrentAndNext(
				{ outTransition: { type: 'additive', duration: 1200 }, autoNextOutTransition: exclusiveOutTransition },
				[outPiece],
				createNextPartTimings({
					fromPartRemaining: 800,
					fromPartKeepalive: 800,
					transitionSource: 'autoNextOutTransition',
				})
			)

			expect(getControlObj(outPiece)).toBeUndefined()
		})

		it('exclusive OutTransition piece starts at the transition start', () => {
			const outPiece = createMockPieceInstance('pieceOut', { pieceType: IBlueprintPieceType.OutTransition })
			const { partGroupId, getControlObj } = buildWithCurrentAndNext(
				{ outTransition: exclusiveOutTransition },
				[outPiece],
				createNextPartTimings({
					toPartDelay: 200,
					fromPartRemaining: 200 + 800 + 100,
					fromPartKeepalive: 800,
					fromPartPostroll: 100,
					transitionSource: 'outTransition',
				})
			)

			expect(getControlObj(outPiece)?.enable).toEqual({ start: `#${partGroupId}.end - 900` })
		})

		it('exclusive OutTransition piece respects its own start and duration', () => {
			const outPiece = createMockPieceInstance('pieceOut', {
				pieceType: IBlueprintPieceType.OutTransition,
				enable: { start: 300, duration: 1000 },
			})
			const { partGroupId, getControlObj } = buildWithCurrentAndNext(
				{ outTransition: exclusiveOutTransition },
				[outPiece],
				createNextPartTimings({
					fromPartRemaining: 800,
					fromPartKeepalive: 800,
					transitionSource: 'outTransition',
				})
			)

			expect(getControlObj(outPiece)?.enable).toEqual({ start: `#${partGroupId}.end - 500`, duration: 1000 })
		})

		it('exclusive OutTransition piece is not played when another transition was used', () => {
			const outPiece = createMockPieceInstance('pieceOut', { pieceType: IBlueprintPieceType.OutTransition })
			const { getControlObj } = buildWithCurrentAndNext(
				{ outTransition: exclusiveOutTransition },
				[outPiece],
				createNextPartTimings({ transitionSource: 'none' })
			)

			expect(getControlObj(outPiece)).toBeUndefined()
		})

		it('exclusive OutTransition piece is not played for timings without a transitionSource', () => {
			const outPiece = createMockPieceInstance('pieceOut', { pieceType: IBlueprintPieceType.OutTransition })
			const { getControlObj } = buildWithCurrentAndNext(
				{ outTransition: exclusiveOutTransition },
				[outPiece],
				createNextPartTimings({ fromPartRemaining: 800, fromPartKeepalive: 800 })
			)

			expect(getControlObj(outPiece)).toBeUndefined()
		})

		it('AutoNextOutTransition piece is played for the autoNextOutTransition', () => {
			const outPiece = createMockPieceInstance('pieceOut', {
				pieceType: IBlueprintPieceType.AutoNextOutTransition,
			})
			const { partGroupId, getControlObj } = buildWithCurrentAndNext(
				{ autoNextOutTransition: exclusiveOutTransition },
				[outPiece],
				createNextPartTimings({
					fromPartRemaining: 800,
					fromPartKeepalive: 800,
					transitionSource: 'autoNextOutTransition',
				})
			)

			expect(getControlObj(outPiece)?.enable).toEqual({ start: `#${partGroupId}.end - 800` })
		})

		it('AutoNextOutTransition piece is not played without the autoNextOutTransition', () => {
			const outPiece = createMockPieceInstance('pieceOut', {
				pieceType: IBlueprintPieceType.AutoNextOutTransition,
			})
			const { getControlObj } = buildWithCurrentAndNext(
				{ autoNextOutTransition: exclusiveOutTransition, outTransition: exclusiveOutTransition },
				[outPiece],
				createNextPartTimings({
					fromPartRemaining: 800,
					fromPartKeepalive: 800,
					transitionSource: 'outTransition',
				})
			)

			expect(getControlObj(outPiece)).toBeUndefined()
		})

		it('exclusive OutTransition piece of a previous part', () => {
			const context = setupDefaultJobEnvironment()

			const outPiece = createMockPieceInstance('pieceOut', { pieceType: IBlueprintPieceType.OutTransition })
			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [
					{
						partTimes: createPartCurrentTimes(currentTime, 1234),
						partInstance: createMockPartInstance(
							'part9',
							{ outTransition: exclusiveOutTransition },
							{ timings: { plannedStartedPlayback: 1235 } }
						),
						pieceInstances: [createMockPieceInstance('piece9'), outPiece],
						calculatedTimings: DEFAULT_PART_TIMINGS,
						regenerateTimelineAt: undefined,
					},
				],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0'),
					pieceInstances: [createMockPieceInstance('piece0')],
					calculatedTimings: createNextPartTimings({
						fromPartRemaining: 800 + 100,
						fromPartKeepalive: 800,
						fromPartPostroll: 100,
						transitionSource: 'outTransition',
					}),
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			const previousPartGroupId = getPartGroupId(selectedPartInfos.previous[0].partInstance)
			expect(objs.timeline.find((obj) => obj.id === getPieceControlObjectId(outPiece))?.enable).toEqual({
				start: `#${previousPartGroupId}.end - 900`,
			})
		})

		it('InTransition piece is not played when replaced by an outTransition', () => {
			const context = setupDefaultJobEnvironment()

			const inPiece = createMockPieceInstance('pieceIn', { pieceType: IBlueprintPieceType.InTransition })
			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0', {
						inTransition: {
							blockTakeDuration: 0,
							previousPartKeepaliveDuration: 500,
							partContentDelayDuration: 500,
						},
					}),
					pieceInstances: [createMockPieceInstance('piece0'), inPiece],
					calculatedTimings: createNextPartTimings({
						inTransitionStart: null,
						fromPartRemaining: 800,
						fromPartKeepalive: 800,
						transitionSource: 'outTransition',
					}),
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timeline.find((obj) => obj.id === getPieceControlObjectId(inPiece))).toBeUndefined()
		})

		it('autonext extension uses the additive outTransition duration', () => {
			const { objs } = buildWithCurrentAndNext(
				{ outTransition: { type: 'additive', duration: 1200 }, availablePostrollDuration: 5000 },
				[],
				createNextPartTimings({ toPartDelay: 1200, fromPartRemaining: 1200, transitionSource: 'none' })
			)

			expect(objs.timingContext?.currentPartGroup.enable).toEqual({ start: 'now', duration: 5000 + 1200 })
		})

		it('autonext extension ignores the additive outTransition duration when replaced by the autoNextOutTransition', () => {
			const { objs } = buildWithCurrentAndNext(
				{
					outTransition: { type: 'additive', duration: 1200 },
					autoNextOutTransition: exclusiveOutTransition,
					availablePostrollDuration: 5000,
				},
				[],
				createNextPartTimings({
					fromPartRemaining: 800,
					fromPartKeepalive: 800,
					transitionSource: 'autoNextOutTransition',
				})
			)

			expect(objs.timingContext?.currentPartGroup.enable).toEqual({ start: 'now', duration: 5000 + 800 })
		})

		it('autonext extension uses the keepalive of an exclusive outTransition', () => {
			const { objs } = buildWithCurrentAndNext(
				{ outTransition: exclusiveOutTransition, availablePostrollDuration: 5000 },
				[],
				createNextPartTimings({
					fromPartRemaining: 800,
					fromPartKeepalive: 800,
					transitionSource: 'outTransition',
				})
			)

			expect(objs.timingContext?.currentPartGroup.enable).toEqual({ start: 'now', duration: 5000 + 800 })
		})
	})

	describe('infinite pieces', () => {
		const PREVIOUS_PART_INSTANCE: SelectedPartInstanceTimelineInfo = {
			partTimes: createPartCurrentTimes(currentTime, 1234),
			partInstance: createMockPartInstance(
				'part9',
				{ autoNext: true, expectedDuration: 5000 },
				{
					timings: {
						plannedStartedPlayback: 1235,
					},
				}
			),
			pieceInstances: [createMockPieceInstance('piece9')],
			calculatedTimings: DEFAULT_PART_TIMINGS,
			regenerateTimelineAt: undefined,
		}

		it('infinite starting in current', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [PREVIOUS_PART_INSTANCE],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0'),
					pieceInstances: [
						createMockPieceInstance('piece0'),
						createMockInfinitePieceInstance('piece1', {}, { plannedStartedPlayback: undefined }),
					],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timeline).not.toHaveLength(0)
			expect(objs.timingContext).not.toBeUndefined()
			expect(transformTimelineIntoSimplifiedForm(objs)).toMatchSnapshot()
		})

		it('infinite ending with previous', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [
					{
						...PREVIOUS_PART_INSTANCE,
						pieceInstances: [
							...PREVIOUS_PART_INSTANCE.pieceInstances,
							createMockInfinitePieceInstance('piece6', {}, {}, 1),
						],
					},
				],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0'),
					pieceInstances: [createMockPieceInstance('piece0')],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timeline).not.toHaveLength(0)
			expect(objs.timingContext).not.toBeUndefined()
			expect(transformTimelineIntoSimplifiedForm(objs)).toMatchSnapshot()
		})

		it('infinite ending with previous excludeDuringPartKeepalive=true', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [
					{
						...PREVIOUS_PART_INSTANCE,
						pieceInstances: [
							...PREVIOUS_PART_INSTANCE.pieceInstances,
							createMockInfinitePieceInstance('piece6', { excludeDuringPartKeepalive: true }, {}, 1),
						],
					},
				],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0'),
					pieceInstances: [createMockPieceInstance('piece0')],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timeline).not.toHaveLength(0)
			expect(objs.timingContext).not.toBeUndefined()
			expect(transformTimelineIntoSimplifiedForm(objs)).toMatchSnapshot()
		})

		it('infinite continuing from previous', () => {
			const context = setupDefaultJobEnvironment()

			const infinitePiece = createMockInfinitePieceInstance('piece6')

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [
					{
						...PREVIOUS_PART_INSTANCE,
						pieceInstances: [...PREVIOUS_PART_INSTANCE.pieceInstances, infinitePiece],
					},
				],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance('part0'),
					pieceInstances: [createMockPieceInstance('piece0'), continueInfinitePiece(infinitePiece)],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timeline).not.toHaveLength(0)
			expect(objs.timingContext).not.toBeUndefined()
			expect(transformTimelineIntoSimplifiedForm(objs)).toMatchSnapshot()
		})

		it('infinite continuing into next with autonext', () => {
			const context = setupDefaultJobEnvironment()

			const infinitePiece = createMockInfinitePieceInstance('piece6')

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance(
						'part0',
						{ autoNext: true, expectedDuration: 5000 },
						{
							timings: {
								plannedStartedPlayback: 1235,
							},
						}
					),
					pieceInstances: [createMockPieceInstance('piece0'), infinitePiece],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
				next: {
					partTimes: createPartCurrentTimes(currentTime, undefined),
					partInstance: createMockPartInstance(
						'part1',
						{},
						{
							timings: {
								plannedStartedPlayback: 5000,
							},
						}
					),
					pieceInstances: [createMockPieceInstance('piece1'), continueInfinitePiece(infinitePiece)],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timeline).not.toHaveLength(0)
			expect(objs.timingContext).not.toBeUndefined()
			expect(transformTimelineIntoSimplifiedForm(objs)).toMatchSnapshot()
		})

		it('infinite stopping in current with autonext', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance(
						'part0',
						{ autoNext: true, expectedDuration: 5000 },
						{
							timings: {
								plannedStartedPlayback: 1235,
							},
						}
					),
					pieceInstances: [createMockPieceInstance('piece0'), createMockInfinitePieceInstance('piece6')],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
				next: {
					partTimes: createPartCurrentTimes(currentTime, undefined),
					partInstance: createMockPartInstance(
						'part1',
						{},
						{
							timings: {
								plannedStartedPlayback: 5000,
							},
						}
					),
					pieceInstances: [createMockPieceInstance('piece1')],
					calculatedTimings: {
						...DEFAULT_PART_TIMINGS,
						fromPartKeepalive: 100,
					},
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timeline).not.toHaveLength(0)
			expect(objs.timingContext).not.toBeUndefined()
			expect(transformTimelineIntoSimplifiedForm(objs)).toMatchSnapshot()
		})

		it('infinite stopping in current with autonext excludeDuringPartKeepalive=true', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 5678),
					partInstance: createMockPartInstance(
						'part0',
						{ autoNext: true, expectedDuration: 5000 },
						{
							timings: {
								plannedStartedPlayback: 1235,
							},
						}
					),
					pieceInstances: [
						createMockPieceInstance('piece0'),
						createMockInfinitePieceInstance('piece6', { excludeDuringPartKeepalive: true }),
					],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
				next: {
					partTimes: createPartCurrentTimes(currentTime, undefined),
					partInstance: createMockPartInstance(
						'part1',
						{},
						{
							timings: {
								plannedStartedPlayback: 5000,
							},
						}
					),
					pieceInstances: [createMockPieceInstance('piece1')],
					calculatedTimings: {
						...DEFAULT_PART_TIMINGS,
						fromPartKeepalive: 100,
					},
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			expect(objs.timeline).not.toHaveLength(0)
			expect(objs.timingContext).not.toBeUndefined()
			expect(transformTimelineIntoSimplifiedForm(objs)).toMatchSnapshot()
		})
	})

	describe('multiple previous parts', () => {
		function makeActivePrevInfo(
			id: string,
			plannedStartedPlayback: number,
			partStarted: number,
			fromPartRemaining: number,
			pieces: PieceInstanceWithTimings[] = []
		): SelectedPartInstanceTimelineInfo {
			return {
				partTimes: createPartCurrentTimes(currentTime, partStarted),
				partInstance: createMockPartInstance(id, {}, { timings: { plannedStartedPlayback } }),
				pieceInstances: pieces,
				calculatedTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining },
				regenerateTimelineAt: undefined,
			}
		}

		it('generates timeline objects for both previous parts', () => {
			const context = setupDefaultJobEnvironment()

			const prev0Info = makeActivePrevInfo('prev0', 7999, 8000, 5000)
			const prev1Info = makeActivePrevInfo('prev1', 2999, 3000, 2000)

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [prev0Info, prev1Info],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 9500),
					partInstance: createMockPartInstance('current', {}, { timings: { plannedStartedPlayback: 9499 } }),
					pieceInstances: [createMockPieceInstance('piece_current')],
					calculatedTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: 5000 },
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			const prev0GroupId = getPartGroupId(prev0Info.partInstance)
			const prev1GroupId = getPartGroupId(prev1Info.partInstance)

			// Both part groups must appear
			expect(objs.timeline.find((obj) => obj.id === prev0GroupId)).toBeTruthy()
			expect(objs.timeline.find((obj) => obj.id === prev1GroupId)).toBeTruthy()

			// Only the most-recent previous overlap goes into timingContext
			expect(objs.timingContext?.previousPartOverlap).toBe(5000)
		})

		it('chains previous[1] group end relative to previous[0] group start', () => {
			const context = setupDefaultJobEnvironment()

			// prev0's group ends at currentGroup.start + 3000 (from current.calculatedTimings.fromPartRemaining)
			// prev1's group ends at prev0Group.start + 4000 (from prev0.calculatedTimings.fromPartRemaining)
			const prev0Info = makeActivePrevInfo('prev0', 7999, 8000, 4000)
			const prev1Info = makeActivePrevInfo('prev1', 2999, 3000, 2000)

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [prev0Info, prev1Info],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 9500),
					partInstance: createMockPartInstance('current', {}, { timings: { plannedStartedPlayback: 9499 } }),
					pieceInstances: [],
					calculatedTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: 3000 },
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			const prev0GroupId = getPartGroupId(prev0Info.partInstance)
			const prev1GroupId = getPartGroupId(prev1Info.partInstance)
			const currentGroupId = objs.timingContext!.currentPartGroup.id

			const prev0Group = objs.timeline.find((obj) => obj.id === prev0GroupId)
			expect(prev0Group).toBeTruthy()
			expect(prev0Group!.enable).toMatchObject({ end: `#${currentGroupId}.start + 3000` })

			const prev1Group = objs.timeline.find((obj) => obj.id === prev1GroupId)
			expect(prev1Group).toBeTruthy()
			expect(prev1Group!.enable).toMatchObject({ end: `#${prev0GroupId}.start + 4000` })
		})

		it('skips a previous part that never had plannedStartedPlayback', () => {
			const context = setupDefaultJobEnvironment()

			const prev0NoPlayback: SelectedPartInstanceTimelineInfo = {
				partTimes: createPartCurrentTimes(currentTime, 8000),
				partInstance: createMockPartInstance('prev0noPB'),
				pieceInstances: [createMockPieceInstance('piece_prev0noPB')],
				calculatedTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: 5000 },
				regenerateTimelineAt: undefined,
			}

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [prev0NoPlayback],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 9500),
					partInstance: createMockPartInstance('current', {}, { timings: { plannedStartedPlayback: 9499 } }),
					pieceInstances: [],
					calculatedTimings: DEFAULT_PART_TIMINGS,
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			const prev0GroupId = getPartGroupId(prev0NoPlayback.partInstance)
			expect(objs.timeline.find((obj) => obj.id === prev0GroupId)).toBeFalsy()
			expect(objs.timingContext?.previousPartOverlap).toBeUndefined()
		})

		it('does not create dangling references when previous[0] is skipped and previous[1] is active', () => {
			const context = setupDefaultJobEnvironment()

			const prev0NoPlayback: SelectedPartInstanceTimelineInfo = {
				partTimes: createPartCurrentTimes(currentTime, 8000),
				partInstance: createMockPartInstance('prev0noPB'),
				pieceInstances: [createMockPieceInstance('piece_prev0noPB')],
				calculatedTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: 5000 },
				regenerateTimelineAt: undefined,
			}

			const prev1Active = makeActivePrevInfo('prev1active', 2999, 3000, 2000)

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: [prev0NoPlayback, prev1Active],
				current: {
					partTimes: createPartCurrentTimes(currentTime, 9500),
					partInstance: createMockPartInstance('current', {}, { timings: { plannedStartedPlayback: 9499 } }),
					pieceInstances: [],
					calculatedTimings: { ...DEFAULT_PART_TIMINGS, fromPartRemaining: 3000 },
					regenerateTimelineAt: undefined,
				},
			}

			const playlist = createMockPlaylist(selectedPartInfos)
			const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

			const prev0GroupId = getPartGroupId(prev0NoPlayback.partInstance)
			const prev1GroupId = getPartGroupId(prev1Active.partInstance)
			const currentGroupId = objs.timingContext!.currentPartGroup.id

			expect(objs.timeline.find((obj) => obj.id === prev0GroupId)).toBeFalsy()

			// prev1 must be emitted and must chain to the current group (not the skipped prev0 group)
			const prev1Group = objs.timeline.find((obj) => obj.id === prev1GroupId)
			expect(prev1Group).toBeTruthy()
			// prev1 chains to the current group using currentPartInstanceTimings.fromPartRemaining (3000),
			// because prev0 was skipped so nextPartTimings stays as currentPartInstanceTimings
			expect(prev1Group!.enable).toMatchObject({ end: `#${currentGroupId}.start + 3000` })
		})
	})
})
