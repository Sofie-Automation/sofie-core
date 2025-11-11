import {
	ClientActions,
	IAdlibPlayoutActionArguments,
	IBaseFilterLink,
	IGUIContextFilterLink,
	ITriggeredActionBase,
	PlayoutActions,
	SomeAction,
	Time,
} from '@sofie-automation/blueprints-integration'
import { TFunction } from 'i18next'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBShowStyleBase, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import RundownViewEventBus, { RundownViewEvents } from '../triggers/RundownViewEventBus.js'
import { UserAction } from '../userAction.js'
import { AdLibFilterChainLink, compileAdLibFilter, IWrappedAdLib } from './actionFilterChainCompilers.js'
import { ClientAPI } from '../api/client.js'
import {
	PartId,
	PartInstanceId,
	RundownId,
	RundownPlaylistId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DeviceActions } from '@sofie-automation/shared-lib/dist/core/model/ShowStyle'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { MountedAdLibTriggerType } from '../api/MountedTriggers.js'
import { DummyReactiveVar, TriggerReactiveVar } from './reactive-var.js'
import { TriggersContext, TriggerTrackerComputation } from './triggersContext.js'
import { assertNever } from '@sofie-automation/corelib/dist/lib'

// as described in this issue: https://github.com/Microsoft/TypeScript/issues/14094
type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never }
type XOR<T, U> = T | U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U

export interface ReactivePlaylistActionContext {
	studioId: TriggerReactiveVar<StudioId>
	rundownPlaylistId: TriggerReactiveVar<RundownPlaylistId>
	rundownPlaylist: TriggerReactiveVar<
		Pick<DBRundownPlaylist, '_id' | 'name' | 'activationId' | 'nextPartInfo' | 'currentPartInfo'>
	>

	currentRundownId: TriggerReactiveVar<RundownId | null>
	currentSegmentPartIds: TriggerReactiveVar<PartId[]>
	nextSegmentPartIds: TriggerReactiveVar<PartId[]>
	currentPartInstanceId: TriggerReactiveVar<PartInstanceId | null>
	currentPartId: TriggerReactiveVar<PartId | null>
	nextPartId: TriggerReactiveVar<PartId | null>
}

interface PlainPlaylistContext {
	rundownPlaylist: DBRundownPlaylist
	currentRundownId: RundownId | null
	currentSegmentPartIds: PartId[]
	nextSegmentPartIds: PartId[]
	currentPartId: PartId | null
	nextPartId: PartId | null
}

interface PlainStudioContext {
	studio: DBStudio
	showStyleBase: DBShowStyleBase
}

export type PlainActionContext = XOR<PlainPlaylistContext, PlainStudioContext>

export type ActionContext = XOR<ReactivePlaylistActionContext, PlainActionContext>

type ActionExecutor = (t: TFunction, e: any, ctx: ActionContext) => Promise<void> | void

/**
 * An action compiled down to a single function that can be executed
 *
 * @interface ExecutableAction
 */
export interface ExecutableAction {
	action: ITriggeredActionBase['action']
	/** Execute the action */
	execute: ActionExecutor
}

/**
 * Optionally, the ExecutableAction can support a preview. Currently this is only implemented for AdLib actions.
 * This will then return a list of the targeted AdLibs using the normalized form of `IWrappedAdLib`
 *
 * @interface PreviewableAction
 * @extends {ExecutableAction}
 */
interface PreviewableAction extends ExecutableAction {
	preview: (ctx: ActionContext, computation: TriggerTrackerComputation | null) => Promise<IWrappedAdLib[]>
}

interface ExecutableAdLibAction extends PreviewableAction {
	action: PlayoutActions.adlib
}

