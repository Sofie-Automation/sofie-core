/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DBRundownPlaylist, SelectedPartInstance } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
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
import { getPartGroupId } from '@sofie-automation/corelib/dist/playout/ids'

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
			previousPartInfo: convertSelectedPartInstance(selectedPartInfos.previous),
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

		const selectedPartInfos: SelectedPartInstancesTimelineInfo = {}

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
			previous: {
				partTimes: createPartCurrentTimes(currentTime, 5678),
				partInstance: createMockPartInstance('part0'),
				pieceInstances: [],
				calculatedTimings: DEFAULT_PART_TIMINGS,
				regenerateTimelineAt: undefined,
			},
		}

		const playlist = createMockPlaylist(selectedPartInfos)
		const objs = buildTimelineObjsForRundown(context, playlist, selectedPartInfos, true)

		expect(objs.timeline).toHaveLength(1)
		expect(objs.timingContext).toBeUndefined()
	})

	it('simple current part', () => {
		const context = setupDefaultJobEnvironment()

		const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
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
			previous: {
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
		const previousPartGroupId = getPartGroupId(selectedPartInfos.previous!.partInstance)
		expect(objs.timeline.find((obj) => obj.id === previousPartGroupId)).toBeTruthy()
		expect(objs.timingContext?.previousPartOverlap).not.toBeUndefined()
	})

	describe('overlap and keepalive', () => {
		it('current and previous parts', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: {
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
			const previousPartGroupId = getPartGroupId(selectedPartInfos.previous!.partInstance)
			expect(objs.timeline.find((obj) => obj.id === previousPartGroupId)).toBeTruthy()
			expect(objs.timingContext?.previousPartOverlap).not.toBeUndefined()
		})

		it('current and previous parts with excludeDuringPartKeepalive', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
				previous: {
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
			const previousPartGroupId = getPartGroupId(selectedPartInfos.previous!.partInstance)
			expect(objs.timeline.find((obj) => obj.id === previousPartGroupId)).toBeTruthy()
			expect(objs.timingContext?.previousPartOverlap).not.toBeUndefined()
		})

		it('autonext into next part', () => {
			const context = setupDefaultJobEnvironment()

			const selectedPartInfos: SelectedPartInstancesTimelineInfo = {
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
				previous: PREVIOUS_PART_INSTANCE,
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
				previous: {
					...PREVIOUS_PART_INSTANCE,
					pieceInstances: [
						...PREVIOUS_PART_INSTANCE.pieceInstances,
						createMockInfinitePieceInstance('piece6', {}, {}, 1),
					],
				},
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
				previous: {
					...PREVIOUS_PART_INSTANCE,
					pieceInstances: [
						...PREVIOUS_PART_INSTANCE.pieceInstances,
						createMockInfinitePieceInstance('piece6', { excludeDuringPartKeepalive: true }, {}, 1),
					],
				},
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
				previous: {
					...PREVIOUS_PART_INSTANCE,
					pieceInstances: [...PREVIOUS_PART_INSTANCE.pieceInstances, infinitePiece],
				},
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
})
