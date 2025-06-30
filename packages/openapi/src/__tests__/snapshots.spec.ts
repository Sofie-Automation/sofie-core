import { randomUUID } from 'crypto'
import { Configuration, SnapshotsApi, PlaylistsApi } from '../../client/ts/index.js'
import { checkServer } from '../checkServer.js'
import Logging from '../httpLogging.js'

const httpLogging = false

describe('Network client', () => {
	const config = new Configuration({
		basePath: process.env.SERVER_URL,
		middleware: [new Logging(httpLogging)],
	})

	beforeAll(async () => await checkServer(config))

	const snapshotsApi = new SnapshotsApi(config)

	test('can store a rundown playlist snapshot', async () => {
		const playlistsApi = new PlaylistsApi(config)
		const playlist = (await playlistsApi.playlists()).result?.[0]
		const execute = await snapshotsApi.storeSnapshot({
			idempotencyKey: randomUUID(),
			storeSnapshotRequest: {
				snapshotType: 'playlist',
				reason: '',
				rundownPlaylistId: playlist.id,
			},
		})
		expect(execute.status).toBe(200)
	})

	test('can store a system snapshot', async () => {
		const execute = await snapshotsApi.storeSnapshot({
			idempotencyKey: randomUUID(),
			storeSnapshotRequest: {
				snapshotType: 'system',
				reason: '',
			},
		})
		expect(execute.status).toBe(200)
	})
})
