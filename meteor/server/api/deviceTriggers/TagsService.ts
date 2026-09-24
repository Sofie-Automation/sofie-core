import { PartInstanceId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { PieceInstanceFields, ContentCache } from './reactiveContentCacheForPieceInstances'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import {
	createPartCurrentTimes,
	PieceInstanceWithTimings,
	processAndPrunePieceInstanceTimings,
} from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { IWrappedAdLib } from '@sofie-automation/meteor-lib/dist/triggers/actionFilterChainCompilers'
import { areSetsEqual, doSetsIntersect } from '@sofie-automation/corelib/dist/lib'
import { getCurrentTime } from '../../lib/lib'
import { isValidForBranding } from '@sofie-automation/corelib/dist/playout/branding'

export class TagsService {
	protected onAirPiecesTags: Set<string> = new Set()
	protected nextPiecesTags: Set<string> = new Set()

	protected tagsObservedByTriggers: Set<string> = new Set()

	public clearObservedTags(): void {
		this.tagsObservedByTriggers.clear()
	}

	public observeTallyTags(adLib: IWrappedAdLib): void {
		if ('currentPieceTags' in adLib && adLib.currentPieceTags) {
			adLib.currentPieceTags.forEach((tag) => {
				this.tagsObservedByTriggers.add(tag)
			})
		}
	}

	public getTallyStateFromTags(adLib: IWrappedAdLib): { isActive: boolean; isNext: boolean } {
		let isActive = false
		let isNext = false
		if ('currentPieceTags' in adLib && adLib.currentPieceTags) {
			isActive = adLib.currentPieceTags.every((tag) => this.onAirPiecesTags.has(tag))
			isNext = adLib.currentPieceTags.every((tag) => this.nextPiecesTags.has(tag))
		}
		return { isActive, isNext }
	}

	/**
	 * @param cache
	 * @param showStyleBaseId
	 * @returns whether triggers should be updated
	 */
	public updatePieceInstances(cache: ContentCache, showStyleBaseId: ShowStyleBaseId): boolean {
		const rundownPlaylist = cache.RundownPlaylists.findOne({
			activationId: {
				$exists: true,
			},
		})
		if (!rundownPlaylist) {
			return false
		}

		const previousPartInstanceIds = (rundownPlaylist?.previousPartsInfo ?? []).map((info) => info.partInstanceId)
		const currentPartInstanceId = rundownPlaylist?.currentPartInfo?.partInstanceId
		const nextPartInstanceId = rundownPlaylist?.nextPartInfo?.partInstanceId

		const showStyleBase = cache.ShowStyleBases.findOne(showStyleBaseId)

		if (!showStyleBase) return false

		const resolvedSourceLayers = applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj

		const inPreviousPartInstances = previousPartInstanceIds.flatMap((previousPartInstanceId) => {
			const partInstance = cache.PartInstances.findOne(previousPartInstanceId)
			return this.processAndPrunePieceInstanceTimings(
				partInstance?.timings,
				partInstance?.brandingId ?? null,
				cache.PieceInstances.findFetch({ partInstanceId: previousPartInstanceId }),
				resolvedSourceLayers
			)
		})
		const currentPartInstance = currentPartInstanceId
			? cache.PartInstances.findOne(currentPartInstanceId)
			: undefined
		const inCurrentPartInstance = currentPartInstanceId
			? this.processAndPrunePieceInstanceTimings(
					currentPartInstance?.timings,
					currentPartInstance?.brandingId ?? null,
					cache.PieceInstances.findFetch({ partInstanceId: currentPartInstanceId }),
					resolvedSourceLayers
				)
			: []
		const inNextPartInstance = nextPartInstanceId
			? this.processAndPrunePieceInstanceTimings(
					undefined,
					cache.PartInstances.findOne(nextPartInstanceId)?.brandingId ?? null,
					cache.PieceInstances.findFetch({ partInstanceId: nextPartInstanceId }),
					resolvedSourceLayers
				)
			: []

		const previousPartInstanceIdSet = new Set(previousPartInstanceIds)
		const activePieceInstances = [...inPreviousPartInstances, ...inCurrentPartInstance].filter((pieceInstance) =>
			this.isPieceInstanceActive(pieceInstance, previousPartInstanceIdSet, currentPartInstanceId)
		)

		const activePieceInstancesTags = new Set<string>()
		activePieceInstances.forEach((pieceInstance) => {
			pieceInstance.piece.tags?.forEach((tag) => {
				activePieceInstancesTags.add(tag)
			})
		})

		const nextPieceInstancesTags = new Set<string>()
		inNextPartInstance.forEach((pieceInstance) => {
			pieceInstance.piece.tags?.forEach((tag) => {
				nextPieceInstancesTags.add(tag)
			})
		})

		const shouldUpdateTriggers = this.shouldUpdateTriggers(activePieceInstancesTags, nextPieceInstancesTags)

		this.onAirPiecesTags = activePieceInstancesTags
		this.nextPiecesTags = nextPieceInstancesTags

		return shouldUpdateTriggers
	}

	private shouldUpdateTriggers(activePieceInstancesTags: Set<string>, nextPieceInstancesTags: Set<string>) {
		return (
			(!areSetsEqual(this.onAirPiecesTags, activePieceInstancesTags) ||
				!areSetsEqual(this.nextPiecesTags, nextPieceInstancesTags)) &&
			(doSetsIntersect(activePieceInstancesTags, this.tagsObservedByTriggers) ||
				doSetsIntersect(nextPieceInstancesTags, this.tagsObservedByTriggers) ||
				doSetsIntersect(this.onAirPiecesTags, this.tagsObservedByTriggers) ||
				doSetsIntersect(this.nextPiecesTags, this.tagsObservedByTriggers))
		)
	}

	private processAndPrunePieceInstanceTimings(
		partInstanceTimings: DBPartInstance['timings'] | undefined,
		brandingId: string | null,
		pieceInstances: Array<Pick<PieceInstance, PieceInstanceFields>>,
		sourceLayers: SourceLayers
	): PieceInstanceWithTimings[] {
		// Approximate when 'now' is in the PartInstance, so that any adlibbed Pieces will be timed roughly correctly
		const partStarted = partInstanceTimings?.plannedStartedPlayback

		// A Piece the Branding hides is not on air, so it must contribute no tally tags.
		//
		// Note: filtered, but deliberately not resolved. The tally matches an AdLib's `currentPieceTags`
		// against these Pieces' `tags`, and `currentPieceTags` is not brandable — so applying the Branding to
		// only one side of that comparison would break the tally whenever a Branding renamed a Piece's tags.
		const playingPieceInstances = pieceInstances.filter((p) => isValidForBranding(p.piece, brandingId))

		return processAndPrunePieceInstanceTimings(
			sourceLayers,
			playingPieceInstances as PieceInstance[],
			createPartCurrentTimes(getCurrentTime(), partStarted),
			false,
			false
		)
	}

	private isPieceInstanceActive(
		pieceInstance: PieceInstanceWithTimings,
		previousPartInstanceIds: Set<PartInstanceId>,
		currentPartInstanceId: PartInstanceId | undefined
	) {
		return (
			pieceInstance.reportedStoppedPlayback == null &&
			pieceInstance.piece.virtual !== true &&
			pieceInstance.disabled !== true &&
			(previousPartInstanceIds.has(pieceInstance.partInstanceId) || // a piece from a previous part instance may be active during transition/overlap
				pieceInstance.partInstanceId === currentPartInstanceId) &&
			(pieceInstance.reportedStartedPlayback != null || // has been reported to have started by the Playout Gateway
				pieceInstance.plannedStartedPlayback != null || // a time to start playing has been set by Core
				(pieceInstance.partInstanceId === currentPartInstanceId && pieceInstance.piece.enable.start === 0) || // this is to speed things up immediately after a part instance is taken when not yet reported by the Playout Gateway
				pieceInstance.infinite?.fromPreviousPart) // infinites from previous part also are on air from the start of the current part
		)
	}
}
