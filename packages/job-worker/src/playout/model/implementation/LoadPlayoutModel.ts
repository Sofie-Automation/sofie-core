import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DatabasePersistedModel } from '../../../modelBase.js'
import { IngestModelReadonly } from '../../../ingest/model/IngestModel.js'
import { PlaylistLock } from '../../../jobs/lock.js'
import { ReadonlyDeep } from 'type-fest'
import { JobContext } from '../../../jobs/index.js'
import { PlayoutModelImpl } from './PlayoutModelImpl.js'
import { PlayoutRundownModelImpl } from './PlayoutRundownModelImpl.js'
import { PartInstanceId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import _ from 'underscore'
import { clone, Complete, groupByToMap, groupByToMapFunc, literal } from '@sofie-automation/corelib/dist/lib'
import { PlayoutSegmentModelImpl } from './PlayoutSegmentModelImpl.js'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { PlayoutModel, PlayoutModelPreInit } from '../PlayoutModel.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { sortRundownsWithinPlaylist } from '@sofie-automation/corelib/dist/playout/playlist'
import { logger } from '../../../logging.js'

/**
 * Load a PlayoutModelPreInit for the given RundownPlaylist
 * @param context Context from the job queue
 * @param playlistLock Lock for the RundownPlaylist to load
 * @param tmpPlaylist Temporary copy of the RundownPlaylist to load
 * @param reloadPlaylist Whether to reload the RundownPlaylist, or use the temporary copy
 * @returns Loaded PlayoutModelPreInit
 */
export async function loadPlayoutModelPreInit(
	context: JobContext,
	playlistLock: PlaylistLock,
	tmpPlaylist: ReadonlyDeep<DBRundownPlaylist>,
	reloadPlaylist = true
): Promise<PlayoutModelPreInit> {
	const span = context.startSpan('PlayoutModelPreInit.createPreInit')
	if (span) span.setLabel('playlistId', unprotectString(tmpPlaylist._id))

	if (!playlistLock.isLocked) {
		throw new Error('Cannot create model with released playlist lock')
	}

	const [PeripheralDevices, Playlist, Rundowns] = await Promise.all([
		context.directCollections.PeripheralDevices.findFetch({ 'studioAndConfigId.studioId': tmpPlaylist.studioId }),
		reloadPlaylist ? context.directCollections.RundownPlaylists.findOne(tmpPlaylist._id) : clone(tmpPlaylist),
		context.directCollections.Rundowns.findFetch({ playlistId: tmpPlaylist._id }),
	])

	if (!Playlist) throw new Error(`Playlist "${tmpPlaylist._id}" not found!`)

	const res: PlayoutModelPreInit = {
		playlistId: playlistLock.playlistId,
		playlistLock: playlistLock,

		peripheralDevices: PeripheralDevices,

		playlist: Playlist,
		rundowns: sortRundownsWithinPlaylist(Playlist.rundownIdsInOrder, Rundowns),

		getRundown: (id: RundownId) => Rundowns.find((rd) => rd._id === id),
	}
	if (span) span.end()
	return res
}

/**
 * Load a PlayoutModel partially from the database, partially from an IngestModel.
 * Anything belonging to the Rundown of the IngestModel will be taken from there, as it is assumed to be the most up to date copy of the data
 * @param context Context from the job queue
 * @param playlistLock Lock for the RundownPlaylist to load
 * @param loadedPlaylist Preloaded copy of the RundownPlaylist
 * @param newRundowns Preloaded copy of the Rundowns belonging to the RundownPlaylist
 * @param ingestModel IngestModel to take data from
 * @returns Loaded PlayoutModel
 */
export async function createPlayoutModelFromIngestModel(
	context: JobContext,
	playlistLock: PlaylistLock,
	loadedPlaylist: ReadonlyDeep<DBRundownPlaylist>,
	newRundowns: ReadonlyDeep<Array<DBRundown>>,
	ingestModel: IngestModelReadonly
): Promise<PlayoutModel & DatabasePersistedModel> {
	const [peripheralDevices, playlist, rundowns] = await loadInitData(context, loadedPlaylist, false, newRundowns)
	const rundownIds = rundowns.map((r) => r._id)

	const [{ partInstances, groupedPieceInstances }, rundownsWithContent, timeline] = await Promise.all([
		loadPartInstances(context, loadedPlaylist, rundownIds),
		loadRundowns(context, ingestModel, sortRundownsWithinPlaylist(playlist.rundownIdsInOrder, rundowns)),
		loadTimeline(context),
	])

	const res = new PlayoutModelImpl(
		context,
		playlistLock,
		loadedPlaylist._id,
		peripheralDevices,
		playlist,
		partInstances,
		groupedPieceInstances,
		rundownsWithContent,
		timeline
	)

	return res
}

async function loadTimeline(context: JobContext): Promise<TimelineComplete | undefined> {
	// Future: This could be defered until we get to updateTimeline. It could be a small performance boost
	return context.directCollections.Timelines.findOne(context.studioId)
}

async function loadInitData(
	context: JobContext,
	tmpPlaylist: ReadonlyDeep<DBRundownPlaylist>,
	reloadPlaylist: boolean,
	existingRundowns: ReadonlyDeep<DBRundown[]> | undefined
): Promise<[ReadonlyDeep<PeripheralDevice[]>, DBRundownPlaylist, ReadonlyDeep<DBRundown[]>]> {
	const [peripheralDevices, reloadedPlaylist, rundowns] = await Promise.all([
		context.directCollections.PeripheralDevices.findFetch({ 'studioAndConfigId.studioId': tmpPlaylist.studioId }),
		reloadPlaylist
			? await context.directCollections.RundownPlaylists.findOne(tmpPlaylist._id)
			: clone<DBRundownPlaylist>(tmpPlaylist),
		existingRundowns ?? context.directCollections.Rundowns.findFetch({ playlistId: tmpPlaylist._id }),
	])

	if (!reloadedPlaylist) throw new Error(`RundownPlaylist went missing!`)

	return [peripheralDevices, reloadedPlaylist, rundowns]
}

/**
 * Load a PlayoutModel from a PlayoutModelPreInit
 * @param context Context from the job queue
 * @param initModel Preloaded PlayoutModelPreInit describing the RundownPlaylist to load
 * @returns Loaded PlayoutModel
 */
export async function createPlayoutModelfromInitModel(
	context: JobContext,
	initModel: PlayoutModelPreInit
): Promise<PlayoutModel & DatabasePersistedModel> {
	const span = context.startSpan('PlayoutModel.fromInit')
	if (span) span.setLabel('playlistId', unprotectString(initModel.playlistId))

	if (!initModel.playlistLock.isLocked) {
		throw new Error('Cannot create model with released playlist lock')
	}

	const rundownIds = initModel.rundowns.map((r) => r._id)

	const [{ partInstances, groupedPieceInstances }, rundownsWithContent, timeline] = await Promise.all([
		loadPartInstances(context, initModel.playlist, rundownIds),
		loadRundowns(context, null, initModel.rundowns),
		loadTimeline(context),
	])

	const res = new PlayoutModelImpl(
		context,
		initModel.playlistLock,
		initModel.playlistId,
		initModel.peripheralDevices,
		clone<DBRundownPlaylist>(initModel.playlist),
		partInstances,
		groupedPieceInstances,
		rundownsWithContent,
		timeline
	)

	if (span) span.end()
	return res
}

async function loadRundowns(
	context: JobContext,
	ingestModel: IngestModelReadonly | null,
	rundowns: ReadonlyDeep<DBRundown[]>
): Promise<PlayoutRundownModelImpl[]> {
	const rundownIds = rundowns.map((rd) => rd._id)

	// If there is an ingestModel, then avoid loading some bits from the db for that rundown
	const loadRundownIds = ingestModel ? rundownIds.filter((id) => id !== ingestModel.rundownId) : rundownIds
	const baselineTimelineFromIngest = ingestModel?.rundownBaselineTimelineObjects.getIfLoaded()
	const loadBaselineIds = baselineTimelineFromIngest ? loadRundownIds : rundownIds

	const [segments, parts, baselineObjects] = await Promise.all([
		context.directCollections.Segments.findFetch({
			$or: [
				{
					// Either in rundown when ingestModel === null or not available in ingestModel
					rundownId: { $in: loadRundownIds },
				},
				{
					// Is the AdlibTesting segment
					rundownId: { $in: rundownIds },
					orphaned: SegmentOrphanedReason.ADLIB_TESTING,
				},
			],
		}),
		context.directCollections.Parts.findFetch({ rundownId: { $in: loadRundownIds } }),
		context.directCollections.RundownBaselineObjects.findFetch({ rundownId: { $in: loadBaselineIds } }),
	])

	const groupedParts = groupByToMap(parts, 'segmentId')
	const segmentsWithParts = segments.map(
		(segment) => new PlayoutSegmentModelImpl(segment, groupedParts.get(segment._id) ?? [])
	)
	const groupedSegmentsWithParts = groupByToMapFunc(segmentsWithParts, (s) => s.segment.rundownId)

	const groupedBaselineObjects = groupByToMap(baselineObjects, 'rundownId')

	if (ingestModel) {
		const playoutSegments: PlayoutSegmentModelImpl[] = []
		groupedSegmentsWithParts.set(ingestModel.rundownId, playoutSegments)
		// Populate the collections with the in-memory data instead
		for (const segment of ingestModel.getAllSegments()) {
			playoutSegments.push(
				new PlayoutSegmentModelImpl(
					clone<DBSegment>(segment.segment),
					segment.parts.map((part) => clone<DBPart>(part.part))
				)
			)
		}
		if (baselineTimelineFromIngest) {
			groupedBaselineObjects.set(ingestModel.rundownId, [
				literal<Complete<RundownBaselineObj>>({
					_id: protectString(''),
					rundownId: ingestModel.rundownId,
					timelineObjectsString: baselineTimelineFromIngest,
				}),
			])
		}
	}

	return rundowns.map((rundown) => {
		const groupedSegmentsWithPartsForRundown = groupedSegmentsWithParts.get(rundown._id)
		if (!groupedSegmentsWithPartsForRundown) {
			logger.debug(
				`groupedSegmentsWithPartsForRundown for Rundown "${rundown._id}" is undefined (has the rundown no segments?)`
			)
		}
		const groupedBaselineObjectsForRundown = groupedBaselineObjects.get(rundown._id)
		if (!groupedBaselineObjectsForRundown)
			logger.debug(
				`groupedBaselineObjectsForRundown for Rundown "${rundown._id}" is undefined (has the rundown no baseline objects?)`
			)

		return new PlayoutRundownModelImpl(
			rundown,
			groupedSegmentsWithPartsForRundown ?? [],
			groupedBaselineObjectsForRundown ?? []
		)
	})
}

async function loadPartInstances(
	context: JobContext,
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	rundownIds: RundownId[]
): Promise<{ partInstances: DBPartInstance[]; groupedPieceInstances: Map<PartInstanceId, PieceInstance[]> }> {
	const selectedPartInstanceIds = _.compact([
		playlist.currentPartInfo?.partInstanceId,
		playlist.nextPartInfo?.partInstanceId,
		playlist.previousPartInfo?.partInstanceId,
	])

	const partInstancesCollection = Promise.resolve().then(async () => {
		// Future: We could optimise away this query if we tracked the segmentIds of these PartInstances on the playlist
		const segmentIds = _.uniq(
			(
				await context.directCollections.PartInstances.findFetch(
					{
						_id: { $in: selectedPartInstanceIds },
					},
					{
						projection: {
							segmentId: 1,
						},
					}
				)
			).map((p) => p.segmentId)
		)

		const partInstancesSelector: MongoQuery<DBPartInstance> = {
			rundownId: { $in: rundownIds },
			$or: [
				{
					segmentId: { $in: segmentIds },
					reset: { $ne: true },
				},
				{
					_id: { $in: selectedPartInstanceIds },
				},
			],
		}
		// Filter the PieceInstances to the activationId, if possible
		pieceInstancesSelector.playlistActivationId = playlist.activationId || { $exists: false }

		return context.directCollections.PartInstances.findFetch(partInstancesSelector)
	})

	const pieceInstancesSelector: MongoQuery<PieceInstance> = {
		rundownId: { $in: rundownIds },
		partInstanceId: { $in: selectedPartInstanceIds },
	}
	// Filter the PieceInstances to the activationId, if possible
	pieceInstancesSelector.playlistActivationId = playlist.activationId || { $exists: false }

	const [partInstances, pieceInstances] = await Promise.all([
		partInstancesCollection,
		context.directCollections.PieceInstances.findFetch(pieceInstancesSelector),
	])

	const groupedPieceInstances = groupByToMap(pieceInstances, 'partInstanceId')

	return { partInstances, groupedPieceInstances }
}
