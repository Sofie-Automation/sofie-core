import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import {
	ExpectedPlayoutItemRundown,
	ExpectedPlayoutItemStudio,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { StudioId, RundownId, PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { clone, getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PlayoutModel } from '../playout/model/PlayoutModel.js'
import { StudioPlayoutModel } from '../studio/model/StudioPlayoutModel.js'
import { BlueprintResultBaseline, ExpectedPlayoutItemGeneric } from '@sofie-automation/blueprints-integration'
import { JobContext } from '../jobs/index.js'
import { IngestModel } from './model/IngestModel.js'
import { ReadonlyDeep } from 'type-fest'
import { IngestPartModel } from './model/IngestPartModel.js'

function extractExpectedPlayoutItems(
	studioId: StudioId,
	rundownId: RundownId,
	partId: PartId | undefined,
	piece: ReadonlyDeep<Piece | AdLibPiece | AdLibAction | RundownBaselineAdLibAction>
): ExpectedPlayoutItemRundown[] {
	const expectedPlayoutItemsGeneric: ExpectedPlayoutItemRundown[] = []

	if (piece.expectedPlayoutItems) {
		piece.expectedPlayoutItems.forEach((pieceItem, i) => {
			expectedPlayoutItemsGeneric.push({
				...clone<ExpectedPlayoutItemGeneric>(pieceItem),
				_id: protectString(piece._id + '_' + i),
				studioId: studioId,
				rundownId: rundownId,
				// pieceId: piece._id,
				partId: partId,
			})
		})
	}

	return expectedPlayoutItemsGeneric
}

export async function updateExpectedPlayoutItemsForRundownBaseline(
	context: JobContext,
	ingestModel: IngestModel,
	baseline: BlueprintResultBaseline | undefined
): Promise<void> {
	const studioId = context.studio._id
	const rundownId = ingestModel.rundownId

	// It isn't great to have to load these unnecessarily, but expectedPackages will resolve this
	const [baselineAdlibPieces, baselineAdlibActions] = await Promise.all([
		ingestModel.rundownBaselineAdLibPieces.get(),
		ingestModel.rundownBaselineAdLibActions.get(),
	])

	const baselineExpectedPlayoutItems: ExpectedPlayoutItemRundown[] = []
	for (const piece of baselineAdlibPieces) {
		baselineExpectedPlayoutItems.push(...extractExpectedPlayoutItems(studioId, rundownId, undefined, piece))
	}
	for (const action of baselineAdlibActions) {
		baselineExpectedPlayoutItems.push(...extractExpectedPlayoutItems(studioId, rundownId, undefined, action))
	}
	for (const piece of ingestModel.getGlobalPieces()) {
		baselineExpectedPlayoutItems.push(...extractExpectedPlayoutItems(studioId, rundownId, undefined, piece))
	}

	if (baseline) {
		for (const item of baseline.expectedPlayoutItems ?? []) {
			baselineExpectedPlayoutItems.push(
				literal<ExpectedPlayoutItemRundown>({
					...item,
					_id: getRandomId(),
					studioId: context.studio._id,
					rundownId: ingestModel.rundownId,
					baseline: 'rundown',
				})
			)
		}
	} else {
		// Preserve anything existing
		for (const expectedPlayoutItem of ingestModel.expectedPlayoutItemsForRundownBaseline) {
			if (expectedPlayoutItem.baseline === 'rundown') {
				baselineExpectedPlayoutItems.push(clone<ExpectedPlayoutItemRundown>(expectedPlayoutItem))
			}
		}
	}

	ingestModel.setExpectedPlayoutItemsForRundownBaseline(baselineExpectedPlayoutItems)
}

export function updateExpectedPlayoutItemsForPartModel(context: JobContext, part: IngestPartModel): void {
	const studioId = context.studio._id

	const expectedPlayoutItems: ExpectedPlayoutItemRundown[] = []
	for (const piece of part.pieces) {
		expectedPlayoutItems.push(
			...extractExpectedPlayoutItems(studioId, part.part.rundownId, piece.startPartId ?? undefined, piece)
		)
	}
	for (const piece of part.adLibPieces) {
		expectedPlayoutItems.push(...extractExpectedPlayoutItems(studioId, part.part.rundownId, piece.partId, piece))
	}
	for (const action of part.adLibActions) {
		expectedPlayoutItems.push(...extractExpectedPlayoutItems(studioId, part.part.rundownId, action.partId, action))
	}

	part.setExpectedPlayoutItems(expectedPlayoutItems)
}

export function updateBaselineExpectedPlayoutItemsOnStudio(
	context: JobContext,
	playoutModel: StudioPlayoutModel | PlayoutModel,
	items: ExpectedPlayoutItemGeneric[]
): void {
	playoutModel.setExpectedPlayoutItemsForStudioBaseline(
		items.map((item): ExpectedPlayoutItemStudio => {
			return {
				...item,
				_id: getRandomId(),
				studioId: context.studio._id,
				baseline: 'studio',
			}
		})
	)
}
