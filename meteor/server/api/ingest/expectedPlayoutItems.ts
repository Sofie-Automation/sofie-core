import { Piece, PieceId } from '../../../lib/collections/Pieces'
import { check } from '../../../lib/check'
import { ExpectedPlayoutItem, ExpectedPlayoutItems } from '../../../lib/collections/ExpectedPlayoutItems'
import { ExpectedPlayoutItemGeneric } from '@sofie-automation/blueprints-integration'
import * as _ from 'underscore'
import { DBRundown, RundownId } from '../../../lib/collections/Rundowns'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { logger } from '../../logging'
import { PartId, DBPart } from '../../../lib/collections/Parts'
import { saveIntoDb, protectString, unprotectString } from '../../../lib/lib'
import { CacheForRundownPlaylist } from '../../DatabaseCaches'
import { getAllPiecesFromCache, getAllAdLibPiecesFromCache } from '../playout/lib'

interface ExpectedPlayoutItemGenericWithPiece extends ExpectedPlayoutItemGeneric {
	partId?: PartId
	pieceId: PieceId
}
function extractExpectedPlayoutItems(
	part: DBPart,
	pieces: Array<Piece | AdLibPiece>
): ExpectedPlayoutItemGenericWithPiece[] {
	let expectedPlayoutItemsGeneric: ExpectedPlayoutItemGenericWithPiece[] = []

	_.each(pieces, (piece) => {
		if (piece.expectedPlayoutItems) {
			_.each(piece.expectedPlayoutItems, (pieceItem) => {
				expectedPlayoutItemsGeneric.push({
					pieceId: piece._id,
					partId: part._id,
					...pieceItem,
				})
			})
		}
	})

	return expectedPlayoutItemsGeneric
}

function wrapExpectedPlayoutItems(
	rundown: DBRundown,
	items: ExpectedPlayoutItemGenericWithPiece[]
): ExpectedPlayoutItem[] {
	return items.map((item, i) => {
		return {
			_id: protectString(item.pieceId + '_' + i),
			studioId: rundown.studioId,
			rundownId: rundown._id,
			...item,
		}
	})
}

export function updateExpectedPlayoutItemsOnRundown(cache: CacheForRundownPlaylist, rundownId: RundownId): void {
	check(rundownId, String)

	const rundown = cache.Rundowns.findOne(rundownId)
	if (!rundown) {
		cache.deferAfterSave(() => {
			const removedItems = ExpectedPlayoutItems.remove({
				rundownId: rundownId,
			})
			logger.info(`Removed ${removedItems} expected playout items for deleted rundown "${rundownId}"`)
		})
		return
	}

	const intermediaryItems: ExpectedPlayoutItemGenericWithPiece[] = []

	const piecesStartingInThisRundown = cache.Pieces.findFetch({
		startRundownId: rundown._id,
	})
	const piecesGrouped = _.groupBy(piecesStartingInThisRundown, 'startPartId')

	const adlibPiecesInThisRundown = cache.AdLibPieces.findFetch({
		rundownId: rundown._id,
	})
	const adlibPiecesGrouped = _.groupBy(adlibPiecesInThisRundown, 'partId')

	for (const part of cache.Parts.findFetch({ rundownId: rundown._id })) {
		intermediaryItems.push(...extractExpectedPlayoutItems(part, piecesGrouped[unprotectString(part._id)] || []))
		intermediaryItems.push(
			...extractExpectedPlayoutItems(part, adlibPiecesGrouped[unprotectString(part._id)] || [])
		)
	}

	cache.deferAfterSave(() => {
		const expectedPlayoutItems = wrapExpectedPlayoutItems(rundown, intermediaryItems)

		saveIntoDb<ExpectedPlayoutItem, ExpectedPlayoutItem>(
			ExpectedPlayoutItems,
			{
				rundownId: rundownId,
			},
			expectedPlayoutItems
		)
	})
}
