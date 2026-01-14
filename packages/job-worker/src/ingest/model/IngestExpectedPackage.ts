import type { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import type {
	ExpectedPackageDBType,
	ExpectedPackageIngestSourcePart,
	ExpectedPackageIngestSourceRundownBaseline,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import type { ExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/Ids'
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
	_id: ExpectedPackageId

	package: ReadonlyDeep<ExpectedPackage.Any>

	source: TPackageSource
}
