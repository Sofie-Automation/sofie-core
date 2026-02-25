import {
	BlueprintManifestType,
	BlueprintResultPart,
	BlueprintResultRundown,
	BlueprintResultSegment,
	ExtendedIngestRundown,
	IBlueprintActionManifest,
	IBlueprintAdLibPiece,
	IBlueprintPart,
	IBlueprintPiece,
	IBlueprintRundown,
	IBlueprintSegment,
	ISegmentUserContext,
	IShowStyleContext,
	IStudioSettings,
	IngestSegment,
	PlaylistTimingType,
	ShowStyleBlueprintManifest,
	StudioBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import {
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { EventsJobFunc } from '@sofie-automation/corelib/dist/worker/events'
import { IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { StudioJobFunc, StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { ReadonlyDeep } from 'type-fest'
import { WrappedShowStyleBlueprint, WrappedStudioBlueprint } from '../blueprints/cache.js'
import {
	ProcessedShowStyleConfig,
	ProcessedStudioConfig,
	preprocessShowStyleConfig,
	preprocessStudioConfig,
} from '../blueprints/config.js'
import { IDirectCollections } from '../db/index.js'
import {
	ApmSpan,
	JobContext,
	JobStudio,
	ProcessedShowStyleBase,
	ProcessedShowStyleCompound,
	ProcessedShowStyleVariant,
	QueueJobOptions,
} from '../jobs/index.js'
import { PlaylistLock, RundownLock } from '../jobs/lock.js'
import { BaseModel } from '../modelBase.js'
import { createShowStyleCompound } from '../showStyles.js'
import { IMockCollections, getMockCollections } from './collection.js'
// import _ from 'underscore'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { JSONBlobStringify } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { removeRundownPlaylistFromDb } from '../ingest/__tests__/lib.js'
import { processShowStyleBase, processShowStyleVariant } from '../jobs/showStyle.js'
import { defaultStudio } from './defaultCollectionObjects.js'
import { convertStudioToJobStudio } from '../jobs/studio.js'

export function setupDefaultJobEnvironment(
	studioId?: StudioId,
	studioSettings?: Partial<IStudioSettings>
): MockJobContext {
	const { mockCollections, jobCollections } = getMockCollections()

	// We don't bother 'saving' this to the db, as usually nothing will load it
	const studio: DBStudio = {
		...defaultStudio(studioId ?? protectString('mockStudio0')),
		name: 'mockStudio',
		_rundownVersionHash: 'asdf',
		blueprintId: protectString('studioBlueprint0'),
	}

	if (studioSettings) {
		studio.settingsWithOverrides = {
			...studio.settingsWithOverrides,
			defaults: {
				...studio.settingsWithOverrides.defaults,
				...studioSettings,
			},
		}
	}

	return new MockJobContext(jobCollections, mockCollections, studio)
}

export class MockJobContext implements JobContext {
	#jobCollections: Readonly<IDirectCollections>
	#mockCollections: Readonly<IMockCollections>
	#studio: ReadonlyDeep<DBStudio>
	#jobStudio: ReadonlyDeep<JobStudio>

	#studioBlueprint: ReadonlyDeep<StudioBlueprintManifest>
	#showStyleBlueprint: ReadonlyDeep<ShowStyleBlueprintManifest>

	constructor(
		jobCollections: Readonly<IDirectCollections>,
		mockCollections: Readonly<IMockCollections>,
		studio: ReadonlyDeep<DBStudio>
	) {
		this.#jobCollections = jobCollections
		this.#mockCollections = mockCollections
		this.#studio = studio
		this.#jobStudio = convertStudioToJobStudio(clone<DBStudio>(studio))

		this.#studioBlueprint = MockStudioBlueprint()
		this.#showStyleBlueprint = MockShowStyleBlueprint()
	}

	get directCollections(): Readonly<IDirectCollections> {
		return this.#jobCollections
	}

	get mockCollections(): Readonly<IMockCollections> {
		return this.#mockCollections
	}

	get studioId(): StudioId {
		return this.#studio._id
	}
	get studio(): ReadonlyDeep<JobStudio> {
		return this.#jobStudio
	}
	get rawStudio(): ReadonlyDeep<DBStudio> {
		return this.#studio
	}

	get studioBlueprint(): ReadonlyDeep<WrappedStudioBlueprint> {
		return {
			blueprintDoc: undefined,
			blueprintId: this.studio.blueprintId || protectString('fake'),
			blueprint: this.#studioBlueprint,
		}
	}

	get rawStudioBlueprint(): ReadonlyDeep<StudioBlueprintManifest> {
		return this.#studioBlueprint
	}

	get rawShowStyleBlueprint(): ReadonlyDeep<ShowStyleBlueprintManifest> {
		return this.#showStyleBlueprint
	}

	trackCache(_model: BaseModel): void {
		// TODO
		// throw new Error('Method not implemented.')
	}
	async lockPlaylist(playlistId: RundownPlaylistId): Promise<PlaylistLock> {
		return new MockPlaylistLock(playlistId)
	}
	async lockRundown(rundownId: RundownId): Promise<RundownLock> {
		return new MockRundownLock(rundownId)
	}

	startSpan(_name: string): ApmSpan | null {
		// no-op
		return null
	}

	async queueIngestJob<T extends keyof IngestJobFunc>(
		_name: T,
		_data: Parameters<IngestJobFunc[T]>[0]
	): Promise<void> {
		throw new Error('Method not implemented.')
	}
	async queueStudioJob<T extends keyof StudioJobFunc>(
		name: T,
		_data: Parameters<StudioJobFunc[T]>[0],
		_options?: QueueJobOptions
	): Promise<void> {
		// Silently ignore the cleanup job - it's a background task that doesn't need to run in tests
		if (name === StudioJobs.CleanupOrphanedExpectedPackageReferences) {
			return
		}
		throw new Error('Method not implemented.')
	}
	async queueEventJob<T extends keyof EventsJobFunc>(
		_name: T,
		_data: Parameters<EventsJobFunc[T]>[0]
	): Promise<void> {
		throw new Error('Method not implemented.')
	}

	getStudioBlueprintConfig(): ProcessedStudioConfig {
		return preprocessStudioConfig(this.studio, this.#studioBlueprint)
	}
	async getShowStyleBases(): Promise<ReadonlyDeep<Array<ProcessedShowStyleBase>>> {
		const docs = await this.directCollections.ShowStyleBases.findFetch(undefined)

		return docs.map(processShowStyleBase)
	}
	async getShowStyleBase(id: ShowStyleBaseId): Promise<ReadonlyDeep<ProcessedShowStyleBase>> {
		const doc = await this.directCollections.ShowStyleBases.findOne(id)
		if (!doc) throw new Error(`ShowStyleBase "${id}" Not found!`)
		return processShowStyleBase(doc)
	}
	async getShowStyleVariants(id: ShowStyleBaseId): Promise<ReadonlyDeep<Array<ProcessedShowStyleVariant>>> {
		const docs = await this.directCollections.ShowStyleVariants.findFetch(
			{
				showStyleBaseId: id,
			},
			{
				sort: {
					_rank: 1,
					_id: 1,
				},
			}
		)

		return docs.map(processShowStyleVariant)
	}
	async getShowStyleVariant(id: ShowStyleVariantId): Promise<ReadonlyDeep<ProcessedShowStyleVariant>> {
		const doc = await this.directCollections.ShowStyleVariants.findOne(id)
		if (!doc) throw new Error(`ShowStyleVariant "${id}" Not found!`)
		return processShowStyleVariant(doc)
	}
	async getShowStyleCompound(
		variantId: ShowStyleVariantId,
		baseId?: ShowStyleBaseId
	): Promise<ReadonlyDeep<ProcessedShowStyleCompound>> {
		const [variant, base0] = await Promise.all([
			this.getShowStyleVariant(variantId),
			baseId ? this.getShowStyleBase(baseId) : null,
		])

		const base = base0 ?? (await this.getShowStyleBase(variant.showStyleBaseId))

		const compound = createShowStyleCompound(base, variant)

		if (!compound) {
			throw new Error(`Failed to compile ShowStyleCompound for base "${base._id}" and variant  "${variant._id}"`)
		}

		return compound
	}
	async getShowStyleBlueprint(id: ShowStyleBaseId): Promise<ReadonlyDeep<WrappedShowStyleBlueprint>> {
		const showStyle = await this.getShowStyleBase(id)

		return {
			blueprintId: showStyle.blueprintId,
			blueprint: this.#showStyleBlueprint,
		}
	}
	getShowStyleBlueprintConfig(showStyle: ReadonlyDeep<ProcessedShowStyleCompound>): ProcessedShowStyleConfig {
		return preprocessShowStyleConfig(showStyle, this.#showStyleBlueprint, this.studio.settings)
	}

	hackPublishTimelineToFastTrack(_newTimeline: TimelineComplete): void {
		// throw new Error('Method not implemented.')
	}

	setRouteSetActive(_routeSetId: string, _isActive: boolean | 'toggle'): boolean {
		throw new Error('Method not implemented.')
	}

	async saveRouteSetChanges(): Promise<void> {
		// throw new Error('Method not implemented.')
	}

	discardRouteSetChanges(): void {
		// throw new Error('Method not implemented.')
	}

	/**
	 * Mock methods
	 */

	setStudio(studio: ReadonlyDeep<DBStudio>): void {
		this.#studio = clone(studio)
		this.#jobStudio = convertStudioToJobStudio(clone<DBStudio>(studio))
	}
	setShowStyleBlueprint(blueprint: ReadonlyDeep<ShowStyleBlueprintManifest>): void {
		this.#showStyleBlueprint = blueprint
	}
	updateShowStyleBlueprint(blueprint: Partial<ShowStyleBlueprintManifest>): void {
		this.#showStyleBlueprint = {
			...this.#showStyleBlueprint,
			...blueprint,
		}
	}
	setStudioBlueprint(blueprint: ReadonlyDeep<StudioBlueprintManifest>): void {
		this.#studioBlueprint = blueprint
	}
	updateStudioBlueprint(blueprint: Partial<StudioBlueprintManifest>): void {
		this.#studioBlueprint = {
			...this.#studioBlueprint,
			...blueprint,
		}
	}

	async clearAllRundownsAndPlaylists(): Promise<void> {
		// Cleanup any rundowns / playlists
		const playlists = await this.mockCollections.RundownPlaylists.findFetch({})
		await removeRundownPlaylistFromDb(
			this,
			playlists.map((p) => p._id)
		)
	}
}

const MockStudioBlueprint: () => StudioBlueprintManifest = () => ({
	blueprintType: BlueprintManifestType.STUDIO,
	blueprintVersion: '0.0.0',
	integrationVersion: '0.0.0',
	TSRVersion: '0.0.0',

	configPresets: {
		defaults: {
			name: 'Defaults',
			config: {},
		},
	},

	studioConfigSchema: JSONBlobStringify({}),
	getBaseline: () => {
		return {
			timelineObjects: [],
		}
	},
	getShowStyleId: (_context, showStyles): string | null => {
		return showStyles[0]._id
	},
})

const MockShowStyleBlueprint: () => ShowStyleBlueprintManifest = () => ({
	blueprintType: BlueprintManifestType.SHOWSTYLE,
	blueprintVersion: '0.0.0',
	integrationVersion: '0.0.0',
	TSRVersion: '0.0.0',

	configPresets: {
		defaults: {
			name: 'Defaults',
			config: {},

			variants: {
				0: {
					name: 'Variant 0',
					config: {},
				},
			},
		},
	},

	showStyleConfigSchema: JSONBlobStringify({}),
	getShowStyleVariantId: (_context, variants): string | null => {
		return variants[0]._id
	},
	getRundown: (
		_context: IShowStyleContext,
		ingestRundown: ExtendedIngestRundown<any, any, any>
	): BlueprintResultRundown => {
		const rundown: IBlueprintRundown = {
			externalId: ingestRundown.externalId,
			name: ingestRundown.name,
			// expectedStart?:
			// expectedDuration?: number;
			privateData: {
				payload: ingestRundown.payload,
				airStatus: ingestRundown.coreData?.airStatus,
			},
			timing: {
				type: PlaylistTimingType.None,
			},
		}

		// Allow the rundown to specify a playlistExternalId that should be used
		const playlistId = ingestRundown.payload?.ForcePlaylistExternalId
		if (playlistId) rundown.playlistExternalId = playlistId

		return {
			rundown,
			globalAdLibPieces: [],
			globalActions: [],
			globalPieces: [],
			baseline: { timelineObjects: [] },
		}
	},
	getSegment: (_context: ISegmentUserContext, ingestSegment: IngestSegment<any, any>): BlueprintResultSegment => {
		const segment: IBlueprintSegment = {
			name: ingestSegment.name ? ingestSegment.name : ingestSegment.externalId,
			privateData: ingestSegment.payload,
			isHidden: ingestSegment.payload?.hidden,
		}
		const parts: BlueprintResultPart[] = []

		for (const ingestPart of ingestSegment.parts) {
			const part: IBlueprintPart = {
				externalId: ingestPart.externalId,
				title: ingestPart.name,
				privateData: ingestPart.payload,
				// autoNext?: boolean;
				// autoNextOverlap?: number;
				// prerollDuration?: number;
				// transitionPrerollDuration?: number | null;
				// transitionKeepaliveDuration?: number | null;
				// transitionDuration?: number | null;
				// disableOutTransition?: boolean;
				// expectedDuration?: number;
				// holdMode?: PartHoldMode;
				// updateStoryStatus?: boolean;
				// classes?: string[];
				// classesForNext?: string[];
				// displayDurationGroup?: string;
				// displayDuration?: number;
				// invalid?: boolean
			}
			const pieces: IBlueprintPiece[] = ingestPart.payload?.pieces ?? []
			const adLibPieces: IBlueprintAdLibPiece[] = []
			const actions: IBlueprintActionManifest[] = []
			parts.push({
				part,
				pieces,
				adLibPieces,
				actions,
			})
		}

		return {
			segment,
			parts,
		}
	},
	// onRundownActivate?: (context: EventContext & RundownContext) => Promise<void>,
	// onRundownFirstTake?: (context: EventContext & PartEventContext) => Promise<void>,
	// onRundownDeActivate?: (context: EventContext & RundownContext) => Promise<void>,
	// onPreTake?: (context: EventContext & PartEventContext) => Promise<void>,
	// onPostTake?: (context: EventContext & PartEventContext) => Promise<void>,
	// onTimelineGenerate?: (context: EventContext & RundownContext, timeline: Timeline.TimelineObject[]) => Promise<Timeline.TimelineObject[]>,
	// onAsRunEvent?: (context: EventContext & AsRunEventContext) => Promise<IBlueprintExternalMessageQueueObj[]>,
})

class MockPlaylistLock extends PlaylistLock {
	#locked = true

	constructor(playlistId: RundownPlaylistId) {
		super(playlistId)
	}

	get isLocked(): boolean {
		return this.#locked
	}
	async release(): Promise<void> {
		if (!this.#locked) throw new Error('Already unlocked!')
		this.#locked = false

		for (const fcn of this.deferedFunctions) {
			await fcn()
		}
	}
}

class MockRundownLock extends RundownLock {
	#locked = true

	constructor(rundownId: RundownId) {
		super(rundownId)
	}

	get isLocked(): boolean {
		return this.#locked
	}
	async release(): Promise<void> {
		if (!this.#locked) throw new Error('Already unlocked!')
		this.#locked = false

		for (const fcn of this.deferedFunctions) {
			await fcn()
		}
	}
}
