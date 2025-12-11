import { Settings } from '../../lib/Settings.js'

export const MAGIC_TIME_SCALE_FACTOR = 0.03

export const SIMULATED_PLAYBACK_SOFT_MARGIN = 0
export const SIMULATED_PLAYBACK_HARD_MARGIN = 3500

export const LIVE_LINE_TIME_PADDING = 150
export const LIVELINE_HISTORY_SIZE = 100
export const TIMELINE_RIGHT_PADDING =
	// TODO: This is only temporary, for hands-on tweaking -- Jan Starzak, 2021-06-01
	parseInt(localStorage.getItem('EXP_timeline_right_padding')!) || LIVELINE_HISTORY_SIZE + LIVE_LINE_TIME_PADDING
export const FALLBACK_ZOOM_FACTOR = MAGIC_TIME_SCALE_FACTOR

export const MINIMUM_ZOOM_FACTOR = // TODO: This is only temporary, for hands-on tweaking -- Jan Starzak, 2021-06-01
	parseInt(localStorage.getItem('EXP_timeline_min_time_scale')!) || MAGIC_TIME_SCALE_FACTOR * Settings.defaultTimeScale
