import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevice, PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import {
	serializeTimelineBlob,
	TimelineComplete,
	TimelineCompleteGenerationVersions,
	TimelineObjGeneric,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { JobContext } from '../../jobs/index.js'
import { ReadonlyDeep } from 'type-fest'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { getCurrentTime } from '../../lib/index.js'
import { IS_PRODUCTION } from '../../environment.js'
import { logger } from '../../logging.js'
import { StudioPlayoutModel } from './StudioPlayoutModel.js'
import { DatabasePersistedModel } from '../../modelBase.js'
import { ExpectedPackageDBFromStudioBaselineObjects } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemStudio } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { StudioBaselineHelper } from './StudioBaselineHelper.js'

/**
 * This is a model used for studio operations.
 */
export class StudioPlayoutModelImpl implements StudioPlayoutModel {
	readonly #baselineHelper: StudioBaselineHelper
	#disposed = false

	public readonly isStudio = true

	public readonly peripheralDevices: ReadonlyDeep<PeripheralDevice[]>

	public readonly rundownPlaylists: ReadonlyDeep<DBRundownPlaylist[]>

	#timelineHasChanged = false
	#timeline: TimelineComplete | null

	public get timeline(): TimelineComplete | null {
		return this.#timeline
	}

	public constructor(
		protected readonly context: JobContext,
		peripheralDevices: ReadonlyDeep<PeripheralDevice[]>,
		rundownPlaylists: ReadonlyDeep<DBRundownPlaylist[]>,
		timeline: TimelineComplete | undefined
	) {
		context.trackCache(this)

		this.#baselineHelper = new StudioBaselineHelper(context)

		this.peripheralDevices = peripheralDevices

		this.rundownPlaylists = rundownPlaylists
		this.#timeline = timeline ?? null
	}

	public get displayName(): string {
		return `StudioPlayoutModel`
	}

	public getActiveRundownPlaylists(excludeRundownPlaylistId?: RundownPlaylistId): ReadonlyDeep<DBRundownPlaylist[]> {
		return this.rundownPlaylists.filter((p) => !!p.activationId && p._id !== excludeRundownPlaylistId)
	}

	#isMultiGatewayMode: boolean | undefined = undefined
	public get isMultiGatewayMode(): boolean {
		if (this.#isMultiGatewayMode === undefined) {
			if (this.context.studio.settings.forceMultiGatewayMode) {
				this.#isMultiGatewayMode = true
			} else {
				const playoutDevices = this.peripheralDevices.filter(
					(device) => device.type === PeripheralDeviceType.PLAYOUT
				)
				this.#isMultiGatewayMode = playoutDevices.length > 1
			}
		}
		return this.#isMultiGatewayMode
	}

	setExpectedPackagesForStudioBaseline(packages: ExpectedPackageDBFromStudioBaselineObjects[]): void {
		this.#baselineHelper.setExpectedPackages(packages)
	}
	setExpectedPlayoutItemsForStudioBaseline(playoutItems: ExpectedPlayoutItemStudio[]): void {
		this.#baselineHelper.setExpectedPlayoutItems(playoutItems)
	}

	setTimeline(
		timelineObjs: TimelineObjGeneric[],
		generationVersions: TimelineCompleteGenerationVersions,
		regenerateTimelineToken: string | undefined
	): ReadonlyDeep<TimelineComplete> {
		this.#timeline = {
			_id: this.context.studioId,
			timelineHash: getRandomId(),
			generated: getCurrentTime(),
			timelineBlob: serializeTimelineBlob(timelineObjs),
			generationVersions: generationVersions,
			regenerateTimelineToken: regenerateTimelineToken,
		}
		this.#timelineHasChanged = true

		return this.#timeline
	}

	switchRouteSet(routeSetId: string, isActive: boolean | 'toggle'): boolean {
		return this.context.setRouteSetActive(routeSetId, isActive)
	}

	/**
	 * Discards all documents in this model, and marks it as unusable
	 */
	dispose(): void {
		this.#disposed = true
	}

	async saveAllToDatabase(): Promise<void> {
		if (this.#disposed) {
			throw new Error('Cannot save disposed PlayoutModel')
		}

		const span = this.context.startSpan('StudioPlayoutModelImpl.saveAllToDatabase')

		// Prioritise the timeline for publication reasons
		if (this.#timelineHasChanged && this.#timeline) {
			await this.context.directCollections.Timelines.replace(this.#timeline)
		}
		this.#timelineHasChanged = false

		await Promise.all([
			this.#baselineHelper.saveAllToDatabase(),
			this.context.saveRouteSetChanges(),
			//
		])

		if (span) span.end()
	}

	/**
	 * Assert that no changes should have been made to the model, will throw an Error otherwise. This can be used in
	 * place of `saveAllToDatabase()`, when the code controlling the model expects no changes to have been made and any
	 * changes made are an error and will cause issues.
	 */
	assertNoChanges(): void {
		const span = this.context.startSpan('StudioPlayoutModelImpl.assertNoChanges')

		function logOrThrowError(error: Error) {
			if (!IS_PRODUCTION) {
				throw error
			} else {
				logger.error(error)
			}
		}

		if (this.#baselineHelper.hasChanges())
			logOrThrowError(
				new Error(
					`Failed no changes in model assertion, baseline ExpectedPackages or ExpectedPlayoutItems has changes`
				)
			)

		if (this.#timelineHasChanged)
			logOrThrowError(new Error(`Failed no changes in model assertion, Timeline has been changed`))

		if (span) span.end()
	}
}

/**
 * Load a StudioPlayoutModel for the current Studio
 * @param context Context from the job queue
 * @returns Loaded StudioPlayoutModel
 */
export async function loadStudioPlayoutModel(
	context: JobContext
): Promise<StudioPlayoutModel & DatabasePersistedModel> {
	const span = context.startSpan('loadStudioPlayoutModel')

	const studioId = context.studioId

	const collections = await Promise.all([
		context.directCollections.PeripheralDevices.findFetch({ 'studioAndConfigId.studioId': studioId }),
		context.directCollections.RundownPlaylists.findFetch({ studioId }),
		context.directCollections.Timelines.findOne(studioId),
	])

	const res = new StudioPlayoutModelImpl(context, ...collections)
	if (span) span.end()
	return res
}
