/** The type of the source layer, used to enable specific functions for special-type layers */
export enum SourceLayerType {
	UNKNOWN = 0,
	/** Local camera sources (local to the studio, not requiring additional coordination) */
	CAMERA = 1,
	/** Video clips */
	VT = 2,
	/** Remote cameras & pre-produced sources */
	REMOTE = 3,
	/** Script and comments for the prompter */
	SCRIPT = 4,
	/** Fullscreen graphics */
	GRAPHICS = 5,
	/** Sources composed out of other sources, such as DVEs, "SuperSource", Additional M/Es, etc. */
	SPLITS = 6,
	/** Audio-only sources */
	AUDIO = 7,
	/** Graphical overlays on top of other video */
	LOWER_THIRD = 10,
	/** Video-only clips or clips with only environment audio */
	LIVE_SPEAK = 11,
	/** Transition effects, content object can use VTContent or TransitionContent */
	TRANSITION = 13,
	/** Control of Studio Lighting, Effects, etc. */
	LIGHTS = 14,
	/** Uncontrolled local sources, such as PowerPoint presentation inputs, Weather systems, EVS replay machines, etc. */
	LOCAL = 15,
	/** Sources that are intended for a studio screen, such as weather, presentations etc. */
	STUDIO_SCREEN = 16,
	/** Remote source with (Local) Studio Audio */
	REMOTE_SPEAK = 17,
}

/** A single source layer, f.g Cameras, VT, Graphics, Remotes */
export interface ISourceLayer {
	_id: string
	/** Rank for ordering */
	_rank: number
	/** User-presentable name for the source layer */
	name: string
	/** Abbreviation for display in the countdown screens */
	abbreviation?: string
	type: SourceLayerType
	/** Source layer exclusivity group. When adLibbing, only a single piece can exist whitin an exclusivity group */
	exclusiveGroup?: string
	/** Use special treatment for remote inputs */
	isRemoteInput?: boolean
	/** Use special treatment for guest inputs */
	isGuestInput?: boolean
	/** Should this layer be clearable */
	isClearable?: boolean
	/** Last used sticky item on a layer is remembered and can be returned to using the sticky hotkey */
	isSticky?: boolean
	/** Whether sticky items should only use original pieces on this layer (not inserted via an adlib) */
	stickyOriginalOnly?: boolean
	/** Should adlibs on this source layer be queueable */
	isQueueable?: boolean
	/** If set to true, the layer will be hidden from the user in Rundown View */
	isHidden?: boolean
	/** If set to true, items in the layer can be disabled by the user (the "G"-shortcut) */
	allowDisable?: boolean
	/** If set to true, items in this layer will be used for presenters screen display */
	onPresenterScreen?: boolean
	/** If set to true, this layer will receive a column of it's own in the List View */
	onListViewColumn?: boolean
	/** If set to true, adLibs on this layer will receive a column of it's own in the List View */
	onListViewAdLibColumn?: boolean
}

/** A layer output group, f.g. PGM, Studio Monitor 1, etc. */
export interface IOutputLayer {
	_id: string
	/** User-presentable name for the layer output group */
	name: string
	/** Rank for ordering */
	_rank: number
	/**
	 * PGM treatment of this output should be in effect
	 * (generate PGM Clean out based on SourceLayer properties)
	 */
	isPGM: boolean
	/** Is the output layer collapsed by default */
	isDefaultCollapsed?: boolean
	/** is the output flattened (all source layers presented on the same layer) */
	isFlattened?: boolean
}

export enum PlayoutActions {
	adlib = 'adlib',
	activateRundownPlaylist = 'activateRundownPlaylist',
	deactivateRundownPlaylist = 'deactivateRundownPlaylist',
	take = 'take',
	hold = 'hold',
	createSnapshotForDebug = 'createSnapshotForDebug',
	resyncRundownPlaylist = 'resyncRundownPlaylist',
	moveNext = 'moveNext',
	resetRundownPlaylist = 'resetRundownPlaylist',
	reloadRundownPlaylistData = 'reloadRundownPlaylistData',
	disableNextPiece = 'disableNextPiece',
	activateAdlibTestingMode = 'activateAdlibTestingMode',
	switchRouteSet = 'switchRouteSet',
}

export enum ClientActions {
	'shelf' = 'shelf',
	'goToOnAirLine' = 'goToOnAirLine',
	'rewindSegments' = 'rewindSegments',
	'showEntireCurrentSegment' = 'showEntireCurrentSegment',
	'miniShelfQueueAdLib' = 'miniShelfQueueAdLib',
	'editMode' = 'editMode',
}

export enum DeviceActions {
	'modifyShiftRegister' = 'modifyShiftRegister',
}

export type SomeActionIdentifier = PlayoutActions | ClientActions | DeviceActions
