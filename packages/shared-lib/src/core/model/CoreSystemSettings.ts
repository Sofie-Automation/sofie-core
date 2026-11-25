export enum LogLevel {
	SILLY = 'silly',
	DEBUG = 'debug',
	VERBOSE = 'verbose',
	INFO = 'info',
	WARN = 'warn',
	ERROR = 'error',
	NONE = 'crit',
}

export enum SofieLogo {
	Default = 'default',
	Pride = 'pride',
	Norway = 'norway',
	Christmas = 'christmas',
}

export interface ICoreSystemSettings {
	/** A user-defined name for the installation */
	name?: string

	/** Sofie logo to be displayed in the header */
	logo?: SofieLogo

	/** What log-level to set. Defaults to the LOG_LEVEL environment variable, or SILLY */
	logLevel?: LogLevel

	/** System-wide notification message */
	systemInfo: {
		message: string
		enabled: boolean
	}

	/** elastic APM (application performance monitoring) settings */
	apm: {
		enabled?: boolean
		/**
		 * How many of the transactions to monitor.
		 * Set to:
		 * -1 to log nothing (max performance),
		 * 0.5 to log 50% of the transactions,
		 * 1 to log all transactions
		 */
		transactionSampleRate?: number
	}

	/** Enables internal monitoring of blocked main thread */
	enableMonitorBlockedThread?: boolean

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
		/** Custom HTML shown in the Help & Support panel. When non-empty, it replaces the default documentation links */
		panelHtml: string
	}

	evaluationsMessage: {
		enabled: boolean
		heading: string
		message: string
	}

	/** Clean up data that is older than this (in milliseconds) */
	maximumDataAge?: number

	/**
	 * Which keyboard key is used as "Confirm" in modal dialogs etc.
	 * In some installations, the rightmost Enter key (on the numpad) is dedicated for playout,
	 * in such cases this must be set to 'Enter' to exclude it.
	 */
	confirmKeyCode?: 'Enter' | 'AnyEnter'

	/** Key to use as the poison key (aborts hotkey actions). Empty string disables it. Default: 'Escape' */
	poisonKey?: string
}
