/**
 * Adversarial test for the TSR end of the TimelineDatastore: datastore values, datastore keys and
 * `$references` paths containing `.` or `$`.
 *
 * The gateway turns the published TimelineDatastore documents into a TSR `Datastore` (see
 * `TSRHandler._updateDatastore`), and TSR fills timeline object content from it (`fillStateFromDatastore`),
 * re-sending device states when a referenced value changes (`Conductor.setDatastore`).
 */
import { Datastore, DeviceTimelineState, fillStateFromDatastore } from 'timeline-state-resolver-types'
import { Conductor } from 'timeline-state-resolver/dist/conductor'

// The device registry pulls in every device integration (some of which are ESM-only, which jest can't load).
// No devices are needed here: device state is captured by stubbing `connectionManager.getConnection`.
jest.mock('timeline-state-resolver/dist/service/devicesRegistry', () => ({ DevicesRegistry: class {} }))

/** Builds the TSR datastore the same way as `TSRHandler._updateDatastore` */
function buildDatastore(docs: Array<{ key: string; value: unknown; modified: number }>): Datastore {
	const datastore: Datastore = {}
	for (const { key, value, modified } of docs) {
		datastore[key] = { value, modified }
	}
	return datastore
}

/** A device state with one timeline object whose content references the datastore */
function makeState(
	content: Record<string, unknown>,
	references: Record<string, { datastoreKey: string; overwrite?: boolean }>
): DeviceTimelineState {
	return {
		time: 0,
		objects: [
			{
				id: 'obj0',
				layer: 'layer0',
				priority: 0,
				content: {
					...content,
					$references: Object.fromEntries(
						Object.entries<{ datastoreKey: string; overwrite?: boolean }>(references).map(([path, ref]) => [
							path,
							{ overwrite: false, ...ref },
						])
					),
				},
				instance: { id: 'obj0_instance', start: 0, end: null },
			} as any,
		],
	}
}

function filledContent(state: DeviceTimelineState, datastore: Datastore): any {
	return fillStateFromDatastore(state, datastore).objects[0].content
}

const hostileValues: Array<[string, unknown]> = [
	['dotted field name', { 'a.b': 1 }],
	['field name that is only a dot', { '.': 1 }],
	['dotted field colliding with a nested path', { 'a.b': 1, a: { b: 2 } }],
	['nested dotted field name', { x: { 'y.z': 1 } }],
	['dotted field name inside an array', [{ 'a.b': 1 }]],
	['$-prefixed field name', { $foo: 1 }],
	['nested $-prefixed field name', { x: { $foo: 1 } }],
	['$references lookalike', { $references: { a: { datastoreKey: 'other', overwrite: false } } }],
	['EJSON $date lookalike', { $date: 0 }],
]

describe('TSR datastore: hostile field names', () => {
	describe('datastore value', () => {
		test.each(hostileValues)('%s is applied to the content unchanged', (_name, value) => {
			const datastore = buildDatastore([{ key: 'myKey', value, modified: 1 }])
			const content = filledContent(
				makeState({ target: 'default' }, { target: { datastoreKey: 'myKey' } }),
				datastore
			)

			expect(content.target).toEqual(value)
		})
	})

	describe('datastore key', () => {
		test.each(['foo.bar', '$foo', '.', '$', 'a.$b'])('%j resolves to its value', (key) => {
			const datastore = buildDatastore([{ key, value: 42, modified: 1 }])
			const content = filledContent(
				makeState({ target: 'default' }, { target: { datastoreKey: key } }),
				datastore
			)

			expect(content.target).toBe(42)
		})
	})

	describe('$references path', () => {
		test.each(['a.b', 'a.b.c', '$foo', 'a.$b'])('%j is set on the content', (path) => {
			const datastore = buildDatastore([{ key: 'myKey', value: 42, modified: 1 }])
			const content = filledContent(makeState({}, { [path]: { datastoreKey: 'myKey' } }), datastore)

			let target: any = content
			for (const part of path.split('.')) target = target?.[part]
			expect(target).toBe(42)
		})
	})

	describe('Conductor.setDatastore', () => {
		let conductor: Conductor
		let handleState: jest.Mock
		beforeEach(() => {
			conductor = new Conductor({ getCurrentTime: () => 1000 })
			handleState = jest.fn(async () => undefined)
			jest.spyOn(conductor.connectionManager, 'getConnection').mockReturnValue({
				device: { handleState },
			} as any)
		})
		afterEach(async () => {
			await conductor.destroy()
		})

		/** Make the conductor hold a current device state that depends on `key`, as after a timeline resolve */
		function setDeviceStateDependingOn(key: string) {
			;(conductor as any)._deviceStates = {
				device0: [
					{
						state: makeState({ target: 'default' }, { target: { datastoreKey: key } }),
						dependencies: [key],
						mappings: {},
					},
				],
			}
		}

		async function setDatastore(datastore: Datastore) {
			conductor.setDatastore(datastore)
			await (conductor as any)._actionQueue.onIdle()
		}

		test.each(['normal', 'foo.bar', '$foo'])(
			're-sends the device state when the value of %j changes',
			async (key) => {
				setDeviceStateDependingOn(key)

				await setDatastore(buildDatastore([{ key, value: 1, modified: 1 }]))
				await setDatastore(buildDatastore([{ key, value: 2, modified: 2 }]))

				expect(handleState).toHaveBeenCalledTimes(2)
				expect(handleState.mock.calls[1][0].objects[0].content.target).toBe(2)
			}
		)
	})
})
