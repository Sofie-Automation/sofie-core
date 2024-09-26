import { IngestPart, IngestSegment } from '@sofie-automation/blueprints-integration'
import { PartId, RundownId, RundownPlaylistId, SegmentId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getRundownNrcsName, Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { Meteor } from 'meteor/meteor'
import { Parts, RundownPlaylists, Rundowns, Segments, Studios } from '../../../collections'
import { runIngestOperation } from '../lib'
import { adaptPart, adaptPlaylist, adaptRundown, adaptSegment } from './httpIngestResponseAdapters'
import { HttpIngestRundown, PartResponse, PlaylistResponse, RundownResponse, SegmentResponse } from './httpIngestTypes'

async function findPlaylist(studioId: StudioId, playlistId: string) {
	const playlist = await RundownPlaylists.findOneAsync({
		$or: [
			{ _id: protectString<RundownPlaylistId>(playlistId), studioId },
			{ externalId: playlistId, studioId },
		],
	})
	if (!playlist) {
		throw new Meteor.Error(404, `Playlist ID '${playlistId}' was not found`)
	}
	return playlist
}

async function findRundown(studioId: StudioId, playlistId: RundownPlaylistId, rundownId: string) {
	const rundown = await Rundowns.findOneAsync({
		$or: [
			{
				_id: protectString<RundownId>(rundownId),
				playlistId,
				studioId,
			},
			{
				externalId: rundownId,
				playlistId,
				studioId,
			},
		],
	})
	if (!rundown) {
		throw new Meteor.Error(404, `Rundown ID '${rundownId}' was not found`)
	}
	return rundown
}

async function findRundowns(studioId: StudioId, playlistId: RundownPlaylistId) {
	const rundowns = await Rundowns.findFetchAsync({
		$or: [
			{
				playlistId,
				studioId,
			},
		],
	})

	return rundowns
}

async function softFindSegment(rundownId: RundownId, segmentId: string) {
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
	return segment
}

async function findSegment(rundownId: RundownId, segmentId: string) {
	const segment = await softFindSegment(rundownId, segmentId)
	if (!segment) {
		throw new Meteor.Error(404, `Segment ID '${segmentId}' was not found`)
	}
	return segment
}

async function findSegments(rundownId: RundownId) {
	const segments = await Segments.findFetchAsync({
		$or: [
			{
				rundownId: rundownId,
			},
		],
	})
	return segments
}

async function softFindPart(segmentId: SegmentId, partId: string) {
	const part = await Parts.findOneAsync({
		$or: [
			{ _id: protectString<PartId>(partId), segmentId },
			{
				externalId: partId,
				segmentId,
			},
		],
	})
	return part
}

async function findPart(segmentId: SegmentId, partId: string) {
	const part = await softFindPart(segmentId, partId)
	if (!part) {
		throw new Meteor.Error(404, `Part ID '${partId}' was not found`)
	}
	return part
}

async function findParts(segmentId: SegmentId) {
	const parts = await Parts.findFetchAsync({
		$or: [{ segmentId }],
	})
	return parts
}

async function findStudio(studioId: string) {
	const studio = await Studios.findOneAsync({ _id: protectString<StudioId>(studioId) })
	if (!studio) {
		throw new Meteor.Error(500, `Studio does not exist`)
	}

	return studio
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

// Playlists

export async function getPlaylists(studioId: string): Promise<PlaylistResponse[]> {
	const studio = await findStudio(studioId)
	const rawPlaylists = await RundownPlaylists.findFetchAsync({ studioId: studio._id })
	const playlists = rawPlaylists.map((rawPlaylist) => adaptPlaylist(rawPlaylist))

	return playlists
}

export async function getPlaylist(studioId: string, playlistId: string): Promise<PlaylistResponse> {
	const studio = await findStudio(studioId)
	const rawPlaylist = await findPlaylist(studio._id, playlistId)
	const playlist = adaptPlaylist(rawPlaylist)

	return playlist
}

export async function deletePlaylists(studioId: string): Promise<void> {
	const rundowns = await Rundowns.findFetchAsync({})
	const studio = await findStudio(studioId)

	for (const rundown of rundowns) {
		await runIngestOperation(studio._id, IngestJobs.RemoveRundown, {
			rundownExternalId: rundown.externalId,
		})
	}
}

export async function deletePlaylist(studioId: string, playlistId: string): Promise<void> {
	const studio = await findStudio(studioId)
	await findPlaylist(studio._id, playlistId)

	const rundowns = await Rundowns.findFetchAsync({
		$or: [{ playlistId: protectString<RundownPlaylistId>(playlistId) }, { playlistExternalId: playlistId }],
	})

	for (const rundown of rundowns) {
		await runIngestOperation(studio._id, IngestJobs.RemoveRundown, {
			rundownExternalId: rundown.externalId,
		})
	}
}

// Rundowns

// Get rundown
export async function getRundown(studioId: string, playlistId: string, rundownId: string): Promise<RundownResponse> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rawRundown = await findRundown(studio._id, playlist._id, rundownId)
	const rundown = adaptRundown(rawRundown)

	return rundown
}

// Get rundowns
export async function getRundowns(studioId: string, playlistId: string): Promise<RundownResponse[]> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rawRundowns = await findRundowns(studio._id, playlist._id)
	const rundowns = rawRundowns.map((rawRundown) => adaptRundown(rawRundown))

	return rundowns
}

