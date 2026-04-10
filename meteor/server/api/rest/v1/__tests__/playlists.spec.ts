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
})
