import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { assertNever, clone } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../logging.js'
import { JobContext, ProcessedShowStyleCompound } from '../jobs/index.js'
import {
	AdlibPieceStartProps,
	DisableNextPieceProps,
	StartStickyPieceOnSourceLayerProps,
	StopPiecesOnSourceLayersProps,
	TakePieceAsAdlibNowProps,
} from '@sofie-automation/corelib/dist/worker/studio'
import { PlayoutModel } from './model/PlayoutModel.js'
import { PlayoutPartInstanceModel } from './model/PlayoutPartInstanceModel.js'
import { runJobWithPlayoutModel } from './lock.js'
import { updateTimeline } from './timeline/generate.js'
import { getCurrentTime } from '../lib/index.js'
import { comparePieceStart, convertAdLibToGenericPiece, convertPieceToAdLibPiece } from './pieces.js'
import { getResolvedPiecesForCurrentPartInstance } from './resolvedPieces.js'
import { syncPlayheadInfinitesForNextPartInstance } from './infinites.js'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { PieceId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { IBlueprintDirectPlayType, IBlueprintPieceType } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages.js'
import { innerFindLastPieceOnLayer, innerStartOrQueueAdLibPiece, innerStopPieces } from './adlibUtils.js'
import _ from 'underscore'
import { executeActionInner } from './adlibAction.js'
import { PlayoutPieceInstanceModel } from './model/PlayoutPieceInstanceModel.js'

/**
 * Play an existing Piece in the Rundown as an AdLib
 */
export async function handleTakePieceAsAdlibNow(context: JobContext, data: TakePieceAsAdlibNowProps): Promise<void> {
	if (!context.studio.settings.allowPieceDirectPlay) {
		// Piece direct play isn't allowed, making this a noop
		logger.debug(`Piece direct play isn't allowed, skipping`)
		return
	}

	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}

			if (playlist.currentPartInfo?.partInstanceId !== data.partInstanceId)
				throw UserError.create(UserErrorMessage.AdlibCurrentPart)
		},
		async (playoutModel) => {
			const currentPartInstance = playoutModel.currentPartInstance
			if (!currentPartInstance) throw UserError.create(UserErrorMessage.InactiveRundown)
			const currentRundown = playoutModel.getRundown(currentPartInstance.partInstance.rundownId)
			if (!currentRundown)
				throw new Error(`Missing Rundown for PartInstance: ${currentPartInstance.partInstance._id}`)

			const rundownIds = playoutModel.getRundownIds()

			const pieceInstanceToCopy = playoutModel.findPieceInstance(
				data.pieceInstanceIdOrPieceIdToCopy as PieceInstanceId
			)

			const pieceToCopy = pieceInstanceToCopy
				? clone<PieceInstancePiece>(pieceInstanceToCopy.pieceInstance.pieceInstance.piece)
				: ((await context.directCollections.Pieces.findOne({
						_id: data.pieceInstanceIdOrPieceIdToCopy as PieceId,
						startRundownId: { $in: rundownIds },
					})) as Piece)
			if (!pieceToCopy) {
				throw UserError.from(
					new Error(`PieceInstance or Piece "${data.pieceInstanceIdOrPieceIdToCopy}" not found!`),
					UserErrorMessage.PieceAsAdlibNotFound
				)
			}

			const showStyleCompound = await context.getShowStyleCompound(
				currentRundown.rundown.showStyleVariantId,
				currentRundown.rundown.showStyleBaseId
			)
			if (!pieceToCopy.allowDirectPlay) {
				throw UserError.from(
					new Error(
						`PieceInstance or Piece "${data.pieceInstanceIdOrPieceIdToCopy}" cannot be direct played!`
					),
					UserErrorMessage.PieceAsAdlibNotDirectPlayable
				)
			}

			switch (pieceToCopy.allowDirectPlay.type) {
				case IBlueprintDirectPlayType.AdLibPiece:
					await pieceTakeNowAsAdlib(
						context,
						playoutModel,
						showStyleCompound,
						currentPartInstance,
						pieceToCopy,
						pieceInstanceToCopy
					)
					break
				case IBlueprintDirectPlayType.AdLibAction: {
					const executeProps = pieceToCopy.allowDirectPlay

					const blueprint = await context.getShowStyleBlueprint(showStyleCompound._id)
					const watchedPackages = WatchedPackagesHelper.empty(context) // TODO: should this be able to retrieve any watched packages?

					await executeActionInner(
						context,
						playoutModel,
						currentRundown,
						showStyleCompound,
						blueprint,
						watchedPackages,
						{
							...executeProps,
							triggerMode: undefined,
							privateData: undefined,
							publicData: undefined,
							actionOptions: undefined,
						}
					)
					break
				}
				default:
					assertNever(pieceToCopy.allowDirectPlay)
					throw UserError.from(
						new Error(
							`PieceInstance or Piece "${data.pieceInstanceIdOrPieceIdToCopy}" cannot be direct played!`
						),
						UserErrorMessage.PieceAsAdlibNotDirectPlayable
					)
			}
		}
	)
}
async function pieceTakeNowAsAdlib(
	context: JobContext,
	playoutModel: PlayoutModel,
	showStyleBase: ReadonlyDeep<ProcessedShowStyleCompound>,
	currentPartInstance: PlayoutPartInstanceModel,
	pieceToCopy: PieceInstancePiece,
	pieceInstanceToCopy:
		| { partInstance: PlayoutPartInstanceModel; pieceInstance: PlayoutPieceInstanceModel }
		| undefined
): Promise<void> {
	const genericAdlibPiece = convertAdLibToGenericPiece(pieceToCopy, false)
	/*const newPieceInstance = */ currentPartInstance.insertAdlibbedPiece(genericAdlibPiece, pieceToCopy._id)

	// Disable the original piece if from the same Part
	if (
		pieceInstanceToCopy &&
		pieceInstanceToCopy.pieceInstance.pieceInstance.partInstanceId === currentPartInstance.partInstance._id
	) {
		// Ensure the piece being copied isnt currently live
		if (
			pieceInstanceToCopy.pieceInstance.pieceInstance.plannedStartedPlayback &&
			pieceInstanceToCopy.pieceInstance.pieceInstance.plannedStartedPlayback <= getCurrentTime()
		) {
			const resolvedPieces = getResolvedPiecesForCurrentPartInstance(
				context,
				showStyleBase.sourceLayers,
				currentPartInstance
			)
			const resolvedPieceBeingCopied = resolvedPieces.find(
				(p) => p.instance._id === pieceInstanceToCopy.pieceInstance.pieceInstance._id
			)

			if (
				resolvedPieceBeingCopied?.resolvedDuration !== undefined &&
				(resolvedPieceBeingCopied.instance.infinite ||
					resolvedPieceBeingCopied.resolvedStart + resolvedPieceBeingCopied.resolvedDuration >=
						getCurrentTime())
			) {
				// logger.debug(`Piece "${piece._id}" is currently live and cannot be used as an ad-lib`)
				throw UserError.from(
					new Error(
						`PieceInstance "${pieceInstanceToCopy.pieceInstance.pieceInstance._id}" is currently live and cannot be used as an ad-lib`
					),
					UserErrorMessage.PieceAsAdlibCurrentlyLive
				)
			}
		}

		// TODO: is this ok?
		pieceInstanceToCopy.pieceInstance.setDisabled(true)
	}

	await syncPlayheadInfinitesForNextPartInstance(
		context,
		playoutModel,
		undefined,
		playoutModel.currentPartInstance,
		playoutModel.nextPartInstance
	)

	await updateTimeline(context, playoutModel)
}

