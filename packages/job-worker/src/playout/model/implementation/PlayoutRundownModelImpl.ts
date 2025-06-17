import { PartId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ReadonlyDeep } from 'type-fest'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { PlayoutRundownModel } from '../PlayoutRundownModel.js'
import { PlayoutSegmentModel } from '../PlayoutSegmentModel.js'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { PlayoutSegmentModelImpl } from './PlayoutSegmentModelImpl.js'

export class PlayoutRundownModelImpl implements PlayoutRundownModel {
	readonly rundown: ReadonlyDeep<DBRundown>
	readonly #segments: PlayoutSegmentModelImpl[]

	readonly baselineObjects: ReadonlyDeep<RundownBaselineObj[]>

	#adlibTestingSegmentHasChanged = false
	/**
	 * Check if the AdlibTesting Segment has unsaved changes
	 */
	get AdlibTestingSegmentHasChanged(): boolean {
		return this.#adlibTestingSegmentHasChanged
	}
	/**
	 * Clear the `AdlibTestingSegmentHasChanged` flag
	 */
	clearAdlibTestingSegmentChangedFlag(): void {
		this.#adlibTestingSegmentHasChanged = false
	}

	constructor(
		rundown: ReadonlyDeep<DBRundown>,
		segments: PlayoutSegmentModelImpl[],
		baselineObjects: ReadonlyDeep<RundownBaselineObj[]>
	) {
		segments.sort((a, b) => a.segment._rank - b.segment._rank)

		this.rundown = rundown
		this.#segments = segments
		this.baselineObjects = baselineObjects
	}

	get segments(): readonly PlayoutSegmentModel[] {
		return this.#segments
	}

	getSegment(id: SegmentId): PlayoutSegmentModel | undefined {
		return this.segments.find((segment) => segment.segment._id === id)
	}

	getSegmentIds(): SegmentId[] {
		return this.segments.map((segment) => segment.segment._id)
	}

	getAllPartIds(): PartId[] {
		return this.getAllOrderedParts().map((p) => p._id)
	}

	getAllOrderedParts(): ReadonlyDeep<DBPart>[] {
		return this.segments.flatMap((segment) => segment.parts)
	}

	insertAdlibTestingSegment(): SegmentId {
		const existingSegment = this.segments.find((s) => s.segment.orphaned === SegmentOrphanedReason.ADLIB_TESTING)
		if (existingSegment) throw UserError.create(UserErrorMessage.AdlibTestingAlreadyActive)

		const segmentId: SegmentId = getRandomId()
		this.#segments.unshift(
			new PlayoutSegmentModelImpl(
				{
					_id: segmentId,
					_rank: calculateRankForAdlibTestingSegment(this.#segments),
					externalId: '__adlib-testing__',
					rundownId: this.rundown._id,
					orphaned: SegmentOrphanedReason.ADLIB_TESTING,
					name: '',
				},
				[]
			)
		)

		this.#adlibTestingSegmentHasChanged = true

		return segmentId
	}

	removeAdlibTestingSegment(): boolean {
		const index = this.#segments.findIndex((s) => s.segment.orphaned === SegmentOrphanedReason.ADLIB_TESTING)
		if (index === -1) return false

		this.#segments.splice(index, 1)
		this.#adlibTestingSegmentHasChanged = true

		return true
	}

	getAdlibTestingSegment(): PlayoutSegmentModel | undefined {
		// Note: this assumes there will be up to one per rundown
		return this.#segments.find((s) => s.segment.orphaned === SegmentOrphanedReason.ADLIB_TESTING)
	}

	updateAdlibTestingSegmentRank(): void {
		const segment = this.#segments.find((s) => s.segment.orphaned === SegmentOrphanedReason.ADLIB_TESTING)
		if (!segment) return

		const changed = segment.setAdlibTestingRank(calculateRankForAdlibTestingSegment(this.#segments))
		if (!changed) return

		this.#segments.sort((a, b) => a.segment._rank - b.segment._rank)
		this.#adlibTestingSegmentHasChanged = true
	}
}

function calculateRankForAdlibTestingSegment(segments: readonly PlayoutSegmentModel[]) {
	// Ensure the _rank is just before the real content

	return (
		Math.min(
			0,
			...segments.map((s) => (s.segment.orphaned === SegmentOrphanedReason.ADLIB_TESTING ? 0 : s.segment._rank))
		) - 1
	)
}
