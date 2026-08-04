import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'

/**
 * Fields of the RundownPlaylist that are (re)written frequently during playout - on essentially every take
 * and every timeline generation - but are NOT read anywhere in the rundown view.
 *
 * The rundown view's top-level playlist query ({@link RundownView}) drives re-rendering of the whole segment
 * tree: any change to the queried document produces a new `playlist` object reference that propagates down.
 * Projecting these fields out means those frequent writes no longer invalidate that (very hot) reactive
 * computation. Other views that DO need some of these (e.g. the Director/Presenter/Prompter screens) query the
 * playlist separately and are unaffected.
 *
 * NOTE: kept in sync with {@link RundownViewPlaylist} - the type is derived from the keys of this object, so
 * add/remove fields in one place only. Do NOT add fields that the rundown view reads (currentPartInfo,
 * nextPartInfo, holdState, timing, segmentsStartedPlayback, tTimers, quickLoop, ...).
 */
export const RUNDOWN_VIEW_PLAYLIST_OMITTED_FIELDS = {
	assignedAbSessions: 0,
	trackedAbSessions: 0,
	privatePlayoutPersistentState: 0,
	publicPlayoutPersistentState: 0,
	lastIncorrectPartPlaybackReported: 0,
	lastTakeTime: 0,
	resetTime: 0,
	rundownsStartedPlayback: 0,
} as const

/**
 * A `RundownPlaylist` as projected for use within the rundown view. See
 * {@link RUNDOWN_VIEW_PLAYLIST_OMITTED_FIELDS} for what is omitted and why. Using this narrowed type through
 * the rundown-view component tree gives a compile-time guarantee that nothing in the subtree reads a field
 * that has been projected away.
 */
export type RundownViewPlaylist = Omit<DBRundownPlaylist, keyof typeof RUNDOWN_VIEW_PLAYLIST_OMITTED_FIELDS>
