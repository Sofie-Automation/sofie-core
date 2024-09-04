// eslint-disable-next-line node/no-missing-import
import { Configuration, IngestApi, IngestPart, IngestRundown, IngestSegment } from '../../client/ts'
import { checkServer } from '../checkServer'
import Logging from '../httpLogging'

const httpLogging = false

describe('Network client', () => {
	const config = new Configuration({
		basePath: process.env.SERVER_URL,
		middleware: [new Logging(httpLogging)],
	})

	beforeAll(async () => await checkServer(config))

	const ingestApi = new IngestApi(config)

	/**
	 * INGEST PLAYLIST
	 */
	const playlistIds: string[] = []
	test('Can request all ingest playlists in Sofie', async () => {
		const ingestPlaylists = await ingestApi.getIngestPlaylists()
		expect(ingestPlaylists.status).toBe(200)
		expect(ingestPlaylists).toHaveProperty('playlists')

		expect(ingestPlaylists.playlists.length).toBeGreaterThanOrEqual(1)
		ingestPlaylists.playlists.forEach((playlist) => {
			expect(typeof playlist).toBe('object')
			expect(typeof playlist.playlistId).toBe('string')
			playlistIds.push(playlist.playlistId)
		})
	})

	test('Can request a playlist by id in Sofie', async () => {
		const ingestPlaylist = await ingestApi.getIngestPlaylist({
			playlistId: playlistIds[0],
		})
		expect(ingestPlaylist.status).toBe(200)
		expect(ingestPlaylist).toHaveProperty('playlist')

		expect(ingestPlaylist.playlist).toHaveProperty('name')
		expect(typeof ingestPlaylist.playlist.name).toBe('string')
	})

	test('Can delete multiple ingest playlists in Sofie', async () => {
		const ingestRundown = await ingestApi.deleteIngestPlaylists()
		expect(ingestRundown.status).toBe(200)
	})

	test('Can delete ingest playlist by id in Sofie', async () => {
		const ingestRundown = await ingestApi.deleteIngestPlaylist({
			playlistId: playlistIds[0],
		})
		expect(ingestRundown.status).toBe(200)
	})

	/**
	 * INGEST RUNDOWS
	 */
	const rundownIds: string[] = []
	test('Can request all ingest rundowns in Sofie', async () => {
		const ingestRundowns = await ingestApi.getIngestRundowns({
			playlistId: playlistIds[0],
		})
		expect(ingestRundowns.status).toBe(200)
		expect(ingestRundowns).toHaveProperty('rundowns')

		expect(ingestRundowns.rundowns.length).toBeGreaterThanOrEqual(1)

		ingestRundowns.rundowns.forEach((rundown) => {
			expect(typeof rundown).toBe('object')
			expect(typeof rundown.externalId).toBe('string')
			rundownIds.push(rundown.externalId)
		})
	})

	let newIngestRundown: IngestRundown | undefined
	test('Can request ingest rundown by id in Sofie', async () => {
		const ingestRundown = await ingestApi.getIngestRundown({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
		})
		expect(ingestRundown.status).toBe(200)
		expect(ingestRundown).toHaveProperty('rundown')

		expect(ingestRundown.rundown).toHaveProperty('name')
		expect(ingestRundown.rundown).toHaveProperty('rank')
		expect(ingestRundown.rundown).toHaveProperty('source')
		expect(typeof ingestRundown.rundown.name).toBe('string')
		expect(typeof ingestRundown.rundown.rank).toBe('number')
		expect(typeof ingestRundown.rundown.source).toBe('string')
		newIngestRundown = JSON.parse(JSON.stringify(ingestRundown.rundown))
	})

	test('Can add/update multiple rundowns in Sofie', async () => {
		newIngestRundown.name = newIngestRundown.name + 'added'
		newIngestRundown.rank = 2
		const ingestRundown = await ingestApi.putIngestRundowns({
			playlistId: playlistIds[0],
			putIngestRundownsRequest: {
				rundowns: [
					{
						name: 'rundown1',
						source: 'Our Company - Some Product Name',
						rank: 0,
					},
					{
						name: 'rundown2',
						source: 'Our Second Company - Some Product Name',
						rank: 1,
					},
				],
			},
		})
		expect(ingestRundown.status).toBe(200)
	})

	const testIngestRundownId = 'rundown3'
	test('Can add/update an ingest rundown in Sofie', async () => {
		const newPutIngestRundown = await ingestApi.putIngestRundown({
			playlistId: playlistIds[0],
			rundownId: testIngestRundownId,
			ingestRundown: {
				name: 'rundown3',
				source: 'Our Company - Some Product Name',
				rank: 3,
			},
			eTag: '123456789',
			ifNoneMatch: ['123456789', '1725453459'],
		})
		expect(newPutIngestRundown.status).toBe(200)
	})

	test('Can delete multiple ingest rundowns in Sofie', async () => {
		const ingestRundown = await ingestApi.deleteIngestRundowns({
			playlistId: playlistIds[0],
		})
		expect(ingestRundown.status).toBe(200)
	})

	test('Can delete ingest rundown by id in Sofie', async () => {
		const ingestRundown = await ingestApi.deleteIngestRundown({
			playlistId: playlistIds[0],
			rundownId: testIngestRundownId,
		})
		expect(ingestRundown.status).toBe(200)
	})

	/**
	 * INGEST SEGMENT
	 */
	const segmentIds: string[] = []
	test('Can request all ingest segments in Sofie', async () => {
		const ingestSegments = await ingestApi.getIngestSegments({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
		})
		expect(ingestSegments.status).toBe(200)
		expect(ingestSegments).toHaveProperty('segments')

		expect(ingestSegments.segments.length).toBeGreaterThanOrEqual(1)

		ingestSegments.segments.forEach((segment) => {
			expect(typeof segment).toBe('object')
			expect(typeof segment.externalId).toBe('string')
			segmentIds.push(segment.externalId)
		})
	})

	let newIngestSegment: IngestSegment | undefined
	test('Can request ingest segment by id in Sofie', async () => {
		const ingestSegment = await ingestApi.getIngestSegment({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
		})
		expect(ingestSegment.status).toBe(200)
		expect(ingestSegment).toHaveProperty('segment')

		expect(ingestSegment.segment).toHaveProperty('name')
		expect(ingestSegment.segment).toHaveProperty('rank')
		expect(typeof ingestSegment.segment.name).toBe('string')
		expect(typeof ingestSegment.segment.rank).toBe('number')
		newIngestSegment = JSON.parse(JSON.stringify(ingestSegment.segment))
	})

	test('can add/update multiple ingest segments in Sofie', async () => {
		const ingestSegment = await ingestApi.putIngestSegments({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			putIngestSegmentsRequest: {
				segments: [
					{
						name: 'segment1',
						rank: 0,
					},
				],
			},
		})
		expect(ingestSegment.status).toBe(200)
	})

	const testIngestSegmentId = 'segment2'
	test('Can add/update an ingest segment in Sofie', async () => {
		newIngestSegment.name = newIngestSegment.name + 'Added'
		const ingestSegment = await ingestApi.putIngestSegment({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: testIngestSegmentId,
			eTag: '1725269223',
			ingestSegment: newIngestSegment,
		})
		expect(ingestSegment.status).toBe(200)
	})

	test('Can delete multiple ingest segments in Sofie', async () => {
		const ingestRundown = await ingestApi.deleteIngestSegments({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
		})
		expect(ingestRundown.status).toBe(200)
	})

	test('Can delete ingest segment by id in Sofie', async () => {
		const ingestRundown = await ingestApi.deleteIngestSegment({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: testIngestSegmentId,
		})
		expect(ingestRundown.status).toBe(200)
	})

	/**
	 * INGEST PARTS
	 */
	const partIds: string[] = []
	test('Can request all ingest parts in Sofie', async () => {
		const ingestParts = await ingestApi.getIngestParts({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
		})

		expect(ingestParts.status).toBe(200)
		expect(ingestParts).toHaveProperty('parts')

		expect(ingestParts.parts.length).toBeGreaterThanOrEqual(1)

		ingestParts.parts.forEach((part) => {
			expect(typeof part).toBe('object')
			expect(typeof part.externalId).toBe('string')
			partIds.push(part.externalId)
		})
	})

	let newIngestPart: IngestPart | undefined
	test('Can request ingest part by id in Sofie', async () => {
		const ingestPart = await ingestApi.getIngestPart({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
			partId: partIds[0],
		})
		expect(ingestPart.status).toBe(200)
		expect(ingestPart).toHaveProperty('part')

		expect(ingestPart.part).toHaveProperty('name')
		expect(ingestPart.part).toHaveProperty('rank')
		expect(typeof ingestPart.part.name).toBe('string')
		expect(typeof ingestPart.part.rank).toBe('number')
		newIngestPart = JSON.parse(JSON.stringify(ingestPart.part))
	})

	test('Can add/update multiple ingest parts in Sofie', async () => {
		const ingestPart = await ingestApi.putIngestParts({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
			putIngestPartsRequest: {
				parts: [
					{
						name: 'part1',
						rank: 0,
					},
				],
			},
		})
		expect(ingestPart.status).toBe(200)
	})

	const testIngestPartId = 'part2'
	test('Can add/update an ingest part in Sofie', async () => {
		newIngestPart.name = newIngestPart.name + 'Added'
		const ingestPart = await ingestApi.putIngestPart({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
			partId: testIngestPartId,
			eTag: '1725269417',
			ingestPart: newIngestPart,
		})
		expect(ingestPart.status).toBe(200)
	})

	test('Can delete multiple ingest parts in Sofie', async () => {
		const ingestRundown = await ingestApi.deleteIngestParts({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
		})
		expect(ingestRundown.status).toBe(200)
	})

	test('Can delete ingest part by id in Sofie', async () => {
		const ingestRundown = await ingestApi.deleteIngestPart({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
			partId: testIngestPartId,
		})
		expect(ingestRundown.status).toBe(200)
	})
})
