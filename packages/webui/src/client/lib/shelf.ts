import _ from 'underscore'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import {
	createPartCurrentTimes,
	processAndPrunePieceInstanceTimings,
} from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { getUnfinishedPieceInstancesReactive } from './rundownLayouts.js'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { PieceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstances } from '../collections/index.js'
import { ReadonlyDeep } from 'type-fest'
import { AdLibPieceUi } from '@sofie-automation/meteor-lib/dist/uiTypes/Adlib'
import { getCurrentTimeReactive } from './currentTimeReactive'

export type { AdLibPieceUi } from '@sofie-automation/meteor-lib/dist/uiTypes/Adlib'

export interface ShelfDisplayOptions {
	enableBuckets: boolean
	enableLayout: boolean
}

export interface AdlibSegmentUi extends DBSegment {
	/** Pieces belonging to this part */
	parts: Array<PartInstance>
	pieces: Array<AdLibPieceUi>
	isLive: boolean
	isNext: boolean
	isCompatibleShowStyle: boolean
}

export function getNextPiecesReactive(
	playlist: DBRundownPlaylist,
	showsStyleBase: UIShowStyleBase
): ReadonlyDeep<PieceInstance>[] {
	let prospectivePieceInstances: ReadonlyDeep<PieceInstance>[] = []
	if (playlist.activationId && playlist.nextPartInfo) {
		prospectivePieceInstances = PieceInstances.find({
			playlistActivationId: playlist.activationId,
			partInstanceId: playlist.nextPartInfo.partInstanceId,
			$and: [
				{
					piece: {
						$exists: true,
					},
				},
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
			],
		}).fetch()
	}

	const partTimes = createPartCurrentTimes(getCurrentTimeReactive(), null)
	prospectivePieceInstances = processAndPrunePieceInstanceTimings(
		showsStyleBase.sourceLayers,
		prospectivePieceInstances,
		partTimes
	)

	return prospectivePieceInstances
}

export function getUnfinishedPieceInstancesGrouped(
	playlist: DBRundownPlaylist,
	showStyleBase: UIShowStyleBase
): {
	unfinishedPieceInstances: ReadonlyDeep<PieceInstance>[]
	unfinishedAdLibIds: PieceId[]
	unfinishedTags: readonly string[]
} {
	const unfinishedPieceInstances = getUnfinishedPieceInstancesReactive(playlist, showStyleBase)

	const unfinishedAdLibIds: PieceId[] = unfinishedPieceInstances
		.filter((piece) => !!piece.adLibSourceId)
		.map((piece) => piece.adLibSourceId!)
	const unfinishedTags: string[] = _.uniq(
		unfinishedPieceInstances
			.filter((piece) => !!piece.piece.tags)
			.map((piece) => piece.piece.tags!)
			.reduce((a, b) => a.concat(b), [])
	)

	return {
		unfinishedPieceInstances,
		unfinishedAdLibIds,
		unfinishedTags,
	}
}

export function getNextPieceInstancesGrouped(
	playlist: DBRundownPlaylist,
	showsStyleBase: UIShowStyleBase
): { nextAdLibIds: PieceId[]; nextTags: readonly string[]; nextPieceInstances: ReadonlyDeep<PieceInstance>[] } {
	const nextPieceInstances = getNextPiecesReactive(playlist, showsStyleBase)

	const nextAdLibIds: PieceId[] = nextPieceInstances
		.filter((piece) => !!piece.adLibSourceId)
		.map((piece) => piece.adLibSourceId!)
	const nextTags = nextPieceInstances
		.filter((piece) => !!piece.piece.tags)
		.map((piece) => piece.piece.tags!)
		.reduce((a, b) => a.concat(b), [])

	return { nextAdLibIds, nextTags, nextPieceInstances }
}

export function isAdLibOnAir(
	unfinishedAdLibIds: PieceId[],
	unfinishedTags: readonly string[],
	adLib: AdLibPieceUi
): boolean {
	if (
		unfinishedAdLibIds.includes(adLib._id) ||
		(adLib.currentPieceTags &&
			adLib.currentPieceTags.length > 0 &&
			adLib.currentPieceTags.every((tag) => unfinishedTags.includes(tag)))
	) {
		return true
	}
	return false
}

export function isAdLibNext(nextAdLibIds: PieceId[], nextTags: readonly string[], adLib: AdLibPieceUi): boolean {
	if (
		nextAdLibIds.includes(adLib._id) ||
		(adLib.nextPieceTags &&
			adLib.nextPieceTags.length > 0 &&
			adLib.nextPieceTags.every((tag) => nextTags.includes(tag)))
	) {
		return true
	}
	return false
}

export function isAdLibDisplayedAsOnAir(
	unfinishedAdLibIds: PieceId[],
	unfinishedTags: readonly string[],
	adLib: AdLibPieceUi
): boolean {
	const isOnAir = isAdLibOnAir(unfinishedAdLibIds, unfinishedTags, adLib)
	return adLib.invertOnAirState ? !isOnAir : isOnAir
}
