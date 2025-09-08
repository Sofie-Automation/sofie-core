import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import Sorensen from '@sofie-automation/sorensen'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { useSubscription, useTracker } from '../ReactMeteorData/ReactMeteorData.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlayoutActions, SomeAction, SomeBlueprintTrigger, TriggerType } from '@sofie-automation/blueprints-integration'
import {
	isPreviewableAction,
	ReactivePlaylistActionContext,
	createAction as libCreateAction,
} from '@sofie-automation/meteor-lib/dist/triggers/actionFactory'
import { flatten, protectString } from '../tempLib.js'
import { IWrappedAdLib } from '@sofie-automation/meteor-lib/dist/triggers/actionFilterChainCompilers'
import { ReactiveVar } from 'meteor/reactive-var'
import { preventDefault } from '../SorensenContext.js'
import { getFinalKey } from './codesToKeyLabels.js'
import { RundownViewEvents, TriggerActionEvent } from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { Tracker } from 'meteor/tracker'
import { Settings } from '../../lib/Settings.js'
import { createInMemorySyncMongoCollection } from '../../collections/lib.js'
import { RundownPlaylists } from '../../collections/index.js'
import { UIShowStyleBases, UITriggeredActions } from '../../ui/Collections.js'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import {
	PartId,
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
	StudioId,
	TriggeredActionId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	MountedAdLibTrigger,
	MountedGenericTrigger,
	MountedHotkeyMixin,
} from '@sofie-automation/meteor-lib/dist/api/MountedTriggers'
import { isHotkeyTrigger } from '@sofie-automation/meteor-lib/dist/triggers/triggerTypeSelectors'
import { RundownPlaylistCollectionUtil } from '../../collections/rundownPlaylistUtil.js'
import { catchError, useRundownViewEventBusListener } from '../lib.js'
import { logger } from '../logging.js'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { toTriggersComputation, toTriggersReactiveVar, UiTriggersContext } from './triggersContext.js'

type HotkeyTriggerListener = (e: KeyboardEvent) => void

interface IProps {
	studioId: StudioId
	rundownPlaylistId: RundownPlaylistId
	currentRundownId: RundownId | null
	showStyleBaseId: ShowStyleBaseId
	currentPartId: PartId | null
	nextPartId: PartId | null
	currentSegmentPartIds: PartId[]
	nextSegmentPartIds: PartId[]

	/** Should this component actually try to bind to the hotkeys, or should it just populate the MountedAdLibTriggers
	 * and MountedGenericTriggers collections. */
	simulateTriggerBinding?: boolean
	/** Provide an external Sorensen object, if Sorensen has already been initialized */
	sorensen?: typeof Sorensen
	/** A function that should be executed when a trigger is fired to check if it should execute or not - such as is the
	 * case with non-global hotkeys which should only fire when not in an Input.
	 */
	global?: (e: KeyboardEvent) => boolean
}

function useSubscriptions(
	rundownPlaylistId: RundownPlaylistId,
	rundownIds: RundownId[],
	showStyleBaseId: ShowStyleBaseId
) {
	const allReady = [
		useSubscription(CorelibPubSub.rundownPlaylists, [rundownPlaylistId], null),
		useSubscription(CorelibPubSub.rundownsInPlaylists, [rundownPlaylistId]),

		useSubscription(CorelibPubSub.adLibActions, rundownIds),
		useSubscription(CorelibPubSub.adLibPieces, rundownIds),
		useSubscription(CorelibPubSub.rundownBaselineAdLibActions, rundownIds),
		useSubscription(CorelibPubSub.rundownBaselineAdLibPieces, rundownIds),
		useSubscription(MeteorPubSub.uiShowStyleBase, showStyleBaseId),
	]

	return !allReady.some((state) => state === false)
}

function createAction(
	_id: TriggeredActionId,
	actions: SomeAction[],
	showStyleBase: UIShowStyleBase,
	t: TFunction,
	collectContext: (computation: Tracker.Computation | null) => ReactivePlaylistActionContext | null
): {
	listener: HotkeyTriggerListener
	preview: (computation: Tracker.Computation) => Promise<IWrappedAdLib[]>
} {
	const executableActions = actions.map((value) =>
		libCreateAction(UiTriggersContext, value, showStyleBase.sourceLayers)
	)
	return {
		preview: async (computation: Tracker.Computation) => {
			const trackerComputation = toTriggersComputation(computation)
			const ctx = collectContext(computation)
			if (!ctx) return []

			return flatten(
				await Promise.all(
					executableActions.map(
						async (action): Promise<IWrappedAdLib[]> =>
							isPreviewableAction(action) ? action.preview(ctx, trackerComputation) : []
					)
				)
			)
		},
		listener: (e) => {
			e.preventDefault()
			e.stopPropagation()

			const ctx = collectContext(null)
			if (ctx) {
				executableActions.forEach((action) =>
					Promise.resolve()
						.then(async () => action.execute(t, e, ctx))
						.catch((e) => {
							logger.error(`Execution Triggered Action "${_id}" failed: ${e}`)
						})
				)
			}
		},
	}
}

