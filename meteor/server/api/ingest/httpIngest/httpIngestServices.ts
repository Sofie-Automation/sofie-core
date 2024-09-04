import { IngestPart, IngestRundown, IngestSegment } from '@sofie-automation/blueprints-integration'
import { PartId, RundownId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getRundownNrcsName, Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { getHash } from '@sofie-automation/corelib/dist/hash'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { Meteor } from 'meteor/meteor'
import { Parts, RundownPlaylists, Rundowns, Segments, Studios } from '../../../collections'
import { runIngestOperation } from '../lib'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

async function findPlaylist(playlistId: string) {
	const playlist = await RundownPlaylists.findOneAsync({
		$or: [{ _id: protectString<RundownPlaylistId>(playlistId) }, { externalId: playlistId }],
	})
	if (!playlist) {
		throw new Meteor.Error(404, `Playlist ID '${playlistId}' was not found`)
	}
	return playlist
}

async function findRundown(playlistId: RundownPlaylistId, rundownId: string) {
	const rundown = await Rundowns.findOneAsync({
		$or: [
			{
				_id: protectString<RundownId>(rundownId),
				playlistId,
			},
			{
				externalId: rundownId,
				playlistId,
			},
		],
	})
	if (!rundown) {
		throw new Meteor.Error(404, `Rundown ID '${rundownId}' was not found`)
	}
	return rundown
}

async function findSegment(rundownId: RundownId, segmentId: string) {
	const segment = await Segments.findOneAsync({
		$or: [
			{
				_id: protectString<SegmentId>(segmentId),
				rundownId: rundownId,
			},
			{
				externalId: segmentId,
				rundownId: rundownId,
			},
		],
	})
	if (!segment) {
		throw new Meteor.Error(404, `Segment ID '${segmentId}' was not found`)
	}
	return segment
}

async function findPart(segmentId: SegmentId, partId: string) {
	const part = await Parts.findOneAsync({
		$or: [
			{ _id: protectString<PartId>(partId), segmentId },
			{
				externalId: partId,
				segmentId,
			},
		],
	})

	if (!part) {
		throw new Meteor.Error(404, `Part ID '${partId}' was not found`)
	}
	return part
}

async function findStudioId() {
	const existingStudio = await Studios.findOneAsync({})
	if (!existingStudio) {
		throw new Meteor.Error(500, `Studio does not exist`)
	}

	return existingStudio._id
}

function checkRundownSource(rundown: Rundown | undefined) {
	if (rundown && rundown.source.type !== 'httpIngest') {
		throw new Meteor.Error(
			403,
			`Cannot replace existing rundown from source '${getRundownNrcsName(
				rundown
			)}' with new data from 'httpIngest' source`
		)
	}
}

function getRundownId(rundownExternalId: string): RundownId {
	if (!rundownExternalId) throw new Meteor.Error(400, 'getRundownId: rundownExternalId must be set!')
	return protectString<RundownId>(getHash(`${rundownExternalId}`))
}

// Playlists

export async function getPlaylists(): Promise<DBRundownPlaylist[]> {
	const playlists = await RundownPlaylists.findFetchAsync({})
	return playlists
}

export async function deletePlaylists(): Promise<void> {
	const rundowns = await Rundowns.findFetchAsync({})
	const studioId = await findStudioId()

	for (const rundown of rundowns) {
		await runIngestOperation(studioId, IngestJobs.RemoveRundown, {
			rundownExternalId: rundown.externalId,
		})
	}
}

export async function getPlaylist(playlistId: string): Promise<DBRundownPlaylist> {
	const playlist = findPlaylist(playlistId)
	return playlist
}

export async function deletePlaylist(playlistId: string): Promise<void> {
	await findPlaylist(playlistId)

	const rundowns = await Rundowns.findFetchAsync({
		$or: [{ playlistId: protectString<RundownPlaylistId>(playlistId) }, { playlistExternalId: playlistId }],
	})
	const studioId = await findStudioId()

	for (const rundown of rundowns) {
		await runIngestOperation(studioId, IngestJobs.RemoveRundown, {
			rundownExternalId: rundown.externalId,
		})
	}
}

// Rundowns

export async function getRundowns(playlistId: string): Promise<any> {
	await findPlaylist(playlistId)
	const rundowns = await Rundowns.findFetchAsync({
		$or: [
			{
				playlistId: protectString<RundownPlaylistId>(playlistId),
			},
			{ playlistExternalId: playlistId },
		],
	})
	return rundowns
}

export async function getRundown(playlistId: string, rundownId: string): Promise<Rundown> {
	const playlist = await findPlaylist(playlistId)
	const rundown = findRundown(playlist._id, rundownId)
	return rundown
}

export async function deleteRundowns(playlistId: string): Promise<void> {
	const playlist = await findPlaylist(playlistId)
	const rundowns = await Rundowns.findFetchAsync({ $or: [{ playlistId: playlist._id }] })
	const studioId = await findStudioId()

	for (const rundown of rundowns) {
		await runIngestOperation(studioId, IngestJobs.RemoveRundown, {
			rundownExternalId: rundown.externalId,
		})
	}
}

export async function putRundown(playlistId: string, ingestRundown: IngestRundown): Promise<void> {
	const rundownId = getRundownId(ingestRundown.externalId)
	const studioId = await findStudioId()

	const existingRundown = await Rundowns.findOneAsync({
		$or: [
			{ _id: rundownId, playlistId: protectString<RundownPlaylistId>(playlistId) },
			{ externalId: rundownId, playlistExternalId: playlistId },
		],
	})
	checkRundownSource(existingRundown)

	await runIngestOperation(studioId, IngestJobs.UpdateRundown, {
		rundownExternalId: ingestRundown.externalId,
		ingestRundown: ingestRundown,
		isCreateAction: true,
		rundownSource: {
			type: 'httpIngest',
		},
	})
}

export async function deleteRundown(playlistId: string, rundownId: string): Promise<void> {
	const playlist = await findPlaylist(playlistId)
	const rundown = await findRundown(playlist._id, rundownId)
	const studioId = await findStudioId()

	await runIngestOperation(studioId, IngestJobs.RemoveRundown, {
		rundownExternalId: rundown.externalId,
	})
}

// Segments

export async function putSegments(
	playlistId: string,
	rundownId: string,
	ingestSegments: IngestSegment[]
): Promise<void> {
	const playlist = await findPlaylist(playlistId)
	const rundown = await findRundown(playlist._id, rundownId)
	const studioId = await findStudioId()
	checkRundownSource(rundown)

	const oldSegments = await Segments.findFetchAsync({ rundownId: rundown._id })
	for (const segment of oldSegments) {
		const oldParts = await Parts.findFetchAsync({ rundownId: rundown._id, segmentId: segment._id })
		for (const part of oldParts) {
			await runIngestOperation(studioId, IngestJobs.RemovePart, {
				partExternalId: part.externalId,
				rundownExternalId: rundown.externalId,
				segmentExternalId: segment.externalId,
			})
		}

		await runIngestOperation(studioId, IngestJobs.RemoveSegment, {
			rundownExternalId: rundown.externalId,
			segmentExternalId: segment.externalId,
		})
	}

	for (const ingestSegment of ingestSegments) {
		await runIngestOperation(studioId, IngestJobs.UpdateSegment, {
			rundownExternalId: rundown.externalId,
			isCreateAction: true,
			ingestSegment,
		})
	}
}

export async function getSegments(playlistId: string, rundownId: string): Promise<any> {
	const playlist = await findPlaylist(playlistId)
	const rundown = await findRundown(playlist._id, rundownId)

	const segments = await Segments.findFetchAsync({
		rundownId: rundown._id,
	})

	return segments
}

export async function deleteSegments(playlistId: string, rundownId: string): Promise<void> {
	const playlist = await findPlaylist(playlistId)
	const rundown = await findRundown(playlist._id, rundownId)
	const studioId = await findStudioId()

	const segments = await Segments.findFetchAsync({ rundownId: rundown._id })

	for (const segment of segments) {
		await runIngestOperation(studioId, IngestJobs.RemoveSegment, {
			rundownExternalId: rundown.externalId,
			segmentExternalId: segment.externalId,
		})
	}
}

export async function getSegment(playlistId: string, rundownId: string, segmentId: string): Promise<any> {
	const playlist = await findPlaylist(playlistId)
	const rundown = await findRundown(playlist._id, rundownId)

	const segment = findSegment(rundown._id, segmentId)

	return segment
}

export async function deleteSegment(playlistId: string, rundownId: string, segmentId: string): Promise<void> {
	const playlist = await findPlaylist(playlistId)
	const rundown = await findRundown(playlist._id, rundownId)
	const studioId = await findStudioId()

	const segment = await findSegment(rundown._id, segmentId)

	await runIngestOperation(studioId, IngestJobs.RemoveSegment, {
		segmentExternalId: segment.externalId,
		rundownExternalId: rundown.externalId,
	})
}

// Parts

export async function getParts(playlistId: string, rundownId: string, segmentId: string): Promise<any> {
	const playlist = await findPlaylist(playlistId)
	const rundown = await findRundown(playlist._id, rundownId)
	const segment = await findSegment(rundown._id, segmentId)

	const parts = await Parts.findFetchAsync({
		segmentId: segment._id,
	})

	return parts
}

export async function getPart(playlistId: string, rundownId: string, segmentId: string, partId: string): Promise<any> {
	const playlist = await findPlaylist(playlistId)
	const rundown = await findRundown(playlist._id, rundownId)
	const segment = await findSegment(rundown._id, segmentId)

	const part = findPart(segment._id, partId)

	return part
}

export async function putParts(
	playlistId: string,
	rundownId: string,
	segmentId: string,
	ingestParts: IngestPart[]
): Promise<void> {
	const playlist = await findPlaylist(playlistId)
	const rundown = await findRundown(playlist._id, rundownId)
	const segment = await findSegment(rundown._id, segmentId)

	const studioId = await findStudioId()
	checkRundownSource(rundown)

	for (const ingestPart of ingestParts) {
		ingestPart.payload.segmentId = segment._id

		await runIngestOperation(studioId, IngestJobs.UpdatePart, {
			segmentExternalId: segment.externalId,
			rundownExternalId: rundown.externalId,
			isCreateAction: true,
			ingestPart,
		})
	}
}

export async function deletePart(
	playlistId: string,
	rundownId: string,
	segmentId: string,
	partId: string
): Promise<any> {
	const playlist = await findPlaylist(playlistId)
	const rundown = await findRundown(playlist._id, rundownId)
	const segment = await findSegment(rundown._id, segmentId)
	const studioId = await findStudioId()

	const part = await findPart(segment._id, partId)

	await runIngestOperation(studioId, IngestJobs.RemovePart, {
		rundownExternalId: rundown.externalId,
		segmentExternalId: segment.externalId,
		partExternalId: part.externalId,
	})

	return part
}