export function isPreviewableAction(action: ExecutableAction): action is PreviewableAction {
	return action.action && 'preview' in action && typeof action['preview'] === 'function'
}
async function createRundownPlaylistContext(
	computation: TriggerTrackerComputation | null,
	triggersContext: TriggersContext,
	context: ActionContext,
	filterChain: IBaseFilterLink[]
): Promise<ReactivePlaylistActionContext | undefined> {
	if (filterChain.length < 1) {
		return undefined
	} else if (filterChain[0].object === 'view' && context.rundownPlaylistId) {
		return context as ReactivePlaylistActionContext
	} else if (filterChain[0].object === 'view' && context.rundownPlaylist) {
		const playlistContext = context as PlainPlaylistContext
		return triggersContext.withComputation(computation, async () => {
			return {
				studioId: new DummyReactiveVar(playlistContext.rundownPlaylist.studioId),
				rundownPlaylistId: new DummyReactiveVar(playlistContext.rundownPlaylist._id),
				rundownPlaylist: new DummyReactiveVar(playlistContext.rundownPlaylist),
				currentRundownId: new DummyReactiveVar(playlistContext.currentRundownId),
				currentPartId: new DummyReactiveVar(playlistContext.currentPartId),
				nextPartId: new DummyReactiveVar(playlistContext.nextPartId),
				currentSegmentPartIds: new DummyReactiveVar(playlistContext.currentSegmentPartIds),
				nextSegmentPartIds: new DummyReactiveVar(playlistContext.nextSegmentPartIds),
				currentPartInstanceId: new DummyReactiveVar(
					playlistContext.rundownPlaylist.currentPartInfo?.partInstanceId ?? null
				),
			}
		})
	} else if (filterChain[0].object === 'rundownPlaylist' && context.studio) {
		// Note: this is only implemented on the server
		return triggersContext.createContextForRundownPlaylistChain(context.studio._id, filterChain)
	} else {
		throw new Error('Invalid filter combination')
	}
}

/**
 * The big one. This compiles the AdLib filter chain and then executes appropriate UserAction's, depending on a
 * particular AdLib type
 *
 * @param {AdLibFilterChainLink[]} filterChain
 * @param {SourceLayers} sourceLayers
 * @return {*}  {ExecutableAdLibAction}
 */
