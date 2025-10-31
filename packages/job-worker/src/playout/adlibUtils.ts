import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { BucketAdLibId, PartInstanceId, PieceId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { assertNever, getRandomId, getRank } from '@sofie-automation/corelib/dist/lib'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { getCurrentTime } from '../lib/index.js'
import { JobContext } from '../jobs/index.js'
import { PlayoutModel } from './model/PlayoutModel.js'
import { PlayoutPartInstanceModel } from './model/PlayoutPartInstanceModel.js'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from './infinites.js'
import { convertAdLibToGenericPiece } from './pieces.js'
import { getResolvedPiecesForCurrentPartInstance } from './resolvedPieces.js'
import { updateTimeline } from './timeline/generate.js'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { updatePartInstanceRanksAfterAdlib } from '../updatePartInstanceRanksAndOrphanedState.js'
import { setNextPart } from './setNext.js'
import { calculateNowOffsetLatency } from './timeline/multi-gateway.js'
import { logger } from '../logging.js'
import { ReadonlyDeep } from 'type-fest'
import { PlayoutRundownModel } from './model/PlayoutRundownModel.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { QuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

export async function innerStartOrQueueAdLibPiece(
	context: JobContext,
	playoutModel: PlayoutModel,
	rundown: PlayoutRundownModel,
	queue: boolean,
	currentPartInstance: PlayoutPartInstanceModel,
	adLibPiece: AdLibPiece | BucketAdLib
): Promise<PartInstanceId | undefined> {
	const span = context.startSpan('innerStartOrQueueAdLibPiece')
	let queuedPartInstanceId: PartInstanceId | undefined
	if (queue || adLibPiece.toBeQueued) {
		const adlibbedPart: Omit<DBPart, 'segmentId' | 'rundownId' | '_rank'> = {
			_id: getRandomId(),
			externalId: '',
			title: adLibPiece.name,
			expectedDuration: adLibPiece.expectedDuration,
			expectedDurationWithTransition: adLibPiece.expectedDuration, // Filled in later
		}

		const genericAdlibPiece = convertAdLibToGenericPiece(adLibPiece, true)
		const newPartInstance = await insertQueuedPartWithPieces(
			context,
			playoutModel,
			rundown,
			currentPartInstance,
			adlibbedPart,
			[genericAdlibPiece],
			adLibPiece._id
		)
		queuedPartInstanceId = newPartInstance.partInstance._id

		// syncPlayheadInfinitesForNextPartInstance is handled by setNextPart
	} else {
		const genericAdlibPiece = convertAdLibToGenericPiece(adLibPiece, false)
		currentPartInstance.insertAdlibbedPiece(genericAdlibPiece, adLibPiece._id)

		await syncPlayheadInfinitesForNextPartInstance(
			context,
			playoutModel,
			undefined,
			currentPartInstance,
			playoutModel.nextPartInstance
		)
	}

	await updateTimeline(context, playoutModel)

	if (span) span.end()
	return queuedPartInstanceId
}

export async function innerFindLastPieceOnLayer(
	context: JobContext,
	playoutModel: PlayoutModel,
	sourceLayerId: string[],
	originalOnly: boolean,
	customQuery?: MongoQuery<PieceInstance>
): Promise<PieceInstance | undefined> {
	const span = context.startSpan('innerFindLastPieceOnLayer')
	const rundownIds = playoutModel.getRundownIds()

	const query: MongoQuery<PieceInstance> = {
		...customQuery,
		playlistActivationId: playoutModel.playlist.activationId,
		rundownId: { $in: rundownIds },
		'piece.sourceLayerId': { $in: sourceLayerId },
		plannedStartedPlayback: {
			$exists: true,
		},
	}

	if (originalOnly) {
		// Ignore adlibs if using original only
		query.dynamicallyInserted = {
			$exists: false,
		}
	}

	if (span) span.end()

	// Note: This does not want to use the in-memory model, as we want to search as far back as we can
	// TODO - will this cause problems?
	return context.directCollections.PieceInstances.findOne(query, {
		sort: {
			plannedStartedPlayback: -1,
		},
	})
}

export async function innerFindLastScriptedPieceOnLayer(
	context: JobContext,
	playoutModel: PlayoutModel,
	sourceLayerId: string[],
	customQuery?: MongoQuery<Piece>
): Promise<Piece | undefined> {
	const span = context.startSpan('innerFindLastScriptedPieceOnLayer')

	const playlist = playoutModel.playlist
	const rundownIds = playoutModel.getRundownIds()

	// TODO - this should throw instead of return more?

	if (!playlist.currentPartInfo || !playlist.activationId) {
		return
	}

	const currentPartInstance = playoutModel.currentPartInstance?.partInstance

	if (!currentPartInstance) {
		return
	}

	const query = {
		...customQuery,
		startRundownId: { $in: rundownIds },
		sourceLayerId: { $in: sourceLayerId },
	}

	const pieces: Array<Pick<Piece, '_id' | 'startPartId' | 'enable'>> =
		await context.directCollections.Pieces.findFetch(query, {
			projection: { _id: 1, startPartId: 1, enable: 1 },
		})

	const pieceIdSet = new Set(pieces.map((p) => p.startPartId))
	const part = playoutModel
		.getAllOrderedParts()
		.filter((p) => pieceIdSet.has(p._id) && p._rank <= currentPartInstance.part._rank)
		.reverse()[0]

	if (!part) {
		return
	}

	const partStarted = currentPartInstance.timings?.plannedStartedPlayback
	const nowInPart = partStarted ? getCurrentTime() - partStarted : 0

	const piecesSortedAsc = pieces
		.filter((p) => p.startPartId === part._id && (p.enable.start === 'now' || p.enable.start <= nowInPart))
		.sort((a, b) => {
			if (a.enable.start === 'now' && b.enable.start === 'now') return 0
			if (a.enable.start === 'now') return -1
			if (b.enable.start === 'now') return 1

			return b.enable.start - a.enable.start
		})

	const piece = piecesSortedAsc.shift()
	if (!piece) {
		return
	}

	const fullPiece = await context.directCollections.Pieces.findOne(piece._id)
	if (!fullPiece) return

	if (span) span.end()
	return fullPiece
}

export async function insertQueuedPartWithPieces(
	context: JobContext,
	playoutModel: PlayoutModel,
	rundown: PlayoutRundownModel,
	currentPartInstance: PlayoutPartInstanceModel,
	newPart: Omit<DBPart, 'segmentId' | 'rundownId' | '_rank'>,
	initialPieces: Omit<PieceInstancePiece, 'startPartId'>[],
	fromAdlibId: PieceId | BucketAdLibId | undefined
): Promise<PlayoutPartInstanceModel> {
	const span = context.startSpan('insertQueuedPartWithPieces')

	// Parts are always integers spaced by one, and orphaned PartInstances will be decimals spaced between two Part
	// so we can predict a 'safe' rank to get the desired position with some simple maths
	const newRank = getRank(
		currentPartInstance.partInstance.part._rank,
		Math.floor(currentPartInstance.partInstance.part._rank + 1)
	)

	const newPartFull: DBPart = {
		...newPart,
		segmentId: currentPartInstance.partInstance.segmentId,
		rundownId: currentPartInstance.partInstance.rundownId,
		_rank: newRank,
	}

	// Find any rundown defined infinites that we should inherit
	const possiblePieces = await fetchPiecesThatMayBeActiveForPart(context, playoutModel, undefined, newPartFull)
	const infinitePieceInstances = getPieceInstancesForPart(
		context,
		playoutModel,
		currentPartInstance,
		rundown,
		newPartFull,
		possiblePieces,
		protectString('') // Replaced inside playoutModel.insertAdlibbedPartInstance
	)

	const newPartInstance = playoutModel.createAdlibbedPartInstance(
		newPartFull,
		initialPieces,
		fromAdlibId,
		infinitePieceInstances
	)

	updatePartInstanceRanksAfterAdlib(playoutModel, currentPartInstance, newPartInstance)

	await setNextPart(context, playoutModel, newPartInstance, false)

	temporarilyExtendQuickLoop(playoutModel, currentPartInstance, newPartInstance)

	if (span) span.end()

	return newPartInstance
}

function temporarilyExtendQuickLoop(
	playoutModel: PlayoutModel,
	currentPartInstance: PlayoutPartInstanceModel,
	newPartInstance: PlayoutPartInstanceModel
) {
	const existingQuickLoopEnd = playoutModel.playlist.quickLoop?.end
	if (!existingQuickLoopEnd) return

	if (
		existingQuickLoopEnd.type === QuickLoopMarkerType.PART &&
		(currentPartInstance.partInstance.part._id === existingQuickLoopEnd.id ||
			currentPartInstance.partInstance.part._id === existingQuickLoopEnd.overridenId)
	) {
		playoutModel.setQuickLoopMarker('end', {
			type: QuickLoopMarkerType.PART,
			id: newPartInstance.partInstance.part._id,
			overridenId: existingQuickLoopEnd.overridenId ?? existingQuickLoopEnd.id,
		})
	}
}

export function innerStopPieces(
	context: JobContext,
	playoutModel: PlayoutModel,
	sourceLayers: SourceLayers,
	currentPartInstance: PlayoutPartInstanceModel,
	filter: (pieceInstance: ReadonlyDeep<PieceInstance>) => boolean,
	timeOffset: number | undefined
): Array<PieceInstanceId> {
	const span = context.startSpan('innerStopPieces')
	const stoppedInstances: PieceInstanceId[] = []

	const lastStartedPlayback = currentPartInstance.partInstance.timings?.plannedStartedPlayback
	if (lastStartedPlayback === undefined) {
		throw new Error('Cannot stop pieceInstances when partInstance hasnt started playback')
	}

	const resolvedPieces = getResolvedPiecesForCurrentPartInstance(context, sourceLayers, currentPartInstance)
	const offsetRelativeToNow = (timeOffset || 0) + (calculateNowOffsetLatency(context, playoutModel) || 0)
	const stopAt = getCurrentTime() + offsetRelativeToNow
	const relativeStopAt = stopAt - lastStartedPlayback

	for (const resolvedPieceInstance of resolvedPieces) {
		const pieceInstance = resolvedPieceInstance.instance

		// Virtual pieces aren't allowed a timed end
		if (pieceInstance.piece.virtual) continue

		// Check if piece has already had an end defined
		if (pieceInstance.userDuration) continue

		// Caller can filter out pieces
		if (!filter(pieceInstance)) continue

		// Check if piece has started yet
		if (resolvedPieceInstance.resolvedStart == undefined || resolvedPieceInstance.resolvedStart > relativeStopAt)
			continue

		// If there end time of the piece is already known, make sure it is in the future
		if (pieceInstance.plannedStoppedPlayback && pieceInstance.plannedStoppedPlayback <= stopAt) continue

		switch (pieceInstance.piece.lifespan) {
			case PieceLifespan.WithinPart:
			case PieceLifespan.OutOnSegmentChange:
			case PieceLifespan.OutOnRundownChange: {
				logger.info(`Blueprint action: Cropping PieceInstance "${pieceInstance._id}" to ${stopAt}`)

				const pieceInstanceModel = playoutModel.findPieceInstance(pieceInstance._id)
				if (pieceInstanceModel) {
					const newDuration: Required<PieceInstance>['userDuration'] =
						playoutModel.isMultiGatewayMode ||
						pieceInstanceModel.pieceInstance.pieceInstance.piece.enable.isAbsolute
							? {
									endRelativeToNow: offsetRelativeToNow,
								}
							: {
									endRelativeToPart: relativeStopAt,
								}

					pieceInstanceModel.pieceInstance.setDuration(newDuration)

					stoppedInstances.push(pieceInstance._id)
				} else {
					logger.warn(
						`Blueprint action: Failed to crop PieceInstance "${pieceInstance._id}", it was not found`
					)
				}

				break
			}
			case PieceLifespan.OutOnSegmentEnd:
			case PieceLifespan.OutOnRundownEnd:
			case PieceLifespan.OutOnShowStyleEnd: {
				logger.info(
					`Blueprint action: Cropping PieceInstance "${pieceInstance._id}" to ${stopAt} with a virtual`
				)

				currentPartInstance.insertVirtualPiece(
					relativeStopAt,
					pieceInstance.piece.lifespan,
					pieceInstance.piece.sourceLayerId,
					pieceInstance.piece.outputLayerId
				)

				stoppedInstances.push(pieceInstance._id)
				break
			}
			default:
				assertNever(pieceInstance.piece.lifespan)
		}
	}

	if (span) span.end()
	return stoppedInstances
}
