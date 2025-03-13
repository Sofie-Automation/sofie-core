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

		const previousPartInstanceId = rundownPlaylist?.previousPartInfo?.partInstanceId
		const currentPartInstanceId = rundownPlaylist?.currentPartInfo?.partInstanceId
		const nextPartInstanceId = rundownPlaylist?.nextPartInfo?.partInstanceId

		const showStyleBase = cache.ShowStyleBases.findOne(showStyleBaseId)

		if (!showStyleBase) return false

		const resolvedSourceLayers = applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj

		const inPreviousPartInstance = previousPartInstanceId
			? this.processAndPrunePieceInstanceTimings(
					cache.PartInstances.findOne(previousPartInstanceId)?.timings,
					cache.PieceInstances.find({ partInstanceId: previousPartInstanceId }).fetch(),
					resolvedSourceLayers
				)
			: []
		const inCurrentPartInstance = currentPartInstanceId
			? this.processAndPrunePieceInstanceTimings(
					cache.PartInstances.findOne(currentPartInstanceId)?.timings,
					cache.PieceInstances.find({ partInstanceId: currentPartInstanceId }).fetch(),
					resolvedSourceLayers
				)
			: []
		const inNextPartInstance = nextPartInstanceId
			? this.processAndPrunePieceInstanceTimings(
					undefined,
					cache.PieceInstances.find({ partInstanceId: nextPartInstanceId }).fetch(),
					resolvedSourceLayers
				)
			: []

		const activePieceInstances = [...inPreviousPartInstance, ...inCurrentPartInstance].filter((pieceInstance) =>
			this.isPieceInstanceActive(pieceInstance, previousPartInstanceId, currentPartInstanceId)
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
		pieceInstances: Array<Pick<PieceInstance, PieceInstanceFields>>,
		sourceLayers: SourceLayers
	): PieceInstanceWithTimings[] {
		// Approximate when 'now' is in the PartInstance, so that any adlibbed Pieces will be timed roughly correctly
		const partStarted = partInstanceTimings?.plannedStartedPlayback

		return processAndPrunePieceInstanceTimings(
			sourceLayers,
			pieceInstances as PieceInstance[],
			createPartCurrentTimes(getCurrentTime(), partStarted),
			false,
			false
		)
	}

	private isPieceInstanceActive(
		pieceInstance: PieceInstanceWithTimings,
		previousPartInstanceId: PartInstanceId | undefined,
		currentPartInstanceId: PartInstanceId | undefined
	) {
		return (
			pieceInstance.reportedStoppedPlayback == null &&
			pieceInstance.piece.virtual !== true &&
			pieceInstance.disabled !== true &&
			(pieceInstance.partInstanceId === previousPartInstanceId || // a piece from previous part instance may be active during transition
				pieceInstance.partInstanceId === currentPartInstanceId) &&
			(pieceInstance.reportedStartedPlayback != null || // has been reported to have started by the Playout Gateway
				pieceInstance.plannedStartedPlayback != null || // a time to start playing has been set by Core
				(pieceInstance.partInstanceId === currentPartInstanceId && pieceInstance.piece.enable.start === 0) || // this is to speed things up immediately after a part instance is taken when not yet reported by the Playout Gateway
				pieceInstance.infinite?.fromPreviousPart) // infinites from previous part also are on air from the start of the current part
		)
	}
}
