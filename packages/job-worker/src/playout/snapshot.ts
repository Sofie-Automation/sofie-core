import { ExpectedPackageDBType, getExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import {
	AdLibActionId,
	ExpectedPackageId,
	PartId,
	PartInstanceId,
	PieceId,
	RundownBaselineAdLibActionId,
	RundownId,
	SegmentId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	SnapshotId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	GeneratePlaylistSnapshotProps,
	GeneratePlaylistSnapshotResult,
	RestorePlaylistSnapshotProps,
	RestorePlaylistSnapshotResult,
} from '@sofie-automation/corelib/dist/worker/studio'
import { getCurrentTime, getSystemVersion } from '../lib/index.js'
import { JobContext } from '../jobs/index.js'
import { runWithPlaylistLock } from './lock.js'
import { CoreRundownPlaylistSnapshot } from '@sofie-automation/corelib/dist/snapshots'
import { unprotectString, ProtectedString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import { saveIntoDb } from '../db/changes.js'
import { getPartId, getSegmentId } from '../ingest/lib.js'
import { assertNever, getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../logging.js'
import { JSONBlobParse, JSONBlobStringify } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { SofieIngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/SofieIngestDataCache'

class IdMapWithGenerator<V extends ProtectedString<any>> extends Map<V, V> {
	getOrGenerate(key: V): V {
		return this.getOrGenerateAndWarn(key, '')
	}

	getOrGenerateAndWarn(key: V, name: string): V {
		const existing = this.get(key)
		if (existing) return existing

		const newValue = getRandomId<V>()
		this.set(key, newValue)
		if (name) logger.warn(`Couldn't find "${name}" when restoring snapshot`)
		return newValue
	}
}

/**
 * Generate the Playlist owned portions of a Playlist snapshot
 */
export async function handleGeneratePlaylistSnapshot(
	context: JobContext,
	props: GeneratePlaylistSnapshotProps
): Promise<GeneratePlaylistSnapshotResult> {
	const snapshot = await runWithPlaylistLock(context, props.playlistId, async () => {
		const snapshotId: SnapshotId = getRandomId()
		logger.info(`Generating RundownPlaylist snapshot "${snapshotId}" for RundownPlaylist "${props.playlistId}"`)

		const playlist = await context.directCollections.RundownPlaylists.findOne(props.playlistId)
		if (!playlist) throw new Error(`Playlist "${props.playlistId}" not found`)

		const rundowns = await context.directCollections.Rundowns.findFetch({ playlistId: playlist._id })
		const rundownIds = rundowns.map((i) => i._id)
		const ingestData = await context.directCollections.NrcsIngestDataCache.findFetch(
			{ rundownId: { $in: rundownIds } },
			{ sort: { modified: -1 } }
		) // @todo: check sorting order
		const sofieIngestData = await context.directCollections.SofieIngestDataCache.findFetch(
			{ rundownId: { $in: rundownIds } },
			{ sort: { modified: -1 } }
		) // @todo: check sorting order

		// const userActions = await context.directCollections.UserActionsLog.findFetch({
		// 	args: {
		// 		$regex:
		// 			`.*(` +
		// 			rundownIds
		// 				.concat(playlistId as any)
		// 				.map((i) => `"${i}"`)
		// 				.join('|') +
		// 			`).*`,
		// 	},
		// })

		const segments = await context.directCollections.Segments.findFetch({ rundownId: { $in: rundownIds } })
		const parts = await context.directCollections.Parts.findFetch({ rundownId: { $in: rundownIds } })
		const validTime = getCurrentTime() - 1000 * 3600 * 24 // 24 hours ago
		const partInstances = await context.directCollections.PartInstances.findFetch(
			props.full
				? { rundownId: { $in: rundownIds } }
				: {
						rundownId: { $in: rundownIds },
						$or: [
							{ 'timings.plannedStoppedPlayback': { $gte: validTime }, reset: true },
							{ reset: { $ne: true } },
						],
					}
		)
		const pieces = await context.directCollections.Pieces.findFetch({ startRundownId: { $in: rundownIds } })
		const pieceInstances = await context.directCollections.PieceInstances.findFetch(
			props.full
				? { rundownId: { $in: rundownIds } }
				: {
						rundownId: { $in: rundownIds },
						$or: [{ partInstanceId: { $in: partInstances.map((p) => p._id) } }, { reset: { $ne: true } }],
					}
		)
		const adLibPieces = await context.directCollections.AdLibPieces.findFetch({ rundownId: { $in: rundownIds } })
		const baselineAdlibs = await context.directCollections.RundownBaselineAdLibPieces.findFetch({
			rundownId: { $in: rundownIds },
		})
		const adLibActions = await context.directCollections.AdLibActions.findFetch({ rundownId: { $in: rundownIds } })
		const baselineAdLibActions = await context.directCollections.RundownBaselineAdLibActions.findFetch({
			rundownId: { $in: rundownIds },
		})

		const expectedPlayoutItems = await context.directCollections.ExpectedPlayoutItems.findFetch({
			rundownId: { $in: rundownIds },
		})
		const expectedPackages = await context.directCollections.ExpectedPackages.findFetch({
			rundownId: { $in: rundownIds },
		})
		const baselineObjs = await context.directCollections.RundownBaselineObjects.findFetch({
			rundownId: { $in: rundownIds },
		})

		const timeline =
			playlist.activationId && props.withTimeline
				? await context.directCollections.Timelines.findOne({
						_id: playlist.studioId,
					})
				: undefined

		logger.info(`Snapshot generation done`)
		return literal<CoreRundownPlaylistSnapshot>({
			version: getSystemVersion(),
			playlistId: playlist._id,
			playlist,
			rundowns,
			ingestData,
			sofieIngestData,
			baselineObjs,
			baselineAdlibs,
			segments,
			parts,
			partInstances,
			pieces,
			pieceInstances,
			adLibPieces,
			adLibActions,
			baselineAdLibActions,
			expectedPlayoutItems,
			expectedPackages,
			timeline,
		})
	})

	return {
		snapshotJson: JSONBlobStringify(snapshot),
	}
}

/**
 * Restore the Playlist owned portions of a Playlist snapshot
 */
export async function handleRestorePlaylistSnapshot(
	context: JobContext,
	props: RestorePlaylistSnapshotProps
): Promise<RestorePlaylistSnapshotResult> {
	// Future: we should validate this against a schema or something
	const snapshot: CoreRundownPlaylistSnapshot = JSONBlobParse(props.snapshotJson)

	const oldPlaylistId = snapshot.playlistId

	if (oldPlaylistId !== snapshot.playlist._id)
		throw new Error(`Restore snapshot: playlistIds don't match, "${oldPlaylistId}", "${snapshot.playlist._id}!"`)

	const playlistId = (snapshot.playlist._id = getRandomId())
	snapshot.playlist.restoredFromSnapshotId = snapshot.playlistId
	delete snapshot.playlist.activationId

	for (const rd of snapshot.rundowns) {
		if (!rd.orphaned) {
			rd.orphaned = RundownOrphanedReason.MANUAL
		}

		rd.playlistId = playlistId
		rd.source = {
			type: 'snapshot',
			rundownId: rd._id,
		}
		rd.studioId = snapshot.playlist.studioId
	}

	// TODO: This is too naive. Ideally we should unset it if it isnt valid, as anything other than a match is likely to have issues.
	// Perhaps we can ask the blueprints what it should be, and hope it chooses something compatible?
	const showStyleBases = await context.getShowStyleBases()
	const showStyleVariantsCache = new Map<ShowStyleBaseId, ShowStyleVariantId[]>()
	async function getVariantIds(baseId: ShowStyleBaseId) {
		const cached = showStyleVariantsCache.get(baseId)
		if (cached) return cached

		const variants = await context.getShowStyleVariants(baseId)
		const ids = variants.map((v) => v._id)
		showStyleVariantsCache.set(baseId, ids)
		return ids
	}

	const showStyleBaseIds = showStyleBases.map((s) => s._id)
	for (const rd of snapshot.rundowns) {
		// Note: this whole loop assumes there is reasonable data in the db. If it encounters an empty array, it will get grumpy but should be predictable
		if (!showStyleBaseIds.includes(rd.showStyleBaseId)) {
			rd.showStyleBaseId = showStyleBaseIds[0]
		}

		const variantIds = await getVariantIds(rd.showStyleBaseId)
		if (variantIds && !variantIds.includes(rd.showStyleVariantId)) {
			rd.showStyleVariantId = variantIds[0]
		}
	}

	// Migrate old data:
	// 1.12.0 Release 24:
	const partSegmentIds: { [partId: string]: SegmentId } = {}
	for (const part of snapshot.parts) {
		partSegmentIds[unprotectString(part._id)] = part.segmentId
	}
	for (const piece of snapshot.pieces) {
		const pieceOld = piece as any
		if (pieceOld.rundownId) {
			piece.startRundownId = pieceOld.rundownId
			delete pieceOld.rundownId
		}
		if (pieceOld.partId) {
			const partId = pieceOld.partId
			piece.startPartId = partId
			delete pieceOld.partId
			piece.startSegmentId = partSegmentIds[unprotectString(partId)]
		}
	}

	// List any ids that need updating on other documents
	const rundownIdMap = new Map<RundownId, RundownId>()
	const getNewRundownId = (oldRundownId: RundownId) => {
		const rundownId = rundownIdMap.get(oldRundownId)
		if (!rundownId) {
			throw new Error(`Could not find new rundownId for "${oldRundownId}"`)
		}
		return rundownId
	}
	for (const rd of snapshot.rundowns) {
		const oldId = rd._id
		rd._id = getRandomId()
		rundownIdMap.set(oldId, rd._id)
	}
	const partIdMap = new IdMapWithGenerator<PartId>()
	for (const part of snapshot.parts) {
		const oldId = part._id
		part._id = part.externalId ? getPartId(getNewRundownId(part.rundownId), part.externalId) : getRandomId()

		partIdMap.set(oldId, part._id)
	}

	const partInstanceOldRundownIdMap = new Map<PartInstanceId, RundownId>()
	const partInstanceIdMap = new IdMapWithGenerator<PartInstanceId>()
	for (const partInstance of snapshot.partInstances) {
		const oldId = partInstance._id
		partInstance._id = getRandomId()
		partInstanceIdMap.set(oldId, partInstance._id)

		partInstance.part._id = partIdMap.getOrGenerate(partInstance.part._id)
		partInstanceOldRundownIdMap.set(oldId, partInstance.rundownId)
	}
	const segmentIdMap = new IdMapWithGenerator<SegmentId>()
	for (const segment of snapshot.segments) {
		const oldId = segment._id
		segment._id = getSegmentId(getNewRundownId(segment.rundownId), segment.externalId)
		segmentIdMap.set(oldId, segment._id)
	}
	type AnyPieceId = PieceId | AdLibActionId | RundownBaselineAdLibActionId
	const pieceIdMap = new IdMapWithGenerator<AnyPieceId>()
	for (const piece of snapshot.pieces) {
		const oldId = piece._id
		piece.startRundownId = getNewRundownId(piece.startRundownId)
		if (piece.startPartId) {
			piece.startPartId = partIdMap.getOrGenerateAndWarn(
				piece.startPartId,
				`piece.startPartId=${piece.startPartId} of piece=${piece._id}`
			)
		}
		if (piece.startSegmentId) {
			piece.startSegmentId = segmentIdMap.getOrGenerateAndWarn(
				piece.startSegmentId,
				`piece.startSegmentId=${piece.startSegmentId} of piece=${piece._id}`
			)
		}
		piece._id = getRandomId()
		pieceIdMap.set(oldId, piece._id)
	}

	for (const adlib of [
		...snapshot.adLibPieces,
		...snapshot.adLibActions,
		...snapshot.baselineAdlibs,
		...snapshot.baselineAdLibActions,
	]) {
		const oldId = adlib._id
		adlib._id = getRandomId()
		pieceIdMap.set(oldId, adlib._id)
	}

	for (const pieceInstance of snapshot.pieceInstances) {
		pieceInstance._id = getRandomId()

		pieceInstance.piece._id = pieceIdMap.getOrGenerate(pieceInstance.piece._id) as PieceId // Note: don't warn if not found, as the piece may have been deleted
		if (pieceInstance.infinite) {
			pieceInstance.infinite.infinitePieceId = pieceIdMap.getOrGenerate(
				pieceInstance.infinite.infinitePieceId
			) as PieceId // Note: don't warn if not found, as the piece may have been deleted
		}
	}

	fixupImportedSelectedPartInstanceIds(
		snapshot,
		rundownIdMap,
		partInstanceIdMap,
		partInstanceOldRundownIdMap,
		'current'
	)
	fixupImportedSelectedPartInstanceIds(snapshot, rundownIdMap, partInstanceIdMap, partInstanceOldRundownIdMap, 'next')
	fixupImportedSelectedPartInstanceIds(
		snapshot,
		rundownIdMap,
		partInstanceIdMap,
		partInstanceOldRundownIdMap,
		'previous'
	)

	const expectedPackageIdMap = new Map<ExpectedPackageId, ExpectedPackageId>()
	for (const expectedPackage of snapshot.expectedPackages) {
		const oldId = expectedPackage._id

		switch (expectedPackage.fromPieceType) {
			case ExpectedPackageDBType.PIECE:
			case ExpectedPackageDBType.ADLIB_PIECE:
			case ExpectedPackageDBType.ADLIB_ACTION:
			case ExpectedPackageDBType.BASELINE_ADLIB_PIECE:
			case ExpectedPackageDBType.BASELINE_ADLIB_ACTION:
			case ExpectedPackageDBType.BASELINE_PIECE: {
				expectedPackage.pieceId = pieceIdMap.getOrGenerateAndWarn(
					expectedPackage.pieceId,
					`expectedPackage.pieceId=${expectedPackage.pieceId}`
				)

				expectedPackage._id = getExpectedPackageId(expectedPackage.pieceId, expectedPackage.blueprintPackageId)

				break
			}
			case ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS: {
				expectedPackage._id = getExpectedPackageId(
					expectedPackage.rundownId,
					expectedPackage.blueprintPackageId
				)
				break
			}
			case ExpectedPackageDBType.BUCKET_ADLIB:
			case ExpectedPackageDBType.BUCKET_ADLIB_ACTION:
			case ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS: {
				// ignore, these are not present in the rundown snapshot anyway.
				logger.warn(`Unexpected ExpectedPackage in snapshot: ${JSON.stringify(expectedPackage)}`)
				break
			}

			default:
				assertNever(expectedPackage)
				break
		}

		expectedPackageIdMap.set(oldId, expectedPackage._id)
	}

	snapshot.playlist.rundownIdsInOrder = snapshot.playlist.rundownIdsInOrder.map((id) => rundownIdMap.get(id) ?? id)

	const rundownIds = snapshot.rundowns.map((r) => r._id)

	// Apply the updates of any properties to any document
	function updateItemIds<
		T extends {
			_id: ProtectedString<any>
			rundownId?: RundownId
			partInstanceId?: PartInstanceId
			partId?: PartId
			segmentId?: SegmentId
			part?: unknown
			piece?: unknown
		},
	>(objs: undefined | T[], updateId: boolean): T[] {
		const updateIds = (obj: T, updateOwnId: boolean) => {
			if (obj.rundownId) {
				obj.rundownId = getNewRundownId(obj.rundownId)
			}

			if (obj.partId) {
				obj.partId = partIdMap.getOrGenerate(obj.partId)
			}
			if (obj.segmentId) {
				obj.segmentId = segmentIdMap.getOrGenerate(obj.segmentId)
			}
			if (obj.partInstanceId) {
				obj.partInstanceId = partInstanceIdMap.getOrGenerate(obj.partInstanceId)
			}

			if (updateOwnId) {
				obj._id = getRandomId()
			}

			if (obj.part) {
				updateIds(obj.part as any, false)
			}
			if (obj.piece) {
				updateIds(obj.piece as any, false)
			}

			return obj
		}
		return (objs || []).map((obj) => updateIds(obj, updateId))
	}

	await Promise.all([
		saveIntoDb(context, context.directCollections.RundownPlaylists, { _id: playlistId }, [snapshot.playlist]),
		saveIntoDb(context, context.directCollections.Rundowns, { playlistId }, snapshot.rundowns),
		saveIntoDb(
			context,
			context.directCollections.NrcsIngestDataCache,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.ingestData, true)
		),
		saveIntoDb(
			context,
			context.directCollections.SofieIngestDataCache,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.sofieIngestData || (snapshot.ingestData as any as SofieIngestDataCacheObj[]), true)
		),
		saveIntoDb(
			context,
			context.directCollections.RundownBaselineObjects,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.baselineObjs, true)
		),
		saveIntoDb(
			context,
			context.directCollections.RundownBaselineAdLibPieces,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.baselineAdlibs, false)
		),
		saveIntoDb(
			context,
			context.directCollections.RundownBaselineAdLibActions,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.baselineAdLibActions, false)
		),
		saveIntoDb(
			context,
			context.directCollections.Segments,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.segments, false)
		),
		saveIntoDb(
			context,
			context.directCollections.Parts,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.parts, false)
		),
		saveIntoDb(
			context,
			context.directCollections.PartInstances,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.partInstances, false)
		),
		saveIntoDb(
			context,
			context.directCollections.Pieces,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.pieces, false)
		),
		saveIntoDb(
			context,
			context.directCollections.PieceInstances,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.pieceInstances, false)
		),
		saveIntoDb(
			context,
			context.directCollections.AdLibPieces,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.adLibPieces, false)
		),
		saveIntoDb(
			context,
			context.directCollections.AdLibActions,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.adLibActions, false)
		),
		saveIntoDb(
			context,
			context.directCollections.ExpectedPlayoutItems,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.expectedPlayoutItems || [], true)
		),
		saveIntoDb(
			context,
			context.directCollections.ExpectedPackages,
			{ rundownId: { $in: rundownIds } },
			snapshot.expectedPackages || []
		),
	])

	logger.info(`Restore done`)
	return {
		playlistId: playlistId,
		remappedIds: {
			rundownId: Array.from(rundownIdMap.entries()),
			segmentId: Array.from(segmentIdMap.entries()),
			partId: Array.from(partIdMap.entries()),
			partInstanceId: Array.from(partInstanceIdMap.entries()),
			expectedPackageId: Array.from(expectedPackageIdMap.entries()),
		},
	}
}

