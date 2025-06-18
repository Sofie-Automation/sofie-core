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
}