// Create rundown
export async function postRundown(
	studioId: string,
	playlistId: string,
	ingestRundown: HttpIngestRundown
): Promise<void> {
	const studio = await findStudio(studioId)
	const rundownExternalId = ingestRundown.externalId

	const existingRundown = await Rundowns.findOneAsync({
		$or: [
			{
				_id: protectString<RundownId>(rundownExternalId),
				playlistId: protectString<RundownPlaylistId>(playlistId),
				studioId: studio._id,
			},
			{
				externalId: rundownExternalId,
				playlistExternalId: playlistId,
				studioId: studio._id,
			},
		],
	})
	if (existingRundown) {
		throw new Meteor.Error(400, `Rundown '${rundownExternalId}' already exists`)
	}

	await runIngestOperation(studio._id, IngestJobs.UpdateRundown, {
		rundownExternalId: rundownExternalId,
		ingestRundown: ingestRundown,
		isCreateAction: true,
		rundownSource: {
			type: 'httpIngest',
			resyncUrl: ingestRundown.resyncUrl,
		},
	})
}

// Update rundown
export async function putRundown(
	studioId: string,
	playlistId: string,
	rundownId: string,
	ingestRundown: HttpIngestRundown
): Promise<void> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)

	const existingRundown = await findRundown(studio._id, playlist._id, rundownId)
	if (!existingRundown) {
		throw new Meteor.Error(400, `Rundown '${rundownId}' does not exist`)
	}

	checkRundownSource(existingRundown)

	await runIngestOperation(studio._id, IngestJobs.UpdateRundown, {
		rundownExternalId: existingRundown.externalId,
		ingestRundown: ingestRundown,
		isCreateAction: true,
		rundownSource: {
			type: 'httpIngest',
			resyncUrl: ingestRundown.resyncUrl,
		},
	})
}

// Update rundowns
export async function putRundowns(
	studioId: string,
	playlistId: string,
	ingestRundowns: HttpIngestRundown[]
): Promise<void> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)

	for (const ingestRundown of ingestRundowns) {
		const rundownExternalId = ingestRundown.externalId
		const existingRundown = await findRundown(studio._id, playlist._id, rundownExternalId)
		if (!existingRundown) {
			continue
		}

		checkRundownSource(existingRundown)

		await runIngestOperation(studio._id, IngestJobs.UpdateRundown, {
			rundownExternalId: ingestRundown.externalId,
			ingestRundown: ingestRundown,
			isCreateAction: true,
			rundownSource: {
				type: 'httpIngest',
				resyncUrl: ingestRundown.resyncUrl,
			},
		})
	}
}

// Delete rundown
export async function deleteRundown(studioId: string, playlistId: string, rundownId: string): Promise<void> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rundown = await findRundown(studio._id, playlist._id, rundownId)
	checkRundownSource(rundown)

	await runIngestOperation(studio._id, IngestJobs.RemoveRundown, {
		rundownExternalId: rundown.externalId,
	})
}

// Delete rundowns
export async function deleteRundowns(studioId: string, playlistId: string): Promise<void> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rundowns = await findRundowns(studio._id, playlist._id)

	for (const rundown of rundowns) {
		checkRundownSource(rundown)
		await runIngestOperation(studio._id, IngestJobs.RemoveRundown, {
			rundownExternalId: rundown.externalId,
		})
	}
}

