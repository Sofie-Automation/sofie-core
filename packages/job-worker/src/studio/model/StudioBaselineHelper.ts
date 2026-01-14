import { JobContext } from '../../jobs/index.js'
import {
	ExpectedPackageDBType,
	ExpectedPackageIngestSource,
	ExpectedPackageIngestSourceStudioBaseline,
	getExpectedPackageIdFromIngestSource,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemStudio } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { saveIntoDb } from '../../db/changes.js'
import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import type { IngestExpectedPackage } from '../../ingest/model/IngestExpectedPackage.js'
import { setDefaultIdOnExpectedPackages } from '../../ingest/expectedPackages.js'
import { writeExpectedPackagesChangesForRundown } from '../../ingest/model/implementation/SaveIngestModel.js'

export class StudioBaselineHelper {
	readonly #context: JobContext

	#pendingExpectedPackages: IngestExpectedPackage<ExpectedPackageIngestSourceStudioBaseline>[] | undefined
	#pendingExpectedPlayoutItems: ExpectedPlayoutItemStudio[] | undefined

	constructor(context: JobContext) {
		this.#context = context
	}

	hasChanges(): boolean {
		return !!this.#pendingExpectedPackages || !!this.#pendingExpectedPlayoutItems
	}

	setExpectedPackages(packages: ExpectedPackage.Any[]): void {
		const source: ExpectedPackageIngestSource = { fromPieceType: ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS }

		setDefaultIdOnExpectedPackages(packages)

		this.#pendingExpectedPackages = packages.map(
			(expectedPackage) =>
				({
					_id: getExpectedPackageIdFromIngestSource(this.#context.studioId, source, expectedPackage._id),

					package: expectedPackage,

					source: source,
				}) satisfies IngestExpectedPackage<ExpectedPackageIngestSourceStudioBaseline>
		)
	}
	setExpectedPlayoutItems(playoutItems: ExpectedPlayoutItemStudio[]): void {
		this.#pendingExpectedPlayoutItems = playoutItems
	}

	async saveAllToDatabase(): Promise<void> {
		await Promise.all([
			this.#pendingExpectedPlayoutItems
				? saveIntoDb(
						this.#context,
						this.#context.directCollections.ExpectedPlayoutItems,
						{ studioId: this.#context.studioId, baseline: 'studio' },
						this.#pendingExpectedPlayoutItems
					)
				: undefined,
			this.#pendingExpectedPackages
				? writeExpectedPackagesChangesForRundown(this.#context, null, this.#pendingExpectedPackages)
				: undefined,
		])

		this.#pendingExpectedPlayoutItems = undefined
		this.#pendingExpectedPackages = undefined
	}
}
