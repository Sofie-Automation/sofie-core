import { Configuration, IngestApi, Part, RundownTimingTypeEnum } from '../../client/ts/index.js'
import { checkServer } from '../checkServer.js'
import Logging from '../httpLogging.js'

const httpLogging = false
const studioId = 'studio0'

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
		const playlists = await ingestApi.getPlaylists({ studioId })

		expect(playlists.length).toBeGreaterThanOrEqual(1)
		playlists.forEach((playlist) => {
			expect(typeof playlist).toBe('object')
			expect(typeof playlist.id).toBe('string')
			expect(typeof playlist.externalId).toBe('string')
			expect(typeof playlist.studioId).toBe('string')
			expect(typeof playlist.rundownIds).toBe('object')
			playlist.rundownIds.forEach((rundownId) => {
				expect(typeof rundownId).toBe('string')
			})

			playlistIds.push(playlist.externalId)
		})
	})

	test('Can request a playlist by id', async () => {
		const playlist = await ingestApi.getPlaylist({
			studioId,
			playlistId: playlistIds[0],
		})

		expect(typeof playlist).toBe('object')
		expect(typeof playlist.id).toBe('string')
		expect(typeof playlist.externalId).toBe('string')
		expect(typeof playlist.studioId).toBe('string')
		expect(typeof playlist.rundownIds).toBe('object')
		playlist.rundownIds.forEach((rundownId) => {
			expect(typeof rundownId).toBe('string')
		})
	})

	test('Can delete multiple playlists', async () => {
		const result = await ingestApi.deletePlaylists({ studioId })
		expect(result).toBe(undefined)
	})

	test('Can delete playlist by id', async () => {
		const result = await ingestApi.deletePlaylist({
			studioId,
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
			studioId,
			playlistId: playlistIds[0],
		})

		expect(rundowns.length).toBeGreaterThanOrEqual(1)

		rundowns.forEach((rundown) => {
			expect(typeof rundown).toBe('object')
			expect(rundown).toHaveProperty('id')
			expect(rundown).toHaveProperty('externalId')
			expect(rundown).toHaveProperty('name')
			expect(rundown).toHaveProperty('studioId')
			expect(rundown).toHaveProperty('playlistId')
			expect(rundown).toHaveProperty('playlistExternalId')
			expect(rundown).toHaveProperty('type')
			expect(rundown).toHaveProperty('timing')
			expect(rundown.timing).toHaveProperty('type')
			expect(typeof rundown.id).toBe('string')
			expect(typeof rundown.externalId).toBe('string')
			expect(typeof rundown.name).toBe('string')
			expect(typeof rundown.studioId).toBe('string')
			expect(typeof rundown.playlistId).toBe('string')
			expect(typeof rundown.playlistExternalId).toBe('string')
			expect(typeof rundown.type).toBe('string')
			expect(typeof rundown.timing).toBe('object')
			expect(typeof rundown.timing.type).toBe('string')
			rundownIds.push(rundown.externalId)
		})
	})

	test('Can request rundown by id', async () => {
		const rundown = await ingestApi.getRundown({
			studioId,
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
		})

		expect(typeof rundown).toBe('object')
		expect(rundown).toHaveProperty('id')
		expect(rundown).toHaveProperty('externalId')
		expect(rundown).toHaveProperty('name')
		expect(rundown).toHaveProperty('studioId')
		expect(rundown).toHaveProperty('playlistId')
		expect(rundown).toHaveProperty('playlistExternalId')
		expect(rundown).toHaveProperty('type')
		expect(rundown).toHaveProperty('timing')
		expect(rundown.timing).toHaveProperty('type')
		expect(typeof rundown.id).toBe('string')
		expect(typeof rundown.externalId).toBe('string')
		expect(typeof rundown.name).toBe('string')
		expect(typeof rundown.studioId).toBe('string')
		expect(typeof rundown.playlistId).toBe('string')
		expect(typeof rundown.playlistExternalId).toBe('string')
		expect(typeof rundown.type).toBe('string')
		expect(typeof rundown.timing).toBe('object')
		expect(typeof rundown.timing.type).toBe('string')
	})

	const rundown = {
		externalId: 'newRundown',
		name: 'New rundown',
		type: 'external',
		resyncUrl: 'resyncUrl',
		timing: {
			type: RundownTimingTypeEnum.None,
			expectedStart: 0,
			expectedEnd: 0,
			expectedDuration: 0,
		},
	}

	test('Can create rundown', async () => {
		const result = await ingestApi.postRundown({ studioId, playlistId: playlistIds[0], rundown })

		expect(result).toBe(undefined)
	})

	test('Can update multiple rundowns', async () => {
		const result = await ingestApi.putRundowns({ studioId, playlistId: playlistIds[0], rundown: [rundown] })
		expect(result).toBe(undefined)
	})

	const updatedRundownId = 'rundown3'
	test('Can update single rundown', async () => {
		const result = await ingestApi.putRundown({
			studioId,
			playlistId: playlistIds[0],
			rundownId: updatedRundownId,
			rundown,
		})
		expect(result).toBe(undefined)
	})

	test('Can delete multiple rundowns', async () => {
		const result = await ingestApi.deleteRundowns({ studioId, playlistId: playlistIds[0] })
		expect(result).toBe(undefined)
	})

	test('Can delete rundown by id', async () => {
		const result = await ingestApi.deleteRundown({
			studioId,
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
		const segments = await ingestApi.getSegments({ studioId, playlistId: playlistIds[0], rundownId: rundownIds[0] })

		expect(segments.length).toBeGreaterThanOrEqual(1)

		segments.forEach((segment) => {
			expect(typeof segment).toBe('object')
			expect(typeof segment.id).toBe('string')
			expect(typeof segment.externalId).toBe('string')
			expect(typeof segment.rundownId).toBe('string')
			expect(typeof segment.name).toBe('string')
			expect(typeof segment.rank).toBe('number')
			expect(typeof segment.timing).toBe('object')
			expect(typeof segment.timing.expectedStart).toBe('number')
			expect(typeof segment.timing.expectedEnd).toBe('number')
			segmentIds.push(segment.externalId)
		})
	})

	test('Can request segment by id', async () => {
		const segment = await ingestApi.getSegment({
			studioId,
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
		})

		expect(segment).toHaveProperty('id')
		expect(segment).toHaveProperty('externalId')
		expect(segment).toHaveProperty('rundownId')
		expect(segment).toHaveProperty('name')
		expect(segment).toHaveProperty('rank')
		expect(segment).toHaveProperty('timing')
		expect(segment.timing).toHaveProperty('expectedStart')
		expect(segment.timing).toHaveProperty('expectedEnd')
		expect(typeof segment.id).toBe('string')
		expect(typeof segment.externalId).toBe('string')
		expect(typeof segment.rundownId).toBe('string')
		expect(typeof segment.name).toBe('string')
		expect(typeof segment.rank).toBe('number')
		expect(typeof segment.timing).toBe('object')
		expect(typeof segment.timing.expectedStart).toBe('number')
		expect(typeof segment.timing.expectedEnd).toBe('number')
	})

	const segment = {
		externalId: 'segment1',
		name: 'Segment 1',
		rank: 0,
		_float: true,
		timing: {
			expectedStart: 0,
			expectedEnd: 0,
		},
	}

	test('Can create segment', async () => {
		const result = await ingestApi.postSegment({
			studioId,
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segment,
		})

		expect(result).toBe(undefined)
	})

	test('Can update multiple segments', async () => {
		const result = await ingestApi.putSegments({
			studioId,
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segment: [segment],
		})
		expect(result).toBe(undefined)
	})

	const updatedSegmentId = 'segment2'
	test('Can update single segment', async () => {
		const result = await ingestApi.putSegment({
			studioId,
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: updatedSegmentId,
			segment,
		})
		expect(result).toBe(undefined)
	})

	test('Can delete multiple segments', async () => {
		const result = await ingestApi.deleteSegments({
			studioId,
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
		})
		expect(result).toBe(undefined)
	})

	test('Can delete segment by id', async () => {
		const result = await ingestApi.deleteSegment({
			studioId,
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
			studioId,
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
			studioId,
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
			partId: partIds[0],
		})

		expect(part).toHaveProperty('id')
		expect(part).toHaveProperty('externalId')
		expect(part).toHaveProperty('rundownId')
		expect(part).toHaveProperty('segmentId')
		expect(part).toHaveProperty('name')
		expect(part).toHaveProperty('expectedDuration')
		expect(part).toHaveProperty('autoNext')
		expect(part).toHaveProperty('rank')
		expect(typeof part.id).toBe('string')
		expect(typeof part.externalId).toBe('string')
		expect(typeof part.rundownId).toBe('string')
		expect(typeof part.segmentId).toBe('string')
		expect(typeof part.name).toBe('string')
		expect(typeof part.expectedDuration).toBe('number')
		expect(typeof part.autoNext).toBe('boolean')
		expect(typeof part.rank).toBe('number')
		newIngestPart = JSON.parse(JSON.stringify(part))
	})

	test('Can create part', async () => {
		const result = await ingestApi.postPart({
			studioId,
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
			part: {
				externalId: 'part1',
				name: 'Part 1',
				rank: 0,
				_float: true,
				autoNext: true,
				payload: {
					type: 'CAMERA',
					guest: true,
					script: '',
					pieces: [
						{
							id: 'piece1',
							objectType: 'CAMERA',
							objectTime: '00:00:00:00',
							duration: {
								type: 'within-part',
								duration: '00:00:10:00',
							},
							resourceName: 'camera1',
							label: 'Piece 1',
							attributes: {},
							transition: 'cut',
							transitionDuration: '00:00:00:00',
							target: 'pgm',
						},
					],
				},
			},
		})
		expect(result).toBe(undefined)
	})

	test('Can update multiple parts', async () => {
		const result = await ingestApi.putParts({
			studioId,
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
			part: [
				{
					externalId: 'part1',
					name: 'Part 1',
					rank: 0,
					_float: true,
					autoNext: true,
					payload: {
						type: 'CAMERA',
						guest: true,
						script: '',
						pieces: [
							{
								id: 'piece1',
								label: 'Piece 1',
								attributes: {},
								objectType: 'CAMERA',
								resourceName: 'camera1',
							},
						],
					},
				},
			],
		})
		expect(result).toBe(undefined)
	})

	const updatedPartId = 'part2'
	test('Can update a part', async () => {
		newIngestPart.name = newIngestPart.name + ' added'
		const result = await ingestApi.putPart({
			studioId,
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
			partId: updatedPartId,
			part: {
				externalId: 'part1',
				name: 'Part 1',
				rank: 0,
				_float: true,
				autoNext: true,
				payload: {
					type: 'CAMERA',
					guest: true,
					script: '',
					pieces: [
						{
							id: 'piece1',
							label: 'Piece 1',
							attributes: {},
							objectType: 'CAMERA',
							resourceName: 'camera1',
						},
					],
				},
			},
		})
		expect(result).toBe(undefined)
	})

	test('Can delete multiple parts', async () => {
		const result = await ingestApi.deleteParts({
			studioId,
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
		})
		expect(result).toBe(undefined)
	})

	test('Can delete part by id', async () => {
		const result = await ingestApi.deletePart({
			studioId,
			playlistId: playlistIds[0],
			rundownId: rundownIds[0],
			segmentId: segmentIds[0],
			partId: updatedPartId,
		})
		expect(result).toBe(undefined)
	})
})
