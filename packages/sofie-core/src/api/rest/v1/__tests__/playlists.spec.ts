import { registerRoutes } from '../playlists'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PlaylistsRestAPI } from '../../../../lib/rest/v1'

describe('Playlists REST API Routes', () => {
	let mockRegisterRoute: jest.Mock
	let mockServerAPI: jest.Mocked<PlaylistsRestAPI>

	beforeEach(() => {
		mockRegisterRoute = jest.fn()
		mockServerAPI = {
			tTimerStartCountdown: jest.fn().mockResolvedValue(ClientAPI.responseSuccess(undefined)),
			tTimerStartFreeRun: jest.fn().mockResolvedValue(ClientAPI.responseSuccess(undefined)),
			tTimerPause: jest.fn().mockResolvedValue(ClientAPI.responseSuccess(undefined)),
			tTimerResume: jest.fn().mockResolvedValue(ClientAPI.responseSuccess(undefined)),
			tTimerRestart: jest.fn().mockResolvedValue(ClientAPI.responseSuccess(undefined)),
			tTimerClearProjected: jest.fn().mockResolvedValue(ClientAPI.responseSuccess(undefined)),
			tTimerSetProjectedAnchorPart: jest.fn().mockResolvedValue(ClientAPI.responseSuccess(undefined)),
			tTimerSetProjectedTime: jest.fn().mockResolvedValue(ClientAPI.responseSuccess(undefined)),
			tTimerSetProjectedDuration: jest.fn().mockResolvedValue(ClientAPI.responseSuccess(undefined)),
		} as any

		registerRoutes(mockRegisterRoute)
	})

	test('should register T-timer countdown route', () => {
		const countdownRoute = mockRegisterRoute.mock.calls.find(
			(call) => call[1] === '/playlists/:playlistId/t-timers/:timerIndex/countdown'
		)
		expect(countdownRoute).toBeDefined()
		expect(countdownRoute[0]).toBe('post')
	})

	test('T-timer countdown handler should call serverAPI.tTimerStartCountdown', async () => {
		const countdownRoute = mockRegisterRoute.mock.calls.find(
			(call) => call[1] === '/playlists/:playlistId/t-timers/:timerIndex/countdown'
		)
		const handler = countdownRoute[4]

		const params = { playlistId: 'playlist0', timerIndex: '1' }
		const body = { duration: 60, stopAtZero: true, startPaused: false }
		const connection = {} as any
		const event = 'test-event'

		await handler(mockServerAPI, connection, event, params, body)

		expect(mockServerAPI.tTimerStartCountdown).toHaveBeenCalledWith(
			connection,
			event,
			protectString('playlist0'),
			1,
			60,
			true,
			false
		)
	})

	test('T-timer countdown handler should reject malformed timerIndex', async () => {
		const countdownRoute = mockRegisterRoute.mock.calls.find(
			(call) => call[1] === '/playlists/:playlistId/t-timers/:timerIndex/countdown'
		)
		const handler = countdownRoute[4]

		const params = { playlistId: 'playlist0', timerIndex: '1foo' }
		const body = { duration: 60, stopAtZero: true, startPaused: false }
		const connection = {} as any
		const event = 'test-event'

		await expect(handler(mockServerAPI, connection, event, params, body)).rejects.toMatchObject({ error: 400 })
		expect(mockServerAPI.tTimerStartCountdown).not.toHaveBeenCalled()
	})

	test('T-timer countdown handler should reject out-of-range timerIndex', async () => {
		const countdownRoute = mockRegisterRoute.mock.calls.find(
			(call) => call[1] === '/playlists/:playlistId/t-timers/:timerIndex/countdown'
		)
		const handler = countdownRoute[4]

		const params = { playlistId: 'playlist0', timerIndex: '4' }
		const body = { duration: 60, stopAtZero: true, startPaused: false }
		const connection = {} as any
		const event = 'test-event'

		await expect(handler(mockServerAPI, connection, event, params, body)).rejects.toMatchObject({ error: 400 })
		expect(mockServerAPI.tTimerStartCountdown).not.toHaveBeenCalled()
	})

	test('should register T-timer pause route', () => {
		const pauseRoute = mockRegisterRoute.mock.calls.find(
			(call) => call[1] === '/playlists/:playlistId/t-timers/:timerIndex/pause'
		)
		expect(pauseRoute).toBeDefined()
		expect(pauseRoute[0]).toBe('post')
	})

	test('T-timer pause handler should call serverAPI.tTimerPause', async () => {
		const pauseRoute = mockRegisterRoute.mock.calls.find(
			(call) => call[1] === '/playlists/:playlistId/t-timers/:timerIndex/pause'
		)
		const handler = pauseRoute[4]

		const params = { playlistId: 'playlist0', timerIndex: '2' }
		const connection = {} as any
		const event = 'test-event'

		await handler(mockServerAPI, connection, event, params, {})

		expect(mockServerAPI.tTimerPause).toHaveBeenCalledWith(connection, event, protectString('playlist0'), 2)
	})

	test('T-timer projected clear handler should accept playlist externalId', async () => {
		const route = mockRegisterRoute.mock.calls.find(
			(call) => call[1] === '/playlists/:playlistId/t-timers/:timerIndex/projected/clear'
		)
		expect(route).toBeDefined()
		const handler = route[4]

		const params = { playlistId: 'playlistExternalId', timerIndex: '1' }
		const connection = {} as any
		const event = 'test-event'

		await handler(mockServerAPI, connection, event, params, {})

		expect(mockServerAPI.tTimerClearProjected).toHaveBeenCalledWith(
			connection,
			event,
			protectString('playlistExternalId'),
			1
		)
	})

	test('T-timer projected anchor-part handler should accept playlist externalId', async () => {
		const route = mockRegisterRoute.mock.calls.find(
			(call) => call[1] === '/playlists/:playlistId/t-timers/:timerIndex/projected/anchor-part'
		)
		expect(route).toBeDefined()
		const handler = route[4]

		const params = { playlistId: 'playlistExternalId', timerIndex: '2' }
		const body = { externalId: 'partExternalId' }
		const connection = {} as any
		const event = 'test-event'

		await handler(mockServerAPI, connection, event, params, body)

		expect(mockServerAPI.tTimerSetProjectedAnchorPart).toHaveBeenCalledWith(
			connection,
			event,
			protectString('playlistExternalId'),
			2,
			undefined,
			'partExternalId'
		)
	})

	test('T-timer projected anchor-part handler should accept partId', async () => {
		const route = mockRegisterRoute.mock.calls.find(
			(call) => call[1] === '/playlists/:playlistId/t-timers/:timerIndex/projected/anchor-part'
		)
		expect(route).toBeDefined()
		const handler = route[4]

		const params = { playlistId: 'playlistExternalId', timerIndex: '2' }
		const body = { partId: 'partInternalId' }
		const connection = {} as any
		const event = 'test-event'

		await handler(mockServerAPI, connection, event, params, body)

		expect(mockServerAPI.tTimerSetProjectedAnchorPart).toHaveBeenCalledWith(
			connection,
			event,
			protectString('playlistExternalId'),
			2,
			protectString('partInternalId'),
			undefined
		)
	})

	test('T-timer projected time handler should accept playlist externalId', async () => {
		const route = mockRegisterRoute.mock.calls.find(
			(call) => call[1] === '/playlists/:playlistId/t-timers/:timerIndex/projected/time'
		)
		expect(route).toBeDefined()
		const handler = route[4]

		const params = { playlistId: 'playlistExternalId', timerIndex: '3' }
		const body = { time: 1707024000000, paused: false }
		const connection = {} as any
		const event = 'test-event'

		await handler(mockServerAPI, connection, event, params, body)

		expect(mockServerAPI.tTimerSetProjectedTime).toHaveBeenCalledWith(
			connection,
			event,
			protectString('playlistExternalId'),
			3,
			1707024000000,
			false
		)
	})

	test('T-timer projected duration handler should accept playlist externalId', async () => {
		const route = mockRegisterRoute.mock.calls.find(
			(call) => call[1] === '/playlists/:playlistId/t-timers/:timerIndex/projected/duration'
		)
		expect(route).toBeDefined()
		const handler = route[4]

		const params = { playlistId: 'playlistExternalId', timerIndex: '1' }
		const body = { duration: 60000, paused: true }
		const connection = {} as any
		const event = 'test-event'

		await handler(mockServerAPI, connection, event, params, body)

		expect(mockServerAPI.tTimerSetProjectedDuration).toHaveBeenCalledWith(
			connection,
			event,
			protectString('playlistExternalId'),
			1,
			60000,
			true
		)
	})
})
