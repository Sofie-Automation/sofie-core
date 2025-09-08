import { JobContext } from '../../jobs/index.js'
import {
	ExpectedPackageDB,
	ExpectedPackageDBFromStudioBaselineObjects,
	ExpectedPackageDBType,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemStudio } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { saveIntoDb } from '../../db/changes.js'

export class StudioBaselineHelper {
	readonly #context: JobContext

	#pendingExpectedPackages: ExpectedPackageDBFromStudioBaselineObjects[] | undefined
	#pendingExpectedPlayoutItems: ExpectedPlayoutItemStudio[] | undefined

	constructor(context: JobContext) {
		this.#context = context
	}

	hasChanges(): boolean {
		return !!this.#pendingExpectedPackages || !!this.#pendingExpectedPlayoutItems
	}

	setExpectedPackages(packages: ExpectedPackageDBFromStudioBaselineObjects[]): void {
		this.#pendingExpectedPackages = packages
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
				? saveIntoDb<ExpectedPackageDB>(
						this.#context,
						this.#context.directCollections.ExpectedPackages,
						{
							studioId: this.#context.studioId,
							fromPieceType: ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS,
						},
						this.#pendingExpectedPackages
					)
				: undefined,
		])

		this.#pendingExpectedPlayoutItems = undefined
		this.#pendingExpectedPackages = undefined
	}
}
