// eslint-disable-next-line node/no-missing-import
import { Configuration, IngestApi, Part } from '../../client/ts'
import { checkServer } from '../checkServer'
import Logging from '../httpLogging'

const httpLogging = false

describe('Ingest API', () => {
	const config = new Configuration({
		basePath: process.env.SERVER_URL,
		middleware: [new Logging(httpLogging)],
	})

	beforeAll(async () => await checkServer(config))

	const ingestApi = new IngestApi(config)

	/**
	 * PLAYLISTS
	 */
	const playlistIds: string[] = []
	test('Can request all playlists', async () => {
		const ingestPlaylists = await ingestApi.getPlaylists()

		expect(ingestPlaylists.length).toBeGreaterThanOrEqual(1)
		ingestPlaylists.forEach((playlist) => {
			expect(typeof playlist).toBe('object')
			expect(typeof playlist.externalId).toBe('string')
			playlistIds.push(playlist.externalId)
		})
	})

	test('Can request a playlist by id', async () => {
		const ingestPlaylist = await ingestApi.getPlaylist({
			playlistId: playlistIds[0],
		})

		expect(ingestPlaylist).toHaveProperty('name')
		expect(typeof ingestPlaylist.name).toBe('string')
	})

	test('Can delete multiple playlists', async () => {
		const result = await ingestApi.deletePlaylists()
		expect(result).toBe(undefined)
	})

	test('Can delete playlist by id', async () => {
		const result = await ingestApi.deletePlaylist({
			playlistId: playlistIds[0],
		})
		expect(result).toBe(undefined)
	})

	/**
	 * RUNDOWNS
	 */
	const rundownIds: string[] = []
	test('Can request all rundowns', async () => {
		const rundowns = await ingestApi.getRundowns({
			playlistId: playlistIds[0],
		})

		expect(rundowns.length).toBeGreaterThanOrEqual(1)

		rundowns.forEach((rundown) => {
			expect(typeof rundown).toBe('object')
			expect(rundown).toHaveProperty('name')
			expect(rundown).toHaveProperty('rank')
			expect(rundown).toHaveProperty('source')
			expect(rundown).toHaveProperty('externalId')
			expect(typeof rundown.name).toBe('string')
			expect(typeof rundown.rank).toBe('number')
			expect(typeof rundown.source).toBe('string')
			expect(typeof rundown.externalId).toBe('string')
			rundownIds.push(rundown.externalId)
		})
	})

	test('Can request rundown by id', async () => {
		const rundown = await ingestApi.getRundown({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
		})

		expect(rundown).toHaveProperty('name')
		expect(rundown).toHaveProperty('rank')
		expect(rundown).toHaveProperty('source')
		expect(rundown).toHaveProperty('externalId')
		expect(typeof rundown.name).toBe('string')
		expect(typeof rundown.rank).toBe('number')
		expect(typeof rundown.source).toBe('string')
		expect(typeof rundown.externalId).toBe('string')
	})

	test('Can create rundown', async () => {
		const result = await ingestApi.postRundown({
			playlistId: playlistIds[0],
			rundown: {
				externalId: 'newRundown',
				name: 'New rundown',
				rank: 1,
				source: 'nrcsId',
			},
		})

		expect(result).toBe(undefined)
	})

	test('Can update multiple rundowns', async () => {
		const result = await ingestApi.putRundowns({
			playlistId: playlistIds[0],
			rundown: [
				{
					externalId: 'rundown1',
					name: 'Rundown 1',
					source: 'Our Company - Some Product Name',
					rank: 0,
				},
				{
					externalId: 'rundown2',
					name: 'Rundown 2',
					source: 'Our Second Company - Some Product Name',
					rank: 1,
				},
			],
		})
		expect(result).toBe(undefined)
	})

	const updatedRundownId = 'rundown3'
	test('Can update single rundown', async () => {
		const result = await ingestApi.putRundown({
			playlistId: playlistIds[0],
			rundownId: updatedRundownId,
			rundown: {
				externalId: 'rundown3',
				name: 'Rundown 3',
				source: 'Our Company - Some Product Name',
				rank: 3,
			},
		})
		expect(result).toBe(undefined)
	})

	test('Can delete multiple rundowns', async () => {
		const ingestRundown = await ingestApi.deleteRundowns({
			playlistId: playlistIds[0],
		})
		expect(ingestRundown.status).toBe(200)
	})

	test('Can delete rundown by id', async () => {
		const result = await ingestApi.deleteRundown({
			playlistId: playlistIds[0],
			rundownId: updatedRundownId,
		})
		expect(result).toBe(undefined)
	})

	/**
	 * INGEST SEGMENT
	 */
	const segmentIds: string[] = []
	test('Can request all segments', async () => {
		const segments = await ingestApi.getSegments({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
		})

		expect(segments.length).toBeGreaterThanOrEqual(1)

		segments.forEach((segment) => {
			expect(typeof segment).toBe('object')
			expect(typeof segment.externalId).toBe('string')
			segmentIds.push(segment.externalId)
		})
	})

	test('Can request segment by id', async () => {
		const segment = await ingestApi.getSegment({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
		})

		expect(segment).toHaveProperty('name')
		expect(segment).toHaveProperty('rank')
		expect(typeof segment.name).toBe('string')
		expect(typeof segment.rank).toBe('number')
	})

	test('Can create segment', async () => {
		const result = await ingestApi.postSegment({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segment: {
				externalId: 'segment1',
				name: 'Segment 1',
				rank: 0,
			},
		})

		expect(result).toBe(undefined)
	})

	test('Can update multiple segments', async () => {
		const result = await ingestApi.putSegments({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segment: [
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 0,
				},
			],
		})
		expect(result).toBe(undefined)
	})

	const updatedSegmentId = 'segment2'
	test('Can update single segment', async () => {
		const result = await ingestApi.putSegment({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: updatedSegmentId,
			segment: {
				externalId: 'segment2',
				name: 'Segment 2',
				rank: 1,
			},
		})
		expect(result).toBe(undefined)
	})

	test('Can delete multiple segments', async () => {
		const result = await ingestApi.deleteSegments({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
		})
		expect(result).toBe(undefined)
	})

	test('Can delete segment by id', async () => {
		const result = await ingestApi.deleteSegment({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: updatedSegmentId,
		})
		expect(result).toBe(undefined)
	})

	/**
	 * INGEST PARTS
	 */
	const partIds: string[] = []
	test('Can request all parts', async () => {
		const parts = await ingestApi.getParts({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
		})

		expect(parts.length).toBeGreaterThanOrEqual(1)

		parts.forEach((part) => {
			expect(typeof part).toBe('object')
			expect(typeof part.externalId).toBe('string')
			partIds.push(part.externalId)
		})
	})

	let newIngestPart: Part | undefined
	test('Can request part by id', async () => {
		const part = await ingestApi.getPart({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
			partId: partIds[0],
		})

		expect(part).toHaveProperty('name')
		expect(part).toHaveProperty('rank')
		expect(typeof part.name).toBe('string')
		expect(typeof part.rank).toBe('number')
		newIngestPart = JSON.parse(JSON.stringify(part))
	})

	test('Can create part', async () => {
		const result = await ingestApi.postPart({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
			part: {
				externalId: 'part1',
				name: 'Part 1',
				rank: 0,
			},
		})
		expect(result).toBe(undefined)
	})

	test('Can update multiple parts', async () => {
		const result = await ingestApi.putParts({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
			part: [
				{
					externalId: 'part1',
					name: 'Part 1',
					rank: 0,
				},
			],
		})
		expect(result).toBe(undefined)
	})

	const updatedPartId = 'part2'
	test('Can update an part', async () => {
		newIngestPart.name = newIngestPart.name + '  added'
		const result = await ingestApi.putPart({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
			partId: updatedPartId,
			part: {
				externalId: 'part1',
				name: 'Part 1',
				rank: 0,
			},
		})
		expect(result).toBe(undefined)
	})

	test('Can delete multiple parts', async () => {
		const result = await ingestApi.deleteParts({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
		})
		expect(result).toBe(undefined)
	})

	test('Can delete part by id', async () => {
		const result = await ingestApi.deletePart({
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
			partId: updatedPartId,
		})
		expect(result).toBe(undefined)
	})
})
