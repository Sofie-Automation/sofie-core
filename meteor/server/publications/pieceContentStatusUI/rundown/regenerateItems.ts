import {
	AdLibActionId,
	BlueprintId,
	PieceId,
	PieceInstanceId,
	RundownBaselineAdLibActionId,
	RundownId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { UIPieceContentStatus } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { CustomPublishCollection } from '../../../lib/customPublication'
import { ContentCache } from './reactiveContentCache'
import { wrapTranslatableMessageFromBlueprintsIfNotString } from '@sofie-automation/corelib/dist/TranslatableMessage'
import {
	checkPieceContentStatusAndDependencies,
	PieceContentStatusPiece,
	PieceContentStatusStudio,
} from '../checkPieceContentStatus'
import type { PieceDependencies } from '../common'
import type { PieceContentStatusMessageFactory } from '../messageFactory'

async function regenerateGenericPiece(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: PieceContentStatusStudio,
	messageFactory: PieceContentStatusMessageFactory | undefined,
	pieceDoc: PieceContentStatusPiece,
	sourceLayerId: string | undefined,
	doc: Pick<Required<UIPieceContentStatus>, '_id' | 'partId' | 'pieceId' | 'rundownId' | 'name'>
): Promise<{
	dependencies: Omit<PieceDependencies, 'rundownId'>
	doc: UIPieceContentStatus
	blueprintId: BlueprintId
} | null> {
	// Regenerate piece
	const rundown = contentCache.Rundowns.findOne(doc.rundownId)
	const sourceLayersForRundown = rundown
		? contentCache.ShowStyleSourceLayers.findOne(rundown.showStyleBaseId)
		: undefined

	const part = doc.partId ? contentCache.Parts.findOne(doc.partId) : undefined
	const segment = part ? contentCache.Segments.findOne(part.segmentId) : undefined
	const sourceLayer = sourceLayerId && sourceLayersForRundown?.sourceLayers?.[sourceLayerId]

	if (part && segment && sourceLayer) {
		const [status, dependencies] = await checkPieceContentStatusAndDependencies(
			uiStudio,
			messageFactory,
			pieceDoc,
			sourceLayer
		)

		return {
			dependencies,
			blueprintId: sourceLayersForRundown.blueprintId,
			doc: {
				...doc,

				segmentId: segment._id,

				segmentRank: segment._rank,
				partRank: part._rank,

				segmentName: segment.name,
				name: wrapTranslatableMessageFromBlueprintsIfNotString(doc.name, [sourceLayersForRundown.blueprintId]),

				isPieceInstance: false,

				status,
			},
		}
	} else {
		return null
	}
}

/**
 * Regenerating the status for the provided PieceIds
 * Note: This will do many calls to the database
 */
export async function regenerateForPieceIds(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: PieceContentStatusStudio,
	dependenciesState: Map<PieceId, PieceDependencies>,
	messageFactories: Map<RundownId, PieceContentStatusMessageFactory>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	regeneratePieceIds: Set<PieceId>
): Promise<void> {
	const deletedPieceIds = new Set<PieceId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const pieceId of regeneratePieceIds) {
		dependenciesState.delete(pieceId)

		const pieceDoc = contentCache.Pieces.findOne(pieceId)
		if (!pieceDoc) {
			// Piece has been deleted, queue it for batching
			deletedPieceIds.add(pieceId)
		} else {
			const res = await regenerateGenericPiece(
				contentCache,
				uiStudio,
				messageFactories.get(pieceDoc.startRundownId),
				pieceDoc,
				pieceDoc.sourceLayerId,
				{
					_id: protectString(`piece_${pieceId}`),

					partId: pieceDoc.startPartId ?? undefined,
					rundownId: pieceDoc.startRundownId,
					pieceId: pieceId,

					name: pieceDoc.name,
				}
			)

			if (res) {
				dependenciesState.set(pieceId, res.dependencies)

				collection.replace(res.doc)
			} else {
				deletedPieceIds.add(pieceId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedPieceIds.has(doc.pieceId as PieceId))
}

/**
 * Regenerating the status for the provided PieceIds
 * Note: This will do many calls to the database
 */
export async function regenerateForPieceInstanceIds(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: PieceContentStatusStudio,
	dependenciesState: Map<PieceInstanceId, PieceDependencies>,
	messageFactories: Map<RundownId, PieceContentStatusMessageFactory>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	regeneratePieceIds: Set<PieceInstanceId>
): Promise<void> {
	const deletedPieceIds = new Set<PieceInstanceId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const pieceId of regeneratePieceIds) {
		dependenciesState.delete(pieceId)

		const pieceDoc = contentCache.PieceInstances.findOne(pieceId)
		if (!pieceDoc) {
			// Piece has been deleted, queue it for batching
			deletedPieceIds.add(pieceId)
		} else {
			// Regenerate piece
			const rundown = contentCache.Rundowns.findOne(pieceDoc.rundownId)
			const sourceLayersForRundown = rundown
				? contentCache.ShowStyleSourceLayers.findOne(rundown.showStyleBaseId)
				: undefined

			const partInstance = pieceDoc.partInstanceId
				? contentCache.PartInstances.findOne(pieceDoc.partInstanceId)
				: undefined
			const segment = partInstance ? contentCache.Segments.findOne(partInstance.segmentId) : undefined
			const sourceLayer =
				pieceDoc.piece.sourceLayerId && sourceLayersForRundown?.sourceLayers?.[pieceDoc.piece.sourceLayerId]

			let previousPieceInstanceId: PieceInstanceId | undefined
			if (pieceDoc.infinite) {
				// Note: this is a temporary solution, until single packages can be owned by multiple PieceInstances
				// This shouldn't need to be reactive upon this PieceInstance, as this is filling a brief gap until package-manager catches up.
				// That assumption could be wrong, but trying to track this dependency will be messy so would be nice to avoid.
				const previousPieceInstance = contentCache.PieceInstances.findOne({
					'infinite.infiniteInstanceId': pieceDoc.infinite.infiniteInstanceId,
					'infinite.infiniteInstanceIndex': pieceDoc.infinite.infiniteInstanceIndex - 1,
				})
				previousPieceInstanceId = previousPieceInstance?._id
			}

			if (partInstance && segment && sourceLayer) {
				const [status, dependencies] = await checkPieceContentStatusAndDependencies(
					uiStudio,
					messageFactories.get(pieceDoc.rundownId),
					{
						...pieceDoc.piece,
						pieceInstanceId: pieceDoc._id,
						previousPieceInstanceId,
					},
					sourceLayer
				)

				const res: UIPieceContentStatus = {
					_id: protectString(`piece_${pieceId}`),

					partId: pieceDoc.piece.startPartId ?? undefined,
					rundownId: pieceDoc.rundownId,
					pieceId: pieceId,

					segmentId: segment._id,

					segmentRank: segment._rank,
					partRank: partInstance.part._rank,

					segmentName: segment.name,
					name: wrapTranslatableMessageFromBlueprintsIfNotString(pieceDoc.piece.name, [
						sourceLayersForRundown.blueprintId,
					]),

					isPieceInstance: true,

					status,
				}

				dependenciesState.set(pieceId, dependencies)

				collection.replace(res)
			} else {
				deletedPieceIds.add(pieceId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedPieceIds.has(doc.pieceId as PieceInstanceId))
}

/**
 * Regenerating the status for the provided PieceIds
 * Note: This will do many calls to the database
 */
export async function regenerateForAdLibPieceIds(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: PieceContentStatusStudio,
	dependenciesState: Map<PieceId, PieceDependencies>,
	messageFactories: Map<RundownId, PieceContentStatusMessageFactory>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	regenerateAdLibPieceIds: Set<PieceId>
): Promise<void> {
	const deletedPieceIds = new Set<PieceId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const pieceId of regenerateAdLibPieceIds) {
		dependenciesState.delete(pieceId)

		const pieceDoc = contentCache.AdLibPieces.findOne(pieceId)
		if (!pieceDoc || !pieceDoc.partId) {
			// Piece has been deleted, queue it for batching
			deletedPieceIds.add(pieceId)
		} else {
			const res = await regenerateGenericPiece(
				contentCache,
				uiStudio,
				messageFactories.get(pieceDoc.rundownId),
				pieceDoc,
				pieceDoc.sourceLayerId,
				{
					_id: protectString(`adlib_${pieceId}`),

					partId: pieceDoc.partId,
					rundownId: pieceDoc.rundownId,
					pieceId: pieceId,

					name: pieceDoc.name,
				}
			)

			if (res) {
				dependenciesState.set(pieceId, res.dependencies)

				collection.replace(res.doc)
			} else {
				deletedPieceIds.add(pieceId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedPieceIds.has(doc.pieceId as PieceId))
}

/**
 * Regenerating the status for the provided PieceIds
 * Note: This will do many calls to the database
 */
export async function regenerateForAdLibActionIds(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: PieceContentStatusStudio,
	dependenciesState: Map<AdLibActionId, PieceDependencies>,
	messageFactories: Map<RundownId, PieceContentStatusMessageFactory>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	regenerateActionIds: Set<AdLibActionId>
): Promise<void> {
	const deletedPieceIds = new Set<AdLibActionId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const pieceId of regenerateActionIds) {
		dependenciesState.delete(pieceId)

		const actionDoc = contentCache.AdLibActions.findOne(pieceId)
		if (!actionDoc || !actionDoc.partId) {
			// Piece has been deleted, queue it for batching
			deletedPieceIds.add(pieceId)
		} else {
			const fakedPiece = literal<PieceContentStatusPiece>({
				_id: protectString(`${actionDoc._id}`),
				content: 'content' in actionDoc.display ? actionDoc.display.content : {},
				name:
					typeof actionDoc.display.label === 'string' ? actionDoc.display.label : actionDoc.display.label.key,
				expectedPackages: actionDoc.expectedPackages,
			})

			const sourceLayerId = 'sourceLayerId' in actionDoc.display ? actionDoc.display.sourceLayerId : undefined

			const res = await regenerateGenericPiece(
				contentCache,
				uiStudio,
				messageFactories.get(actionDoc.rundownId),
				fakedPiece,
				sourceLayerId,
				{
					_id: protectString(`action_${pieceId}`),

					partId: actionDoc.partId,
					rundownId: actionDoc.rundownId,
					pieceId: pieceId,

					name: actionDoc.display.label,
				}
			)

			if (res) {
				dependenciesState.set(pieceId, res.dependencies)

				collection.replace(res.doc)
			} else {
				deletedPieceIds.add(pieceId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedPieceIds.has(doc.pieceId as AdLibActionId))
}

/**
 * Regenerating the status for the provided PieceIds
 * Note: This will do many calls to the database
 */
export async function regenerateForBaselineAdLibPieceIds(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: PieceContentStatusStudio,
	dependenciesState: Map<PieceId, PieceDependencies>,
	messageFactories: Map<RundownId, PieceContentStatusMessageFactory>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	regenerateAdLibPieceIds: Set<PieceId>
): Promise<void> {
	const deletedPieceIds = new Set<PieceId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const pieceId of regenerateAdLibPieceIds) {
		dependenciesState.delete(pieceId)

		const pieceDoc = contentCache.BaselineAdLibPieces.findOne(pieceId)
		if (!pieceDoc) {
			// Piece has been deleted, queue it for batching
			deletedPieceIds.add(pieceId)
		} else {
			// Regenerate piece
			const rundown = contentCache.Rundowns.findOne(pieceDoc.rundownId)
			const sourceLayersForRundown = rundown
				? contentCache.ShowStyleSourceLayers.findOne(rundown.showStyleBaseId)
				: undefined

			const sourceLayer = sourceLayersForRundown?.sourceLayers?.[pieceDoc.sourceLayerId]

			if (sourceLayer) {
				const [status, dependencies] = await checkPieceContentStatusAndDependencies(
					uiStudio,
					messageFactories.get(pieceDoc.rundownId),
					pieceDoc,
					sourceLayer
				)

				dependenciesState.set(pieceId, dependencies)

				collection.replace({
					_id: protectString(`baseline_adlib_${pieceId}`),

					partId: undefined,
					segmentId: undefined,
					rundownId: pieceDoc.rundownId,
					pieceId: pieceId,

					name: pieceDoc.name,
					segmentName: undefined,

					segmentRank: -1,
					partRank: -1,

					isPieceInstance: false,

					status,
				})
			} else {
				deletedPieceIds.add(pieceId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedPieceIds.has(doc.pieceId as PieceId))
}

/**
 * Regenerating the status for the provided PieceIds
 * Note: This will do many calls to the database
 */
export async function regenerateForBaselineAdLibActionIds(
	contentCache: ReadonlyDeep<ContentCache>,
	uiStudio: PieceContentStatusStudio,
	dependenciesState: Map<RundownBaselineAdLibActionId, PieceDependencies>,
	messageFactories: Map<RundownId, PieceContentStatusMessageFactory>,
	collection: CustomPublishCollection<UIPieceContentStatus>,
	regenerateActionIds: Set<RundownBaselineAdLibActionId>
): Promise<void> {
	const deletedPieceIds = new Set<RundownBaselineAdLibActionId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const pieceId of regenerateActionIds) {
		dependenciesState.delete(pieceId)

		const actionDoc = contentCache.BaselineAdLibActions.findOne(pieceId)
		if (!actionDoc || !actionDoc.partId) {
			// Piece has been deleted, queue it for batching
			deletedPieceIds.add(pieceId)
		} else {
			const fakedPiece = literal<PieceContentStatusPiece>({
				_id: protectString(`${actionDoc._id}`),
				content: 'content' in actionDoc.display ? actionDoc.display.content : {},
				name:
					typeof actionDoc.display.label === 'string' ? actionDoc.display.label : actionDoc.display.label.key,
				expectedPackages: actionDoc.expectedPackages,
			})

			const sourceLayerId = 'sourceLayerId' in actionDoc.display ? actionDoc.display.sourceLayerId : undefined

			// Regenerate piece
			const rundown = contentCache.Rundowns.findOne(actionDoc.rundownId)
			const sourceLayersForRundown = rundown
				? contentCache.ShowStyleSourceLayers.findOne(rundown.showStyleBaseId)
				: undefined

			const sourceLayer = sourceLayerId && sourceLayersForRundown?.sourceLayers?.[sourceLayerId]

			if (sourceLayer) {
				const [status, dependencies] = await checkPieceContentStatusAndDependencies(
					uiStudio,
					messageFactories.get(actionDoc.rundownId),
					fakedPiece,
					sourceLayer
				)

				dependenciesState.set(pieceId, dependencies)

				collection.replace({
					_id: protectString(`baseline_adlib_${pieceId}`),

					partId: undefined,
					segmentId: undefined,
					rundownId: actionDoc.rundownId,
					pieceId: pieceId,

					name: wrapTranslatableMessageFromBlueprintsIfNotString(actionDoc.display.label, [
						sourceLayersForRundown.blueprintId,
					]),
					segmentName: undefined,

					segmentRank: -1,
					partRank: -1,

					isPieceInstance: false,

					status,
				})
			} else {
				deletedPieceIds.add(pieceId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedPieceIds.has(doc.pieceId as RundownBaselineAdLibActionId))
}
