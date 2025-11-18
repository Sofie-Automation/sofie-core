import {
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { Rundowns } from '../../../collections'
import { runAllTimers, runTimersUntilNow, waitUntil } from '../../../../__mocks__/helpers/jest'
import { MongoMock } from '../../../../__mocks__/mongo'
import { RundownsObserver } from '../rundownsObserver'

const RundownsMock = (Rundowns as any).mockCollection as MongoMock.Collection<Rundown>

const MAX_WAIT_TIME = 4000

describe('RundownsObserver', () => {
	beforeEach(() => {
		jest.useFakeTimers()
	})

	test('create and destroy observer', async () => {
		const studioId = protectString<StudioId>('studio0')
		const playlistId = protectString<RundownPlaylistId>('playlist0')

		const onChangedCleanup = jest.fn()
		const onChanged = jest.fn(async () => onChangedCleanup)

		// should not be any observers yet
		expect(RundownsMock.observers).toHaveLength(0)

		const observer = await RundownsObserver.createForPlaylist(studioId, playlistId, onChanged)
		try {
			// should now be an observer
			expect(RundownsMock.observers).toHaveLength(1)

			// Before debounce
			expect(onChanged).toHaveBeenCalledTimes(0)

			// After debounce
			await waitUntil(async () => {
				// Run timers, so that promises in the observer has a chance to resolve:
				await runAllTimers()
				expect(onChanged).toHaveBeenCalledTimes(1)
				expect(onChangedCleanup).toHaveBeenCalledTimes(0)
			}, MAX_WAIT_TIME)

			// still got an observer
			expect(RundownsMock.observers).toHaveLength(1)

			// get the mock observer, and ensure to looks sane
			expect(RundownsMock.observers).toHaveLength(1)
			const mockObserver = RundownsMock.observers[0]
			expect(mockObserver).toBeTruthy()
			expect(mockObserver.callbacksChanges).toBeFalsy()
			expect(mockObserver.callbacksObserve).toBeTruthy()
			expect(mockObserver.callbacksObserve?.added).toBeTruthy()
			expect(mockObserver.callbacksObserve?.changed).toBeTruthy()
			expect(mockObserver.callbacksObserve?.removed).toBeTruthy()
			expect(mockObserver.query).toEqual({
				studioId,
				playlistId,
			})
		} finally {
			// Make sure to cleanup
			observer.stop()

			// Check it stopped
			expect(onChanged).toHaveBeenCalledTimes(1)
			expect(onChangedCleanup).toHaveBeenCalledTimes(1)
			expect(RundownsMock.observers).toHaveLength(0)
		}
	})

	test('add a document', async () => {
		const studioId = protectString<StudioId>('studio0')
		const playlistId = protectString<RundownPlaylistId>('playlist0')

		const onChangedCleanup = jest.fn()
		const onChanged = jest.fn<Promise<() => void>, [RundownId[]]>(async () => onChangedCleanup)

		// should not be any observers yet
		expect(RundownsMock.observers).toHaveLength(0)

		const observer = await RundownsObserver.createForPlaylist(studioId, playlistId, onChanged)
		try {
			// ensure starts correct
			await waitUntil(async () => {
				// Run timers, so that promises in the observer has a chance to resolve:
				await runAllTimers()
				expect(onChanged).toHaveBeenCalledTimes(1)
			}, MAX_WAIT_TIME)

			expect(onChanged).toHaveBeenLastCalledWith([])
			expect(onChangedCleanup).toHaveBeenCalledTimes(0)
			expect(observer.rundownIds).toEqual([])

			// get the mock observer
			expect(RundownsMock.observers).toHaveLength(1)
			const mockObserver = RundownsMock.observers[0]
			expect(mockObserver).toBeTruthy()

			// simulate a document being added
			const mockId0 = protectString<RundownId>('ro0')
			mockObserver.callbacksObserve!.added!({ _id: mockId0 } as Rundown)

			// check result
			expect(observer.rundownIds).toEqual([mockId0])

			// no debounced call yet
			expect(onChanged).toHaveBeenCalledTimes(1)
			expect(onChangedCleanup).toHaveBeenCalledTimes(0)

			// After debounce
			// ensure starts correct
			await waitUntil(async () => {
				// Run timers, so that promises in the observer has a chance to resolve:
				await runAllTimers()
				expect(onChanged).toHaveBeenCalledTimes(2)
			}, MAX_WAIT_TIME)
			expect(onChangedCleanup).toHaveBeenCalledTimes(1)
			expect(onChanged).toHaveBeenLastCalledWith([mockId0])
		} finally {
			// Make sure to cleanup
			observer.stop()
		}
	})

	test('change a document', async () => {
		const studioId = protectString<StudioId>('studio0')
		const playlistId = protectString<RundownPlaylistId>('playlist0')

		const onChangedCleanup = jest.fn()
		const onChanged = jest.fn<Promise<() => void>, [RundownId[]]>(async () => onChangedCleanup)

		// should not be any observers yet
		expect(RundownsMock.observers).toHaveLength(0)

		const observer = await RundownsObserver.createForPlaylist(studioId, playlistId, onChanged)
		try {
			// ensure starts correct
			// ensure starts correct
			await waitUntil(async () => {
				// Run timers, so that promises in the observer has a chance to resolve:
				await runAllTimers()
				expect(onChanged).toHaveBeenCalledTimes(1)
			}, MAX_WAIT_TIME)
			expect(onChanged).toHaveBeenLastCalledWith([])
			expect(onChangedCleanup).toHaveBeenCalledTimes(0)
			expect(observer.rundownIds).toEqual([])

			// get the mock observer
			expect(RundownsMock.observers).toHaveLength(1)
			const mockObserver = RundownsMock.observers[0]
			expect(mockObserver).toBeTruthy()

			// simulate a document being changed
			const mockId0 = protectString<RundownId>('ro0')
			mockObserver.callbacksObserve!.changed!({ _id: mockId0 } as Rundown, { _id: mockId0 } as Rundown)

			// check result
			expect(observer.rundownIds).toEqual([mockId0])

			// no debounced call yet
			expect(onChanged).toHaveBeenCalledTimes(1)
			expect(onChangedCleanup).toHaveBeenCalledTimes(0)

			// After debounce
			// ensure starts correct
			await waitUntil(async () => {
				// Run timers, so that promises in the observer has a chance to resolve:
				await runAllTimers()
				expect(onChanged).toHaveBeenCalledTimes(2)
			}, MAX_WAIT_TIME)
			expect(onChangedCleanup).toHaveBeenCalledTimes(1)
			expect(onChanged).toHaveBeenLastCalledWith([mockId0])
		} finally {
			// Make sure to cleanup
			observer.stop()
		}
	})

	test('sequence of updates', async () => {
		const studioId = protectString<StudioId>('studio0')
		const playlistId = protectString<RundownPlaylistId>('playlist0')

		const onChangedCleanup = jest.fn()
		const onChanged = jest.fn<Promise<() => void>, [RundownId[]]>(async () => onChangedCleanup)

		// should not be any observers yet
		expect(RundownsMock.observers).toHaveLength(0)

		const observer = await RundownsObserver.createForPlaylist(studioId, playlistId, onChanged)
		try {
			// ensure starts correct
			// ensure starts correct
			await waitUntil(async () => {
				// Run timers, so that promises in the observer has a chance to resolve:
				await runAllTimers()
				expect(onChanged).toHaveBeenCalledTimes(1)
			}, MAX_WAIT_TIME)
			expect(onChanged).toHaveBeenLastCalledWith([])
			expect(onChangedCleanup).toHaveBeenCalledTimes(0)
			expect(observer.rundownIds).toEqual([])

			// get the mock observer
			expect(RundownsMock.observers).toHaveLength(1)
			const mockObserver = RundownsMock.observers[0]
			expect(mockObserver).toBeTruthy()

			// simulate some documents changing
			const mockId0 = protectString<RundownId>('ro0')
			const mockId1 = protectString<RundownId>('ro1')
			const mockId2 = protectString<RundownId>('ro2')
			const mockId3 = protectString<RundownId>('ro3')
			mockObserver.callbacksObserve!.added!({ _id: mockId0 } as Rundown)
			mockObserver.callbacksObserve!.added!({ _id: mockId1 } as Rundown)
			mockObserver.callbacksObserve!.changed!({ _id: mockId2 } as Rundown, { _id: mockId2 } as Rundown)
			mockObserver.callbacksObserve!.changed!({ _id: mockId3 } as Rundown, { _id: mockId3 } as Rundown)

			// check result
			expect(observer.rundownIds).toEqual([mockId0, mockId1, mockId2, mockId3])

			// no debounced call yet
			expect(onChanged).toHaveBeenCalledTimes(1)
			expect(onChangedCleanup).toHaveBeenCalledTimes(0)

			// After debounce
			// ensure starts correct
			await waitUntil(async () => {
				// Run timers, so that promises in the observer has a chance to resolve:
				await runAllTimers()
				expect(onChanged).toHaveBeenCalledTimes(2)
			}, MAX_WAIT_TIME)
			expect(onChangedCleanup).toHaveBeenCalledTimes(1)
			expect(onChanged).toHaveBeenLastCalledWith([mockId0, mockId1, mockId2, mockId3])

			// more documents changing
			const mockId4 = protectString<RundownId>('ro4')
			mockObserver.callbacksObserve!.changed!({ _id: mockId1 } as Rundown, { _id: mockId1 } as Rundown)

			// put in a sleep to ensure debounce is ok
			jest.advanceTimersByTime(10)
			await runTimersUntilNow()

			mockObserver.callbacksObserve!.added!({ _id: mockId4 } as Rundown)
			mockObserver.callbacksObserve!.removed!({ _id: mockId2 } as Rundown)

			// check result
			expect(observer.rundownIds).toEqual([mockId0, mockId1, mockId3, mockId4])

			// no debounced call yet
			expect(onChanged).toHaveBeenCalledTimes(2)
			expect(onChangedCleanup).toHaveBeenCalledTimes(1)

			// After debounce
			// ensure starts correct
			await waitUntil(async () => {
				// Run timers, so that promises in the observer has a chance to resolve:
				await runAllTimers()
				expect(onChanged).toHaveBeenCalledTimes(3)
			}, MAX_WAIT_TIME)
			expect(onChangedCleanup).toHaveBeenCalledTimes(2)
			expect(onChanged).toHaveBeenLastCalledWith([mockId0, mockId1, mockId3, mockId4])
		} finally {
			// Make sure to cleanup
			observer.stop()
		}
	})

	test('create and destroy observer - for peripheraldevice', async () => {
		const deviceId = protectString<PeripheralDeviceId>('device0')

		const onChangedCleanup = jest.fn()
		const onChanged = jest.fn(async () => onChangedCleanup)

		// should not be any observers yet
		expect(RundownsMock.observers).toHaveLength(0)

		const observer = await RundownsObserver.createForPeripheralDevice(deviceId, onChanged)
		try {
			// should now be an observer
			expect(RundownsMock.observers).toHaveLength(1)

			// Before debounce
			expect(onChanged).toHaveBeenCalledTimes(0)

			// After debounce
			await waitUntil(async () => {
				// Run timers, so that promises in the observer has a chance to resolve:
				await runAllTimers()
				expect(onChanged).toHaveBeenCalledTimes(1)
				expect(onChangedCleanup).toHaveBeenCalledTimes(0)
			}, MAX_WAIT_TIME)

			// still got an observer
			expect(RundownsMock.observers).toHaveLength(1)

			// get the mock observer, and ensure to looks sane
			expect(RundownsMock.observers).toHaveLength(1)
			const mockObserver = RundownsMock.observers[0]
			expect(mockObserver).toBeTruthy()
			expect(mockObserver.callbacksChanges).toBeFalsy()
			expect(mockObserver.callbacksObserve).toBeTruthy()
			expect(mockObserver.callbacksObserve?.added).toBeTruthy()
			expect(mockObserver.callbacksObserve?.changed).toBeTruthy()
			expect(mockObserver.callbacksObserve?.removed).toBeTruthy()
			expect(mockObserver.query).toEqual({
				'source.peripheralDeviceId': 'device0',
				'source.type': 'nrcs',
			})
		} finally {
			// Make sure to cleanup
			observer.stop()

			// Check it stopped
			expect(onChanged).toHaveBeenCalledTimes(1)
			expect(onChangedCleanup).toHaveBeenCalledTimes(1)
			expect(RundownsMock.observers).toHaveLength(0)
		}
	})
})