const rundownPlaylistContext: ReactiveVar<ReactivePlaylistActionContext | null> = new ReactiveVar(null)

function setRundownPlaylistContext(ctx: ReactivePlaylistActionContext | null) {
	rundownPlaylistContext.set(ctx)
}
function getCurrentContext(computation: Tracker.Computation | null): ReactivePlaylistActionContext | null {
	return rundownPlaylistContext.get(computation ?? undefined)
}

export const MountedAdLibTriggers = createInMemorySyncMongoCollection<MountedAdLibTrigger & MountedHotkeyMixin>(
	'MountedAdLibTrigger'
)
export const MountedGenericTriggers = createInMemorySyncMongoCollection<MountedGenericTrigger & MountedHotkeyMixin>(
	'MountedGenericTrigger'
)

export function isMountedAdLibTrigger(
	mountedTrigger: MountedAdLibTrigger | MountedGenericTrigger
): mountedTrigger is MountedAdLibTrigger {
	return 'targetId' in mountedTrigger && !!mountedTrigger['targetId']
}

function isolatedAutorunWithCleanup(
	autorun: (computation: Tracker.Computation) => Promise<void | (() => void)>
): Tracker.Computation {
	return Tracker.nonreactive(() =>
		Tracker.autorun(async (computation) => {
			const cleanUp = await autorun(computation)

			if (typeof cleanUp === 'function') {
				computation.onInvalidate(cleanUp)
			}
		})
	)
}

/**
 * This is a component that handles all Client-side triggers for Action Triggers.
 * Note: there can only be a single TriggersHandler in the node tree.
 *
 * @param {IProps} props
 * @return {*}
 */
