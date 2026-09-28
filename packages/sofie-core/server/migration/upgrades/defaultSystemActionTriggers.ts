import {
	IBlueprintTriggeredActions,
	ClientActions,
	TriggerType,
	PlayoutActions,
	IBlueprintDefaultCoreSystemTriggersType,
	IBlueprintDefaultCoreSystemTriggers,
} from '@sofie-automation/blueprints-integration'
import { getHash, generateTranslation as t } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'

let j = 0

export const DEFAULT_CORE_TRIGGERS: IBlueprintDefaultCoreSystemTriggers = {
	[IBlueprintDefaultCoreSystemTriggersType.toggleShelf]: {
		_id: 'core_toggleShelf',
		actions: {
			'0': {
				action: ClientActions.shelf,
				filterChain: [
					{
						object: 'view',
					},
				],
				state: 'toggle',
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Tab',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Toggle Shelf'),
	},
	[IBlueprintDefaultCoreSystemTriggersType.activateRundownPlaylist]: {
		_id: 'core_activateRundownPlaylist',
		actions: {
			'0': {
				action: PlayoutActions.activateRundownPlaylist,
				rehearsal: false,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Backquote',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Activate (On-Air)'),
	},
	[IBlueprintDefaultCoreSystemTriggersType.activateRundownPlaylistRehearsal]: {
		_id: 'core_activateRundownPlaylist_rehearsal',
		actions: {
			'0': {
				action: PlayoutActions.activateRundownPlaylist,
				rehearsal: true,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Control+Backquote',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Activate (Rehearsal)'),
	},
	[IBlueprintDefaultCoreSystemTriggersType.deactivateRundownPlaylist]: {
		_id: 'core_deactivateRundownPlaylist',
		actions: {
			'0': {
				action: PlayoutActions.deactivateRundownPlaylist,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Control+Shift+Backquote',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Deactivate'),
	},
	[IBlueprintDefaultCoreSystemTriggersType.take]: {
		_id: 'core_take',
		actions: {
			'0': {
				action: PlayoutActions.take,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'NumpadEnter',
				up: true,
			},
			'1': {
				type: TriggerType.hotkey,
				keys: 'F12',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Take'),
	},
	[IBlueprintDefaultCoreSystemTriggersType.hold]: {
		_id: 'core_hold',
		actions: {
			'0': {
				action: PlayoutActions.hold,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'KeyH',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Hold'),
	},
	[IBlueprintDefaultCoreSystemTriggersType.holdUndo]: {
		_id: 'core_hold_undo',
		actions: {
			'0': {
				action: PlayoutActions.hold,
				undo: true,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Shift+KeyH',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Undo Hold'),
	},
	[IBlueprintDefaultCoreSystemTriggersType.resetRundownPlaylist]: {
		_id: 'core_reset_rundown_playlist',
		actions: {
			'0': {
				action: PlayoutActions.resetRundownPlaylist,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Control+Shift+F12',
				up: true,
			},
			'1': {
				type: TriggerType.hotkey,
				keys: 'Control+Shift+AnyEnter',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Reset Rundown'),
	},
	[IBlueprintDefaultCoreSystemTriggersType.disableNextPiece]: {
		_id: 'core_disable_next_piece',
		actions: {
			'0': {
				action: PlayoutActions.disableNextPiece,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'KeyG',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Disable the next element'),
	},
	[IBlueprintDefaultCoreSystemTriggersType.disableNextPieceUndo]: {
		_id: 'core_disable_next_piece_undo',
		actions: {
			'0': {
				action: PlayoutActions.disableNextPiece,
				filterChain: [
					{
						object: 'view',
					},
				],
				undo: true,
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Shift+KeyG',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Undo Disable the next element'),
	},
	[IBlueprintDefaultCoreSystemTriggersType.createSnapshotForDebug]: {
		_id: 'core_create_snapshot_for_debug',
		actions: {
			'0': {
				action: PlayoutActions.createSnapshotForDebug,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Backspace',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Store Snapshot'),
	},
	[IBlueprintDefaultCoreSystemTriggersType.moveNextPart]: {
		_id: 'core_move_next_part',
		actions: {
			'0': {
				action: PlayoutActions.moveNext,
				filterChain: [
					{
						object: 'view',
					},
				],
				parts: 1,
				segments: 0,
				ignoreQuickLoop: false,
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'F9',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Move Next forwards'),
	},
	[IBlueprintDefaultCoreSystemTriggersType.moveNextSegment]: {
		_id: 'core_move_next_segment',
		actions: {
			'0': {
				action: PlayoutActions.moveNext,
				filterChain: [
					{
						object: 'view',
					},
				],
				parts: 0,
				segments: 1,
				ignoreQuickLoop: false,
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'F10',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Move Next to the following segment'),
	},
	[IBlueprintDefaultCoreSystemTriggersType.movePreviousPart]: {
		_id: 'core_move_previous_part',
		actions: {
			'0': {
				action: PlayoutActions.moveNext,
				filterChain: [
					{
						object: 'view',
					},
				],
				parts: -1,
				segments: 0,
				ignoreQuickLoop: false,
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Shift+F9',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Move Next backwards'),
	},
	[IBlueprintDefaultCoreSystemTriggersType.movePreviousSegment]: {
		_id: 'core_move_previous_segment',
		actions: {
			'0': {
				action: PlayoutActions.moveNext,
				filterChain: [
					{
						object: 'view',
					},
				],
				parts: 0,
				segments: -1,
				ignoreQuickLoop: false,
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Shift+F10',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Move Next to the previous segment'),
	},
	[IBlueprintDefaultCoreSystemTriggersType.goToOnAirLine]: {
		_id: 'core_go_to_onAir_line',
		actions: {
			'0': {
				action: ClientActions.goToOnAirLine,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Control+Home',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Go to On Air line'),
	},
	[IBlueprintDefaultCoreSystemTriggersType.rewindSegments]: {
		_id: 'core_rewind_segments',
		actions: {
			'0': {
				action: ClientActions.rewindSegments,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Shift+Home',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Rewind segments to start'),
	},
}

export const DEFAULT_CORE_TRIGGER_IDS = Object.values<IBlueprintTriggeredActions>(DEFAULT_CORE_TRIGGERS).map(
	(triggeredAction) => protectString<TriggeredActionId>(getHash(triggeredAction._id))
)
