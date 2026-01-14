import { SourceLayerType } from './content.js'
import { ITranslatableMessage } from './translations.js'
import {
	SomeActionIdentifier,
	ClientActions,
	PlayoutActions,
	DeviceActions,
} from '@sofie-automation/shared-lib/dist/core/model/ShowStyle'

export enum TriggerType {
	hotkey = 'hotkey',
	device = 'device',
}

/**
 * An abstract description of a trigger mechanism that can be used to trigger events
 *
 * @export
 * @interface ITrigger
 */
export interface IBlueprintTrigger {
	// type of a trigger (keyboard hotkey, GPI, MIDI, OSC, etc.)
	type: TriggerType
}

/**
 * Non-implementation note: Chromium-based browsers have certain keyboard combinations that are either
 * unbindable or the default action is non-preventDefault()'able, which makes them useless. The key combinations
 * are:
 *
 *	* Close tab (ctrl+w)
 *	* Close tab (ctrl+f4)
 *	* Close window (ctrl+shift+w)
 *	* New incognito window (ctrl+shift+n)
 *	* New tab (ctrl+t)
 *	* New window (ctrl+n)
 *	* Restore tab (ctrl+shift+t)
 *	* Select next tab (ctrl+tab)
 *	* Select next tab (ctrl+next)
 *	* Select previous tab (ctrl+shift+tab)
 *	* Select previous tab (ctrl+prior)
 *	* Exit (Escape - only in programmatic full screen mode, i.e. element.requestFullscreen())
 */

/**
 * A hotkey trigger is a trigger local to the current client and as such, it should only be used with
 * filter chains containing `IGUIContextFilterLink`
 *
 * @export
 * @interface IBlueprintHotkeyTrigger
 * @extends {IBlueprintTrigger}
 */
export interface IBlueprintHotkeyTrigger extends IBlueprintTrigger {
	type: TriggerType.hotkey

	/**
	 * a "+" and space concatenated list of KeyboardEvent.key key values (see: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values),
	 * in order (order not significant for modifier keys), f.g. "Control+Shift+KeyA", "Control+Shift+KeyB KeyU".
	 * "Control" means "either ControlLeft or ControlRight", same for "Shift" and "Alt"
	 * Spaces indicate chord sequences.
	 */
	keys: string

	/**
	 * If enabled, actions will happen on keyUp, as opposed to keyDown
	 *
	 * @type {boolean}
	 * @memberof IBlueprintHotkeyTrigger
	 */
	up?: boolean
}

export interface IBlueprintDeviceTrigger extends IBlueprintTrigger {
	type: TriggerType.device

	/**
	 * This is an external identifier, identifying a device providing triggers (a panel, keyboard, etc.)
	 */
	deviceId: string

	/**
	 * An optional, user-presentable string identifying the device class ("Stream Deck", "X-Keys")
	 */
	deviceClass?: string

	/**
	 * This is an external identifier, identifying an individual event source (a button, a key, a GPI input pin)
	 */
	triggerId: string

	/**
	 * Additional arguements, provided by the trigger, that are required to match
	 */
	values?: DeviceTriggerArguments
}

export type DeviceTriggerArguments = Record<string, string | number | boolean>

export type SomeBlueprintTrigger = IBlueprintHotkeyTrigger | IBlueprintDeviceTrigger

export interface ITriggeredActionBase {
	action: SomeActionIdentifier
	filterChain: IBaseFilterLink[]
}

export interface IBaseFilterLink {
	object: string
}

export type IRundownPlaylistFilterLink =
	| {
			object: 'rundownPlaylist'
			field: 'activationId'
			value: boolean
	  }
	| {
			object: 'rundownPlaylist'
			field: 'studioId'
			value: string
	  }
	| {
			object: 'rundownPlaylist'
			field: 'name'
			value: string
	  }

export type IGUIContextFilterLink = {
	object: 'view'
}