function createAdLibAction(
	triggersContext: TriggersContext,
	filterChain: AdLibFilterChainLink[],
	sourceLayers: SourceLayers,
	actionArguments: IAdlibPlayoutActionArguments | undefined
): ExecutableAdLibAction {
	const compiledAdLibFilter = compileAdLibFilter(triggersContext, filterChain, sourceLayers)

	return {
		action: PlayoutActions.adlib,
		preview: async (ctx, computation) => {
			const innerCtx = await createRundownPlaylistContext(computation, triggersContext, ctx, filterChain)

			if (innerCtx) {
				try {
					return compiledAdLibFilter(innerCtx, computation)
				} catch (e) {
					triggersContext.logger.error(e)
					return []
				}
			} else {
				return []
			}
		},
		execute: async (t, e, ctx) => {
			const innerCtx = await createRundownPlaylistContext(null, triggersContext, ctx, filterChain)

			if (!innerCtx) {
				triggersContext.logger.warn(
					`Could not create RundownPlaylist context for executable AdLib Action`,
					filterChain
				)
				return
			}
			const currentPartInstanceId = innerCtx.rundownPlaylist.get(null).currentPartInfo?.partInstanceId

			const sourceLayerIdsToClear: string[] = []

			// This withComputation is probably not needed, but it ensures there is no accidental reactivity
			const wrappedAdLibs = await triggersContext.withComputation(null, async () =>
				compiledAdLibFilter(innerCtx, null)
			)

			wrappedAdLibs.forEach((wrappedAdLib) => {
				switch (wrappedAdLib.type) {
					case MountedAdLibTriggerType.adLibPiece:
						triggersContext.doUserAction(t, e, UserAction.START_ADLIB, async (e, ts) =>
							currentPartInstanceId
								? triggersContext.MeteorCall.userAction.segmentAdLibPieceStart(
										e,
										ts,
										innerCtx.rundownPlaylistId.get(null),
										currentPartInstanceId,
										wrappedAdLib.item._id,
										false
									)
								: ClientAPI.responseSuccess<void>(undefined)
						)
						break
					case MountedAdLibTriggerType.rundownBaselineAdLibItem:
						triggersContext.doUserAction(t, e, UserAction.START_GLOBAL_ADLIB, async (e, ts) =>
							currentPartInstanceId
								? triggersContext.MeteorCall.userAction.baselineAdLibPieceStart(
										e,
										ts,
										innerCtx.rundownPlaylistId.get(null),
										currentPartInstanceId,
										wrappedAdLib.item._id,
										false
									)
								: ClientAPI.responseSuccess<void>(undefined)
						)
						break
					case MountedAdLibTriggerType.adLibAction:
						triggersContext.doUserAction(t, e, UserAction.START_ADLIB, async (e, ts) =>
							triggersContext.MeteorCall.userAction.executeAction(
								e,
								ts,
								innerCtx.rundownPlaylistId.get(null),
								wrappedAdLib._id,
								wrappedAdLib.item.actionId,
								wrappedAdLib.item.userData,
								(actionArguments && actionArguments.triggerMode) || undefined
							)
						)
						break
					case MountedAdLibTriggerType.rundownBaselineAdLibAction:
						triggersContext.doUserAction(t, e, UserAction.START_GLOBAL_ADLIB, async (e, ts) =>
							triggersContext.MeteorCall.userAction.executeAction(
								e,
								ts,
								innerCtx.rundownPlaylistId.get(null),
								wrappedAdLib._id,
								wrappedAdLib.item.actionId,
								wrappedAdLib.item.userData,
								(actionArguments && actionArguments.triggerMode) || undefined
							)
						)
						break
					case MountedAdLibTriggerType.clearSourceLayer:
						// defer this action to send a single clear action all at once
						sourceLayerIdsToClear.push(wrappedAdLib.sourceLayerId)
						break
					case MountedAdLibTriggerType.sticky:
						triggersContext.doUserAction(t, e, UserAction.START_STICKY_PIECE, async (e, ts) =>
							triggersContext.MeteorCall.userAction.sourceLayerStickyPieceStart(
								e,
								ts,
								innerCtx.rundownPlaylistId.get(null),
								wrappedAdLib.sourceLayerId //
							)
						)
						break
					default:
						assertNever(wrappedAdLib)
						return
				}
			})

			if (currentPartInstanceId && sourceLayerIdsToClear.length > 0) {
				triggersContext.doUserAction(t, e, UserAction.CLEAR_SOURCELAYER, async (e, ts) =>
					triggersContext.MeteorCall.userAction.sourceLayerOnPartStop(
						e,
						ts,
						innerCtx.rundownPlaylistId.get(null),
						currentPartInstanceId,
						sourceLayerIdsToClear
					)
				)
			}
		},
	}
}

function createShelfAction(_filterChain: IGUIContextFilterLink[], state: boolean | 'toggle'): ExecutableAction {
	return {
		action: ClientActions.shelf,
		execute: () => {
			RundownViewEventBus.emit(RundownViewEvents.SHELF_STATE, {
				state,
			})
		},
	}
}

function createMiniShelfQueueAdLibAction(_filterChain: IGUIContextFilterLink[], forward: boolean): ExecutableAction {
	return {
		action: ClientActions.miniShelfQueueAdLib,
		execute: (_t, e) => {
			RundownViewEventBus.emit(RundownViewEvents.MINI_SHELF_QUEUE_ADLIB, {
				forward,
				context: e,
			})
		},
	}
}

function createGoToOnAirLineAction(_filterChain: IGUIContextFilterLink[]): ExecutableAction {
	return {
		action: ClientActions.goToOnAirLine,
		execute: () => {
			RundownViewEventBus.emit(RundownViewEvents.GO_TO_LIVE_SEGMENT)
		},
	}
}

function createRewindSegmentsAction(_filterChain: IGUIContextFilterLink[]): ExecutableAction {
	return {
		action: ClientActions.rewindSegments,
		execute: () => {
			RundownViewEventBus.emit(RundownViewEvents.REWIND_SEGMENTS)
		},
	}
}

function createRundownPlaylistSoftTakeAction(_filterChain: IGUIContextFilterLink[]): ExecutableAction {
	return {
		action: PlayoutActions.take,
		execute: (_t, e) => {
			RundownViewEventBus.emit(RundownViewEvents.TAKE, {
				context: e,
			})
		},
	}
}

