import { BucketAdLibActionId, BucketAdLibId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { UIBucketContentStatus } from '@sofie-automation/meteor-lib/dist/api/rundownNotifications'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { CustomPublishCollection } from '../../../lib/customPublication'
import { BucketContentCache } from './bucketContentCache'
import { PieceDependencies } from '../common'
import { wrapTranslatableMessageFromBlueprintsIfNotString } from '@sofie-automation/corelib/dist/TranslatableMessage'
import {
	checkPieceContentStatusAndDependencies,
	PieceContentStatusPiece,
	PieceContentStatusStudio,
} from '../checkPieceContentStatus'
import type { PieceContentStatusMessageFactory } from '../messageFactory'

/**
 * Regenerating the status for the provided AdLibActionId
 * Note: This will do many calls to the database
 */
export async function regenerateForBucketAdLibIds(
	contentCache: ReadonlyDeep<BucketContentCache>,
	uiStudio: PieceContentStatusStudio,
	dependenciesState: Map<BucketAdLibId, PieceDependencies>,
	messageFactories: Map<ShowStyleBaseId, PieceContentStatusMessageFactory>,
	collection: CustomPublishCollection<UIBucketContentStatus>,
	regenerateIds: Set<BucketAdLibId>
): Promise<void> {
	const deletedActionIds = new Set<BucketAdLibId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const adlibId of regenerateIds) {
		dependenciesState.delete(adlibId)

		const actionDoc = contentCache.BucketAdLibs.findOne(adlibId)
		if (!actionDoc) {
			// Piece has been deleted, queue it for batching
			deletedActionIds.add(adlibId)
		} else {
			// Regenerate piece

			const sourceLayer = contentCache.ShowStyleSourceLayers.findOne(actionDoc.showStyleBaseId)?.sourceLayers?.[
				actionDoc.sourceLayerId
			]

			// Only if this piece is valid
			if (sourceLayer) {
				const [status, itemDependencies] = await checkPieceContentStatusAndDependencies(
					uiStudio,
					actionDoc.bucketId,
					messageFactories.get(actionDoc.showStyleBaseId),
					actionDoc,
					sourceLayer
				)

				dependenciesState.set(adlibId, itemDependencies)

				collection.replace({
					_id: protectString(`bucket_adlib_${adlibId}`),

					bucketId: actionDoc.bucketId,
					docId: adlibId,

					name: actionDoc.name,

					status: status,
				})
			} else {
				deletedActionIds.add(adlibId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedActionIds.has(doc.docId as BucketAdLibId))
}

/**
 * Regenerating the status for the provided AdLibActionId
 * Note: This will do many calls to the database
 */
export async function regenerateForBucketActionIds(
	contentCache: ReadonlyDeep<BucketContentCache>,
	uiStudio: PieceContentStatusStudio,
	dependenciesState: Map<BucketAdLibActionId, PieceDependencies>,
	messageFactories: Map<ShowStyleBaseId, PieceContentStatusMessageFactory>,
	collection: CustomPublishCollection<UIBucketContentStatus>,
	regenerateIds: Set<BucketAdLibActionId>
): Promise<void> {
	const deletedActionIds = new Set<BucketAdLibActionId>()

	// Apply the updates to the Pieces
	// Future: this could be done with some limited concurrency. It will need to balance performance of the updates and not interfering with other tasks
	for (const actionId of regenerateIds) {
		dependenciesState.delete(actionId)

		const actionDoc = contentCache.BucketAdLibActions.findOne(actionId)
		if (!actionDoc) {
			// Piece has been deleted, queue it for batching
			deletedActionIds.add(actionId)
		} else {
			// Regenerate piece

			const showStyleBase = contentCache.ShowStyleSourceLayers.findOne(actionDoc.showStyleBaseId)

			const sourceLayer =
				'sourceLayerId' in actionDoc.display && showStyleBase?.sourceLayers?.[actionDoc.display.sourceLayerId]

			// Only if this piece is valid
			if (sourceLayer) {
				const fakedPiece = literal<PieceContentStatusPiece>({
					_id: protectString(`${actionDoc._id}`),
					content: 'content' in actionDoc.display ? actionDoc.display.content : {},
					name:
						typeof actionDoc.display.label === 'string'
							? actionDoc.display.label
							: actionDoc.display.label.key,
					expectedPackages: actionDoc.expectedPackages,
				})

				const [status, itemDependencies] = await checkPieceContentStatusAndDependencies(
					uiStudio,
					actionDoc.bucketId,
					messageFactories.get(actionDoc.showStyleBaseId),
					fakedPiece,
					sourceLayer
				)

				dependenciesState.set(actionId, itemDependencies)

				collection.replace({
					_id: protectString(`bucket_action_${actionId}`),

					bucketId: actionDoc.bucketId,
					docId: actionId,

					name: wrapTranslatableMessageFromBlueprintsIfNotString(
						actionDoc.display.label,
						showStyleBase ? [showStyleBase.blueprintId] : []
					),

					status: status,
				})
			} else {
				deletedActionIds.add(actionId)
			}
		}
	}

	// Process any piece deletions
	collection.remove((doc) => deletedActionIds.has(doc.docId as BucketAdLibActionId))
}
