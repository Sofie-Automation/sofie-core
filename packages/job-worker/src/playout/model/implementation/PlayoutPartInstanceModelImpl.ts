import { PieceId, PieceInstanceId, RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	getPieceInstanceIdForPiece,
	omitPiecePropertiesForInstance,
	PieceInstance,
	PieceInstancePiece,
} from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { clone, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { getCurrentTime } from '../../../lib/index.js'
import { setupPieceInstanceInfiniteProperties } from '../../pieces.js'
import {
	calculatePartExpectedDurationWithTransition,
	PartCalculatedTimings,
} from '@sofie-automation/corelib/dist/playout/timings'
import { IBlueprintPieceType, PieceLifespan, Time } from '@sofie-automation/blueprints-integration'
import {
	PlayoutMutatablePart,
	PlayoutPartInstanceModel,
	PlayoutPartInstanceModelSnapshot,
} from '../PlayoutPartInstanceModel.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PlayoutPieceInstanceModel } from '../PlayoutPieceInstanceModel.js'
import { PlayoutPieceInstanceModelImpl } from './PlayoutPieceInstanceModelImpl.js'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import _ from 'underscore'
import { DBPart, PartInvalidReason } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PlayoutMutatablePartSampleKeys } from '../../../blueprints/context/lib.js'
import { QuickLoopService } from '../services/QuickLoopService.js'

/**
 * time in ms before an autotake when we don't accept takes/updates
 */
const AUTOTAKE_UPDATE_DEBOUNCE = 5000
const AUTOTAKE_TAKE_DEBOUNCE = 1000

interface PlayoutPieceInstanceModelSnapshotImpl {
	PieceInstance: PieceInstance
	HasChanges: boolean
}
class PlayoutPartInstanceModelSnapshotImpl implements PlayoutPartInstanceModelSnapshot {
	readonly __isPlayoutPartInstanceModelBackup = true

	isRestored = false

	readonly partInstance: DBPartInstance
	readonly partInstanceHasChanges: boolean
	readonly pieceInstances: ReadonlyMap<PieceInstanceId, PlayoutPieceInstanceModelSnapshotImpl | null>

	constructor(copyFrom: PlayoutPartInstanceModelImpl) {
		this.partInstance = clone(copyFrom.partInstanceImpl)
		this.partInstanceHasChanges = copyFrom.partInstanceHasChanges

		const pieceInstances = new Map<PieceInstanceId, PlayoutPieceInstanceModelSnapshotImpl | null>()
		for (const [pieceInstanceId, pieceInstance] of copyFrom.pieceInstancesImpl) {
			if (pieceInstance) {
				pieceInstances.set(pieceInstanceId, {
					PieceInstance: clone(pieceInstance.PieceInstanceImpl),
					HasChanges: pieceInstance.HasChanges,
				})
			} else {
				pieceInstances.set(pieceInstanceId, null)
			}
		}
		this.pieceInstances = pieceInstances
	}
}
export class PlayoutPartInstanceModelImpl implements PlayoutPartInstanceModel {
	partInstanceImpl: DBPartInstance
	pieceInstancesImpl: Map<PieceInstanceId, PlayoutPieceInstanceModelImpl | null>
	quickLoopService: QuickLoopService

	#setPartInstanceValue<T extends keyof DBPartInstance>(key: T, newValue: DBPartInstance[T]): void {
		if (newValue === undefined) {
			delete this.partInstanceImpl[key]
		} else {
			this.partInstanceImpl[key] = newValue
		}

