import { z } from 'zod'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { check, zAnyArray } from '../lib/check'
import { FindOptions } from '@sofie-automation/meteor-lib/dist/collections/lib'
import { ExpectedPlayoutItems, NrcsIngestDataCache, Rundowns, Segments } from '../collections'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { NrcsIngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import {
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { PeripheralDevicePubSub } from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import { checkAccessAndGetPeripheralDevice } from '../security/check'
import type { PublicationRegistry } from '../publicationRegistry'
import { SofieError } from '@sofie-automation/corelib/dist/error'

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
}
