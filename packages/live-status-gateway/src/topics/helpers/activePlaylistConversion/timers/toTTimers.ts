import type { TTimerStatus, TTimerIndex } from '@sofie-automation/live-status-gateway-api'
import {
	type RundownTTimer,
	isRundownTTimerIndex,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/TTimers'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'

function emptyTimer(index: number): TTimerStatus {
	return {
		index: index as TTimerIndex,
		label: '',
		configured: false,
		mode: null,
		state: null,
		projected: null,
		anchorPartId: null,
	}
}

function toTTimer(timer: RundownTTimer): TTimerStatus {
	const { index, label, mode, state, projectedState, anchorPartId } = timer
	return {
		index: index as TTimerIndex,
		label,
		configured: !!(mode && state),
		mode: mode as TTimerStatus['mode'],
		state: state as TTimerStatus['state'],
		projected: projectedState ? (projectedState as NonNullable<TTimerStatus['projected']>) : null,
		anchorPartId: anchorPartId ? unprotectString(anchorPartId) : null,
	}
}

export function toTTimers(tTimers: RundownTTimer[] | null | undefined): [TTimerStatus, TTimerStatus, TTimerStatus] {
	// Always return exactly 3 timers
	const slots: [TTimerStatus, TTimerStatus, TTimerStatus] = [emptyTimer(1), emptyTimer(2), emptyTimer(3)]
	if (!tTimers || tTimers.length === 0) return slots

	const filled = new Set<number>()

	for (const timer of tTimers) {
		if (!isRundownTTimerIndex(timer.index)) continue
		const slotIndex = timer.index - 1
		if (slotIndex < 0 || slotIndex > 2) continue
		if (filled.has(slotIndex)) continue
		slots[slotIndex] = toTTimer(timer)
		filled.add(slotIndex)
	}

	return slots
}