		this.#partInstanceHasChanges = true
	}
	#compareAndSetPartInstanceValue<T extends keyof DBPartInstance>(
		key: T,
		newValue: DBPartInstance[T],
		deepEqual = false
	): boolean {
		const oldValue = this.partInstanceImpl[key]

		const areEqual = deepEqual ? _.isEqual(oldValue, newValue) : oldValue === newValue

		if (!areEqual) {
			this.#setPartInstanceValue(key, newValue)

			return true
		} else {
			return false
		}
	}

	#setPartValue<T extends keyof DBPart>(key: T, newValue: DBPart[T]): void {
		if (newValue === undefined) {
			delete this.partInstanceImpl.part[key]
		} else {
			this.partInstanceImpl.part[key] = newValue
		}

		this.#partInstanceHasChanges = true
	}
	#compareAndSetPartValue<T extends keyof DBPart>(key: T, newValue: DBPart[T], deepEqual = false): boolean {
		const oldValue = this.partInstanceImpl.part[key]

		const areEqual = deepEqual ? _.isEqual(oldValue, newValue) : oldValue === newValue

		if (!areEqual) {
			this.#setPartValue(key, newValue)

			return true
		} else {
			return false
		}
	}

	#partInstanceHasChanges = false
	get partInstanceHasChanges(): boolean {
		return this.#partInstanceHasChanges
	}
	changedPieceInstanceIds(): PieceInstanceId[] {
		const result: PieceInstanceId[] = []
		for (const [id, pieceInstance] of this.pieceInstancesImpl.entries()) {
			if (!pieceInstance || pieceInstance.HasChanges) result.push(id)
		}
		return result
	}
	hasAnyChanges(): boolean {
		return this.#partInstanceHasChanges || this.changedPieceInstanceIds().length > 0
	}
	clearChangedFlags(): void {
		this.#partInstanceHasChanges = false

		for (const [id, value] of this.pieceInstancesImpl) {
			if (!value) {
				this.pieceInstancesImpl.delete(id)
			} else if (value.HasChanges) {
				value.clearChangedFlag()
			}
		}
	}

	get partInstance(): ReadonlyDeep<DBPartInstance> {
		return this.partInstanceImpl
	}
	get pieceInstances(): PlayoutPieceInstanceModel[] {
		const result: PlayoutPieceInstanceModel[] = []

		for (const pieceWrapped of this.pieceInstancesImpl.values()) {
			if (pieceWrapped) result.push(pieceWrapped)
		}

		return result
	}

	constructor(
		partInstance: DBPartInstance,
		pieceInstances: PieceInstance[],
		hasChanges: boolean,
		quickLoopService: QuickLoopService
	) {
		this.partInstanceImpl = partInstance
		this.#partInstanceHasChanges = hasChanges
		this.quickLoopService = quickLoopService

		this.pieceInstancesImpl = new Map()
		for (const pieceInstance of pieceInstances) {
			this.pieceInstancesImpl.set(pieceInstance._id, new PlayoutPieceInstanceModelImpl(pieceInstance, hasChanges))
		}
	}

	getPartInstanceWithQuickLoopOverrides(): ReadonlyDeep<DBPartInstance> {
		if (!this.quickLoopService.isPartWithinQuickLoop(this)) return this.partInstance
		const overrides = this.quickLoopService.getOverridenValues(this)
		const part = { ...this.partInstance.part, ...overrides }
		const partInstance = { ...this.partInstance, part }
		return partInstance
	}

	snapshotMakeCopy(): PlayoutPartInstanceModelSnapshot {
		return new PlayoutPartInstanceModelSnapshotImpl(this)
	}

	snapshotRestore(snapshot: PlayoutPartInstanceModelSnapshot): void {
		if (!(snapshot instanceof PlayoutPartInstanceModelSnapshotImpl))
			throw new Error(`Cannot restore a Snapshot from an different Model`)

		if (snapshot.partInstance._id !== this.partInstance._id)
			throw new Error(`Cannot restore a Snapshot from an different PartInstance`)

		if (snapshot.isRestored) throw new Error(`Cannot restore a Snapshot which has already been restored`)
		snapshot.isRestored = true

		this.partInstanceImpl = snapshot.partInstance
		this.#partInstanceHasChanges = snapshot.partInstanceHasChanges
		this.pieceInstancesImpl.clear()
		for (const [pieceInstanceId, pieceInstance] of snapshot.pieceInstances) {
			if (pieceInstance) {
				this.pieceInstancesImpl.set(
					pieceInstanceId,
					new PlayoutPieceInstanceModelImpl(pieceInstance.PieceInstance, pieceInstance.HasChanges)
				)
			} else {
				this.pieceInstancesImpl.set(pieceInstanceId, null)
			}
		}
	}

	blockTakeUntil(timestamp: Time | null): void {
		this.#compareAndSetPartInstanceValue('blockTakeUntil', timestamp ?? undefined)
	}

	setInvalidReason(reason: PartInvalidReason | undefined): void {
		this.#compareAndSetPartInstanceValue('invalidReason', reason)
	}

	getPieceInstance(id: PieceInstanceId): PlayoutPieceInstanceModel | undefined {
		return this.pieceInstancesImpl.get(id) ?? undefined
	}

	insertAdlibbedPiece(
		piece: Omit<PieceInstancePiece, 'startPartId'>,
		fromAdlibId: PieceId | undefined
	): PlayoutPieceInstanceModel {
		const pieceInstance: PieceInstance = {
			_id: protectString(`${this.partInstance._id}_${piece._id}`),
			rundownId: this.partInstance.rundownId,
			playlistActivationId: this.partInstance.playlistActivationId,
			partInstanceId: this.partInstance._id,
			piece: clone(
				omitPiecePropertiesForInstance({
					...piece,
					startPartId: this.partInstanceImpl.part._id,
				})
			),
		}

		// Ensure it is labelled as dynamic
		pieceInstance.partInstanceId = this.partInstance._id
		pieceInstance.piece.startPartId = this.partInstance.part._id
		pieceInstance.adLibSourceId = fromAdlibId

		if (this.partInstance.isTaken) pieceInstance.dynamicallyInserted = getCurrentTime()

		setupPieceInstanceInfiniteProperties(pieceInstance)

		const pieceInstanceModel = new PlayoutPieceInstanceModelImpl(pieceInstance, true)
		this.pieceInstancesImpl.set(pieceInstance._id, pieceInstanceModel)

		return pieceInstanceModel
	}

	insertHoldPieceInstance(extendPieceInstance: PlayoutPieceInstanceModel): PlayoutPieceInstanceModel {
		const extendPieceInfinite = extendPieceInstance.pieceInstance.infinite
		if (!extendPieceInfinite) throw new Error('Piece being extended is not infinite!')
		if (extendPieceInfinite.infiniteInstanceIndex !== 0 || extendPieceInfinite.fromPreviousPart)
			throw new Error('Piece being extended is not infinite due to HOLD!')

		const infiniteInstanceId = extendPieceInfinite.infiniteInstanceId

		// make the extension
		const newInstance: PieceInstance = {
			_id: protectString<PieceInstanceId>(extendPieceInstance.pieceInstance._id + '_hold'),
			playlistActivationId: extendPieceInstance.pieceInstance.playlistActivationId,
			rundownId: extendPieceInstance.pieceInstance.rundownId,
			partInstanceId: this.partInstance._id,
			dynamicallyInserted: getCurrentTime(),
			piece: {
				...clone<PieceInstancePiece>(extendPieceInstance.pieceInstance.piece),
				enable: { start: 0 },
				extendOnHold: false,
			},
			infinite: {
				infiniteInstanceId: infiniteInstanceId,
				infiniteInstanceIndex: 1,
				infinitePieceId: extendPieceInstance.pieceInstance.piece._id,
				fromPreviousPart: true,
				fromHold: true,
			},
			// Preserve the timings from the playing instance
			reportedStartedPlayback: extendPieceInstance.pieceInstance.reportedStartedPlayback,
			reportedStoppedPlayback: extendPieceInstance.pieceInstance.reportedStoppedPlayback,
			plannedStartedPlayback: extendPieceInstance.pieceInstance.plannedStartedPlayback,
			plannedStoppedPlayback: extendPieceInstance.pieceInstance.plannedStoppedPlayback,
		}

		const pieceInstanceModel = new PlayoutPieceInstanceModelImpl(newInstance, true)
		this.pieceInstancesImpl.set(newInstance._id, pieceInstanceModel)

		return pieceInstanceModel
	}

	insertPlannedPiece(piece: Omit<PieceInstancePiece, 'startPartId'>): PlayoutPieceInstanceModel {
		const pieceInstanceId = getPieceInstanceIdForPiece(this.partInstance._id, piece._id)
		if (this.pieceInstancesImpl.has(pieceInstanceId))
			throw new Error(`PieceInstance "${pieceInstanceId}" already exists`)

		const newPieceInstance: PieceInstance = {
			_id: getPieceInstanceIdForPiece(this.partInstance._id, piece._id),
			rundownId: this.partInstance.rundownId,
			playlistActivationId: this.partInstance.playlistActivationId,
			partInstanceId: this.partInstance._id,
			piece: {
				...piece,
				startPartId: this.partInstance.part._id,
			},
		}

		// Ensure the infinite-ness is setup correctly
		setupPieceInstanceInfiniteProperties(newPieceInstance)

		const pieceInstanceModel = new PlayoutPieceInstanceModelImpl(newPieceInstance, true)
		this.pieceInstancesImpl.set(pieceInstanceId, pieceInstanceModel)

		return pieceInstanceModel
	}

	insertVirtualPiece(
		start: number,
		lifespan: PieceLifespan,
		sourceLayerId: string,
		outputLayerId: string
	): PlayoutPieceInstanceModel {
		const pieceId: PieceId = getRandomId()
		const newPieceInstance: PieceInstance = {
			_id: protectString(`${this.partInstance._id}_${pieceId}`),
			rundownId: this.partInstance.rundownId,
			playlistActivationId: this.partInstance.playlistActivationId,
			partInstanceId: this.partInstance._id,
			piece: {
				_id: pieceId,
				externalId: '-',
				enable: { start: start },
				lifespan: lifespan,
				sourceLayerId: sourceLayerId,
				outputLayerId: outputLayerId,
				invalid: false,
				name: '',
				startPartId: this.partInstance.part._id,
				pieceType: IBlueprintPieceType.Normal,
				virtual: true,
				content: {},
				timelineObjectsString: EmptyPieceTimelineObjectsBlob,
			},

			dynamicallyInserted: getCurrentTime(),
		}
		setupPieceInstanceInfiniteProperties(newPieceInstance)

		const pieceInstanceModel = new PlayoutPieceInstanceModelImpl(newPieceInstance, true)
		this.pieceInstancesImpl.set(newPieceInstance._id, pieceInstanceModel)

		return pieceInstanceModel
	}

	markAsReset(): void {
		this.#compareAndSetPartInstanceValue('reset', true)

		for (const pieceInstance of this.pieceInstancesImpl.values()) {
			if (!pieceInstance) continue

			pieceInstance.compareAndSetPieceInstanceValue('reset', true)
		}
	}

	recalculateExpectedDurationWithTransition(): void {
		const newDuration = calculatePartExpectedDurationWithTransition(
			this.partInstanceImpl.part,
			this.pieceInstances.map((p) => p.pieceInstance.piece)
		)

		this.#compareAndSetPartValue('expectedDurationWithTransition', newDuration)
	}

	removePieceInstance(id: PieceInstanceId): boolean {
		// Future: should this limit what can be removed based on type/infinite

		const pieceInstanceWrapped = this.pieceInstancesImpl.get(id)
		if (pieceInstanceWrapped) {
			this.pieceInstancesImpl.set(id, null)
			return true
		}

		return false
	}

	replaceInfinitesFromPreviousPlayhead(pieceInstances: PieceInstance[]): void {
		// Future: this should do some of the wrapping from a Piece into a PieceInstance

		// Remove old infinite pieces
		for (const [id, piece] of this.pieceInstancesImpl.entries()) {
			if (!piece) continue

			if (piece.pieceInstance.infinite?.fromPreviousPlayhead) {
				this.pieceInstancesImpl.set(id, null)
			}
		}

		for (const pieceInstance of pieceInstances) {
			if (this.pieceInstancesImpl.get(pieceInstance._id))
				throw new Error(
					`Cannot replace infinite PieceInstance "${pieceInstance._id}" as it replaces a non-infinite`
				)

			if (!pieceInstance.infinite?.fromPreviousPlayhead)
				throw new Error(`Cannot insert non-infinite PieceInstance "${pieceInstance._id}" as an infinite`)

			// Future: should this do any deeper validation of the PieceInstances?

			this.pieceInstancesImpl.set(pieceInstance._id, new PlayoutPieceInstanceModelImpl(pieceInstance, true))
		}
	}

	mergeOrInsertPieceInstance(doc: ReadonlyDeep<PieceInstance>): PlayoutPieceInstanceModel {
		// Future: this should do some validation of the new PieceInstance

		const existingPieceInstance = this.pieceInstancesImpl.get(doc._id)
		if (existingPieceInstance) {
			existingPieceInstance.mergeProperties(doc)

			return existingPieceInstance
		} else {
			const newPieceInstance = new PlayoutPieceInstanceModelImpl(clone<PieceInstance>(doc), true)
			this.pieceInstancesImpl.set(newPieceInstance.pieceInstance._id, newPieceInstance)
			return newPieceInstance
		}
	}

	setOrphaned(orphaned: 'adlib-part' | 'deleted' | undefined): void {
		this.#compareAndSetPartInstanceValue('orphaned', orphaned)
	}

	setPlaylistActivationId(id: RundownPlaylistActivationId): void {
		this.#compareAndSetPartInstanceValue('playlistActivationId', id)

		for (const pieceInstance of this.pieceInstancesImpl.values()) {
			if (!pieceInstance) continue
			pieceInstance.compareAndSetPieceInstanceValue('playlistActivationId', id)
		}
	}

	setPlannedStartedPlayback(time: Time | undefined): void {
		const timings = { ...this.partInstanceImpl.timings }
		timings.plannedStartedPlayback = time
		delete timings.plannedStoppedPlayback

		this.#compareAndSetPartInstanceValue('timings', timings, true)
	}
	setPlannedStoppedPlayback(time: Time | undefined): void {
		const timings = { ...this.partInstanceImpl.timings }
		if (timings?.plannedStartedPlayback && !timings.plannedStoppedPlayback) {
			if (time) {
				timings.plannedStoppedPlayback = time
				timings.duration = time - timings.plannedStartedPlayback
			} else {
				delete timings.plannedStoppedPlayback
				delete timings.duration
			}

			this.#compareAndSetPartInstanceValue('timings', timings, true)
		}
	}
	setReportedStartedPlayback(time: Time): boolean {
		const timings = { ...this.partInstanceImpl.timings }

		if (!timings.reportedStartedPlayback) {
			timings.reportedStartedPlayback = time
			delete timings.plannedStoppedPlayback
			delete timings.duration

			return this.#compareAndSetPartInstanceValue('timings', timings, true)
		}

		return false
	}
	setReportedStoppedPlayback(time: number): boolean {
		const timings = { ...this.partInstanceImpl.timings }

		if (!timings.reportedStoppedPlayback) {
			timings.reportedStoppedPlayback = time
			timings.duration = time - (timings.reportedStartedPlayback || time)

			return this.#compareAndSetPartInstanceValue('timings', timings, true)
		}
		return false
	}
	setReportedStoppedPlaybackWithPieceInstances(time: number): boolean {
		if (!this.partInstance.timings?.reportedStartedPlayback) return false

		let setOnAll = this.setReportedStoppedPlayback(time)

		for (const model of this.pieceInstances) {
			if (model.pieceInstance.reportedStartedPlayback) {
				setOnAll &&= model.setReportedStoppedPlayback(time)
			}
		}

		return setOnAll
	}

	setRank(rank: number): void {
		this.#compareAndSetPartValue('_rank', rank)
	}

	setTaken(takeTime: number, playOffset: number | null): void {
		this.#compareAndSetPartInstanceValue('isTaken', true)

		const timings = { ...this.partInstanceImpl.timings }
		timings.take = takeTime
		timings.playOffset = playOffset ?? 0

		if (playOffset !== null) {
			// Shift the startedPlayback into the past, to cause playout to start a while into the Part:
			// Note: We won't use the takeTime here, since the takeTime is when we started executing the take, and we'd rather have the play-time to be Now instead
			timings.plannedStartedPlayback = getCurrentTime() - playOffset
		}

		this.#compareAndSetPartInstanceValue('timings', timings, true)
	}

	storePlayoutTimingsAndPreviousEndState(
		partPlayoutTimings: PartCalculatedTimings,
		previousPartEndState: unknown
	): void {
		this.#compareAndSetPartInstanceValue('isTaken', true)

		// TODO: should this do a comparison?
		this.#setPartInstanceValue('partPlayoutTimings', partPlayoutTimings)
		this.#setPartInstanceValue('previousPartEndState', previousPartEndState)
	}

	updatePartProps(props: Partial<PlayoutMutatablePart>): boolean {
		// Future: this could do some better validation

		// filter the submission to the allowed ones
		const trimmedProps: Partial<PlayoutMutatablePart> = filterPropsToAllowed(props)
		if (Object.keys(trimmedProps).length === 0) return false

		const newPart: DBPart = {
			...this.partInstanceImpl.part,
			...trimmedProps,
			userEditOperations: this.partInstanceImpl.part.userEditOperations, // Replaced below if changed
			userEditProperties: this.partInstanceImpl.part.userEditProperties,
		}

		// Only replace `userEditOperations` if new values were provided
		if ('userEditOperations' in trimmedProps) newPart.userEditOperations = props.userEditOperations

		this.#compareAndSetPartInstanceValue('part', newPart, true)

		return true
	}

	validateAdlibTestingSegmentProperties(): void {
		this.#compareAndSetPartInstanceValue('orphaned', 'adlib-part')

		// Autonext isn't allowed to begin with, to avoid accidentally exiting the adlib testing segment
		this.#compareAndSetPartValue('autoNext', undefined)

		// Force this to not affect rundown timing
		this.#compareAndSetPartValue('untimed', true)
	}

	isTooCloseToAutonext(isTake?: boolean): boolean {
		const partInstance = this.getPartInstanceWithQuickLoopOverrides()
		if (!partInstance.part.autoNext) return false

		const debounce = isTake ? AUTOTAKE_TAKE_DEBOUNCE : AUTOTAKE_UPDATE_DEBOUNCE

		const start = partInstance.timings?.plannedStartedPlayback
		if (start !== undefined && partInstance.part.expectedDuration) {
			// date.now - start = playback duration, duration + offset gives position in part
			const playbackDuration = getCurrentTime() - start

			// If there is an auto next planned
			if (Math.abs(partInstance.part.expectedDuration - playbackDuration) < debounce) {
				return true
			}
		}

		return false
	}
}

function filterPropsToAllowed(props: Partial<PlayoutMutatablePart>): Partial<PlayoutMutatablePart> {
	return _.pick(props, [...PlayoutMutatablePartSampleKeys])
}