export type IAdLibFilterLink =
	| {
			object: 'adLib'
			field: 'sourceLayerId' | 'outputLayerId' | 'tag' | 'label'
			value: string[]
			/** TODO: Support "NOT" filters */
	  }
	| {
			object: 'adLib'
			field: 'pick' | 'pickEnd' | 'limit'
			/** for `pick` and `pickEnd`: note that while this is 0-indexed in the data structure, the GUI will show this as `value + 1` */
			value: number
	  }
	| {
			object: 'adLib'
			field: 'global' // | 'focused' // as above stated, eventually allowing to select the "focused" adlib
			value: boolean
	  }
	| {
			object: 'adLib'
			field: 'segment'
			value: 'current' | 'next'
	  }
	| {
			object: 'adLib'
			field: 'part'
			value: 'current' | 'next'
	  }
	| {
			object: 'adLib'
			field: 'sourceLayerType'
			value: SourceLayerType[]
	  }
	| {
			object: 'adLib'
			field: 'type'
			value: 'adLib' | 'adLibAction' | 'clear' | 'sticky'
	  }

export interface IAdlibPlayoutActionArguments {
	triggerMode: string
}

export interface IAdlibPlayoutAction extends ITriggeredActionBase {
	action: PlayoutActions.adlib
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink | IAdLibFilterLink)[]
	arguments?: IAdlibPlayoutActionArguments | null
}

export interface IRundownPlaylistActivateAction extends ITriggeredActionBase {
	action: PlayoutActions.activateRundownPlaylist
	rehearsal: boolean
	force?: boolean
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
}

export interface IRundownPlaylistDeactivateAction extends ITriggeredActionBase {
	action: PlayoutActions.deactivateRundownPlaylist
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
}

export interface IRundownPlaylistActivateAdlibTestingAction extends ITriggeredActionBase {
	action: PlayoutActions.activateAdlibTestingMode
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
}

export interface ISwitchRouteSetAction extends ITriggeredActionBase {
	action: PlayoutActions.switchRouteSet
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
	routeSetId: string
	state: boolean | 'toggle'
}

export interface ITakeAction extends ITriggeredActionBase {
	action: PlayoutActions.take
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
}

export interface IHoldAction extends ITriggeredActionBase {
	action: PlayoutActions.hold
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
	undo?: boolean
}

export interface IMoveNextAction extends ITriggeredActionBase {
	action: PlayoutActions.moveNext
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]

	/**
	 * "Vertical delta" - the next Part will be moved to the beginning of the specified segment
	 *
	 * @type {number}
	 * @memberof IMoveNextAction
	 */
	segments: number
	/**
	 * "Horizontal delta" - the next Part will be moved by this amount within the selected segment
	 *
	 * @type {number}
	 * @memberof IMoveNextAction
	 */
	parts: number
	/**
	 * When moving the next part it should ignore any of the boundaries set by the QuickLoop feature
	 *
	 * @type {boolean}
	 * @memberof IMoveNextAction
	 */
	ignoreQuickLoop: boolean
}

export interface ICreateSnapshotForDebugAction extends ITriggeredActionBase {
	action: PlayoutActions.createSnapshotForDebug
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
}

export interface IDisableNextPieceAction extends ITriggeredActionBase {
	action: PlayoutActions.disableNextPiece
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
	undo?: boolean
}

export interface IRundownPlaylistReloadDataAction extends ITriggeredActionBase {
	action: PlayoutActions.reloadRundownPlaylistData
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
}

export interface IRundownPlaylistResetAction extends ITriggeredActionBase {
	action: PlayoutActions.resetRundownPlaylist
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
}

export interface IRundownPlaylistResyncAction extends ITriggeredActionBase {
	action: PlayoutActions.resyncRundownPlaylist
	filterChain: (IRundownPlaylistFilterLink | IGUIContextFilterLink)[]
	force?: boolean
}

export interface IShelfAction extends ITriggeredActionBase {
	action: ClientActions.shelf
	state: true | false | 'toggle'
	filterChain: IGUIContextFilterLink[]
}

export interface IEditModeAction extends ITriggeredActionBase {
	action: ClientActions.editMode
	state: true | false | 'toggle'
	filterChain: IGUIContextFilterLink[]
}