export const TriggersHandler: React.FC<IProps> = function TriggersHandler(
	props: IProps
): React.ReactElement<any, any> | null {
	const [initialized, setInitialized] = useState(props.sorensen ? true : false)
	const { t } = useTranslation()
	const localSorensen = props.sorensen || Sorensen
	const createdActions = useRef<Map<TriggeredActionId, (e: any) => void>>(new Map())

	function bindHotkey(id: TriggeredActionId, keys: string, up: boolean, action: HotkeyTriggerListener) {
		try {
			localSorensen.bind(keys, action, {
				up,
				exclusive: true,
				ordered: 'modifiersFirst',
				preventDefaultPartials: false,
				preventDefaultDown: true,
				global: props.global ?? false,
				tag: id,
			})
		} catch (e) {
			logger.error(e)
		}
	}

	function unbindHotkey(keys: string, listener: (e: KeyboardEvent) => void) {
		localSorensen.unbind(keys, listener)
	}

	function triggerAction(e: TriggerActionEvent) {
		const listener = createdActions.current.get(e.actionId)
		if (listener) {
			listener(e.context)
		}
	}

	useEffect(() => {
		// if we're using a local instance of Sorensen
		if (!props.sorensen) {
			localSorensen
				.init()
				.then(() => {
					setInitialized(true)
				})
				.catch(catchError('localSorensen.init'))
		}

		return () => {
			// do not destroy, if we're using a provided instance of Sorensen
			if (!props.sorensen) {
				localSorensen.destroy().catch(catchError('localSorensen.destroy'))
			}
		}
	}, []) // run once

	useEffect(() => {
		if (rundownPlaylistContext.get() !== null) {
			throw new Error('There can only be a single instance of TriggersHandler in the Node tree.')
		}

		return () => {
			setRundownPlaylistContext(null)
		}
	}, [])

	function poisonHotkeys() {
		localSorensen.poison() // cancels all pressed keys, poisons all chords, no hotkey trigger will execute
	}

	useEffect(() => {
		const fKeys = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F12'] // not 'F11', because people use that apparently
		const ctrlDigitKeys = [
			// Ctrl+DigitX is a shortcut for switching Tabs in some browsers
			'Digit1',
			'Digit2',
			'Digit3',
			'Digit4',
			'Digit5',
			'Digit6',
			'Digit7',
			'Digit8',
			'Digit9',
			'Digit0',
		]

		const poisonKey: string | null = Settings.poisonKey

		if (initialized) {
			if (poisonKey) {
				localSorensen.bind(poisonKey, poisonHotkeys, {
					exclusive: false,
					global: true,
				})
			}

			// block Control+KeyF only if this is running in a context where other key bindings will be bound
			if (!props.simulateTriggerBinding) {
				localSorensen.bind('Control+KeyF', preventDefault, {
					global: true,
					exclusive: true,
					ordered: 'modifiersFirst',
					preventDefaultPartials: false,
				})
				localSorensen.bind('Control+F5', preventDefault, {
					global: true,
					exclusive: true,
					ordered: false,
					preventDefaultPartials: false,
				})
				fKeys.forEach((key) =>
					localSorensen.bind(key, preventDefault, {
						exclusive: false,
						global: true,
					})
				)
				ctrlDigitKeys.forEach((key) =>
					localSorensen.bind(`Control+${key}`, preventDefault, {
						exclusive: true,
						global: true,
						ordered: true,
						preventDefaultPartials: false,
					})
				)
			}
		}

		return () => {
			if (poisonKey) {
				localSorensen.unbind(poisonKey, poisonHotkeys)
			}
			localSorensen.unbind('Control+KeyF', preventDefault)
			localSorensen.unbind('Control+F5', preventDefault)
			fKeys.forEach((key) => localSorensen.unbind(key, preventDefault))
			ctrlDigitKeys.forEach((key) => localSorensen.unbind(`Control+${key}`, preventDefault))
		}
	}, [initialized]) // run once once Sorensen is initialized

	useRundownViewEventBusListener(RundownViewEvents.TRIGGER_ACTION, triggerAction)

	useEffect(() => {
		Tracker.nonreactive(() => {
			const playlist = RundownPlaylists.findOne(props.rundownPlaylistId, {
				fields: {
					_id: 1,
					name: 1,
					activationId: 1,
					nextPartInfo: 1,
					currentPartInfo: 1,
				},
			}) as Pick<DBRundownPlaylist, '_id' | 'name' | 'activationId' | 'nextPartInfo' | 'currentPartInfo'> | undefined
			if (playlist) {
				let context = rundownPlaylistContext.get()
				if (context === null) {
					context = {
						studioId: toTriggersReactiveVar(new ReactiveVar(props.studioId)),
						rundownPlaylistId: toTriggersReactiveVar(new ReactiveVar(playlist._id)),
						rundownPlaylist: toTriggersReactiveVar(new ReactiveVar(playlist)),
						currentRundownId: toTriggersReactiveVar(new ReactiveVar(props.currentRundownId)),
						currentPartId: toTriggersReactiveVar(new ReactiveVar(props.currentPartId)),
						nextPartId: toTriggersReactiveVar(new ReactiveVar(props.nextPartId)),
						currentSegmentPartIds: toTriggersReactiveVar(new ReactiveVar(props.currentSegmentPartIds)),
						nextSegmentPartIds: toTriggersReactiveVar(new ReactiveVar(props.nextSegmentPartIds)),
						currentPartInstanceId: toTriggersReactiveVar(
							new ReactiveVar(playlist.currentPartInfo?.partInstanceId ?? null)
						),
					}
					rundownPlaylistContext.set(context)
				} else {
					context.rundownPlaylistId.set(playlist._id)
					context.rundownPlaylist.set(playlist)
					context.currentRundownId.set(props.currentRundownId)
					context.currentPartId.set(props.currentPartId)
					context.nextPartId.set(props.nextPartId)
					context.currentSegmentPartIds.set(props.currentSegmentPartIds)
					context.nextSegmentPartIds.set(props.nextSegmentPartIds)
				}
			}
		})
	}, [
		props.studioId,
		props.rundownPlaylistId,
		props.currentRundownId,
		props.currentPartId,
		JSON.stringify(props.currentSegmentPartIds),
		props.nextPartId,
		JSON.stringify(props.nextSegmentPartIds),
	])

	const triggerSubReady = useSubscription(MeteorPubSub.uiTriggeredActions, props.showStyleBaseId)

	const rundownIds =
		useTracker(() => {
			const playlist = RundownPlaylists.findOne(props.rundownPlaylistId, {
				fields: {
					_id: 1,
				},
			})
			if (playlist) {
				return RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)
			}
			return []
		}, [props.rundownPlaylistId]) || []

	const showStyleBase = useTracker(() => UIShowStyleBases.findOne(props.showStyleBaseId), [props.showStyleBaseId])

	useSubscriptions(props.rundownPlaylistId, rundownIds, props.showStyleBaseId)

	const triggeredActions = useTracker(() => {
		return UITriggeredActions.find(
			{
				showStyleBaseId: {
					$in: [null, props.showStyleBaseId],
				},
			},
			{
				sort: {
					showStyleBaseId: 1,
					_rank: 1,
				},
			}
		).fetch()
	}, [props.showStyleBaseId])

	useEffect(() => {
		if (!triggeredActions || !initialized || !showStyleBase || !triggerSubReady) {
			return
		}

		createdActions.current = new Map()
		const previewAutoruns: Tracker.Computation[] = []

		triggeredActions.forEach((pair) => {
			const action = createAction(
				pair._id,
				Object.values<SomeAction>(pair.actions),
				showStyleBase,
				t,
				getCurrentContext
			)
			if (!props.simulateTriggerBinding) {
				createdActions.current.set(pair._id, action.listener)
				Object.values<SomeBlueprintTrigger>(pair.triggers).forEach((trigger) => {
					if (trigger.type !== TriggerType.hotkey) return
					if (trigger.keys.trim() === '') return
					bindHotkey(pair._id, trigger.keys, !!trigger.up, action.listener)
				})
			}

			if (pair.name) {
				const triggers = Object.values<SomeBlueprintTrigger>(pair.triggers).filter(
					(trigger) => trigger.type === TriggerType.hotkey
				)
				const genericTriggerId = protectString(`${pair._id}`)
				const keys = triggers.filter(isHotkeyTrigger).map((trigger) => trigger.keys)
				const finalKeys = keys.map((key) => getFinalKey(key))
				const adLibOnly = Object.values<SomeAction>(pair.actions).every(
					(actionDescriptor) => actionDescriptor.action === PlayoutActions.adlib
				)
				MountedGenericTriggers.upsert(genericTriggerId, {
					$set: {
						_id: genericTriggerId,
						_rank: pair._rank,
						triggeredActionId: pair._id,
						keys,
						finalKeys,
						name: pair.name,
						adLibOnly,
					},
				})
			}

			const hotkeyTriggers = Object.values<SomeBlueprintTrigger>(pair.triggers)
				.filter(isHotkeyTrigger)
				.map((trigger) => trigger.keys)

			const hotkeyFinalKeys = hotkeyTriggers.map((key) => getFinalKey(key))

			previewAutoruns.push(
				isolatedAutorunWithCleanup(async (computation) => {
					let previewAdLibs: IWrappedAdLib[] = []
					try {
						previewAdLibs = await action.preview(computation)
					} catch (e) {
						logger.error(e)
					}

					previewAdLibs.forEach((adLib) => {
						const triggerId = protectString(pair._id + '_' + adLib._id + '_' + adLib.type)
						MountedAdLibTriggers.upsert(triggerId, {
							$set: {
								_id: triggerId,
								_rank: pair._rank,
								targetId: adLib._id,
								type: adLib.type,
								triggeredActionId: pair._id,
								keys: hotkeyTriggers,
								finalKeys: hotkeyFinalKeys,
								name: pair.name,
								targetName: adLib.label,
								sourceLayerId: adLib.sourceLayerId,
							},
						})
					})

					return () => {
						MountedAdLibTriggers.remove({
							triggeredActionId: pair._id,
						})
					}
				})
			)
		})

		return () => {
			if (initialized) {
				triggeredActions.forEach((pair) => {
					const actionListener = createdActions.current.get(pair._id)
					if (actionListener) {
						Object.values<SomeBlueprintTrigger>(pair.triggers).forEach((trigger) => {
							if (trigger.type !== TriggerType.hotkey) return
							if (trigger.keys.trim() === '') return
							unbindHotkey(trigger.keys, actionListener)
						})
					}

					if (pair.name) {
						MountedGenericTriggers.remove({
							triggeredActionId: pair._id,
						})
					}
				})
			}

			previewAutoruns.forEach((autorun) => autorun.stop())
		}
	}, [triggeredActions, initialized, showStyleBase, triggerSubReady])

	return null
}

const windowAny: any = window
windowAny['MountedAdLibTriggers'] = MountedAdLibTriggers
windowAny['MountedGenericTriggers'] = MountedGenericTriggers