/**
 * Play an AdLib piece by its id
 */
export async function handleAdLibPieceStart(context: JobContext, data: AdlibPieceStartProps): Promise<void> {
	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}

			if (!data.queue && playlist.currentPartInfo?.partInstanceId !== data.partInstanceId)
				throw UserError.create(UserErrorMessage.AdlibCurrentPart)
		},
		async (playoutModel) => {
			const partInstance = playoutModel.getPartInstance(data.partInstanceId)
			if (!partInstance) throw new Error(`PartInstance "${data.partInstanceId}" not found!`)
			const rundown = playoutModel.getRundown(partInstance.partInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${partInstance.partInstance.rundownId}" not found!`)

			// Rundows that share the same showstyle variant as the current rundown, so adlibs from these rundowns are safe to play
			const safeRundownIds = playoutModel.rundowns
				.filter((rd) => rd.rundown.showStyleVariantId === rundown.rundown.showStyleVariantId)
				.map((r) => r.rundown._id)

			let adLibPiece: AdLibPiece | BucketAdLib | undefined
			if (data.pieceType === 'baseline') {
				adLibPiece = await context.directCollections.RundownBaselineAdLibPieces.findOne({
					_id: data.adLibPieceId,
					rundownId: { $in: safeRundownIds },
				})
			} else if (data.pieceType === 'normal') {
				adLibPiece = await context.directCollections.AdLibPieces.findOne({
					_id: data.adLibPieceId,
					rundownId: { $in: safeRundownIds },
				})
			} else if (data.pieceType === 'bucket') {
				const bucketAdlib = await context.directCollections.BucketAdLibPieces.findOne({
					_id: data.adLibPieceId,
					studioId: context.studioId,
				})

				if (bucketAdlib && bucketAdlib.showStyleVariantId !== rundown.rundown.showStyleVariantId) {
					throw UserError.from(
						new Error(
							`Bucket AdLib "${data.adLibPieceId}" is not compatible with rundown "${rundown.rundown._id}"!`
						),
						UserErrorMessage.BucketAdlibIncompatible
					)
				}

				adLibPiece = bucketAdlib
			}

			if (!adLibPiece)
				throw UserError.from(
					new Error(`AdLib Piece "${data.adLibPieceId}" ("${data.pieceType}") not found!`),
					UserErrorMessage.AdlibNotFound
				)
			if (adLibPiece.invalid)
				throw UserError.from(
					new Error(`Cannot take invalid AdLib Piece "${data.adLibPieceId}"!`),
					UserErrorMessage.AdlibUnplayable
				)
			if (adLibPiece.floated)
				throw UserError.from(
					new Error(`Cannot take floated AdLib Piece "${data.adLibPieceId}"!`),
					UserErrorMessage.AdlibUnplayable
				)

			await innerStartOrQueueAdLibPiece(context, playoutModel, rundown, !!data.queue, partInstance, adLibPiece)
		}
	)
}

