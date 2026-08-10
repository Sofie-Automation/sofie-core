/** How many parts lookahead will search through when no other value is specified  */
export const LOOKAHEAD_DEFAULT_SEARCH_DISTANCE = 10

/** TODO - this should be some kind of config */
export const PRESERVE_UNSYNCED_PLAYING_SEGMENT_CONTENTS = false

/** After this time, MOS-messages are considered to have timed out */
export const DEFAULT_MOS_TIMEOUT_TIME = 10 * 1000

/** How often to ping NRCS (to determine connection status) */
export const DEFAULT_MOS_HEARTBEAT_INTERVAL = 30 * 1000

/** After this time, messages to the NRCS are considered to have timed out */
export const DEFAULT_NRCS_TIMEOUT_TIME = 10 * 1000

/** After this time, actions executed by the TSR are considered to have timed out */
export const DEFAULT_TSR_ACTION_TIMEOUT_TIME = 5 * 1000

/** How much time must pass, in milliseconds, after a take before another take is allowed */
export const DEFAULT_MINIMUM_TAKE_SPAN = 1000

/** The duration to apply on too short Parts Within QuickLoop when ForceQuickLoopAutoNext.ENABLED_FORCING_MIN_DURATION is selected */
export const DEFAULT_FALLBACK_PART_DURATION = 3000

/** Default duration (in milliseconds) to use to render parts when no duration is provided */
export const DEFAULT_DISPLAY_DURATION = 3000

/** Default value used to toggle Shelf options when the 'display' URL argument is not provided */
export const DEFAULT_SHELF_DISPLAY_OPTIONS = 'buckets,layout,shelfLayout,inspector'

/** Clean up data that is older than this (in milliseconds) */
export const DEFAULT_MAXIMUM_DATA_AGE = 1000 * 60 * 60 * 24 * 100 // 100 days

/** Default time scale zooming for the UI */
export const DEFAULT_TIME_SCALE = 1

/** Default key to use as the poison key (used to abort/escape hotkey actions) */
export const DEFAULT_POISON_KEY = 'Escape'

/** Default keyboard key used as "Confirm" in modal dialogs etc. */
export const DEFAULT_CONFIRM_KEY_CODE = 'Enter'

/** The expected time it takes from an ingest operation to receiving a new timeline in the playout-gateway */
export const EXPECTED_INGEST_TO_PLAYOUT_TIME = 500