function createRundownPlaylistSoftActivateAction(
	_filterChain: IGUIContextFilterLink[],
	rehearsal: boolean
): ExecutableAction {
	return {
		action: PlayoutActions.activateRundownPlaylist,
		execute: (_t, e) => {
			RundownViewEventBus.emit(RundownViewEvents.ACTIVATE_RUNDOWN_PLAYLIST, {
				context: e,
				rehearsal,
			})
		},
	}
}

function createRundownPlaylistSoftDeactivateAction(): ExecutableAction {
	return {
		action: PlayoutActions.deactivateRundownPlaylist,
		execute: (_t, e) => {
			RundownViewEventBus.emit(RundownViewEvents.DEACTIVATE_RUNDOWN_PLAYLIST, {
				context: e,
			})
		},
	}
}

function createRundownPlaylistSoftResyncAction(_filterChain: IGUIContextFilterLink[]): ExecutableAction {
	return {
		action: PlayoutActions.resyncRundownPlaylist,
		execute: (_t, e) => {
			RundownViewEventBus.emit(RundownViewEvents.RESYNC_RUNDOWN_PLAYLIST, {
				context: e,
			})
		},
	}
}

function createShowEntireCurrentSegmentAction(_filterChain: IGUIContextFilterLink[], on: boolean): ExecutableAction {
	return {
		action: ClientActions.showEntireCurrentSegment,
		execute: () => {
			if (on) {
				RundownViewEventBus.emit(RundownViewEvents.SEGMENT_ZOOM_ON)
			} else {
				RundownViewEventBus.emit(RundownViewEvents.SEGMENT_ZOOM_OFF)
			}
		},
	}
}

function createRundownPlaylistSoftResetRundownAction(_filterChain: IGUIContextFilterLink[]): ExecutableAction {
	return {
		action: PlayoutActions.resetRundownPlaylist,
		execute: (_t, e) => {
			RundownViewEventBus.emit(RundownViewEvents.RESET_RUNDOWN_PLAYLIST, {
				context: e,
			})
		},
	}
}

function createTakeRundownSnapshotAction(_filterChain: IGUIContextFilterLink[]): ExecutableAction {
	return {
		action: PlayoutActions.createSnapshotForDebug,
		execute: (_t, e) => {
			RundownViewEventBus.emit(RundownViewEvents.CREATE_SNAPSHOT_FOR_DEBUG, {
				context: e,
			})
		},
	}
}

/**
 * A utility method to create an ExecutableAction wrapping a simple UserAction call that takes some variables from
 * InternalActionContext as input
 *
 * @param {SomeAction} action
 * @param {UserAction} userAction
 * @param {(e: any, ctx: InternalActionContext) => Promise<ClientAPI.ClientResponse<any>>} userActionExec
 * @return {*}  {ExecutableAction}
 */
function createUserActionWithCtx(
	triggersContext: TriggersContext,
	action: SomeAction,
	userAction: UserAction,
	userActionExec: (e: string, ts: Time, ctx: ReactivePlaylistActionContext) => Promise<ClientAPI.ClientResponse<any>>
): ExecutableAction {
	return {
		action: action.action,
		execute: async (t, e, ctx) => {
			// This outer withComputation is probably not needed, but it ensures there is no accidental reactivity
			const innerCtx = await triggersContext.withComputation(null, async () =>
				createRundownPlaylistContext(null, triggersContext, ctx, action.filterChain)
			)
			if (innerCtx) {
				triggersContext.doUserAction(t, e, userAction, async (e, ts) => userActionExec(e, ts, innerCtx))
			}
		},
	}
}

/**
 * This is a factory method to create the ExecutableAction from a SomeAction-type description
 * @param action
 * @param sourceLayers
 * @returns
 */
