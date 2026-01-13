import { ExpectedPlayoutItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { ExpectedPlayoutItemId, PartId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { diffAndReturnLatestObjects, DocumentChanges, getDocumentChanges, setValuesAndTrackChanges } from './utils.js'
import type { IngestExpectedPackage } from '../IngestExpectedPackage.js'
import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'

export class ExpectedPackagesStore<TPackageSource extends { fromPieceType: ExpectedPackageDBType }> {
	#expectedPlayoutItems: ExpectedPlayoutItemRundown[]
	#expectedPackages: IngestExpectedPackage<TPackageSource>[]

	#expectedPlayoutItemsWithChanges = new Set<ExpectedPlayoutItemId>()
	#expectedPackagesHasChanges = false

	get expectedPlayoutItems(): ReadonlyDeep<ExpectedPlayoutItemRundown[]> {
		return this.#expectedPlayoutItems
	}
	get expectedPackages(): ReadonlyDeep<IngestExpectedPackage<TPackageSource>[]> {
		// Typescript is not happy because of the generic
		return this.#expectedPackages as any
	}

	get hasChanges(): boolean {
		return this.#expectedPlayoutItemsWithChanges.size > 0 || this.#expectedPackagesHasChanges
	}

	get expectedPlayoutItemsChanges(): DocumentChanges<ExpectedPlayoutItemRundown> {
		return getDocumentChanges(this.#expectedPlayoutItemsWithChanges, this.#expectedPlayoutItems)
	}

	clearChangedFlags(): void {
		this.#expectedPlayoutItemsWithChanges.clear()
		this.#expectedPackagesHasChanges = false
	}

	#rundownId: RundownId
	#partId: PartId | undefined

	constructor(
		isBeingCreated: boolean,
		rundownId: RundownId,
		partId: PartId | undefined,
		expectedPlayoutItems: ExpectedPlayoutItemRundown[],
		expectedPackages: IngestExpectedPackage<TPackageSource>[]
	) {
		this.#rundownId = rundownId
		this.#partId = partId

		this.#expectedPlayoutItems = expectedPlayoutItems
		this.#expectedPackages = expectedPackages

		if (isBeingCreated) {
			// Everything contained currently is a new document, track the ids as having changed
			for (const expectedPlayoutItem of this.#expectedPlayoutItems) {
				this.#expectedPlayoutItemsWithChanges.add(expectedPlayoutItem._id)
			}
			this.#expectedPackagesHasChanges = true
		}
	}

	setOwnerIds(
		rundownId: RundownId,
		partId: PartId | undefined,
		updatePackageSource: (source: TPackageSource) => boolean
	): void {
		this.#rundownId = rundownId
		this.#partId = partId

		setValuesAndTrackChanges(this.#expectedPlayoutItemsWithChanges, this.#expectedPlayoutItems, {
			rundownId,
			partId,
		})
		for (const expectedPackage of this.#expectedPackages) {
			const mutatorChanged = updatePackageSource(expectedPackage.source)

			// The doc changed, track it as such
			if (mutatorChanged) this.#expectedPackagesHasChanges = true
		}
	}

	compareToPreviousData(oldStore: ExpectedPackagesStore<TPackageSource>): void {
		// Diff the objects, but don't update the stored copies
		diffAndReturnLatestObjects(
			this.#expectedPlayoutItemsWithChanges,
			oldStore.#expectedPlayoutItems,
			this.#expectedPlayoutItems
		)
		this.#expectedPackagesHasChanges = true
	}

	setExpectedPlayoutItems(expectedPlayoutItems: ExpectedPlayoutItemRundown[]): void {
		const newExpectedPlayoutItems: ExpectedPlayoutItemRundown[] = expectedPlayoutItems.map((item) => ({
			...item,
			partId: this.#partId,
			rundownId: this.#rundownId,
		}))

		this.#expectedPlayoutItems = diffAndReturnLatestObjects(
			this.#expectedPlayoutItemsWithChanges,
			this.#expectedPlayoutItems,
			newExpectedPlayoutItems
		)
	}
	setExpectedPackages(expectedPackages: IngestExpectedPackage<TPackageSource>[]): void {
		this.#expectedPackagesHasChanges = true
		this.#expectedPackages = [...expectedPackages]
	}
}