// Segments

export async function getSegment(
	studioId: string,
	playlistId: string,
	rundownId: string,
	segmentId: string
): Promise<SegmentResponse> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rundown = await findRundown(studio._id, playlist._id, rundownId)
	checkRundownSource(rundown)

	const rawSegment = await findSegment(rundown._id, segmentId)
	const segment = adaptSegment(rawSegment)

	return segment
}

export async function getSegments(studioId: string, playlistId: string, rundownId: string): Promise<SegmentResponse[]> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rundown = await findRundown(studio._id, playlist._id, rundownId)
	checkRundownSource(rundown)

	const rawSegments = await findSegments(rundown._id)
	const segments = rawSegments.map((rawSegment) => adaptSegment(rawSegment))

	return segments
}

export async function postSegment(
	studioId: string,
	playlistId: string,
	rundownId: string,
	ingestSegment: IngestSegment
): Promise<void> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rundown = await findRundown(studio._id, playlist._id, rundownId)
	checkRundownSource(rundown)

	const segmentExternalId = ingestSegment.externalId

	const existingSegment = await softFindSegment(rundown._id, segmentExternalId)
	if (existingSegment) {
		throw new Meteor.Error(400, `Segment '${segmentExternalId}' already exists`)
	}

	await runIngestOperation(studio._id, IngestJobs.UpdateSegment, {
		rundownExternalId: rundown.externalId,
		isCreateAction: true,
		ingestSegment,
	})
}

export async function putSegment(
	studioId: string,
	playlistId: string,
	rundownId: string,
	segmentId: string,
	ingestSegment: IngestSegment
): Promise<void> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rundown = await findRundown(studio._id, playlist._id, rundownId)
	checkRundownSource(rundown)

	const segment = await softFindSegment(rundown._id, segmentId)
	if (!segment) {
		throw new Meteor.Error(400, `Segment '${segmentId}' does not exist`)
	}

	const parts = await findParts(segment._id)
	for (const part of parts) {
		await runIngestOperation(studio._id, IngestJobs.RemovePart, {
			partExternalId: part.externalId,
			rundownExternalId: rundown.externalId,
			segmentExternalId: segment.externalId,
		})
	}

	await runIngestOperation(studio._id, IngestJobs.UpdateSegment, {
		rundownExternalId: rundown.externalId,
		isCreateAction: true,
		ingestSegment,
	})
}

export async function putSegments(
	studioId: string,
	playlistId: string,
	rundownId: string,
	ingestSegments: IngestSegment[]
): Promise<void> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rundown = await findRundown(studio._id, playlist._id, rundownId)
	checkRundownSource(rundown)

	const segments = await findSegments(rundown._id)
	for (const segment of segments) {
		const parts = await findParts(segment._id)
		for (const part of parts) {
			await runIngestOperation(studio._id, IngestJobs.RemovePart, {
				partExternalId: part.externalId,
				rundownExternalId: rundown.externalId,
				segmentExternalId: segment.externalId,
			})
		}
	}

	for (const ingestSegment of ingestSegments) {
		const existingSegment = await softFindSegment(rundown._id, ingestSegment.externalId)
		if (!existingSegment) {
			continue
		}

		await runIngestOperation(studio._id, IngestJobs.UpdateSegment, {
			rundownExternalId: rundown.externalId,
			isCreateAction: true,
			ingestSegment,
		})
	}
}

export async function deleteSegment(
	studioId: string,
	playlistId: string,
	rundownId: string,
	segmentId: string
): Promise<void> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rundown = await findRundown(studio._id, playlist._id, rundownId)
	checkRundownSource(rundown)
	const segment = await findSegment(rundown._id, segmentId)

	await runIngestOperation(studio._id, IngestJobs.RemoveSegment, {
		segmentExternalId: segment.externalId,
		rundownExternalId: rundown.externalId,
	})
}

export async function deleteSegments(studioId: string, playlistId: string, rundownId: string): Promise<void> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rundown = await findRundown(studio._id, playlist._id, rundownId)

	const segments = await findSegments(rundown._id)

	for (const segment of segments) {
		await runIngestOperation(studio._id, IngestJobs.RemoveSegment, {
			rundownExternalId: rundown.externalId,
			segmentExternalId: segment.externalId,
		})
	}
}

// Parts

