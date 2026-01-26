import { JobContext } from '../../jobs/index.js'
import {
	ExpectedPackageDB,
	ExpectedPackageDBType,
	ExpectedPackageIngestSourceStudioBaseline,
	getExpectedPackageId,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemStudio } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { saveIntoDb } from '../../db/changes.js'
import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import type { IngestExpectedPackage } from '../../ingest/model/IngestExpectedPackage.js'
import { sanitiseExpectedPackages } from '../../ingest/expectedPackages.js'
import { ExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Complete } from '@sofie-automation/corelib/dist/lib'

export class StudioBaselineHelper {
	readonly #context: JobContext

	#pendingExpectedPackages:
		| Map<ExpectedPackageId, IngestExpectedPackage<ExpectedPackageIngestSourceStudioBaseline>>
		| undefined
	#pendingExpectedPlayoutItems: ExpectedPlayoutItemStudio[] | undefined

	constructor(context: JobContext) {
		this.#context = context
	}

	hasChanges(): boolean {
		return !!this.#pendingExpectedPackages || !!this.#pendingExpectedPlayoutItems
	}

	setExpectedPackages(packages: ExpectedPackage.Any[]): void {
		sanitiseExpectedPackages(packages)

		// Using a map here is a bit excessive, but it makes it easier to remove duplicates
		this.#pendingExpectedPackages = new Map()
		for (const expectedPackage of packages) {
			const id = getExpectedPackageId(this.#context.studioId, expectedPackage)

			this.#pendingExpectedPackages.set(id, {
				packageId: id,

				package: expectedPackage,

				source: {
					fromPieceType: ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS,
					blueprintPackageId: expectedPackage._id,
					listenToPackageInfoUpdates: expectedPackage.listenToPackageInfoUpdates,
				},
			} satisfies IngestExpectedPackage<ExpectedPackageIngestSourceStudioBaseline>)
		}
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
				? // We can be naive here, as we know the packages will have only one owner (the studio baseline)
					saveIntoDb<ExpectedPackageDB>(
						this.#context,
						this.#context.directCollections.ExpectedPackages,
						{
							studioId: this.#context.studioId,
							rundownId: null,
							bucketId: null,
						},
						Array.from(this.#pendingExpectedPackages.values()).map(
							(pkg) =>
								({
									_id: pkg.packageId,
									studioId: this.#context.studioId,
									rundownId: null,
									bucketId: null,

									created: Date.now(),
									package: pkg.package,
									ingestSources: [pkg.source],
									playoutSources: {
										// This doesn't belong to a rundown, so can't be referenced by playout
										pieceInstanceIds: [],
									},
								}) satisfies Complete<ExpectedPackageDB>
						),
						{
							beforeDiff: (doc, oldDoc) => {
								// Preserve the created date
								doc.created = oldDoc.created
								return doc
							},
						}
					)
				: undefined,
		])

		this.#pendingExpectedPlayoutItems = undefined
		this.#pendingExpectedPackages = undefined
	}
}
