import { IngestPart, IngestRundown, IngestSegment } from '@sofie-automation/blueprints-integration'
import {
	BlueprintId,
	PartId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { getRundownNrcsName, Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import {
	RestApiIngestRundown,
	IngestRestAPI,
	PartResponse,
	PlaylistResponse,
	RundownResponse,
	SegmentResponse,
} from '../../../lib/rest/v1/ingest'
import { check } from '../../../lib/check'
import { Parts, RundownPlaylists, Rundowns, Segments, Studios } from '../../../collections'
import { logger } from '../../../logging'
import { runIngestOperation } from '../../ingest/lib'
import { validateAPIPartPayload, validateAPIRundownPayload, validateAPISegmentPayload } from './typeConversion'
import { APIFactory, APIRegisterHook, ServerAPIContext } from './types'

class IngestServerAPI implements IngestRestAPI {
	private async validateAPIPayloadsForRundown(
		blueprintId: BlueprintId | undefined,
		rundown: IngestRundown,
		indexes?: {
			rundown?: number
		}
	) {
		const validationResult = await validateAPIRundownPayload(blueprintId, rundown.payload)
		const errorMessage = this.formatPayloadValidationErrors('Rundown', validationResult, indexes)

		if (errorMessage) {
			logger.error(`${errorMessage} with errors: ${validationResult}`)
			throw new Meteor.Error(409, errorMessage, JSON.stringify(validationResult))
		}

		return Promise.all(
			rundown.segments.map(async (segment, index) => {
				return this.validateAPIPayloadsForSegment(blueprintId, segment, {
					...indexes,
					segment: index,
				})
			})
		)
	}

	private async validateAPIPayloadsForSegment(
		blueprintId: BlueprintId | undefined,
		segment: IngestRundown['segments'][number],
		indexes?: {
			rundown?: number
			segment?: number
		}
	) {
		const validationResult = await validateAPISegmentPayload(blueprintId, segment.payload)
		const errorMessage = this.formatPayloadValidationErrors('Segment', validationResult, indexes)

		if (errorMessage) {
			logger.error(`${errorMessage} with errors: ${validationResult}`)
			throw new Meteor.Error(409, errorMessage, JSON.stringify(validationResult))
		}

		return Promise.all(
			segment.parts.map(async (part, index) => {
				return this.validateAPIPayloadsForPart(blueprintId, part, { ...indexes, part: index })
			})
		)
	}

	private async validateAPIPayloadsForPart(
		blueprintId: BlueprintId | undefined,
		part: IngestRundown['segments'][number]['parts'][number],
		indexes?: {
			rundown?: number
			segment?: number
			part?: number
		}
	) {
		const validationResult = await validateAPIPartPayload(blueprintId, part.payload)
		const errorMessage = this.formatPayloadValidationErrors('Part', validationResult, indexes)

		if (errorMessage) {
			logger.error(`${errorMessage} with errors: ${validationResult}`)
			throw new Meteor.Error(409, errorMessage, JSON.stringify(validationResult))
		}
	}

	private formatPayloadValidationErrors(
		type: 'Rundown' | 'Segment' | 'Part',
		validationResult: string[] | undefined,
		indexes?: {
			rundown?: number
			segment?: number
			part?: number
		}
	) {
		if (!validationResult || validationResult.length === 0) {
			return
		}

		const messageParts = []
		if (indexes?.rundown !== undefined) messageParts.push(`rundowns[${indexes.rundown}]`)
		if (indexes?.segment !== undefined) messageParts.push(`segments[${indexes.segment}]`)
		if (indexes?.part !== undefined) messageParts.push(`parts[${indexes.part}]`)
		let message = `${type} payload validation failed`
		if (messageParts.length > 0) message += ` for ${messageParts.join('.')}`
		return message
	}

	private validateRundown(ingestRundown: RestApiIngestRundown) {
		check(ingestRundown, Object)
		check(ingestRundown.externalId, String)
		check(ingestRundown.name, String)
		check(ingestRundown.type, String)
		check(ingestRundown.segments, Array)
		check(ingestRundown.resyncUrl, String)

		check(ingestRundown.timing, Object)
		check(ingestRundown.timing?.type, String)

		if (ingestRundown.timing?.type === 'forward-time') {
			check(ingestRundown.timing.expectedStart, Number)
		} else if (ingestRundown.timing?.type === 'back-time') {
			check(ingestRundown.timing?.expectedEnd, Number)
		}

		ingestRundown.segments.forEach((ingestSegment) => this.validateSegment(ingestSegment))
	}

	private validateSegment(ingestSegment: IngestSegment) {
		check(ingestSegment, Object)
		check(ingestSegment.externalId, String)
		check(ingestSegment.name, String)
		check(ingestSegment.rank, Number)
		check(ingestSegment.parts, Array)

		if (ingestSegment.isHidden !== undefined) check(ingestSegment.isHidden, Boolean)
		if (ingestSegment.timing !== undefined) {
			check(ingestSegment.timing.expectedStart, Number)
			check(ingestSegment.timing.expectedEnd, Number)
		}

		ingestSegment.parts.forEach((ingestPart) => this.validatePart(ingestPart))
	}

	private validatePart(ingestPart: IngestPart) {
		check(ingestPart, Object)
		check(ingestPart.externalId, String)
		check(ingestPart.name, String)
		check(ingestPart.rank, Number)

		if (ingestPart.float !== undefined) check(ingestPart.float, Boolean)
		if (ingestPart.autoNext !== undefined) check(ingestPart.autoNext, Boolean)
	}

	private adaptPlaylist(rawPlaylist: DBRundownPlaylist): PlaylistResponse {
		return {
			id: unprotectString(rawPlaylist._id),
			externalId: rawPlaylist.externalId,
			rundownIds: rawPlaylist.rundownIdsInOrder.map((id) => unprotectString(id)),
			studioId: unprotectString(rawPlaylist.studioId),
		}
	}

	private adaptRundown(rawRundown: Rundown): RundownResponse {
		return {
			id: unprotectString(rawRundown._id),
			externalId: rawRundown.externalId,
			playlistId: unprotectString(rawRundown.playlistId),
			playlistExternalId: rawRundown.playlistExternalId,
			studioId: unprotectString(rawRundown.studioId),
			name: rawRundown.name,
		}
	}

	private adaptSegment(rawSegment: DBSegment): SegmentResponse {
		return {
			id: unprotectString(rawSegment._id),
			externalId: rawSegment.externalId,
			name: rawSegment.name,
			rank: rawSegment._rank,
			rundownId: unprotectString(rawSegment.rundownId),
			isHidden: rawSegment.isHidden,
		}
	}

	private adaptPart(rawPart: DBPart): PartResponse {
		return {
			id: unprotectString(rawPart._id),
			externalId: rawPart.externalId,
			name: rawPart.title,
			rank: rawPart._rank,
			rundownId: unprotectString(rawPart.rundownId),
			autoNext: rawPart.autoNext,
			expectedDuration: rawPart.expectedDuration,
			segmentId: unprotectString(rawPart.segmentId),
		}
	}

	private async findPlaylist(studioId: StudioId, playlistId: string) {
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

	private async findRundown(studioId: StudioId, playlistId: RundownPlaylistId, rundownId: string) {
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

	private async findRundowns(studioId: StudioId, playlistId: RundownPlaylistId) {
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

	private async softFindSegment(rundownId: RundownId, segmentId: string) {
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

	private async findSegment(rundownId: RundownId, segmentId: string) {
		const segment = await this.softFindSegment(rundownId, segmentId)
		if (!segment) {
			throw new Meteor.Error(404, `Segment ID '${segmentId}' was not found`)
		}
		return segment
	}

	private async findSegments(rundownId: RundownId) {
		const segments = await Segments.findFetchAsync({
			$or: [
				{
					rundownId: rundownId,
				},
			],
		})
		return segments
	}

	private async softFindPart(segmentId: SegmentId, partId: string) {
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

	private async findPart(segmentId: SegmentId, partId: string) {
		const part = await this.softFindPart(segmentId, partId)
		if (!part) {
			throw new Meteor.Error(404, `Part ID '${partId}' was not found`)
		}
		return part
	}

	private async findParts(segmentId: SegmentId) {
		const parts = await Parts.findFetchAsync({
			$or: [{ segmentId }],
		})
		return parts
	}

	private async findStudio(studioId: StudioId) {
		const studio = await Studios.findOneAsync({ _id: studioId })
		if (!studio) {
			throw new Meteor.Error(500, `Studio '${studioId}' does not exist`)
		}

		return studio
	}

	private checkRundownSource(rundown: Rundown | undefined) {
		if (rundown && rundown.source.type !== 'restApi') {
			throw new Meteor.Error(
				403,
				`Cannot replace existing rundown from source '${getRundownNrcsName(
					rundown
				)}' with new data from 'restApi' source`
			)
		}
	}

	// Playlists

	async getPlaylists(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<Array<PlaylistResponse>>> {
		check(studioId, String)

		const studio = await this.findStudio(studioId)
		const rawPlaylists = await RundownPlaylists.findFetchAsync({ studioId: studio._id })
		const playlists = rawPlaylists.map((rawPlaylist) => this.adaptPlaylist(rawPlaylist))

		return ClientAPI.responseSuccess(playlists)
	}

	async getPlaylist(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string
	): Promise<ClientAPI.ClientResponse<PlaylistResponse>> {
		check(studioId, String)
		check(playlistId, String)

		const studio = await this.findStudio(studioId)
		const rawPlaylist = await this.findPlaylist(studio._id, playlistId)
		const playlist = this.adaptPlaylist(rawPlaylist)

		return ClientAPI.responseSuccess(playlist)
	}

	async deletePlaylists(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<undefined>> {
		check(studioId, String)

		const rundowns = await Rundowns.findFetchAsync({})
		const studio = await this.findStudio(studioId)

		await Promise.all(
			rundowns.map(async (rundown) =>
				runIngestOperation(studio._id, IngestJobs.RemoveRundown, {
					rundownExternalId: rundown.externalId,
				})
			)
		)

		return ClientAPI.responseSuccess(undefined)
	}

	async deletePlaylist(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string
	): Promise<ClientAPI.ClientResponse<undefined>> {
		check(studioId, String)
		check(playlistId, String)

		const studio = await this.findStudio(studioId)
		await this.findPlaylist(studio._id, playlistId)

		const rundowns = await Rundowns.findFetchAsync({
			$or: [{ playlistId: protectString<RundownPlaylistId>(playlistId) }, { playlistExternalId: playlistId }],
		})

		await Promise.all(
			rundowns.map(async (rundown) =>
				runIngestOperation(studio._id, IngestJobs.RemoveRundown, {
					rundownExternalId: rundown.externalId,
				})
			)
		)

		return ClientAPI.responseSuccess(undefined)
	}

	// Rundowns

	async getRundowns(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string
	): Promise<ClientAPI.ClientResponse<Array<RundownResponse>>> {
		check(studioId, String)
		check(playlistId, String)

		const studio = await this.findStudio(studioId)
		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rawRundowns = await this.findRundowns(studio._id, playlist._id)
		const rundowns = rawRundowns.map((rawRundown) => this.adaptRundown(rawRundown))

		return ClientAPI.responseSuccess(rundowns)
	}

	async getRundown(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string
	): Promise<ClientAPI.ClientResponse<RundownResponse>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)

		const studio = await this.findStudio(studioId)
		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rawRundown = await this.findRundown(studio._id, playlist._id, rundownId)
		const rundown = this.adaptRundown(rawRundown)

		return ClientAPI.responseSuccess(rundown)
	}

	async postRundown(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		ingestRundown: RestApiIngestRundown
	): Promise<ClientAPI.ClientResponse<void>> {
		check(studioId, String)
		check(playlistId, String)
		check(ingestRundown, Object)

		const studio = await this.findStudio(studioId)

		this.validateRundown(ingestRundown)
		await this.validateAPIPayloadsForRundown(studio.blueprintId, ingestRundown)

		const existingRundown = await Rundowns.findOneAsync({
			$or: [
				{
					_id: protectString<RundownId>(ingestRundown.externalId),
					playlistId: protectString<RundownPlaylistId>(playlistId),
					studioId: studio._id,
				},
				{
					externalId: ingestRundown.externalId,
					playlistExternalId: playlistId,
					studioId: studio._id,
				},
			],
		})
		if (existingRundown) {
			throw new Meteor.Error(400, `Rundown '${ingestRundown.externalId}' already exists`)
		}

		await runIngestOperation(studio._id, IngestJobs.UpdateRundown, {
			rundownExternalId: ingestRundown.externalId,
			ingestRundown: { ...ingestRundown, playlistExternalId: playlistId },
			isCreateAction: true,
			rundownSource: {
				type: 'restApi',
				resyncUrl: ingestRundown.resyncUrl,
			},
		})

		return ClientAPI.responseSuccess(undefined)
	}

	async putRundowns(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		ingestRundowns: RestApiIngestRundown[]
	): Promise<ClientAPI.ClientResponse<void>> {
		check(studioId, String)
		check(playlistId, String)
		check(ingestRundowns, Array)

		const studio = await this.findStudio(studioId)

		await Promise.all(
			ingestRundowns.map(async (ingestRundown, index) => {
				this.validateRundown(ingestRundown)
				return this.validateAPIPayloadsForRundown(studio.blueprintId, ingestRundown, { rundown: index })
			})
		)

		const playlist = await this.findPlaylist(studio._id, playlistId)

		await Promise.all(
			ingestRundowns.map(async (ingestRundown) => {
				const rundownExternalId = ingestRundown.externalId
				const existingRundown = await this.findRundown(studio._id, playlist._id, rundownExternalId)
				if (!existingRundown) {
					return
				}

				this.checkRundownSource(existingRundown)

				return runIngestOperation(studio._id, IngestJobs.UpdateRundown, {
					rundownExternalId: ingestRundown.externalId,
					ingestRundown: { ...ingestRundown, playlistExternalId: playlist.externalId },
					isCreateAction: true,
					rundownSource: {
						type: 'restApi',
						resyncUrl: ingestRundown.resyncUrl,
					},
				})
			})
		)

		return ClientAPI.responseSuccess(undefined)
	}

	async putRundown(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		ingestRundown: RestApiIngestRundown
	): Promise<ClientAPI.ClientResponse<void>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)
		check(ingestRundown, Object)

		const studio = await this.findStudio(studioId)

		this.validateRundown(ingestRundown)
		await this.validateAPIPayloadsForRundown(studio.blueprintId, ingestRundown)

		const playlist = await this.findPlaylist(studio._id, playlistId)
		const existingRundown = await this.findRundown(studio._id, playlist._id, rundownId)
		if (!existingRundown) {
			throw new Meteor.Error(400, `Rundown '${rundownId}' does not exist`)
		}
		this.checkRundownSource(existingRundown)

		await runIngestOperation(studio._id, IngestJobs.UpdateRundown, {
			rundownExternalId: existingRundown.externalId,
			ingestRundown: { ...ingestRundown, playlistExternalId: playlist.externalId },
			isCreateAction: true,
			rundownSource: {
				type: 'restApi',
				resyncUrl: ingestRundown.resyncUrl,
			},
		})

		return ClientAPI.responseSuccess(undefined)
	}

	async deleteRundowns(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string
	): Promise<ClientAPI.ClientResponse<void>> {
		check(studioId, String)
		check(playlistId, String)

		const studio = await this.findStudio(studioId)
		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rundowns = await this.findRundowns(studio._id, playlist._id)

		await Promise.all(
			rundowns.map(async (rundown) => {
				this.checkRundownSource(rundown)
				return runIngestOperation(studio._id, IngestJobs.RemoveRundown, {
					rundownExternalId: rundown.externalId,
				})
			})
		)

		return ClientAPI.responseSuccess(undefined)
	}

	async deleteRundown(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string
	): Promise<ClientAPI.ClientResponse<void>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)

		const studio = await this.findStudio(studioId)
		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rundown = await this.findRundown(studio._id, playlist._id, rundownId)
		this.checkRundownSource(rundown)

		await runIngestOperation(studio._id, IngestJobs.RemoveRundown, {
			rundownExternalId: rundown.externalId,
		})

		return ClientAPI.responseSuccess(undefined)
	}

	// Segments

	async getSegments(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string
	): Promise<ClientAPI.ClientResponse<Array<SegmentResponse>>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)

		const studio = await this.findStudio(studioId)
		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rundown = await this.findRundown(studio._id, playlist._id, rundownId)
		this.checkRundownSource(rundown)
		const rawSegments = await this.findSegments(rundown._id)
		const segments = rawSegments.map((rawSegment) => this.adaptSegment(rawSegment))

		return ClientAPI.responseSuccess(segments)
	}

	async getSegment(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string
	): Promise<ClientAPI.ClientResponse<SegmentResponse>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)
		check(segmentId, String)

		const studio = await this.findStudio(studioId)
		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rundown = await this.findRundown(studio._id, playlist._id, rundownId)
		this.checkRundownSource(rundown)
		const rawSegment = await this.findSegment(rundown._id, segmentId)
		const segment = this.adaptSegment(rawSegment)

		return ClientAPI.responseSuccess(segment)
	}

	async postSegment(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		ingestSegment: IngestSegment
	): Promise<ClientAPI.ClientResponse<void>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)
		check(ingestSegment, Object)

		const studio = await this.findStudio(studioId)

		this.validateSegment(ingestSegment)
		await this.validateAPIPayloadsForSegment(studio.blueprintId, ingestSegment)

		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rundown = await this.findRundown(studio._id, playlist._id, rundownId)
		this.checkRundownSource(rundown)
		const existingSegment = await this.softFindSegment(rundown._id, ingestSegment.externalId)
		if (existingSegment) {
			throw new Meteor.Error(400, `Segment '${ingestSegment.externalId}' already exists`)
		}

		await runIngestOperation(studio._id, IngestJobs.UpdateSegment, {
			rundownExternalId: rundown.externalId,
			isCreateAction: true,
			ingestSegment,
		})

		return ClientAPI.responseSuccess(undefined)
	}

	async putSegments(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		ingestSegments: IngestSegment[]
	): Promise<ClientAPI.ClientResponse<void>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)
		check(ingestSegments, Array)

		const studio = await this.findStudio(studioId)

		await Promise.all(
			ingestSegments.map(async (ingestSegment, index) => {
				this.validateSegment(ingestSegment)
				return await this.validateAPIPayloadsForSegment(studio.blueprintId, ingestSegment, {
					segment: index,
				})
			})
		)

		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rundown = await this.findRundown(studio._id, playlist._id, rundownId)
		this.checkRundownSource(rundown)

		await Promise.all(
			ingestSegments.map(async (ingestSegment) => {
				const segment = await this.findSegment(rundown._id, ingestSegment.externalId)
				if (!segment) {
					return
				}

				const parts = await this.findParts(segment._id)
				return Promise.all(
					parts.map(async (part) =>
						runIngestOperation(studio._id, IngestJobs.RemovePart, {
							partExternalId: part.externalId,
							rundownExternalId: rundown.externalId,
							segmentExternalId: segment.externalId,
						})
					)
				)
			})
		)

		await Promise.all(
			ingestSegments.map(async (ingestSegment) => {
				const existingSegment = await this.softFindSegment(rundown._id, ingestSegment.externalId)
				if (!existingSegment) {
					return null
				}

				return runIngestOperation(studio._id, IngestJobs.UpdateSegment, {
					rundownExternalId: rundown.externalId,
					isCreateAction: true,
					ingestSegment,
				})
			})
		)

		return ClientAPI.responseSuccess(undefined)
	}

	async putSegment(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		ingestSegment: IngestSegment
	): Promise<ClientAPI.ClientResponse<void>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)
		check(segmentId, String)
		check(ingestSegment, Object)

		const studio = await this.findStudio(studioId)

		this.validateSegment(ingestSegment)
		await this.validateAPIPayloadsForSegment(studio.blueprintId, ingestSegment)

		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rundown = await this.findRundown(studio._id, playlist._id, rundownId)
		this.checkRundownSource(rundown)
		const segment = await this.softFindSegment(rundown._id, segmentId)
		if (!segment) {
			throw new Meteor.Error(400, `Segment '${segmentId}' does not exist`)
		}
		const parts = await this.findParts(segment._id)

		await Promise.all(
			parts.map(async (part) =>
				runIngestOperation(studio._id, IngestJobs.RemovePart, {
					partExternalId: part.externalId,
					rundownExternalId: rundown.externalId,
					segmentExternalId: segment.externalId,
				})
			)
		)

		await runIngestOperation(studio._id, IngestJobs.UpdateSegment, {
			rundownExternalId: rundown.externalId,
			isCreateAction: true,
			ingestSegment,
		})

		return ClientAPI.responseSuccess(undefined)
	}

	async deleteSegments(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string
	): Promise<ClientAPI.ClientResponse<void>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)

		const studio = await this.findStudio(studioId)
		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rundown = await this.findRundown(studio._id, playlist._id, rundownId)
		const segments = await this.findSegments(rundown._id)

		await Promise.all(
			segments.map(async (segment) =>
				// This also removes linked Parts
				runIngestOperation(studio._id, IngestJobs.RemoveSegment, {
					rundownExternalId: rundown.externalId,
					segmentExternalId: segment.externalId,
				})
			)
		)

		return ClientAPI.responseSuccess(undefined)
	}

	async deleteSegment(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string
	): Promise<ClientAPI.ClientResponse<void>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)
		check(segmentId, String)

		const studio = await this.findStudio(studioId)
		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rundown = await this.findRundown(studio._id, playlist._id, rundownId)
		this.checkRundownSource(rundown)
		const segment = await this.findSegment(rundown._id, segmentId)

		// This also removes linked Parts
		await runIngestOperation(studio._id, IngestJobs.RemoveSegment, {
			segmentExternalId: segment.externalId,
			rundownExternalId: rundown.externalId,
		})

		return ClientAPI.responseSuccess(undefined)
	}

	// Parts

	async getParts(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string
	): Promise<ClientAPI.ClientResponse<Array<PartResponse>>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)
		check(segmentId, String)

		const studio = await this.findStudio(studioId)
		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rundown = await this.findRundown(studio._id, playlist._id, rundownId)
		this.checkRundownSource(rundown)
		const segment = await this.findSegment(rundown._id, segmentId)
		const rawParts = await this.findParts(segment._id)
		const parts = rawParts.map((rawPart) => this.adaptPart(rawPart))

		return ClientAPI.responseSuccess(parts)
	}

	async getPart(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		partId: string
	): Promise<ClientAPI.ClientResponse<PartResponse>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)
		check(segmentId, String)
		check(partId, String)

		const studio = await this.findStudio(studioId)
		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rundown = await this.findRundown(studio._id, playlist._id, rundownId)
		this.checkRundownSource(rundown)
		const segment = await this.findSegment(rundown._id, segmentId)
		const rawPart = await this.findPart(segment._id, partId)
		const part = this.adaptPart(rawPart)

		return ClientAPI.responseSuccess(part)
	}

	async postPart(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		ingestPart: IngestPart
	): Promise<ClientAPI.ClientResponse<void>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)
		check(segmentId, String)
		check(ingestPart, Object)

		const studio = await this.findStudio(studioId)

		this.validatePart(ingestPart)
		await this.validateAPIPayloadsForPart(studio.blueprintId, ingestPart)

		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rundown = await this.findRundown(studio._id, playlist._id, rundownId)
		this.checkRundownSource(rundown)
		const segment = await this.findSegment(rundown._id, segmentId)
		const existingPart = await this.softFindPart(segment._id, ingestPart.externalId)
		if (existingPart) {
			throw new Meteor.Error(400, `Part '${ingestPart.externalId}' already exists`)
		}

		await runIngestOperation(studio._id, IngestJobs.UpdatePart, {
			rundownExternalId: rundown.externalId,
			segmentExternalId: segment.externalId,
			isCreateAction: true,
			ingestPart,
		})

		return ClientAPI.responseSuccess(undefined)
	}

	async putParts(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		ingestParts: IngestPart[]
	): Promise<ClientAPI.ClientResponse<void>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)
		check(segmentId, String)
		check(ingestParts, Array)

		const studio = await this.findStudio(studioId)

		await Promise.all(
			ingestParts.map(async (ingestPart, index) => {
				this.validatePart(ingestPart)
				return this.validateAPIPayloadsForPart(studio.blueprintId, ingestPart, { part: index })
			})
		)

		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rundown = await this.findRundown(studio._id, playlist._id, rundownId)
		this.checkRundownSource(rundown)
		const segment = await this.findSegment(rundown._id, segmentId)

		await Promise.all(
			ingestParts.map(async (ingestPart) => {
				const existingPart = await this.findPart(segment._id, ingestPart.externalId)
				if (!existingPart) {
					return
				}

				return runIngestOperation(studio._id, IngestJobs.UpdatePart, {
					segmentExternalId: segment.externalId,
					rundownExternalId: rundown.externalId,
					isCreateAction: true,
					ingestPart,
				})
			})
		)

		return ClientAPI.responseSuccess(undefined)
	}

	async putPart(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		partId: string,
		ingestPart: IngestPart
	): Promise<ClientAPI.ClientResponse<void>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)
		check(segmentId, String)
		check(partId, String)
		check(ingestPart, Object)

		const studio = await this.findStudio(studioId)

		this.validatePart(ingestPart)
		await this.validateAPIPayloadsForPart(studio.blueprintId, ingestPart)

		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rundown = await this.findRundown(studio._id, playlist._id, rundownId)
		this.checkRundownSource(rundown)
		const segment = await this.findSegment(rundown._id, segmentId)
		const existingPart = await this.findPart(segment._id, partId)
		if (!existingPart) {
			throw new Meteor.Error(400, `Part '${partId}' does not exists`)
		}

		await runIngestOperation(studio._id, IngestJobs.UpdatePart, {
			rundownExternalId: rundown.externalId,
			segmentExternalId: segment.externalId,
			isCreateAction: true,
			ingestPart,
		})

		return ClientAPI.responseSuccess(undefined)
	}

	async deleteParts(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string
	): Promise<ClientAPI.ClientResponse<void>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)
		check(segmentId, String)

		const studio = await this.findStudio(studioId)
		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rundown = await this.findRundown(studio._id, playlist._id, rundownId)
		this.checkRundownSource(rundown)
		const segment = await this.findSegment(rundown._id, segmentId)
		const parts = await this.findParts(segment._id)

		await Promise.all(
			parts.map(async (part) =>
				runIngestOperation(studio._id, IngestJobs.RemovePart, {
					rundownExternalId: rundown.externalId,
					segmentExternalId: segment.externalId,
					partExternalId: part.externalId,
				})
			)
		)

		return ClientAPI.responseSuccess(undefined)
	}

	async deletePart(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		partId: string
	): Promise<ClientAPI.ClientResponse<void>> {
		check(studioId, String)
		check(playlistId, String)
		check(rundownId, String)
		check(segmentId, String)
		check(partId, String)

		const studio = await this.findStudio(studioId)
		const playlist = await this.findPlaylist(studio._id, playlistId)
		const rundown = await this.findRundown(studio._id, playlist._id, rundownId)
		this.checkRundownSource(rundown)
		const segment = await this.findSegment(rundown._id, segmentId)
		const part = await this.findPart(segment._id, partId)

		await runIngestOperation(studio._id, IngestJobs.RemovePart, {
			rundownExternalId: rundown.externalId,
			segmentExternalId: segment.externalId,
			partExternalId: part.externalId,
		})

		return ClientAPI.responseSuccess(undefined)
	}
}

