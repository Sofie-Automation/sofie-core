import { z } from 'zod'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { MongoFieldSpecifierZeroes, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { check, zAnyArray } from '../lib/check'
import { FindOptions } from '@sofie-automation/meteor-lib/dist/collections/lib'
import {
	AdLibActions,
	AdLibPieces,
	ExpectedPlayoutItems,
	NrcsIngestDataCache,
	Pieces,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	Rundowns,
	Segments,
} from '../collections'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { NrcsIngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import {
	PartId,
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { PeripheralDevicePubSub } from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import { checkAccessAndGetPeripheralDevice } from '../security/check'
import type { PublicationRegistry } from '../publicationRegistry'
import { SofieError } from '@sofie-automation/corelib/dist/error'

const piecesSubFields: MongoFieldSpecifierZeroes<Piece> = {
	privateData: 0,
	timelineObjectsString: 0,
}

const adlibPiecesSubFields: MongoFieldSpecifierZeroes<AdLibPiece> = {
	privateData: 0,
	timelineObjectsString: 0,
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

			if (!selector) throw new SofieError(400, 'selector argument missing')
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
