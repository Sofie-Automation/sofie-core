export enum ForceQuickLoopAutoNext {
	/** Parts will auto-next only when explicitly set by the NRCS/blueprints */
	DISABLED = 'disabled',
	/** Parts will auto-next when the expected duration is set and within range */
	ENABLED_WHEN_VALID_DURATION = 'enabled_when_valid_duration',
	/** All parts will auto-next. If expected duration is undefined or low, the default display duration will be used */
	ENABLED_FORCING_MIN_DURATION = 'enabled_forcing_min_duration',
}

export interface IStudioSettings {
	/** The framerate (frames per second) used to convert internal timing information (in milliseconds)
	 * into timecodes and timecode-like strings and interpret timecode user input
	 * Default: 25
	 */
	frameRate: number

	/** URL to endpoint where media preview are exposed */
	mediaPreviewsUrl: string // (former media_previews_url in config)
	/** URLs for slack webhook to send evaluations */
	slackEvaluationUrls?: string // (former slack_evaluation in config)

	/** Media Resolutions supported by the studio for media playback */
	supportedMediaFormats?: string // (former mediaResolutions in config)
	/** Audio Stream Formats supported by the studio for media playback */
	supportedAudioStreams?: string // (former audioStreams in config)

	/** Should the play from anywhere feature be enabled in this studio */
	enablePlayFromAnywhere?: boolean

	/**
	 * If set, forces the multi-playout-gateway mode (aka set "now"-time right away)
	 * for single playout-gateways setups
	 */
	forceMultiGatewayMode?: boolean

	/** How much extra delay to add to the Now-time (used for the "multi-playout-gateway" feature).
	 * A higher value adds delays in playout, but reduces the risk of missed frames. */
	multiGatewayNowSafeLatency?: number

	/** Allow resets while a rundown is on-air */
	allowRundownResetOnAir?: boolean

	/** Preserve unsynced segments position in the rundown, relative to the other segments */
	preserveOrphanedSegmentPositionInRundown?: boolean

	/** Allow inifite adlibs from adlib testing mode to persist in the rundown */
	allowTestingAdlibsToPersist?: boolean

	/**
	 * The minimum amount of time, in milliseconds, that must pass after a take before another take may be performed.
	 * Default: 1000
	 */
	minimumTakeSpan: number

	/** Whether to allow adlib testing mode, before a Part is playing in a Playlist */
	allowAdlibTestingSegment?: boolean

	/** Should QuickLoop context menu options be available to the users. It does not affect Playlist loop enabled by the NRCS. */
	enableQuickLoop?: boolean

	/** If and how to force auto-nexting in a looping Playlist */
	forceQuickLoopAutoNext?: ForceQuickLoopAutoNext

	/**
	 * The duration to apply on too short Parts Within QuickLoop when ForceQuickLoopAutoNext.ENABLED_FORCING_MIN_DURATION is selected
	 * Default: 3000
	 */
	fallbackPartDuration?: number

	/**
	 * Whether to allow hold operations for Rundowns in this Studio
	 * When disabled, any action-triggers that would normally trigger a hold operation will be silently ignored
	 * This should only block entering hold, to ensure Sofie doesn't get stuck if it somehow gets into hold
	 */
	allowHold: boolean

	/**
	 * Whether to allow direct playing of a piece in the rundown
	 * This behaviour is usally triggered by double-clicking on a piece in the GUI
	 */
	allowPieceDirectPlay: boolean

	/**
	 * Enable buckets - the default behavior is to have buckets.
	 */
	enableBuckets: boolean

	/**
	 * Enable evaluation form - the default behavior is to have evaluation forms.
	 */
	enableEvaluationForm: boolean

	/**
	 * Doubleclick changes behaviour as selector for userediting
	 */
	enableUserEdits?: boolean

	/**
	 * Override the piece content statuses with fake info - used for developing the UI
	 */
	mockPieceContentStatus?: boolean

	/**
	 * How long before their start time a rundown owned piece be added to the timeline
	 */
	rundownGlobalPiecesPrepareTime?: number
}
