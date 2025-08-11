import { Meteor } from 'meteor/meteor'
import { meteorPublish } from './lib/lib'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { MongoFieldSpecifierZeroes, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { check, Match } from 'meteor/check'
import { FindOptions } from '@sofie-automation/meteor-lib/dist/collections/lib'
import {
	AdLibActions,
	AdLibPieces,
	ExpectedPlayoutItems,
	NrcsIngestDataCache,
	PartInstances,
	Parts,
	PieceInstances,
	Pieces,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	Rundowns,
	Segments,
} from '../collections'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { NrcsIngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import { literal } from '@sofie-automation/corelib/dist/lib'
import {
	PartId,
	PartInstanceId,
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	SegmentId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { PeripheralDevicePubSub } from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import { checkAccessAndGetPeripheralDevice } from '../security/check'

meteorPublish(
	PeripheralDevicePubSub.rundownsForDevice,
	async function (deviceId: PeripheralDeviceId, token: string | undefined) {
		check(deviceId, String)
		check(token, String)

		// Future: this should be reactive to studioId changes, but this matches how the other *ForDevice publications behave

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, this)

		// No studio, then no rundowns
		const studioId = peripheralDevice.studioAndConfigId?.studioId
		if (!studioId) return null

		return Rundowns.findWithCursor(
			{
				studioId: studioId,
			},
			{
				projection: {
					privateData: 0,
				},
			}
		)
	}
)

meteorPublish(
	CorelibPubSub.rundownsInPlaylists,
	async function (playlistIds: RundownPlaylistId[], _token: string | undefined) {
		check(playlistIds, Array)

		triggerWriteAccessBecauseNoCheckNecessary()

		// If values were provided, they must have values
		if (playlistIds.length === 0) return null

		const selector: MongoQuery<DBRundown> = {
			playlistId: { $in: playlistIds },
		}

		const modifier: FindOptions<DBRundown> = {
			projection: {
				privateData: 0,
			},
		}

		return Rundowns.findWithCursor(selector, modifier)
	}
)
meteorPublish(
	CorelibPubSub.rundownsWithShowStyleBases,
	async function (showStyleBaseIds: ShowStyleBaseId[], _token: string | undefined) {
		check(showStyleBaseIds, Array)

		triggerWriteAccessBecauseNoCheckNecessary()

		if (showStyleBaseIds.length === 0) return null

		const selector: MongoQuery<DBRundown> = {
			showStyleBaseId: { $in: showStyleBaseIds },
		}

		const modifier: FindOptions<DBRundown> = {
			projection: {
				privateData: 0,
			},
		}

		return Rundowns.findWithCursor(selector, modifier)
	}
)

meteorPublish(
	CorelibPubSub.segments,
	async function (rundownIds: RundownId[], filter: { omitHidden?: boolean } | undefined, _token: string | undefined) {
		check(rundownIds, Array)

		triggerWriteAccessBecauseNoCheckNecessary()

		if (rundownIds.length === 0) return null

		const selector: MongoQuery<DBSegment> = {
			rundownId: { $in: rundownIds },
		}
		if (filter?.omitHidden) selector.isHidden = { $ne: true }

		return Segments.findWithCursor(selector, {
			projection: {
				privateData: 0,
			},
		})
	}
)

meteorPublish(
	CorelibPubSub.parts,
	async function (rundownIds: RundownId[], segmentIds: SegmentId[] | null, _token: string | undefined) {
		check(rundownIds, Array)
		check(segmentIds, Match.Maybe(Array))

		triggerWriteAccessBecauseNoCheckNecessary()

		if (rundownIds.length === 0) return null
		if (segmentIds && segmentIds.length === 0) return null

		const modifier: FindOptions<DBPart> = {
			projection: {
				privateData: 0,
			},
		}

		const selector: MongoQuery<DBPart> = {
			rundownId: { $in: rundownIds },
			reset: { $ne: true },
		}
		if (segmentIds) selector.segmentId = { $in: segmentIds }

		return Parts.findWithCursor(selector, modifier)
	}
)
meteorPublish(
	CorelibPubSub.partInstances,
	async function (
		rundownIds: RundownId[],
		playlistActivationId: RundownPlaylistActivationId | null,
		_token: string | undefined
	) {
		check(rundownIds, Array)
		check(playlistActivationId, Match.Maybe(String))

		triggerWriteAccessBecauseNoCheckNecessary()

		if (rundownIds.length === 0 || !playlistActivationId) return null

		const modifier: FindOptions<DBPartInstance> = {
			projection: {
				// @ts-expect-error Mongo typings aren't clever enough yet
				'part.privateData': 0,
			},
		}

		const selector: MongoQuery<DBPartInstance> = {
			rundownId: { $in: rundownIds },
			reset: { $ne: true },
		}
		if (playlistActivationId) selector.playlistActivationId = playlistActivationId

		return PartInstances.findWithCursor(selector, modifier)
	}
)
meteorPublish(
	CorelibPubSub.partInstancesSimple,
	async function (
		rundownIds: RundownId[],
		playlistActivationId: RundownPlaylistActivationId | null,
		_token: string | undefined
	) {
		check(rundownIds, Array)

		triggerWriteAccessBecauseNoCheckNecessary()

		if (rundownIds.length === 0) return null

		const selector: MongoQuery<DBPartInstance> = {
			rundownId: { $in: rundownIds },
			// Enforce only not-reset
			reset: { $ne: true },
		}
		if (playlistActivationId) selector.playlistActivationId = playlistActivationId

		return PartInstances.findWithCursor(selector, {
			projection: literal<MongoFieldSpecifierZeroes<DBPartInstance>>({
				// @ts-expect-error Mongo typings aren't clever enough yet
				'part.privateData': 0,
				isTaken: 0,
				timings: 0,
			}),
		})
	}
)

const piecesSubFields: MongoFieldSpecifierZeroes<Piece> = {
	privateData: 0,
	timelineObjectsString: 0,
}

meteorPublish(
	CorelibPubSub.pieces,
	async function (rundownIds: RundownId[], partIds: PartId[] | null, _token: string | undefined) {
		check(rundownIds, Array)
		check(partIds, Match.Maybe(Array))

		triggerWriteAccessBecauseNoCheckNecessary()

		// If values were provided, they must have values
		if (partIds && partIds.length === 0) return null

		const selector: MongoQuery<Piece> = {
			startRundownId: { $in: rundownIds },
		}
		if (partIds) selector.startPartId = { $in: partIds }

		return Pieces.findWithCursor(selector, {
			projection: piecesSubFields,
		})
	}
)

meteorPublish(
	CorelibPubSub.piecesInfiniteStartingBefore,
	async function (
		thisRundownId: RundownId,
		segmentsIdsBefore: SegmentId[],
		rundownIdsBefore: RundownId[],
		_token: string | undefined
	) {
		triggerWriteAccessBecauseNoCheckNecessary()

		const selector: MongoQuery<Piece> = {
			invalid: {
				$ne: true,
			},
			$or: [
				// same rundown, and previous segment
				{
					startRundownId: thisRundownId,
					startSegmentId: { $in: segmentsIdsBefore },
					lifespan: {
						$in: [
							PieceLifespan.OutOnRundownEnd,
							PieceLifespan.OutOnRundownChange,
							PieceLifespan.OutOnShowStyleEnd,
						],
					},
				},
				// Previous rundown
				{
					startRundownId: { $in: rundownIdsBefore },
					lifespan: {
						$in: [PieceLifespan.OutOnShowStyleEnd],
					},
				},
			],
		}

		return Pieces.findWithCursor(selector, {
			projection: piecesSubFields,
		})
	}
)

const adlibPiecesSubFields: MongoFieldSpecifierZeroes<AdLibPiece> = {
	privateData: 0,
	timelineObjectsString: 0,
}

meteorPublish(CorelibPubSub.adLibPieces, async function (rundownIds: RundownId[], _token: string | undefined) {
	check(rundownIds, Array)

	triggerWriteAccessBecauseNoCheckNecessary()

	if (rundownIds.length === 0) return null

	const selector: MongoQuery<AdLibPiece> = {
		rundownId: { $in: rundownIds },
	}

	return AdLibPieces.findWithCursor(selector, {
		projection: adlibPiecesSubFields,
	})
})
meteorPublish(MeteorPubSub.adLibPiecesForPart, async function (partId: PartId, sourceLayerIds: string[]) {
	check(partId, String)
	check(sourceLayerIds, Array)

	triggerWriteAccessBecauseNoCheckNecessary()

	return AdLibPieces.findWithCursor(
		{
			partId,
			sourceLayerId: { $in: sourceLayerIds },
		},
		{
			projection: adlibPiecesSubFields,
		}
	)
})

const pieceInstanceFields: MongoFieldSpecifierZeroes<PieceInstance> = {
	// @ts-expect-error Mongo typings aren't clever enough yet
	'piece.privateData': 0,
	'piece.timelineObjectsString': 0,
}

meteorPublish(
	CorelibPubSub.pieceInstances,
	async function (
		rundownIds: RundownId[],
		partInstanceIds: PartInstanceId[] | null,
		filter:
			| {
					onlyPlayingAdlibsOrWithTags?: boolean
			  }
			| undefined,
		_token: string | undefined
	) {
		check(rundownIds, Array)
		check(partInstanceIds, Match.Maybe(Array))

		triggerWriteAccessBecauseNoCheckNecessary()

		// If values were provided, they must have values
		if (rundownIds.length === 0) return null
		if (partInstanceIds && partInstanceIds.length === 0) return null

		const selector: MongoQuery<PieceInstance> = {
			rundownId: { $in: rundownIds },

			// Enforce only not-reset
			reset: { $ne: true },
		}
		if (partInstanceIds) selector.partInstanceId = { $in: partInstanceIds }

		if (filter?.onlyPlayingAdlibsOrWithTags) {
			selector.plannedStartedPlayback = {
				$exists: true,
			}
			selector.$and = [
				{
					$or: [
						{
							adLibSourceId: {
								$exists: true,
							},
						},
						{
							'piece.tags': {
								$exists: true,
							},
						},
					],
				},
				{
					$or: [
						{
							plannedStoppedPlayback: {
								$eq: 0,
							},
						},
						{
							plannedStoppedPlayback: {
								$exists: false,
							},
						},
					],
				},
			]
		}

		return PieceInstances.findWithCursor(selector, {
			projection: pieceInstanceFields,
		})
	}
)

meteorPublish(
	CorelibPubSub.pieceInstancesSimple,
	async function (
		rundownIds: RundownId[],
		playlistActivationId: RundownPlaylistActivationId | null,
		_token: string | undefined
	) {
		check(rundownIds, Array)

		triggerWriteAccessBecauseNoCheckNecessary()

		if (rundownIds.length === 0) return null

		const selector: MongoQuery<PieceInstance> = {
			rundownId: { $in: rundownIds },
			// Enforce only not-reset
			reset: { $ne: true },
		}
		if (playlistActivationId) selector.playlistActivationId = playlistActivationId

		return PieceInstances.findWithCursor(selector, {
			projection: literal<MongoFieldSpecifierZeroes<PieceInstance>>({
				...pieceInstanceFields,
				plannedStartedPlayback: 0,
				plannedStoppedPlayback: 0,
			}),
		})
	}
)

meteorPublish(
	PeripheralDevicePubSub.expectedPlayoutItemsForDevice,
	async function (deviceId: PeripheralDeviceId, token: string | undefined) {
		check(deviceId, String)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, this)

		const studioId = peripheralDevice.studioAndConfigId?.studioId
		if (!studioId) return null

		return ExpectedPlayoutItems.findWithCursor({ studioId })
	}
)
// Note: this publication is for dev purposes only:
meteorPublish(
	CorelibPubSub.ingestDataCache,
	async function (selector: MongoQuery<NrcsIngestDataCacheObj>, _token: string | undefined) {
		triggerWriteAccessBecauseNoCheckNecessary()

		if (!selector) throw new Meteor.Error(400, 'selector argument missing')
		const modifier: FindOptions<NrcsIngestDataCacheObj> = {
			projection: {},
		}

		return NrcsIngestDataCache.findWithCursor(selector, modifier)
	}
)
meteorPublish(
	CorelibPubSub.rundownBaselineAdLibPieces,
	async function (rundownIds: RundownId[], _token: string | undefined) {
		check(rundownIds, Array)

		triggerWriteAccessBecauseNoCheckNecessary()

		if (rundownIds.length === 0) return null

		const selector: MongoQuery<RundownBaselineAdLibItem> = {
			rundownId: { $in: rundownIds },
		}

		return RundownBaselineAdLibPieces.findWithCursor(selector, {
			projection: {
				timelineObjectsString: 0,
				privateData: 0,
			},
		})
	}
)

const adlibActionSubFields: MongoFieldSpecifierZeroes<AdLibAction> = {
	privateData: 0,
}

meteorPublish(CorelibPubSub.adLibActions, async function (rundownIds: RundownId[], _token: string | undefined) {
	check(rundownIds, Array)

	triggerWriteAccessBecauseNoCheckNecessary()

	if (rundownIds.length === 0) return null

	const selector: MongoQuery<AdLibAction> = {
		rundownId: { $in: rundownIds },
	}

	return AdLibActions.findWithCursor(selector, {
		projection: adlibActionSubFields,
	})
})
meteorPublish(MeteorPubSub.adLibActionsForPart, async function (partId: PartId, sourceLayerIds: string[]) {
	check(partId, String)
	check(sourceLayerIds, Array)

	triggerWriteAccessBecauseNoCheckNecessary()

	return AdLibActions.findWithCursor(
		{
			partId,
			'display.sourceLayerId': { $in: sourceLayerIds },
		},
		{
			projection: adlibActionSubFields,
		}
	)
})

meteorPublish(
	CorelibPubSub.rundownBaselineAdLibActions,
	async function (rundownIds: RundownId[], _token: string | undefined) {
		check(rundownIds, Array)

		triggerWriteAccessBecauseNoCheckNecessary()

		if (rundownIds.length === 0) return null

		const selector: MongoQuery<RundownBaselineAdLibAction> = {
			rundownId: { $in: rundownIds },
		}

		return RundownBaselineAdLibActions.findWithCursor(selector, {
			projection: adlibActionSubFields,
		})
	}
)