/**
 * Find and play a sticky Piece on a SourceLayer
 */
export async function handleStartStickyPieceOnSourceLayer(
	context: JobContext,
	data: StartStickyPieceOnSourceLayerProps
): Promise<void> {
	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}
			if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart)
		},
		async (playoutModel) => {
			const currentPartInstance = playoutModel.currentPartInstance
			if (!currentPartInstance) throw UserError.create(UserErrorMessage.NoCurrentPart)

			const rundown = playoutModel.getRundown(currentPartInstance.partInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${currentPartInstance.partInstance.rundownId}" not found!`)

			const showStyleBase = await context.getShowStyleBase(rundown.rundown.showStyleBaseId)
			const sourceLayer = showStyleBase.sourceLayers[data.sourceLayerId]
			if (!sourceLayer) throw new Error(`Source layer "${data.sourceLayerId}" not found!`)

			if (!sourceLayer.isSticky)
				throw UserError.from(
					new Error(`Only sticky layers can be restarted. "${data.sourceLayerId}" is not sticky.`),
					UserErrorMessage.SourceLayerNotSticky
				)

			const lastPieceInstance = await innerFindLastPieceOnLayer(
				context,
				playoutModel,
				[sourceLayer._id],
				sourceLayer.stickyOriginalOnly || false
			)
			if (!lastPieceInstance) {
				throw UserError.create(UserErrorMessage.SourceLayerStickyNothingFound)
			}

			const lastPiece = convertPieceToAdLibPiece(context, lastPieceInstance.piece)
			await innerStartOrQueueAdLibPiece(context, playoutModel, rundown, false, currentPartInstance, lastPiece)
		}
	)
}

/**
 * Stop any playing Pieces on some SourceLayers
 */