export function createAction(
	triggersContext: TriggersContext,
	action: SomeAction,
	sourceLayers: SourceLayers
): ExecutableAction {
	switch (action.action) {
		case ClientActions.shelf:
			return createShelfAction(action.filterChain, action.state)
		case ClientActions.goToOnAirLine:
			return createGoToOnAirLineAction(action.filterChain)
		case ClientActions.rewindSegments:
			return createRewindSegmentsAction(action.filterChain)
		case PlayoutActions.adlib:
			return createAdLibAction(triggersContext, action.filterChain, sourceLayers, action.arguments || undefined)
		case PlayoutActions.activateRundownPlaylist:
			if (action.force) {
				return createUserActionWithCtx(
					triggersContext,
					action,
					UserAction.DEACTIVATE_OTHER_RUNDOWN_PLAYLIST,
					async (e, ts, ctx) =>
						triggersContext.MeteorCall.userAction.forceResetAndActivate(
							e,
							ts,
							ctx.rundownPlaylistId.get(null),
							!!action.rehearsal || false
						)
				)
			} else {
				if (isActionTriggeredFromUiContext(triggersContext, action)) {
					return createRundownPlaylistSoftActivateAction(
						action.filterChain as IGUIContextFilterLink[],
						!!action.rehearsal
					)
				} else {
					return createUserActionWithCtx(
						triggersContext,
						action,
						UserAction.ACTIVATE_RUNDOWN_PLAYLIST,
						async (e, ts, ctx) =>
							triggersContext.MeteorCall.userAction.activate(
								e,
								ts,
								ctx.rundownPlaylistId.get(null),
								!!action.rehearsal || false
							)
					)
				}
			}
		case PlayoutActions.deactivateRundownPlaylist:
			if (isActionTriggeredFromUiContext(triggersContext, action)) {
				return createRundownPlaylistSoftDeactivateAction()
			}
			return createUserActionWithCtx(
				triggersContext,
				action,
				UserAction.DEACTIVATE_RUNDOWN_PLAYLIST,
				async (e, ts, ctx) =>
					triggersContext.MeteorCall.userAction.deactivate(e, ts, ctx.rundownPlaylistId.get(null))
			)
		case PlayoutActions.activateAdlibTestingMode:
			return createUserActionWithCtx(
				triggersContext,
				action,
				UserAction.ACTIVATE_ADLIB_TESTING,
				async (e, ts, ctx) => {
					const rundownId = ctx.currentRundownId.get(null)
					if (rundownId) {
						return triggersContext.MeteorCall.userAction.activateAdlibTestingMode(
							e,
							ts,
							ctx.rundownPlaylistId.get(null),
							rundownId
						)
					} else {
						return ClientAPI.responseError(UserError.create(UserErrorMessage.InactiveRundown))
					}
				}
			)
		case PlayoutActions.take:
			if (isActionTriggeredFromUiContext(triggersContext, action)) {
				return createRundownPlaylistSoftTakeAction(action.filterChain as IGUIContextFilterLink[])
			} else {
				return createUserActionWithCtx(triggersContext, action, UserAction.TAKE, async (e, ts, ctx) =>
					triggersContext.MeteorCall.userAction.take(
						e,
						ts,
						ctx.rundownPlaylistId.get(null),
						ctx.currentPartInstanceId.get(null)
					)
				)
			}
		case PlayoutActions.hold:
			return createUserActionWithCtx(triggersContext, action, UserAction.ACTIVATE_HOLD, async (e, ts, ctx) =>
				triggersContext.MeteorCall.userAction.activateHold(
					e,
					ts,
					ctx.rundownPlaylistId.get(null),
					!!action.undo
				)
			)
		case PlayoutActions.disableNextPiece:
			return createUserActionWithCtx(triggersContext, action, UserAction.DISABLE_NEXT_PIECE, async (e, ts, ctx) =>
				triggersContext.MeteorCall.userAction.disableNextPiece(
					e,
					ts,
					ctx.rundownPlaylistId.get(null),
					!!action.undo
				)
			)
		case PlayoutActions.createSnapshotForDebug:
			if (isActionTriggeredFromUiContext(triggersContext, action)) {
				return createTakeRundownSnapshotAction(action.filterChain as IGUIContextFilterLink[])
			} else {
				return createUserActionWithCtx(
					triggersContext,
					action,
					UserAction.CREATE_SNAPSHOT_FOR_DEBUG,
					async (e, ts, ctx) =>
						triggersContext.MeteorCall.system.generateSingleUseToken().then(async (tokenResult) => {
							if (ClientAPI.isClientResponseError(tokenResult))
								throw UserError.fromSerialized(tokenResult.error)
							if (!tokenResult.result) throw new Error('Failed to generate token')
							return triggersContext.MeteorCall.userAction.storeRundownSnapshot(
								e,
								ts,
								triggersContext.hashSingleUseToken(tokenResult.result),
								ctx.rundownPlaylistId.get(null),
								`action`,
								false
							)
						})
				)
			}
		case PlayoutActions.moveNext:
			return createUserActionWithCtx(triggersContext, action, UserAction.MOVE_NEXT, async (e, ts, ctx) => {
				return triggersContext.MeteorCall.userAction.moveNext(
					e,
					ts,
					ctx.rundownPlaylistId.get(null),
					action.parts ?? 0,
					action.segments ?? 0,
					action.ignoreQuickLoop
				)
			})
		case PlayoutActions.reloadRundownPlaylistData:
			if (isActionTriggeredFromUiContext(triggersContext, action)) {
				return createRundownPlaylistSoftResyncAction(action.filterChain as IGUIContextFilterLink[])
			} else {
				return createUserActionWithCtx(
					triggersContext,
					action,
					UserAction.RELOAD_RUNDOWN_PLAYLIST_DATA,
					async (e, ts, ctx) =>
						// TODO: Needs some handling of the response. Perhaps this should switch to
						// an event on the RundownViewEventBus, if ran on the client?
						triggersContext.MeteorCall.userAction.resyncRundownPlaylist(
							e,
							ts,
							ctx.rundownPlaylistId.get(null)
						)
				)
			}
		case PlayoutActions.resetRundownPlaylist:
			if (isActionTriggeredFromUiContext(triggersContext, action)) {
				return createRundownPlaylistSoftResetRundownAction(action.filterChain as IGUIContextFilterLink[])
			} else {
				return createUserActionWithCtx(
					triggersContext,
					action,
					UserAction.RESET_RUNDOWN_PLAYLIST,
					async (e, ts, ctx) =>
						triggersContext.MeteorCall.userAction.resetRundownPlaylist(
							e,
							ts,
							ctx.rundownPlaylistId.get(null)
						)
				)
			}
		case PlayoutActions.resyncRundownPlaylist:
			return createUserActionWithCtx(
				triggersContext,
				action,
				UserAction.RESYNC_RUNDOWN_PLAYLIST,
				async (e, ts, ctx) =>
					triggersContext.MeteorCall.userAction.resyncRundownPlaylist(e, ts, ctx.rundownPlaylistId.get(null))
			)
		case PlayoutActions.switchRouteSet:
			return createUserActionWithCtx(triggersContext, action, UserAction.SWITCH_ROUTE_SET, async (e, ts, ctx) =>
				triggersContext.MeteorCall.userAction.switchRouteSet(
					e,
					ts,
					ctx.studioId.get(null),
					action.routeSetId,
					action.state
				)
			)
		case ClientActions.showEntireCurrentSegment:
			return createShowEntireCurrentSegmentAction(action.filterChain, action.on)
		case ClientActions.miniShelfQueueAdLib:
			return createMiniShelfQueueAdLibAction(action.filterChain, action.forward)
		case DeviceActions.modifyShiftRegister:
			return {
				action: action.action,
				execute: () => {
					// do nothing
				},
			}
		default:
			assertNever(action)
			break
	}

	// return a NO-OP, if not recognized
	return {
		// @ts-expect-error action.action is "never", based on TypeScript rules, but if input doesn't folllow them,
		// it can actually exist
		action: action.action,
		execute: () => {
			// Nothing
		},
	}
}

function isActionTriggeredFromUiContext(triggersContext: TriggersContext, action: SomeAction): boolean {
	return triggersContext.isClient && action.filterChain.every((link) => link.object === 'view')
}
