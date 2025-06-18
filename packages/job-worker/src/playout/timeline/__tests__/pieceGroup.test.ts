import { getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { createPieceGroupAndCap, PieceTimelineMetadata } from '../pieceGroup'
import {
	OnGenerateTimelineObjExt,
	TimelineContentTypeOther,
	TimelineObjGroupRundown,
	TimelineObjPieceAbstract,
	TimelineObjRundown,
	TimelineObjType,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { TSR } from '@sofie-automation/blueprints-integration'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PlayoutChangedType } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'

type PieceInstanceParam = Parameters<typeof createPieceGroupAndCap>[1]

type TimelineEnable = TSR.Timeline.TimelineEnable

describe('Pieces', () => {
	describe('createPieceGroupAndCap', () => {
		function createFakePiece(enable: Piece['enable'], sourceLayerId: string): Piece {
			return {
				enable,
				sourceLayerId,
			} as any
		}

		const playlistId: RundownPlaylistId = getRandomId()

		const simplePieceInstance = literal<PieceInstanceParam>({
			_id: protectString('randomId9000'),
			rundownId: getRandomId(),
			partInstanceId: protectString('randomId9002'),
			piece: createFakePiece({ start: 10 }, 'some-layer'),
			infinite: undefined,
			resolvedEndCap: undefined,
			priority: 123,
		})
		const simplePieceGroup = literal<TimelineObjGroupRundown & OnGenerateTimelineObjExt<PieceTimelineMetadata>>({
			children: [],
			content: {
				deviceType: 'ABSTRACT' as TSR.DeviceType.ABSTRACT,
				type: TimelineContentTypeOther.GROUP,
			},
			enable: {
				start: '#piece_group_control_randomId9000.start - 0',
				end: '#piece_group_control_randomId9000.end + 0',
			},
			id: 'piece_group_randomId9000',
			inGroup: undefined,
			infinitePieceInstanceId: undefined,
			isGroup: true,
			layer: '',
			metaData: {
				pieceInstanceGroupId: protectString('randomId9000'),
				isPieceTimeline: true,
			},
			objectType: TimelineObjType.RUNDOWN,
			pieceInstanceId: 'randomId9000',
			partInstanceId: protectString('randomId9002'),
			priority: 0,
		})
		const simplePieceControl = literal<TimelineObjPieceAbstract & OnGenerateTimelineObjExt<PieceTimelineMetadata>>({
			content: {
				deviceType: 'ABSTRACT' as TSR.DeviceType.ABSTRACT,
				type: 'callback',
				callBack: PlayoutChangedType.PIECE_PLAYBACK_STARTED,
				callBackData: {
					rundownPlaylistId: playlistId,
					partInstanceId: protectString('randomId9002'),
					pieceInstanceId: protectString('randomId9000'),
					dynamicallyInserted: false,
				},
				callBackStopped: PlayoutChangedType.PIECE_PLAYBACK_STOPPED,
			},
			enable: {
				end: undefined,
				start: 10,
			},
			id: 'piece_group_control_randomId9000',
			inGroup: undefined,
			infinitePieceInstanceId: undefined,
			layer: 'some-layer',
			metaData: {
				isPieceTimeline: true,
				triggerPieceInstanceId: protectString('randomId9000'),
			},
			objectType: TimelineObjType.RUNDOWN,
			pieceInstanceId: 'randomId9000',
			partInstanceId: protectString('randomId9002'),
			priority: 123,
			classes: [],
		})
		const partGroup = { id: 'randomId9003' } as any as TimelineObjRundown

		test('Basic piece', () => {
			const res = createPieceGroupAndCap(playlistId, simplePieceInstance, simplePieceInstance.piece.enable)

			expect(res.capObjs).toHaveLength(0)
			expect(res.childGroup).toStrictEqual(simplePieceGroup)
			expect(res.controlObj).toStrictEqual(simplePieceControl)
		})
		test('Basic piece with a partGroup', () => {
			const res = createPieceGroupAndCap(
				playlistId,
				simplePieceInstance,
				simplePieceInstance.piece.enable,
				[],
				partGroup
			)

			expect(res.capObjs).toHaveLength(0)
			expect(res.childGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
			})
			expect(res.controlObj).toStrictEqual({
				...simplePieceControl,
				inGroup: partGroup.id,
				classes: [],
			})
		})
		test('override enable', () => {
			const enable: TimelineEnable = { start: 'abc + 3', end: 999 }
			const res = createPieceGroupAndCap(playlistId, simplePieceInstance, enable, [], partGroup)

			expect(res.capObjs).toHaveLength(0)
			expect(res.childGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
			})
			expect(res.controlObj).toStrictEqual({
				...simplePieceControl,
				inGroup: partGroup.id,
				classes: [],
				enable,
			})
		})
		test('Numeric end cap with resolvedEndCap', () => {
			const enable: TimelineEnable = { start: 'abc + 3', end: 999 }

			{
				// cap is sooner
				const pieceInstance: PieceInstanceParam = {
					...simplePieceInstance,
					resolvedEndCap: 800,
				}
				const res = createPieceGroupAndCap(playlistId, pieceInstance, enable, [], partGroup)

				expect(res.capObjs).toHaveLength(0)
				expect(res.childGroup).toStrictEqual({
					...simplePieceGroup,
					inGroup: partGroup.id,
				})
				expect(res.controlObj).toStrictEqual({
					...simplePieceControl,
					inGroup: partGroup.id,
					classes: [],
					enable: {
						...enable,
						end: 800,
					},
				})
			}

			{
				// cap is later
				const pieceInstance: PieceInstanceParam = {
					...simplePieceInstance,
					resolvedEndCap: 8000,
				}
				const res = createPieceGroupAndCap(playlistId, pieceInstance, enable, [], partGroup)

				expect(res.capObjs).toHaveLength(0)
				expect(res.childGroup).toStrictEqual({
					...simplePieceGroup,
					inGroup: partGroup.id,
				})
				expect(res.controlObj).toStrictEqual({
					...simplePieceControl,
					inGroup: partGroup.id,
					classes: [],
					enable,
				})
			}
		})
		test('Numeric duration with resolvedEndCap', () => {
			{
				// numeric start
				const enable: TimelineEnable = { start: 234, duration: 999 }
				const pieceInstance: PieceInstanceParam = {
					...simplePieceInstance,
					resolvedEndCap: 800,
				}
				const res = createPieceGroupAndCap(playlistId, pieceInstance, enable, [], partGroup)

				expect(res.capObjs).toHaveLength(0)
				expect(res.childGroup).toStrictEqual({
					...simplePieceGroup,
					inGroup: partGroup.id,
				})
				expect(res.controlObj).toStrictEqual({
					...simplePieceControl,
					inGroup: partGroup.id,
					classes: [],
					enable: {
						start: enable.start,
						end: 800,
					},
				})
			}

			{
				// string start
				const enable: TimelineEnable = { start: 'abc + 3', duration: 999 }
				const pieceInstance: PieceInstanceParam = {
					...simplePieceInstance,
					resolvedEndCap: 800,
				}
				const res = createPieceGroupAndCap(playlistId, pieceInstance, enable, [], partGroup)

				expect(res.capObjs).toStrictEqual([
					{
						children: [],
						content: { deviceType: 'ABSTRACT', type: 'group' },
						enable: { end: 800, start: 0 },
						id: 'piece_group_control_randomId9000_cap',
						inGroup: 'randomId9003',
						isGroup: true,
						layer: '',
						objectType: 'rundown',
						partInstanceId: 'randomId9002',
						metaData: {
							isPieceTimeline: true,
						},
						priority: 0,
					},
				])
				expect(res.childGroup).toStrictEqual({
					...simplePieceGroup,
					inGroup: partGroup.id,
				})
				expect(res.controlObj).toStrictEqual({
					...simplePieceControl,
					inGroup: 'piece_group_control_randomId9000_cap',
					classes: [],
					enable,
				})
			}
		})
		test('Basic piece - unbounded piece', () => {
			const enable: TimelineEnable = { start: 'abc + 3' }

			const pieceInstance: PieceInstanceParam = {
				...simplePieceInstance,
				resolvedEndCap: 800,
			}
			const res = createPieceGroupAndCap(playlistId, pieceInstance, enable, [], partGroup)

			expect(res.capObjs).toHaveLength(0)
			expect(res.childGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
			})
			expect(res.controlObj).toStrictEqual({
				...simplePieceControl,
				inGroup: partGroup.id,
				classes: [],
				enable: {
					...enable,
					end: 800,
				},
			})
		})

		test('resolvedEndCap of now and numeric piece end', () => {
			const enable: TimelineEnable = { start: 'abc + 3', end: 999 }

			const pieceInstance: PieceInstanceParam = {
				...simplePieceInstance,
				resolvedEndCap: { offsetFromNow: 99 },
			}
			const res = createPieceGroupAndCap(playlistId, pieceInstance, enable, [], partGroup)

			expect(res.capObjs).toStrictEqual([
				{
					content: { deviceType: 'ABSTRACT' },
					enable: { start: 'now' },
					id: 'piece_group_control_randomId9000_cap_now',
					layer: '',
					objectType: 'rundown',
					partInstanceId: 'randomId9002',
					metaData: {
						isPieceTimeline: true,
					},
					priority: 0,
				},
				{
					children: [],
					content: { deviceType: 'ABSTRACT', type: 'group' },
					enable: { end: '#piece_group_control_randomId9000_cap_now.start + 99', start: 0 },
					id: 'piece_group_control_randomId9000_cap',
					inGroup: partGroup.id,
					isGroup: true,
					layer: '',
					objectType: 'rundown',
					partInstanceId: 'randomId9002',
					metaData: {
						isPieceTimeline: true,
					},
					priority: 0,
				},
			])
			expect(res.childGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
			})
			expect(res.controlObj).toStrictEqual({
				...simplePieceControl,
				inGroup: 'piece_group_control_randomId9000_cap',
				classes: [],
				enable,
			})
		})

		test('resolvedEndCap of now and no piece end', () => {
			const enable: TimelineEnable = { start: 'abc + 3' }

			const pieceInstance: PieceInstanceParam = {
				...simplePieceInstance,
				resolvedEndCap: { offsetFromNow: 0 },
			}
			const res = createPieceGroupAndCap(playlistId, pieceInstance, enable, [], partGroup)

			expect(res.capObjs).toStrictEqual([
				{
					content: { deviceType: 'ABSTRACT' },
					enable: { start: 'now' },
					id: 'piece_group_control_randomId9000_cap_now',
					layer: '',
					objectType: 'rundown',
					partInstanceId: 'randomId9002',
					metaData: {
						isPieceTimeline: true,
					},
					priority: 0,
				},
			])
			expect(res.childGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
			})
			expect(res.controlObj).toStrictEqual({
				...simplePieceControl,
				inGroup: partGroup.id,
				classes: [],
				enable: {
					...enable,
					end: '#piece_group_control_randomId9000_cap_now.start + 0',
				},
			})
		})

		test('resolvedEndCap of now and reference piece end', () => {
			const enable: TimelineEnable = { start: 'abc + 3', end: 'def - 9' }

			const pieceInstance: PieceInstanceParam = {
				...simplePieceInstance,
				resolvedEndCap: { offsetFromNow: 0 },
			}
			const res = createPieceGroupAndCap(playlistId, pieceInstance, enable, [], partGroup)

			expect(res.capObjs).toStrictEqual([
				{
					content: { deviceType: 'ABSTRACT' },
					enable: { start: 'now' },
					id: 'piece_group_control_randomId9000_cap_now',
					layer: '',
					objectType: 'rundown',
					partInstanceId: 'randomId9002',
					metaData: {
						isPieceTimeline: true,
					},
					priority: 0,
				},
				{
					children: [],
					content: { deviceType: 'ABSTRACT', type: 'group' },
					enable: { end: '#piece_group_control_randomId9000_cap_now.start + 0', start: 0 },
					id: 'piece_group_control_randomId9000_cap',
					inGroup: partGroup.id,
					isGroup: true,
					layer: '',
					objectType: 'rundown',
					partInstanceId: 'randomId9002',
					metaData: {
						isPieceTimeline: true,
					},
					priority: 0,
				},
			])
			expect(res.childGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
			})
			expect(res.controlObj).toStrictEqual({
				...simplePieceControl,
				inGroup: 'piece_group_control_randomId9000_cap',
				classes: [],
				enable,
			})
		})

		test('resolvedEndCap of relative and piece relative end', () => {
			const enable: TimelineEnable = { start: 'abc + 3', end: 'def - 9' }

			const pieceInstance: PieceInstanceParam = {
				...simplePieceInstance,
				resolvedEndCap: { offsetFromNow: 99 },
			}
			const res = createPieceGroupAndCap(playlistId, pieceInstance, enable, [], partGroup)

			expect(res.capObjs).toStrictEqual([
				{
					content: { deviceType: 'ABSTRACT' },
					enable: { start: 'now' },
					id: 'piece_group_control_randomId9000_cap_now',
					layer: '',
					objectType: 'rundown',
					partInstanceId: 'randomId9002',
					metaData: {
						isPieceTimeline: true,
					},
					priority: 0,
				},
				{
					children: [],
					content: { deviceType: 'ABSTRACT', type: 'group' },
					enable: { end: '#piece_group_control_randomId9000_cap_now.start + 99', start: 0 },
					id: 'piece_group_control_randomId9000_cap',
					inGroup: partGroup.id,
					isGroup: true,
					layer: '',
					objectType: 'rundown',
					partInstanceId: 'randomId9002',
					metaData: {
						isPieceTimeline: true,
					},
					priority: 0,
				},
			])
			expect(res.childGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
			})
			expect(res.controlObj).toStrictEqual({
				...simplePieceControl,
				inGroup: 'piece_group_control_randomId9000_cap',
				classes: [],
				enable,
			})
		})

		test('resolvedEndCap of relative and no piece end', () => {
			const enable: TimelineEnable = { start: 'abc + 3' }

			const pieceInstance: PieceInstanceParam = {
				...simplePieceInstance,
				resolvedEndCap: { offsetFromNow: 99 },
			}
			const res = createPieceGroupAndCap(playlistId, pieceInstance, enable, [], partGroup)

			expect(res.capObjs).toStrictEqual([
				{
					content: { deviceType: 'ABSTRACT' },
					enable: { start: 'now' },
					id: 'piece_group_control_randomId9000_cap_now',
					layer: '',
					objectType: 'rundown',
					partInstanceId: 'randomId9002',
					metaData: {
						isPieceTimeline: true,
					},
					priority: 0,
				},
			])
			expect(res.childGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
			})
			expect(res.controlObj).toStrictEqual({
				...simplePieceControl,
				inGroup: partGroup.id,
				classes: [],
				enable: {
					...enable,
					end: '#piece_group_control_randomId9000_cap_now.start + 99',
				},
			})
		})

		test('resolvedEndCap with piece start offset', () => {
			const enable: TimelineEnable = { start: 0 }

			const pieceInstance: PieceInstanceParam = {
				...simplePieceInstance,
				resolvedEndCap: 500,
			}

			// No offset
			const res = createPieceGroupAndCap(playlistId, pieceInstance, enable, [], partGroup)
			expect(res.capObjs).toHaveLength(0)
			expect(res.childGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
			})
			expect(res.controlObj).toStrictEqual({
				...simplePieceControl,
				inGroup: partGroup.id,
				classes: [],
				enable: {
					...enable,
					end: 500,
				},
			})

			// Factor in offset
			const res2 = createPieceGroupAndCap(playlistId, pieceInstance, enable, [], partGroup, 100)
			expect(res2.capObjs).toHaveLength(0)
			expect(res2.childGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
			})
			expect(res2.controlObj).toStrictEqual({
				...simplePieceControl,
				inGroup: partGroup.id,
				classes: [],
				enable: {
					...enable,
					end: 600,
				},
			})
		})
	})
})
