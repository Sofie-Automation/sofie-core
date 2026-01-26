import { ExpectedPackageId, PieceInstanceInfiniteId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { clone, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { ExpectedPackage, Time } from '@sofie-automation/blueprints-integration'
import { PlayoutPieceInstanceModel } from '../PlayoutPieceInstanceModel.js'
import _ from 'underscore'
import { getExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'

export class PlayoutPieceInstanceModelImpl implements PlayoutPieceInstanceModel {
	/**
	 * The raw mutable PieceInstance
	 * Danger: This should not be modified externally, this is exposed for cloning and saving purposes
	 */
	PieceInstanceImpl: PieceInstance

	updatedExpectedPackages: Map<ExpectedPackageId, ReadonlyDeep<ExpectedPackage.Base>> | null

	/**
	 * Set/delete a value for this PieceInstance, and track that there are changes
	 * @param key Property key
	 * @param newValue Property value
	 */
	setPieceInstanceValue<T extends keyof PieceInstance>(key: T, newValue: PieceInstance[T]): void {
		if (newValue === undefined) {
			delete this.PieceInstanceImpl[key]
		} else {
			this.PieceInstanceImpl[key] = newValue
		}

		this.#hasChanges = true

		// Updating the 'piece' has side effects on the expectedPackages
		if (key === 'piece') {
			const newPiece = newValue as PieceInstance['piece'] | undefined
			this.updatedExpectedPackages = createExpectedPackagesMap(
				this.PieceInstanceImpl.rundownId,
				newPiece?.expectedPackages
			)
			this.PieceInstanceImpl.neededExpectedPackageIds = Array.from(this.updatedExpectedPackages.keys())
		}
	}

	/**
	 * Set/delete a value for this PieceInstance if the value has cahnged, and track that there are changes
	 * @param key Property key
	 * @param newValue Property value
	 * @param deepEqual Perform a deep equality check
	 */
	compareAndSetPieceInstanceValue<T extends keyof PieceInstance>(
		key: T,
		newValue: PieceInstance[T],
		deepEqual = false
	): boolean {
		const oldValue = this.PieceInstanceImpl[key]

		const areEqual = deepEqual ? _.isEqual(oldValue, newValue) : oldValue === newValue

		if (!areEqual) {
			this.setPieceInstanceValue(key, newValue)

			return true
		} else {
			return false
		}
	}

	#hasChanges = false
	/**
	 * Whether this PieceInstance has unsaved changes
	 */
	get HasChanges(): boolean {
		return this.#hasChanges || !!this.updatedExpectedPackages
	}

	/**
	 * Clear the `HasChanges` flag
	 */
	clearChangedFlag(): void {
		this.#hasChanges = false
	}

	get pieceInstance(): ReadonlyDeep<PieceInstance> {
		return this.PieceInstanceImpl
	}

	constructor(pieceInstance: PieceInstance, hasChanges: boolean) {
		this.PieceInstanceImpl = pieceInstance
		this.#hasChanges = hasChanges

		if (hasChanges) {
			this.updatedExpectedPackages = createExpectedPackagesMap(
				pieceInstance.rundownId,
				pieceInstance.piece.expectedPackages
			)
			this.PieceInstanceImpl.neededExpectedPackageIds = Array.from(this.updatedExpectedPackages.keys())
		} else {
			this.updatedExpectedPackages = null
		}
	}

	/**
	 * Merge properties from another PieceInstance onto this one
	 * @param pieceInstance PieceInstance to merge properties from
	 */
	mergeProperties(pieceInstance: ReadonlyDeep<PieceInstance>): void {
		this.PieceInstanceImpl = {
			...this.PieceInstanceImpl,
			...clone<PieceInstance>(pieceInstance),
		}

		this.#hasChanges = true
	}

	prepareForHold(): PieceInstanceInfiniteId {
		const infiniteInstanceId: PieceInstanceInfiniteId = getRandomId()
		this.setPieceInstanceValue('infinite', {
			infiniteInstanceId: infiniteInstanceId,
			infiniteInstanceIndex: 0,
			infinitePieceId: this.PieceInstanceImpl.piece._id,
			fromPreviousPart: false,
		})

		return infiniteInstanceId
	}

	setDisabled(disabled: boolean): void {
		this.compareAndSetPieceInstanceValue('disabled', disabled)
	}

	setDuration(duration: Required<PieceInstance>['userDuration']): void {
		this.compareAndSetPieceInstanceValue('userDuration', duration, true)
	}

	setPlannedStartedPlayback(time: Time): boolean {
		this.compareAndSetPieceInstanceValue('plannedStoppedPlayback', undefined)
		return this.compareAndSetPieceInstanceValue('plannedStartedPlayback', time)
	}
	setPlannedStoppedPlayback(time: Time | undefined): boolean {
		return this.compareAndSetPieceInstanceValue('plannedStoppedPlayback', time)
	}
	setReportedStartedPlayback(time: Time): boolean {
		this.compareAndSetPieceInstanceValue('reportedStoppedPlayback', undefined)
		return this.compareAndSetPieceInstanceValue('reportedStartedPlayback', time)
	}
	setReportedStoppedPlayback(time: Time): boolean {
		return this.compareAndSetPieceInstanceValue('reportedStoppedPlayback', time)
	}

	updatePieceProps(props: Partial<PieceInstancePiece>): void {
		// TODO - this is missing a lot of validation

		this.compareAndSetPieceInstanceValue(
			'piece',
			{
				...this.PieceInstanceImpl.piece,
				...props,
			},
			true
		)
	}
}

function createExpectedPackagesMap(
	rundownId: RundownId,
	packages: ExpectedPackage.Base[] | undefined
): Map<ExpectedPackageId, ReadonlyDeep<ExpectedPackage.Base>> {
	const map = new Map<ExpectedPackageId, ReadonlyDeep<ExpectedPackage.Base>>()
	if (!packages) return map

	for (const pkg of packages) {
		map.set(getExpectedPackageId(rundownId, pkg), pkg)
	}
	return map
}
