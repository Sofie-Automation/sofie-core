import { Configuration, PlaylistsApi, SourceLayersApi } from '../../client/ts/index.js'
import { checkServer } from '../checkServer.js'
import Logging from '../httpLogging.js'

const httpLogging = false
let testServer
if (process.env.SERVER_TYPE === 'TEST') {
	testServer = true
}

describe('Network client', () => {
	const config = new Configuration({
		basePath: process.env.SERVER_URL,
		middleware: [new Logging(httpLogging)],
	})

	beforeAll(async () => await checkServer(config))

	const sourceLayersApi = new SourceLayersApi(config)
	const playlistsApi = new PlaylistsApi(config)
	const playlistIds: string[] = []
	test('can request all playlists available in Sofie', async () => {
		const playlists = await playlistsApi.playlists()
		expect(playlists.status).toBe(200)
		expect(playlists).toHaveProperty('result')
		expect(playlists.result.length).toBeGreaterThanOrEqual(1)
		playlists.result.forEach((playlist) => {
			expect(typeof playlist.id).toBe('string')
			playlistIds.push(playlist.id)
		})

		const active = await playlistsApi.activate({
			playlistId: playlistIds[0],
			activateRequest: { rehearsal: true },
		})
		expect(active.status).toBe(200)

		const take = await playlistsApi.take({ playlistId: playlistIds[0] })
		expect(take.status).toBe(200)
	})

	test('fails to clear the target SourceLayer with null playlistId', async () => {
		await expect(
			sourceLayersApi.clearSourceLayer({
				playlistId: null,
				sourceLayerId: '42',
			})
		).rejects.toThrow()
	})

	test('fails to clear the target SourceLayer with null sourceLayerId', async () => {
		await expect(
			sourceLayersApi.clearSourceLayer({
				playlistId: playlistIds[0],
				sourceLayerId: null,
			})
		).rejects.toThrow()
	})

	if (testServer) {
		test('can clear the target SourceLayer', async () => {
			const sofieVersion = await sourceLayersApi.clearSourceLayer({
				playlistId: playlistIds[0],
				sourceLayerId: '42',
			})
			expect(sofieVersion.status).toBe(200)
		})
	} else {
		test.todo('Get SourceLayerId for clear operation')
	}

	test('fails to recall the last sticky Piece with null playlistId', async () => {
		await expect(
			sourceLayersApi.recallSticky({
				playlistId: null,
				sourceLayerId: '42',
			})
		).rejects.toThrow()
	})

	test('fails to recall the last sticky Piece with null sourceLayerId', async () => {
		await expect(
			sourceLayersApi.recallSticky({
				playlistId: playlistIds[0],
				sourceLayerId: null,
			})
		).rejects.toThrow()
	})

	if (testServer) {
		test('can recall the last sticky Piece on the specified SourceLayer', async () => {
			const sofieVersion = await sourceLayersApi.recallSticky({
				playlistId: playlistIds[0],
				sourceLayerId: '42',
			})
			expect(sofieVersion.status).toBe(200)
		})
	} else {
		test.todo('Get SourceLayerId for recall operation')
	}

	afterAll(async () => await playlistsApi.deactivate({ playlistId: playlistIds[0] }))
})
