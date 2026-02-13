import { TimelineObjHoldMode, TimelineObjOnAirMode } from '@sofie-automation/blueprints-integration'
import { shouldIncludeObjectOnTimeline, TimelinePlayoutState } from '../lib.js'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { TimelineObjectCoreExt } from '@sofie-automation/blueprints-integration'

describe('shouldIncludeObjectOnTimeline', () => {
	describe('holdMode filtering', () => {
		it('should include object with NORMAL holdMode when not in hold', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: false,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				holdMode: TimelineObjHoldMode.NORMAL,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(true)
		})

		it('should include object with NORMAL holdMode when in hold', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: true,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				holdMode: TimelineObjHoldMode.NORMAL,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(true)
		})

		it('should include object with undefined holdMode when not in hold', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: false,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(true)
		})

		it('should include object with undefined holdMode when in hold', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: true,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(true)
		})

		it('should include object with EXCEPT holdMode when not in hold', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: false,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				holdMode: TimelineObjHoldMode.EXCEPT,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(true)
		})

		it('should exclude object with EXCEPT holdMode when in hold', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: true,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				holdMode: TimelineObjHoldMode.EXCEPT,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(false)
		})

		it('should include object with EXCEPT holdMode when in hold but includeWhenNotInHoldObjects is true', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: true,
				includeWhenNotInHoldObjects: true,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				holdMode: TimelineObjHoldMode.EXCEPT,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(true)
		})

		it('should exclude object with ONLY holdMode when not in hold', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: false,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				holdMode: TimelineObjHoldMode.ONLY,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(false)
		})

		it('should include object with ONLY holdMode when in hold', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: true,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				holdMode: TimelineObjHoldMode.ONLY,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(true)
		})
	})

	describe('onAirMode filtering', () => {
		it('should include object with ALWAYS onAirMode when on air', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: false,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				onAirMode: TimelineObjOnAirMode.ALWAYS,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(true)
		})

		it('should include object with ALWAYS onAirMode when in rehearsal', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: true,
				isInHold: false,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				onAirMode: TimelineObjOnAirMode.ALWAYS,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(true)
		})

		it('should include object with undefined onAirMode when on air', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: false,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(true)
		})

		it('should include object with undefined onAirMode when in rehearsal', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: true,
				isInHold: false,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(true)
		})

		it('should include object with ONAIR onAirMode when on air', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: false,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				onAirMode: TimelineObjOnAirMode.ONAIR,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(true)
		})

		it('should exclude object with ONAIR onAirMode when in rehearsal', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: true,
				isInHold: false,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				onAirMode: TimelineObjOnAirMode.ONAIR,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(false)
		})

		it('should exclude object with REHEARSAL onAirMode when on air', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: false,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				onAirMode: TimelineObjOnAirMode.REHEARSAL,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(false)
		})

		it('should include object with REHEARSAL onAirMode when in rehearsal', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: true,
				isInHold: false,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				onAirMode: TimelineObjOnAirMode.REHEARSAL,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(true)
		})
	})

	describe('combined holdMode and onAirMode filtering', () => {
		it('should exclude object with EXCEPT holdMode in hold, even if onAirMode would allow it', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: true,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				holdMode: TimelineObjHoldMode.EXCEPT,
				onAirMode: TimelineObjOnAirMode.ONAIR,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(false)
		})

		it('should exclude object with ONLY holdMode when not in hold, even if onAirMode would allow it', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: false,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				holdMode: TimelineObjHoldMode.ONLY,
				onAirMode: TimelineObjOnAirMode.ONAIR,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(false)
		})

		it('should exclude object with ONAIR onAirMode in rehearsal, even if holdMode would allow it', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: true,
				isInHold: false,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				holdMode: TimelineObjHoldMode.NORMAL,
				onAirMode: TimelineObjOnAirMode.ONAIR,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(false)
		})

		it('should exclude object with REHEARSAL onAirMode when on air, even if holdMode would allow it', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: false,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				holdMode: TimelineObjHoldMode.NORMAL,
				onAirMode: TimelineObjOnAirMode.REHEARSAL,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(false)
		})

		it('should include object with ONLY holdMode and REHEARSAL onAirMode when in hold and in rehearsal', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: true,
				isInHold: true,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				holdMode: TimelineObjHoldMode.ONLY,
				onAirMode: TimelineObjOnAirMode.REHEARSAL,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(true)
		})

		it('should include object with NORMAL holdMode and ONAIR onAirMode when not in hold and on air', () => {
			const playoutState = literal<TimelinePlayoutState>({
				isRehearsal: false,
				isInHold: false,
			})
			const object = literal<TimelineObjectCoreExt<any>>({
				id: 'test',
				enable: { start: 0 },
				layer: 'layer1',
				content: { deviceType: 0 },
				priority: 0,
				holdMode: TimelineObjHoldMode.NORMAL,
				onAirMode: TimelineObjOnAirMode.ONAIR,
			})

			expect(shouldIncludeObjectOnTimeline(playoutState, object)).toBe(true)
		})
	})
})