export interface IGoToOnAirLineAction extends ITriggeredActionBase {
	action: ClientActions.goToOnAirLine
	filterChain: IGUIContextFilterLink[]
}

export interface IRewindSegmentsAction extends ITriggeredActionBase {
	action: ClientActions.rewindSegments
	filterChain: IGUIContextFilterLink[]
}

export interface IShowEntireCurrentSegmentAction extends ITriggeredActionBase {
	action: ClientActions.showEntireCurrentSegment
	filterChain: IGUIContextFilterLink[]
	on: boolean
}

/**
 * Note that while the name of this action is "Queue AdLib", and this is a ClientAction, this is a
 * compound action that will change move the focus in the UI AND trigger the AdLib (with the queue
 * parameter set to TRUE). It is up to the Blueprint Developer to ensure that this will Queue,
 * in a production sense, if this is an AdLib Action.
 */
export interface IMiniShelfQueueAdLib extends ITriggeredActionBase {
	action: ClientActions.miniShelfQueueAdLib
	filterChain: IGUIContextFilterLink[]
	/** `forward: true` means advance 1, `forward: false` means move to previous */
	forward: boolean // TODO: Change this to use `delta: number`, as opposed to `forward: boolean`
}

export interface IModifyShiftRegister extends ITriggeredActionBase {
	action: DeviceActions.modifyShiftRegister
	filterChain: IGUIContextFilterLink[]
	register: number
	value: number
	operation: '+' | '-' | '='
	limitMin: number
	limitMax: number
}

export type SomeAction =
	| IAdlibPlayoutAction
	| IRundownPlaylistActivateAction
	| IRundownPlaylistDeactivateAction
	| IRundownPlaylistActivateAdlibTestingAction
	| ITakeAction
	| IHoldAction
	| IMoveNextAction
	| ICreateSnapshotForDebugAction
	| IDisableNextPieceAction
	| IRundownPlaylistReloadDataAction
	| IRundownPlaylistResetAction
	| IRundownPlaylistResyncAction
	| IShelfAction
	| IEditModeAction
	| IGoToOnAirLineAction
	| IRewindSegmentsAction
	| IShowEntireCurrentSegmentAction
	| IMiniShelfQueueAdLib
	| IModifyShiftRegister
	| ISwitchRouteSetAction

export interface IBlueprintTriggeredActions {
	_id: string
	/** Rank number for visually ordering the hotkeys */
	_rank: number
	/** Optional label to specify what this triggered action is supposed to do, a comment basically */
	name?: ITranslatableMessage | string
	/** A list of triggers that will make the list of actions in `.actions` happen */
	triggers: Record<string, SomeBlueprintTrigger>
	/** A list of actions to execute */
	actions: Record<string, SomeAction>
	/** Space separated list of class names to use when displaying this triggered actions */
	styleClassNames?: string
}

export { SomeActionIdentifier, ClientActions, PlayoutActions }

export enum IBlueprintDefaultCoreSystemTriggersType {
	toggleShelf = 'toggleShelf',
	activateRundownPlaylist = 'activateRundownPlaylist',
	activateRundownPlaylistRehearsal = 'activateRundownPlaylistRehearsal',
	deactivateRundownPlaylist = 'deactivateRundownPlaylist',
	take = 'take',
	hold = 'hold',
	holdUndo = 'holdUndo',
	resetRundownPlaylist = 'resetRundownPlaylist',
	disableNextPiece = 'disableNextPiece',
	disableNextPieceUndo = 'disableNextPieceUndo',
	createSnapshotForDebug = 'createSnapshotForDebug',
	moveNextPart = 'moveNextPart',
	moveNextSegment = 'moveNextSegment',
	movePreviousPart = 'movePreviousPart',
	movePreviousSegment = 'movePreviousSegment',
	goToOnAirLine = 'goToOnAirLine',
	rewindSegments = 'rewindSegments',
}

export type IBlueprintDefaultCoreSystemTriggers = {
	[key in IBlueprintDefaultCoreSystemTriggersType]: IBlueprintTriggeredActions
}