export async function getParts(
	studioId: string,
	playlistId: string,
	rundownId: string,
	segmentId: string
): Promise<PartResponse[]> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rundown = await findRundown(studio._id, playlist._id, rundownId)
	checkRundownSource(rundown)
	const segment = await findSegment(rundown._id, segmentId)

	const rawParts = await findParts(segment._id)
	const parts = rawParts.map((rawPart) => adaptPart(rawPart))

	return parts
}

export async function getPart(
	studioId: string,
	playlistId: string,
	rundownId: string,
	segmentId: string,
	partId: string
): Promise<PartResponse> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rundown = await findRundown(studio._id, playlist._id, rundownId)
	checkRundownSource(rundown)
	const segment = await findSegment(rundown._id, segmentId)

	const rawPart = await findPart(segment._id, partId)
	const part = adaptPart(rawPart)

	return part
}

export async function postPart(
	studioId: string,
	playlistId: string,
	rundownId: string,
	segmentId: string,
	ingestPart: IngestPart
): Promise<void> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rundown = await findRundown(studio._id, playlist._id, rundownId)
	checkRundownSource(rundown)
	const segment = await findSegment(rundown._id, segmentId)
	const partExternalId = ingestPart.externalId

	const existingPart = await softFindPart(segment._id, partExternalId)
	if (existingPart) {
		throw new Meteor.Error(400, `Part '${partExternalId}' already exists`)
	}

	await runIngestOperation(studio._id, IngestJobs.UpdatePart, {
		rundownExternalId: rundown.externalId,
		segmentExternalId: segment.externalId,
		isCreateAction: true,
		ingestPart,
	})
}

export async function putPart(
	studioId: string,
	playlistId: string,
	rundownId: string,
	segmentId: string,
	partId: string,
	ingestPart: IngestPart
): Promise<void> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rundown = await findRundown(studio._id, playlist._id, rundownId)
	checkRundownSource(rundown)
	const segment = await findSegment(rundown._id, segmentId)

	const existingPart = await findPart(segment._id, partId)
	if (!existingPart) {
		throw new Meteor.Error(400, `Part '${partId}' does not exists`)
	}

	await runIngestOperation(studio._id, IngestJobs.UpdatePart, {
		rundownExternalId: rundown.externalId,
		segmentExternalId: segment.externalId,
		isCreateAction: true,
		ingestPart,
	})
}

export async function putParts(
	studioId: string,
	playlistId: string,
	rundownId: string,
	segmentId: string,
	ingestParts: IngestPart[]
): Promise<void> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rundown = await findRundown(studio._id, playlist._id, rundownId)
	checkRundownSource(rundown)
	const segment = await findSegment(rundown._id, segmentId)

	for (const ingestPart of ingestParts) {
		const existingPart = await findPart(segment._id, ingestPart.externalId)
		if (!existingPart) {
			continue
		}

		await runIngestOperation(studio._id, IngestJobs.UpdatePart, {
			segmentExternalId: segment.externalId,
			rundownExternalId: rundown.externalId,
			isCreateAction: true,
			ingestPart,
		})
	}
}

export async function deletePart(
	studioId: string,
	playlistId: string,
	rundownId: string,
	segmentId: string,
	partId: string
): Promise<void> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rundown = await findRundown(studio._id, playlist._id, rundownId)
	checkRundownSource(rundown)
	const segment = await findSegment(rundown._id, segmentId)

	const part = await findPart(segment._id, partId)

	await runIngestOperation(studio._id, IngestJobs.RemovePart, {
		rundownExternalId: rundown.externalId,
		segmentExternalId: segment.externalId,
		partExternalId: part.externalId,
	})
}

export async function deleteParts(
	studioId: string,
	playlistId: string,
	rundownId: string,
	segmentId: string
): Promise<void> {
	const studio = await findStudio(studioId)
	const playlist = await findPlaylist(studio._id, playlistId)
	const rundown = await findRundown(studio._id, playlist._id, rundownId)
	checkRundownSource(rundown)
	const segment = await findSegment(rundown._id, segmentId)

	const parts = await findParts(segment._id)

	for (const part of parts) {
		await runIngestOperation(studio._id, IngestJobs.RemovePart, {
			rundownExternalId: rundown.externalId,
			segmentExternalId: segment.externalId,
			partExternalId: part.externalId,
		})
	}
}
