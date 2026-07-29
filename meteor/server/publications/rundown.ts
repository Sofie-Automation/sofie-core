import { Meteor } from 'meteor/meteor'
import { z } from 'zod'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { MongoFieldSpecifierZeroes, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { check, zAnyArray } from '../lib/check'
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
import type { PublicationRegistry } from '../publicationRegistry'

const piecesSubFields: MongoFieldSpecifierZeroes<Piece> = {
	privateData: 0,
	timelineObjectsString: 0,
}

const adlibPiecesSubFields: MongoFieldSpecifierZeroes<AdLibPiece> = {
	privateData: 0,
	timelineObjectsString: 0,
}

const pieceInstanceFields: MongoFieldSpecifierZeroes<PieceInstance> = {
	// @ts-expect-error Mongo typings aren't clever enough yet
	'piece.privateData': 0,
	'piece.timelineObjectsString': 0,
}

const adlibActionSubFields: MongoFieldSpecifierZeroes<AdLibAction> = {
	privateData: 0,
}

export function registerRundownPublications(registry: PublicationRegistry): void {
	registry.publish(
		PeripheralDevicePubSub.rundownsForDevice,
		async (context, deviceId: PeripheralDeviceId, token: string | undefined) => {
			check(deviceId, z.string())
			check(token, z.string())

			// Future: this should be reactive to studioId changes, but this matches how the other *ForDevice publications behave

			const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, context)

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
						externalEventSubscriptions: 0,
					},
				}
			)
		}
	)

	registry.publish(
		CorelibPubSub.rundownsInPlaylists,
		async (_context, playlistIds: RundownPlaylistId[], _token: string | undefined) => {
			check(playlistIds, zAnyArray)

			triggerWriteAccessBecauseNoCheckNecessary()

			// If values were provided, they must have values
			if (playlistIds.length === 0) return null

			const selector: MongoQuery<DBRundown> = {
				playlistId: { $in: playlistIds },
			}

			const modifier: FindOptions<DBRundown> = {
				projection: {
					privateData: 0,
					externalEventSubscriptions: 0,
				},
			}

			return Rundowns.findWithCursor(selector, modifier)
		}
	)
	registry.publish(
		CorelibPubSub.rundownsWithShowStyleBases,
		async (_context, showStyleBaseIds: ShowStyleBaseId[], _token: string | undefined) => {
			check(showStyleBaseIds, zAnyArray)

			triggerWriteAccessBecauseNoCheckNecessary()

			if (showStyleBaseIds.length === 0) return null

			const selector: MongoQuery<DBRundown> = {
				showStyleBaseId: { $in: showStyleBaseIds },
			}

			const modifier: FindOptions<DBRundown> = {
				projection: {
					privateData: 0,
					externalEventSubscriptions: 0,
				},
			}

			return Rundowns.findWithCursor(selector, modifier)
		}
	)

	registry.publish(
		CorelibPubSub.segments,
		async (
			_context,
			rundownIds: RundownId[],
			filter: { omitHidden?: boolean } | undefined,
			_token: string | undefined
		) => {
			check(rundownIds, zAnyArray)

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

	registry.publish(
		CorelibPubSub.parts,
		async (_context, rundownIds: RundownId[], segmentIds: SegmentId[] | null, _token: string | undefined) => {
			check(rundownIds, zAnyArray)
			check(segmentIds, zAnyArray.nullish())

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
	registry.publish(
		CorelibPubSub.partInstances,
		async (
			_context,
			rundownIds: RundownId[],
			playlistActivationId: RundownPlaylistActivationId | null,
			_token: string | undefined
		) => {
			check(rundownIds, zAnyArray)
			check(playlistActivationId, z.string().nullish())

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
	registry.publish(
		CorelibPubSub.partInstancesSimple,
		async (
			_context,
			rundownIds: RundownId[],
			playlistActivationId: RundownPlaylistActivationId | null,
			_token: string | undefined
		) => {
			check(rundownIds, zAnyArray)
			check(playlistActivationId, z.string().nullish())

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

	registry.publish(
		CorelibPubSub.pieces,
		async (_context, rundownIds: RundownId[], partIds: PartId[] | null, _token: string | undefined) => {
			check(rundownIds, zAnyArray)
			check(partIds, zAnyArray.nullish())

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

	registry.publish(
		CorelibPubSub.piecesInfiniteStartingBefore,
		async (
			_context,
			thisRundownId: RundownId,
			segmentsIdsBefore: SegmentId[],
			rundownIdsBefore: RundownId[],
			_token: string | undefined
		) => {
			check(thisRundownId, z.string())

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

	registry.publish(
		CorelibPubSub.adLibPieces,
		async (_context, rundownIds: RundownId[], _token: string | undefined) => {
			check(rundownIds, zAnyArray)

			triggerWriteAccessBecauseNoCheckNecessary()

			if (rundownIds.length === 0) return null

			const selector: MongoQuery<AdLibPiece> = {
				rundownId: { $in: rundownIds },
			}

			return AdLibPieces.findWithCursor(selector, {
				projection: adlibPiecesSubFields,
			})
		}
	)
	registry.publish(MeteorPubSub.adLibPiecesForPart, async (_context, partId: PartId, sourceLayerIds: string[]) => {
		check(partId, z.string())
		check(sourceLayerIds, zAnyArray)

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

	registry.publish(
		CorelibPubSub.pieceInstances,
		async (
			_context,
			rundownIds: RundownId[],
			partInstanceIds: PartInstanceId[] | null,
			filter:
				| {
						onlyPlayingAdlibsOrWithTags?: boolean
				  }
				| undefined,
			_token: string | undefined
		) => {
			check(rundownIds, zAnyArray)
			check(partInstanceIds, zAnyArray.nullish())

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

	registry.publish(
		CorelibPubSub.pieceInstancesSimple,
		async (
			_context,
			rundownIds: RundownId[],
			playlistActivationId: RundownPlaylistActivationId | null,
			_token: string | undefined
		) => {
			check(rundownIds, zAnyArray)

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

	registry.publish(
		PeripheralDevicePubSub.expectedPlayoutItemsForDevice,
		async (context, deviceId: PeripheralDeviceId, token: string | undefined) => {
			check(deviceId, z.string())

			const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, context)

			const studioId = peripheralDevice.studioAndConfigId?.studioId
			if (!studioId) return null

			return ExpectedPlayoutItems.findWithCursor({ studioId })
		}
	)
	// Note: this publication is for dev purposes only:
	registry.publish(
		CorelibPubSub.ingestDataCache,
		async (_context, selector: MongoQuery<NrcsIngestDataCacheObj>, _token: string | undefined) => {
			triggerWriteAccessBecauseNoCheckNecessary()

			if (!selector) throw new Meteor.Error(400, 'selector argument missing')
			const modifier: FindOptions<NrcsIngestDataCacheObj> = {
				projection: {},
			}

			return NrcsIngestDataCache.findWithCursor(selector, modifier)
		}
	)
	registry.publish(
		CorelibPubSub.rundownBaselineAdLibPieces,
		async (_context, rundownIds: RundownId[], _token: string | undefined) => {
			check(rundownIds, zAnyArray)

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

	registry.publish(
		CorelibPubSub.adLibActions,
		async (_context, rundownIds: RundownId[], _token: string | undefined) => {
			check(rundownIds, zAnyArray)

			triggerWriteAccessBecauseNoCheckNecessary()

			if (rundownIds.length === 0) return null

			const selector: MongoQuery<AdLibAction> = {
				rundownId: { $in: rundownIds },
			}

			return AdLibActions.findWithCursor(selector, {
				projection: adlibActionSubFields,
			})
		}
	)
	registry.publish(MeteorPubSub.adLibActionsForPart, async (_context, partId: PartId, sourceLayerIds: string[]) => {
		check(partId, z.string())
		check(sourceLayerIds, zAnyArray)

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

	registry.publish(
		CorelibPubSub.rundownBaselineAdLibActions,
		async (_context, rundownIds: RundownId[], _token: string | undefined) => {
			check(rundownIds, zAnyArray)

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
}