class IngestAPIFactory implements APIFactory<IngestRestAPI> {
	createServerAPI(_context: ServerAPIContext): IngestRestAPI {
		return new IngestServerAPI()
	}
}

export function registerRoutes(registerRoute: APIRegisterHook<IngestRestAPI>): void {
	const ingestAPIFactory = new IngestAPIFactory()

	// Playlists

	// Get all playlists
	registerRoute<{ studioId: string }, never, Array<PlaylistResponse>>(
		'get',
		'/ingest/:studioId/playlists',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			logger.info(`INGEST API GET: Playlists`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)

			return await serverAPI.getPlaylists(connection, event, studioId)
		}
	)

	// Get playlist
	registerRoute<{ studioId: string; playlistId: string }, never, PlaylistResponse>(
		'get',
		'/ingest/:studioId/playlists/:playlistId',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			logger.info(`INGEST API GET: Playlist`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)

			return await serverAPI.getPlaylist(connection, event, studioId, playlistId)
		}
	)

	// Delete all playlists
	registerRoute<{ studioId: string }, never, void>(
		'delete',
		'/ingest/:studioId/playlists',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			logger.info(`INGEST API DELETE: Playlists`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)

			return await serverAPI.deletePlaylists(connection, event, studioId)
		}
	)

	// Delete playlist
	registerRoute<{ studioId: string; playlistId: string }, never, void>(
		'delete',
		'/ingest/:studioId/playlists/:playlistId',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			logger.info(`INGEST API DELETE: Playlist`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)

			return await serverAPI.deletePlaylist(connection, event, studioId, playlistId)
		}
	)

	// Rundowns

	// Get all rundowns
	registerRoute<{ studioId: string; playlistId: string }, never, RundownResponse[]>(
		'get',
		'/ingest/:studioId/playlists/:playlistId/rundowns',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			logger.info(`INGEST API GET: Rundowns`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)

			return await serverAPI.getRundowns(connection, event, studioId, playlistId)
		}
	)

	// Get rundown
	registerRoute<{ studioId: string; playlistId: string; rundownId: string }, never, RundownResponse>(
		'get',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			logger.info(`INGEST API GET: Rundown`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)

			return await serverAPI.getRundown(connection, event, studioId, playlistId, rundownId)
		}
	)

	// Create rundown
	registerRoute<{ studioId: string; playlistId: string; rundownId: string }, never, void>(
		'post',
		'/ingest/:studioId/playlists/:playlistId/rundowns',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			logger.info(`INGEST API POST: Rundowns`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)

			const ingestRundown = body as RestApiIngestRundown
			if (!ingestRundown) throw new Meteor.Error(400, 'Upload rundown: Missing request body')
			if (typeof ingestRundown !== 'object') throw new Meteor.Error(400, 'Upload rundown: Invalid request body')

			return await serverAPI.postRundown(connection, event, studioId, playlistId, ingestRundown)
		}
	)

	// Update rundowns
	registerRoute<{ studioId: string; playlistId: string }, never, void>(
		'put',
		'/ingest/:studioId/playlists/:playlistId/rundowns',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			logger.info(`INGEST API PUT: Rundowns`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)

			const ingestRundowns = body as RestApiIngestRundown[]
			if (!ingestRundowns) throw new Meteor.Error(400, 'Upload rundown: Missing request body')
			if (typeof ingestRundowns !== 'object') throw new Meteor.Error(400, 'Upload rundown: Invalid request body')

			return await serverAPI.putRundowns(connection, event, studioId, playlistId, ingestRundowns)
		}
	)

	// Update rundown
	registerRoute<{ studioId: string; playlistId: string; rundownId: string }, never, void>(
		'put',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			logger.info(`INGEST API PUT: Rundown`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)

			const ingestRundown = body as RestApiIngestRundown
			if (!ingestRundown) throw new Meteor.Error(400, 'Upload rundown: Missing request body')
			if (typeof ingestRundown !== 'object') throw new Meteor.Error(400, 'Upload rundown: Invalid request body')

			return await serverAPI.putRundown(connection, event, studioId, playlistId, rundownId, ingestRundown)
		}
	)

	// Delete rundowns
	registerRoute<{ studioId: string; playlistId: string }, never, void>(
		'delete',
		'/ingest/:studioId/playlists/:playlistId/rundowns',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			logger.info(`INGEST API DELETE: Rundowns`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)

			return await serverAPI.deleteRundowns(connection, event, studioId, playlistId)
		}
	)

	// Delete rundown
	registerRoute<{ studioId: string; playlistId: string; rundownId: string }, never, void>(
		'delete',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			logger.info(`INGEST API DELETE: Rundown`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)

			return await serverAPI.deleteRundown(connection, event, studioId, playlistId, rundownId)
		}
	)

	// Segments

	// Get all segments
	registerRoute<{ studioId: string; playlistId: string; rundownId: string }, never, SegmentResponse[]>(
		'get',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId/segments',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			logger.info(`INGEST API GET: Segments`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)

			return await serverAPI.getSegments(connection, event, studioId, playlistId, rundownId)
		}
	)

	// Get segment
	registerRoute<
		{ studioId: string; playlistId: string; rundownId: string; segmentId: string },
		never,
		SegmentResponse
	>(
		'get',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			logger.info(`INGEST API GET: Segment`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)
			const segmentId = params.segmentId
			check(segmentId, String)

			return await serverAPI.getSegment(connection, event, studioId, playlistId, rundownId, segmentId)
		}
	)

	// Create segment
	registerRoute<{ studioId: string; playlistId: string; rundownId: string }, never, void>(
		'post',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId/segments',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			logger.info(`INGEST API POST: Segments`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)

			const ingestSegment = body as IngestSegment
			if (!ingestSegment) throw new Meteor.Error(400, 'Upload rundown: Missing request body')

			return await serverAPI.postSegment(connection, event, studioId, playlistId, rundownId, ingestSegment)
		}
	)

	// Update segments
	registerRoute<{ studioId: string; playlistId: string; rundownId: string }, never, void>(
		'put',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId/segments',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			logger.info(`INGEST API PUT: Segments`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)

			const ingestSegments = body as IngestSegment[]
			if (!ingestSegments) throw new Meteor.Error(400, 'Upload rundown: Missing request body')
			if (!Array.isArray(ingestSegments)) throw new Meteor.Error(400, 'Upload rundown: Invalid request body')

			return await serverAPI.putSegments(connection, event, studioId, playlistId, rundownId, ingestSegments)
		}
	)

	// Update segment
	registerRoute<{ studioId: string; playlistId: string; rundownId: string; segmentId: string }, never, void>(
		'put',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			logger.info(`INGEST API PUT: Segment`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)
			const segmentId = params.segmentId
			check(segmentId, String)

			const ingestSegment = body as IngestSegment
			if (!ingestSegment) throw new Meteor.Error(400, 'Upload rundown: Missing request body')

			return await serverAPI.putSegment(
				connection,
				event,
				studioId,
				playlistId,
				rundownId,
				segmentId,
				ingestSegment
			)
		}
	)

	// Delete segments
	registerRoute<{ studioId: string; playlistId: string; rundownId: string }, never, void>(
		'delete',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId/segments',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			logger.info(`INGEST API DELETE: Segments`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)

			return await serverAPI.deleteSegments(connection, event, studioId, playlistId, rundownId)
		}
	)

	// Delete segment
	registerRoute<{ studioId: string; playlistId: string; rundownId: string; segmentId: string }, never, void>(
		'delete',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			logger.info(`INGEST API DELETE: Segment`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)
			const segmentId = params.segmentId
			check(segmentId, String)

			return await serverAPI.deleteSegment(connection, event, studioId, playlistId, rundownId, segmentId)
		}
	)

	// Parts

	// Get all parts
	registerRoute<
		{ studioId: string; playlistId: string; rundownId: string; segmentId: string },
		never,
		PartResponse[]
	>(
		'get',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			logger.info(`INGEST API GET: Parts`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)
			const segmentId = params.segmentId
			check(segmentId, String)

			return await serverAPI.getParts(connection, event, studioId, playlistId, rundownId, segmentId)
		}
	)

	// Get part
	registerRoute<
		{ studioId: string; playlistId: string; rundownId: string; segmentId: string; partId: string },
		never,
		PartResponse
	>(
		'get',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts/:partId',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			logger.info(`INGEST API GET: Part`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)
			const segmentId = params.segmentId
			check(segmentId, String)
			const partId = params.partId
			check(partId, String)

			return await serverAPI.getPart(connection, event, studioId, playlistId, rundownId, segmentId, partId)
		}
	)

	// Create part
	registerRoute<{ studioId: string; playlistId: string; rundownId: string; segmentId: string }, never, void>(
		'post',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			logger.info(`INGEST API POST: Parts`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)
			const segmentId = params.segmentId
			check(segmentId, String)

			const ingestPart = body as IngestPart
			if (!ingestPart) throw new Meteor.Error(400, 'Upload rundown: Missing request body')

			return await serverAPI.postPart(connection, event, studioId, playlistId, rundownId, segmentId, ingestPart)
		}
	)

	// Update parts
	registerRoute<{ studioId: string; playlistId: string; rundownId: string; segmentId: string }, never, void>(
		'put',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			logger.info(`INGEST API PUT: Parts`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)
			const segmentId = params.segmentId
			check(segmentId, String)

			const ingestParts = body as IngestPart[]
			if (!ingestParts) throw new Meteor.Error(400, 'Upload rundown: Missing request body')
			if (!Array.isArray(ingestParts)) throw new Meteor.Error(400, 'Upload rundown: Invalid request body')

			return await serverAPI.putParts(connection, event, studioId, playlistId, rundownId, segmentId, ingestParts)
		}
	)

	// Update part
	registerRoute<
		{ studioId: string; playlistId: string; rundownId: string; segmentId: string; partId: string },
		never,
		void
	>(
		'put',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts/:partId',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			logger.info(`INGEST API PUT: Part`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)
			const segmentId = params.segmentId
			check(segmentId, String)
			const partId = params.partId
			check(partId, String)

			const ingestPart = body as IngestPart
			if (!ingestPart) throw new Meteor.Error(400, 'Upload rundown: Missing request body')

			return await serverAPI.putPart(
				connection,
				event,
				studioId,
				playlistId,
				rundownId,
				segmentId,
				partId,
				ingestPart
			)
		}
	)

	// Delete parts
	registerRoute<{ studioId: string; playlistId: string; rundownId: string; segmentId: string }, never, void>(
		'delete',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			logger.info(`INGEST API DELETE: Parts`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)
			const segmentId = params.segmentId
			check(segmentId, String)

			return await serverAPI.deleteParts(connection, event, studioId, playlistId, rundownId, segmentId)
		}
	)

	// Delete part
	registerRoute<
		{ studioId: string; playlistId: string; rundownId: string; segmentId: string; partId: string },
		never,
		void
	>(
		'delete',
		'/ingest/:studioId/playlists/:playlistId/rundowns/:rundownId/segments/:segmentId/parts/:partId',
		new Map(),
		ingestAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			logger.info(`INGEST API DELETE: Part`)

			const studioId = protectString<StudioId>(params.studioId)
			check(studioId, String)
			const playlistId = params.playlistId
			check(playlistId, String)
			const rundownId = params.rundownId
			check(rundownId, String)
			const segmentId = params.segmentId
			check(segmentId, String)
			const partId = params.partId
			check(partId, String)

			return await serverAPI.deletePart(connection, event, studioId, playlistId, rundownId, segmentId, partId)
		}
	)
}
