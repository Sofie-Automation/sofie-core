import { TimelineObjRundown, TimelineObjType } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { deNowifyInfinites } from '../multi-gateway.js'
import { TSR } from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/corelib/dist/lib'

describe('Multi-gateway', () => {
	describe('deNowifyInfinites', () => {
		test('preserves other enable properties when de-nowifying', () => {
			const targetNowTime = 1000
			const obj1 = literal<TimelineObjRundown>({
				id: 'obj1',
				enable: {
					start: 'now',
					duration: 500,
				},
				layer: 'layer1',
				content: {
					deviceType: TSR.DeviceType.ABSTRACT,
				},
				objectType: TimelineObjType.RUNDOWN,
				priority: 0,
			})

			const timelineObjsMap = {
				[obj1.id]: obj1,
			}

			deNowifyInfinites(targetNowTime, [obj1], timelineObjsMap)

			expect(obj1.enable).toEqual({
				start: targetNowTime,
				duration: 500,
			})
		})

		test('preserves other enable properties when de-nowifying with parent group', () => {
			const targetNowTime = 1500
			const parentObj = literal<TimelineObjRundown>({
				id: 'parent',
				enable: {
					start: 500,
				},
				layer: 'parentLayer',
				content: {
					deviceType: TSR.DeviceType.ABSTRACT,
				},
				objectType: TimelineObjType.RUNDOWN,
				priority: 0,
			})

			const obj1 = literal<TimelineObjRundown>({
				id: 'obj1',
				inGroup: 'parent',
				enable: {
					start: 'now',
					duration: 200,
				},
				layer: 'layer1',
				content: {
					deviceType: TSR.DeviceType.ABSTRACT,
				},
				objectType: TimelineObjType.RUNDOWN,
				priority: 0,
			})

			const timelineObjsMap = {
				[parentObj.id]: parentObj,
				[obj1.id]: obj1,
			}

			deNowifyInfinites(targetNowTime, [obj1], timelineObjsMap)

			expect(obj1.enable).toEqual({
				start: targetNowTime - 500, // 1500 - 500 = 1000
				duration: 200,
			})
		})

		test('does nothing if start is not "now"', () => {
			const targetNowTime = 1000
			const obj1 = literal<TimelineObjRundown>({
				id: 'obj1',
				enable: {
					start: 500,
					duration: 500,
				},
				layer: 'layer1',
				content: {
					deviceType: TSR.DeviceType.ABSTRACT,
				},
				objectType: TimelineObjType.RUNDOWN,
				priority: 0,
			})

			const timelineObjsMap = {
				[obj1.id]: obj1,
			}

			deNowifyInfinites(targetNowTime, [obj1], timelineObjsMap)

			expect(obj1.enable).toEqual({
				start: 500,
				duration: 500,
			})
		})
	})
})
