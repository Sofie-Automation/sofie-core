import { ExpectedMediaItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import { ExpectedPackageDBBase } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import {
	ExpectedMediaItemId,
	ExpectedPackageId,
	ExpectedPlayoutItemId,
	PartId,
	RundownId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { diffAndReturnLatestObjects, DocumentChanges, getDocumentChanges, setValuesAndTrackChanges } from './utils.js'

function mutateExpectedPackage<ExpectedPackageType extends ExpectedPackageDBBase>(
	oldObj: ExpectedPackageType,
	newObj: ExpectedPackageType
): ExpectedPackageType {
	return {
		...newObj,
		// Retain the created property
		created: oldObj.created,
	}
}

export class ExpectedPackagesStore<ExpectedPackageType extends ExpectedPackageDBBase & { rundownId: RundownId }> {
	#expectedMediaItems: ExpectedMediaItemRundown[]
	#expectedPlayoutItems: ExpectedPlayoutItemRundown[]
	#expectedPackages: ExpectedPackageType[]

	#expectedMediaItemsWithChanges = new Set<ExpectedMediaItemId>()
	#expectedPlayoutItemsWithChanges = new Set<ExpectedPlayoutItemId>()
	#expectedPackagesWithChanges = new Set<ExpectedPackageId>()

	get expectedMediaItems(): ReadonlyDeep<ExpectedMediaItemRundown[]> {
		return this.#expectedMediaItems
	}
	get expectedPlayoutItems(): ReadonlyDeep<ExpectedPlayoutItemRundown[]> {
		return this.#expectedPlayoutItems
	}
	get expectedPackages(): ReadonlyDeep<ExpectedPackageType[]> {
		// Typescript is not happy with turning ExpectedPackageType into ReadonlyDeep because it can be a union
		return this.#expectedPackages as any
	}

	get hasChanges(): boolean {
		return (
			this.#expectedMediaItemsWithChanges.size > 0 ||
			this.#expectedPlayoutItemsWithChanges.size > 0 ||
			this.#expectedPackagesWithChanges.size > 0
		)
	}

	get expectedMediaItemsChanges(): DocumentChanges<ExpectedMediaItemRundown> {
		return getDocumentChanges(this.#expectedMediaItemsWithChanges, this.#expectedMediaItems)
	}
	get expectedPlayoutItemsChanges(): DocumentChanges<ExpectedPlayoutItemRundown> {
		return getDocumentChanges(this.#expectedPlayoutItemsWithChanges, this.#expectedPlayoutItems)
	}
	get expectedPackagesChanges(): DocumentChanges<ExpectedPackageType> {
		return getDocumentChanges(this.#expectedPackagesWithChanges, this.#expectedPackages)
	}

	clearChangedFlags(): void {
		this.#expectedMediaItemsWithChanges.clear()
		this.#expectedPlayoutItemsWithChanges.clear()
		this.#expectedPackagesWithChanges.clear()
	}

	#rundownId: RundownId
	#segmentId: SegmentId | undefined
	#partId: PartId | undefined

	constructor(
		isBeingCreated: boolean,
		rundownId: RundownId,
		segmentId: SegmentId | undefined,
		partId: PartId | undefined,
		expectedMediaItems: ExpectedMediaItemRundown[],
		expectedPlayoutItems: ExpectedPlayoutItemRundown[],
		expectedPackages: ExpectedPackageType[]
	) {
		this.#rundownId = rundownId
		this.#segmentId = segmentId
		this.#partId = partId

		this.#expectedMediaItems = expectedMediaItems
		this.#expectedPlayoutItems = expectedPlayoutItems
		this.#expectedPackages = expectedPackages

		if (isBeingCreated) {
			// Everything contained currently is a new document, track the ids as having changed
			for (const expectedPlayoutItem of this.#expectedPlayoutItems) {
				this.#expectedPlayoutItemsWithChanges.add(expectedPlayoutItem._id)
			}
			for (const expectedMediaItem of this.#expectedMediaItems) {
				this.#expectedMediaItemsWithChanges.add(expectedMediaItem._id)
			}
			for (const expectedPackage of this.#expectedPackages) {
				this.#expectedPackagesWithChanges.add(expectedPackage._id)
			}
		}
	}

	setOwnerIds(rundownId: RundownId, segmentId: SegmentId | undefined, partId: PartId | undefined): void {
		this.#rundownId = rundownId
		this.#segmentId = segmentId
		this.#partId = partId

		setValuesAndTrackChanges(this.#expectedPlayoutItemsWithChanges, this.#expectedPlayoutItems, {
			rundownId,
			partId,
		})
		setValuesAndTrackChanges(this.#expectedMediaItemsWithChanges, this.#expectedMediaItems, {
			rundownId,
			partId,
		})
		setValuesAndTrackChanges(this.#expectedPackagesWithChanges, this.#expectedPackages, {
			rundownId,
			// @ts-expect-error Not all ExpectedPackage types have this property
			segmentId,
			partId,
		})
	}

	compareToPreviousData(oldStore: ExpectedPackagesStore<ExpectedPackageType>): void {
		// Diff the objects, but don't update the stored copies
		diffAndReturnLatestObjects(
			this.#expectedPlayoutItemsWithChanges,
			oldStore.#expectedPlayoutItems,
			this.#expectedPlayoutItems
		)
		diffAndReturnLatestObjects(
			this.#expectedMediaItemsWithChanges,
			oldStore.#expectedMediaItems,
			this.#expectedMediaItems
		)
		diffAndReturnLatestObjects(
			this.#expectedPackagesWithChanges,
			oldStore.#expectedPackages,
			this.#expectedPackages,
			mutateExpectedPackage
		)
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
	setExpectedMediaItems(expectedMediaItems: ExpectedMediaItemRundown[]): void {
		const newExpectedMediaItems: ExpectedMediaItemRundown[] = expectedMediaItems.map((item) => ({
			...item,
			partId: this.#partId,
			rundownId: this.#rundownId,
		}))

		this.#expectedMediaItems = diffAndReturnLatestObjects(
			this.#expectedMediaItemsWithChanges,
			this.#expectedMediaItems,
			newExpectedMediaItems
		)
	}
	setExpectedPackages(expectedPackages: ExpectedPackageType[]): void {
		const newExpectedPackages: ExpectedPackageType[] = expectedPackages.map((pkg) => ({
			...pkg,
			partId: this.#partId,
			segmentId: this.#segmentId,
			rundownId: this.#rundownId,
		}))

		this.#expectedPackages = diffAndReturnLatestObjects(
			this.#expectedPackagesWithChanges,
			this.#expectedPackages,
			newExpectedPackages,
			mutateExpectedPackage
		)
	}
}