function fixupImportedSelectedPartInstanceIds(
	snapshot: CoreRundownPlaylistSnapshot,
	rundownIdMap: Map<RundownId, RundownId>,
	partInstanceIdMap: Map<PartInstanceId, PartInstanceId>,
	partInstanceOldRundownIdMap: Map<PartInstanceId, RundownId>,
	property: 'current' | 'next' | 'previous'
) {
	const fullOldKey = `${property}PartInstanceId`
	if (fullOldKey in snapshot.playlist) {
		const oldId = (snapshot.playlist as any)[fullOldKey] as PartInstanceId
		snapshot.playlist.currentPartInfo = {
			partInstanceId: oldId,
			rundownId: partInstanceOldRundownIdMap.get(oldId) || protectString(''),
			manuallySelected: false,
			consumesQueuedSegmentId: false,
		}
	}

	const fullNewKey: keyof DBRundownPlaylist = `${property}PartInfo`

	const snapshotInfo = snapshot.playlist[fullNewKey]
	if (snapshotInfo) {
		snapshot.playlist[fullNewKey] = {
			partInstanceId: partInstanceIdMap.get(snapshotInfo.partInstanceId) || snapshotInfo.partInstanceId,
			rundownId: rundownIdMap.get(snapshotInfo.rundownId) || snapshotInfo.rundownId,
			manuallySelected: snapshotInfo.manuallySelected,
			consumesQueuedSegmentId: snapshotInfo.consumesQueuedSegmentId,
		}
	}
}
