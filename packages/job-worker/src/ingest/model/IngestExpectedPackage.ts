import type { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import {
	getExpectedPackageIdNew,
	type ExpectedPackageDBType,
	type ExpectedPackageIngestSourcePart,
	type ExpectedPackageIngestSourceRundownBaseline,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import type { BucketId, ExpectedPackageId, RundownId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { ReadonlyDeep } from 'type-fest'

/**
 * A simpler form of ExpectedPackageDB that is scoped to the properties relevant to ingest.
 * This is limited to be owned by one source, during the save process the documents will be merged
 */
export interface IngestExpectedPackage<
	TPackageSource extends { fromPieceType: ExpectedPackageDBType } =
		| ExpectedPackageIngestSourcePart
		| ExpectedPackageIngestSourceRundownBaseline,
> {
	packageId: ExpectedPackageId

	package: ReadonlyDeep<Omit<ExpectedPackage.Base, 'listenToPackageInfoUpdates'>>

	source: TPackageSource
}

export class ExpectedPackageCollector<TSource extends { fromPieceType: ExpectedPackageDBType } = never> {
	readonly #parentId: RundownId | StudioId | BucketId
	readonly #packages: IngestExpectedPackage<TSource>[] = []

	constructor(parentId: RundownId | StudioId | BucketId) {
		this.#parentId = parentId
	}

	addPackagesWithSource = <TSource = never>( // never to force the caller to specify the type
		expectedPackages: ReadonlyDeep<ExpectedPackage.Any>[],
		source: Omit<TSource, 'blueprintPackageId' | 'listenToPackageInfoUpdates'>
	): void => {
		const insertedPackagesForSource = new Set<string>()
		for (const expectedPackage of expectedPackages) {
			const id = getExpectedPackageIdNew(this.#parentId, expectedPackage)

			// Deduplicate with an id including the blueprintPackageId.
			// This is to ensure the blueprints can reference the package with that id still
			const uniqueId = `${id}-${expectedPackage._id}-${expectedPackage.listenToPackageInfoUpdates ?? false}`

			// Ensure only inserted once for this source
			if (insertedPackagesForSource.has(uniqueId)) continue
			insertedPackagesForSource.add(uniqueId)

			this.#packages.push({
				packageId: id,
				package: expectedPackage,
				source: {
					...(source as any), // Because this is a generic, this spread doesnt work
					blueprintPackageId: expectedPackage._id,
					listenToPackageInfoUpdates: expectedPackage.listenToPackageInfoUpdates,
				},
			})
		}
	}

	finish(): IngestExpectedPackage<TSource>[] {
		return this.#packages
	}
}
