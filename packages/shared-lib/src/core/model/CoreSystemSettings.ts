export interface ICoreSystemSettings {
	/** Cron jobs running nightly */
	cron: {
		casparCGRestart: {
			enabled: boolean
		}
		storeRundownSnapshots?: {
			enabled: boolean
			rundownNames?: string[]
		}
	}

	/** Support info */
	support: {
		message: string
	}

	evaluationsMessage: {
		enabled: boolean
		heading: string
		message: string
	}

	/** Clean up data that is older than this (in milliseconds) */
	maximumDataAge?: number

	/** How many errors to keep in the Error Log. When a new error is recorded, the oldest ones beyond this are removed */
	errorLogMaxItems?: number

	/**
	 * Which keyboard key is used as "Confirm" in modal dialogs etc.
	 * In some installations, the rightmost Enter key (on the numpad) is dedicated for playout,
	 * in such cases this must be set to 'Enter' to exclude it.
	 */
	confirmKeyCode?: 'Enter' | 'AnyEnter'

	/** Key to use as the poison key (aborts hotkey actions). Empty string disables it. Default: 'Escape' */
	poisonKey?: string
}
