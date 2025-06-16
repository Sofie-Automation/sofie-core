import { Tracker } from 'meteor/tracker'
import { ReactiveVar } from 'meteor/reactive-var'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { getCurrentTime } from '../systemTime.js'
import { FindOptions } from '../../collections/lib.js'
import { RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ExternalMessageQueue, PeripheralDevices, Pieces, Rundowns } from '../../collections/index.js'
import { DBRundown, Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'

export namespace reactiveData {
	// export function getRRundownId (rundownId: RundownId): ReactiveVar<RundownId | undefined> {
	// 	const rVar = new ReactiveVar<RundownId | undefined>(undefined)
	// 	Tracker.autorun(() => {
	// 		const rObj = Rundowns.findOne(rundownId)
	// 		if (rObj) {
	// 			rVar.set(rObj._id)
	// 		} else {
	// 			rVar.set(undefined)
	// 		}
	// 	})

	// 	return rVar
	// }

	export function getRRundowns(
		playlistId: RundownPlaylistId | undefined,
		options?: FindOptions<DBRundown>
	): ReactiveVar<Rundown[]> {
		const rVar = new ReactiveVar<Rundown[]>([])

		Tracker.autorun(() => {
			if (playlistId) {
				const rundowns = Rundowns.find(
					{
						playlistId: playlistId,
					},
					options
				).fetch()
				rVar.set(rundowns)
			} else {
				rVar.set([])
			}
		})
		return rVar
	}

	// export function getRRundownStudioId (rundownId: RundownId): ReactiveVar<StudioId | undefined> {
	// 	const rVar = new ReactiveVar<StudioId | undefined>(undefined)
	// 	Tracker.autorun(() => {
	// 		const rObj = Rundowns.findOne(rundownId)
	// 		if (rObj) {
	// 			rVar.set(rObj.studioId)
	// 		} else {
	// 			rVar.set(undefined)
	// 		}
	// 	})

	// 	return rVar
	// }

	// export function getRRundownShowStyleBaseId (rundownId: RundownId): ReactiveVar<ShowStyleBaseId | undefined> {
	// 	const rVar = new ReactiveVar<ShowStyleBaseId | undefined>(undefined)
	// 	Tracker.autorun(() => {
	// 		const rObj = Rundowns.findOne(rundownId)
	// 		if (rObj) {
	// 			rVar.set(rObj.showStyleBaseId)
	// 		} else {
	// 			rVar.set(undefined)
	// 		}
	// 	})

	// 	return rVar
	// }

	// export function getRStudio (studioId: StudioId): ReactiveVar<Studio | undefined> {
	// 	const rVar = new ReactiveVar<Studio | undefined>(undefined, ReactiveDataHelper.simpleObjCompare)
	// 	Tracker.autorun(() => {
	// 		const studio = Studios.findOne(studioId)
	// 		rVar.set(studio)
	// 	})

	// 	return rVar
	// }

	// export function getRPieces (rundownIds: RundownId[]): ReactiveVar<Piece[]>
	// export function getRPieces (rundownId: RundownId): ReactiveVar<Piece[]>
	export function getRPieces(playlistId: RundownPlaylistId, options?: FindOptions<Piece>): ReactiveVar<Piece[]> {
		const rVar = new ReactiveVar<Piece[]>([])

		const rRundowns = getRRundowns(playlistId)
		Tracker.autorun(() => {
			const rundownIds = rRundowns.get().map((r) => r._id)
			const slis = Pieces.find(
				{
					startRundownId: { $in: rundownIds },
				},
				options
			).fetch()
			rVar.set(slis)
		})
		return rVar
	}

	// export function getRSourceLayer (showStyleBase: ShowStyleBase, sourceLayerId: string): ReactiveVar<ISourceLayer | undefined> {
	// 	const rVar = new ReactiveVar<ISourceLayer | undefined>(undefined, ReactiveDataHelper.simpleObjCompare)
	// 	Tracker.autorun(() => {
	// 		const sourceLayer = showStyleBase.sourceLayers.find((layer) => layer._id === sourceLayerId)
	// 		rVar.set(sourceLayer)
	// 	})
	// 	return rVar
	// }

	// export function getRMediaObject (mediaId: string): ReactiveVar<MediaObject | undefined> {
	// 	const rVar = new ReactiveVar<MediaObject | undefined>(undefined, ReactiveDataHelper.simpleObjCompare)
	// 	Tracker.autorun(() => {
	// 		const mediaObj = MediaObjects.findOne({ mediaId })
	// 		rVar.set(mediaObj)
	// 	})

	// 	return rVar
	// }

	export function getRPeripheralDevices(
		studioId: StudioId,
		options?: FindOptions<PeripheralDevice>
	): ReactiveVar<PeripheralDevice[]> {
		const rVar = new ReactiveVar<PeripheralDevice[]>([])

		Tracker.autorun(() => {
			const allDevices: PeripheralDevice[] = []
			const peripheralDevices = PeripheralDevices.find(
				{
					'studioAndConfigId.studioId': studioId,
					ignore: {
						$ne: true,
					},
				},
				options
			).fetch()
			allDevices.splice(allDevices.length, 0, ...peripheralDevices)
			peripheralDevices.forEach((i) => {
				const subDevices = PeripheralDevices.find({ parentDeviceId: i._id }, options).fetch()
				allDevices.splice(allDevices.length, 0, ...subDevices)
			})
			rVar.set(allDevices)
		})

		return rVar
	}

	export function getUnsentExternalMessageCount(
		studioId: StudioId,
		playlistId: RundownPlaylistId
	): ReactiveVar<number> {
		const rVar = new ReactiveVar<number>(0)

		Tracker.autorun(() => {
			const rundowns = Rundowns.find({ playlistId }).fetch()
			const now = getCurrentTime()
			const unsentMessages = ExternalMessageQueue.find(
				{
					expires: { $gt: now },
					studioId: { $eq: studioId },
					rundownId: { $in: rundowns.map((i) => i._id) },
					sent: { $not: { $gt: 0 } },
					tryCount: { $not: { $lt: 1 } },
				},
				{
					limit: 10,
				}
			).count()
			rVar.set(unsentMessages)
		})

		return rVar
	}
}
