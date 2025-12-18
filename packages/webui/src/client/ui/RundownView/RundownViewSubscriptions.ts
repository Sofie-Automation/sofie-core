import {
	useSubscriptionIfEnabled,
	useSubscriptionIfEnabledReadyOnce,
	useSubscriptions,
	useTracker,
} from '../../lib/ReactMeteorData/react-meteor-data'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { meteorSubscribe } from '../../lib/meteorApi'
import { PartInstanceId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylists, Rundowns } from '../../collections'
import { RundownPlaylistCollectionUtil } from '../../collections/rundownPlaylistUtil'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { useRundownAndShowStyleIdsForPlaylist } from '../util/useRundownAndShowStyleIdsForPlaylist'

export function useRundownViewSubscriptions(playlistId: RundownPlaylistId): boolean {
	const requiredSubsReady: boolean[] = []
	const auxSubsReady: boolean[] = []
	requiredSubsReady.push(useSubscriptionIfEnabled(CorelibPubSub.rundownPlaylists, true, [playlistId], null))
	requiredSubsReady.push(useSubscriptionIfEnabled(CorelibPubSub.rundownsInPlaylists, true, [playlistId]))

	const playlistStudioId = useTracker(() => {
		const playlist = RundownPlaylists.findOne(playlistId, {
			fields: {
				_id: 1,
				studioId: 1,
			},
		}) as Pick<DBRundownPlaylist, '_id' | 'studioId'> | undefined

		return playlist?.studioId
	}, [playlistId])
	// Load only when the studio is known
	requiredSubsReady.push(
		useSubscriptionIfEnabled(MeteorPubSub.uiStudio, !!playlistStudioId, playlistStudioId ?? protectString(''))
	)
	auxSubsReady.push(
		useSubscriptionIfEnabled(CorelibPubSub.buckets, !!playlistStudioId, playlistStudioId ?? protectString(''), null)
	)

	const playlistActivationId = useTracker(() => {
		const playlist = RundownPlaylists.findOne(playlistId, {
			fields: {
				_id: 1,
				activationId: 1,
			},
		}) as Pick<DBRundownPlaylist, '_id' | 'activationId'> | undefined

		return playlist?.activationId
	}, [playlistId])

	const { rundownIds, showStyleBaseIds, showStyleVariantIds } = useRundownAndShowStyleIdsForPlaylist(playlistId)

	requiredSubsReady.push(
		useSubscriptions(
			MeteorPubSub.uiShowStyleBase,
			showStyleBaseIds.map((id) => [id])
		)
	)
	requiredSubsReady.push(
		useSubscriptionIfEnabledReadyOnce(
			CorelibPubSub.showStyleVariants,
			showStyleVariantIds.length > 0,
			null,
			showStyleVariantIds
		)
	)
	auxSubsReady.push(
		useSubscriptionIfEnabled(MeteorPubSub.rundownLayouts, showStyleBaseIds.length > 0, showStyleBaseIds)
	)

	auxSubsReady.push(useSubscriptionIfEnabled(CorelibPubSub.segments, rundownIds.length > 0, rundownIds, {}))
	auxSubsReady.push(useSubscriptionIfEnabled(CorelibPubSub.adLibPieces, rundownIds.length > 0, rundownIds))
	auxSubsReady.push(
		useSubscriptionIfEnabled(CorelibPubSub.rundownBaselineAdLibPieces, rundownIds.length > 0, rundownIds)
	)
	auxSubsReady.push(useSubscriptionIfEnabled(CorelibPubSub.adLibActions, rundownIds.length > 0, rundownIds))
	auxSubsReady.push(
		useSubscriptionIfEnabled(CorelibPubSub.rundownBaselineAdLibActions, rundownIds.length > 0, rundownIds)
	)
	auxSubsReady.push(useSubscriptionIfEnabled(MeteorPubSub.uiParts, rundownIds.length > 0, playlistId))
	auxSubsReady.push(
		useSubscriptionIfEnabled(MeteorPubSub.uiPartInstances, !!playlistActivationId, playlistActivationId ?? null)
	)

	// Load once the playlist is confirmed to exist
	auxSubsReady.push(useSubscriptionIfEnabled(MeteorPubSub.uiSegmentPartNotes, !!playlistStudioId, playlistId))
	auxSubsReady.push(useSubscriptionIfEnabled(CorelibPubSub.uiPieceContentStatuses, !!playlistStudioId, playlistId))

	useTracker(() => {
		const playlist = RundownPlaylists.findOne(playlistId, {
			fields: {
				currentPartInfo: 1,
				nextPartInfo: 1,
				previousPartInfo: 1,
			},
		}) as Pick<DBRundownPlaylist, '_id' | 'currentPartInfo' | 'nextPartInfo' | 'previousPartInfo'> | undefined
		if (playlist) {
			const rundownIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)
			// Use meteorSubscribe so that this subscription doesn't mess with this.subscriptionsReady()
			// it's run in useTracker, so the subscription will be stopped along with the autorun,
			// so we don't have to manually clean up after ourselves.
			meteorSubscribe(
				CorelibPubSub.pieceInstances,
				rundownIds,
				[
					playlist.currentPartInfo?.partInstanceId,
					playlist.nextPartInfo?.partInstanceId,
					playlist.previousPartInfo?.partInstanceId,
				].filter((p): p is PartInstanceId => p !== null),
				{}
			)
		}
	}, [playlistId])

	auxSubsReady.push(
		useSubscriptionIfEnabled(
			CorelibPubSub.notificationsForRundownPlaylist,
			!!playlistId && !!playlistStudioId,
			playlistStudioId || protectString(''),
			playlistId
		)
	)

	useTracker(() => {
		const rundowns = Rundowns.find(
			{ playlistId },
			{
				fields: {
					_id: 1,
					studioId: 1,
				},
			}
		).fetch() as Pick<DBRundown, '_id' | 'studioId'>[]

		for (const rundown of rundowns) {
			meteorSubscribe(CorelibPubSub.notificationsForRundown, rundown.studioId, rundown._id)
		}
	}, [playlistId])

	return requiredSubsReady.findIndex((ready) => !ready) === -1
}