export async function handleStopPiecesOnSourceLayers(
	context: JobContext,
	data: StopPiecesOnSourceLayersProps
): Promise<void> {
	if (data.sourceLayerIds.length === 0) return
	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}
			if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart)
		},
		async (playoutModel) => {
			const partInstance = playoutModel.getPartInstance(data.partInstanceId)
			if (!partInstance) throw new Error(`PartInstance "${data.partInstanceId}" not found!`)
			const lastStartedPlayback = partInstance.partInstance.timings?.plannedStartedPlayback
			if (!lastStartedPlayback) throw new Error(`Part "${data.partInstanceId}" has yet to start playback!`)

			const rundown = playoutModel.getRundown(partInstance.partInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${partInstance.partInstance.rundownId}" not found!`)

			const showStyleBase = await context.getShowStyleBase(rundown.rundown.showStyleBaseId)
			const sourceLayerIds = new Set(data.sourceLayerIds)
			const changedIds = innerStopPieces(
				context,
				playoutModel,
				showStyleBase.sourceLayers,
				partInstance,
				(pieceInstance) => sourceLayerIds.has(pieceInstance.piece.sourceLayerId),
				undefined
			)

			if (changedIds.length) {
				await syncPlayheadInfinitesForNextPartInstance(
					context,
					playoutModel,
					undefined,
					playoutModel.currentPartInstance,
					playoutModel.nextPartInstance
				)

				await updateTimeline(context, playoutModel)
			}
		}
	)
}

/**
 * Disable the next Piece which allows being disabled
 */
export async function handleDisableNextPiece(context: JobContext, data: DisableNextPieceProps): Promise<void> {
	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart)
		},
		async (playoutModel) => {
			const playlist = playoutModel.playlist

			const currentPartInstance = playoutModel.currentPartInstance
			const nextPartInstance = playoutModel.nextPartInstance
			if (!currentPartInstance)
				throw new Error(`PartInstance "${playlist.currentPartInfo?.partInstanceId}" not found!`)

			const rundown = playoutModel.getRundown(currentPartInstance.partInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${currentPartInstance.partInstance.rundownId}" not found!`)
			const showStyleBase = await context.getShowStyleBase(rundown.rundown.showStyleBaseId)

			// logger.info(o)
			// logger.info(JSON.stringify(o, '', 2))

			const allowedSourceLayers = showStyleBase.sourceLayers

			const getNextPiece = (partInstance: PlayoutPartInstanceModel, ignoreStartedPlayback: boolean) => {
				// Find next piece to disable

				let nowInPart = 0
				if (!ignoreStartedPlayback && partInstance.partInstance.timings?.plannedStartedPlayback) {
					nowInPart = getCurrentTime() - partInstance.partInstance.timings?.plannedStartedPlayback
				}

				const filteredPieces = partInstance.pieceInstances.filter((piece) => {
					const sourceLayer = allowedSourceLayers[piece.pieceInstance.piece.sourceLayerId]
					if (
						sourceLayer?.allowDisable &&
						!piece.pieceInstance.piece.virtual &&
						piece.pieceInstance.piece.pieceType === IBlueprintPieceType.Normal
					)
						return true
					return false
				})

				const sortedByLayer = _.sortBy(filteredPieces, (piece) => {
					const sourceLayer = allowedSourceLayers[piece.pieceInstance.piece.sourceLayerId]
					return sourceLayer?._rank || -9999
				})

				const sortedPieces = [...sortedByLayer]
				sortedPieces.sort((a, b) => comparePieceStart(a.pieceInstance.piece, b.pieceInstance.piece, nowInPart))

				const findLast = !!data.undo

				if (findLast) sortedPieces.reverse()

				return sortedPieces.find((piece) => {
					return (
						piece.pieceInstance.piece.enable.start !== 'now' &&
						piece.pieceInstance.piece.enable.start >= nowInPart &&
						((!data.undo && !piece.pieceInstance.disabled) || (data.undo && piece.pieceInstance.disabled))
					)
				})
			}

			const partInstances: Array<[PlayoutPartInstanceModel | null, boolean]> = [
				[currentPartInstance, false],
				[nextPartInstance, true], // If not found in currently playing part, let's look in the next one:
			]
			if (data.undo) partInstances.reverse()

			let disabledPiece = false

			for (const [partInstance, ignoreStartedPlayback] of partInstances) {
				if (partInstance && !disabledPiece) {
					const candidatePieceInstance = getNextPiece(partInstance, ignoreStartedPlayback)
					if (candidatePieceInstance) {
						logger.debug(
							(data.undo ? 'Disabling' : 'Enabling') +
								' next PieceInstance ' +
								candidatePieceInstance.pieceInstance._id
						)
						candidatePieceInstance.setDisabled(!data.undo)
						disabledPiece = true

						break
					}
				}
			}

			if (disabledPiece) {
				await updateTimeline(context, playoutModel)
			} else {
				playoutModel.assertNoChanges()

				throw UserError.create(UserErrorMessage.DisableNoPieceFound)
			}
		}
	)
}
