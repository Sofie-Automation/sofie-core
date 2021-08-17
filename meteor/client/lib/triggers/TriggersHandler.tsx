import * as React from 'react'
import { useEffect, useState } from 'react'
import { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import Sorensen from 'sorensen'
import { PubSub } from '../../../lib/api/pubsub'
import { ShowStyleBase, ShowStyleBaseId, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { TriggeredActionId, TriggeredActions } from '../../../lib/collections/TriggeredActions'
import { useSubscription, useTracker } from '../ReactMeteorData/ReactMeteorData'
import { RundownPlaylistId, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { ISourceLayer, SomeAction, TriggerType } from '@sofie-automation/blueprints-integration'
import { RundownId } from '../../../lib/collections/Rundowns'
import {
	ActionContext,
	createAction as libCreateAction,
	isPreviewableAction,
} from '../../../lib/api/triggers/actionFactory'
import { Tracker } from 'meteor/tracker'
import { PartId } from '../../../lib/collections/Parts'
import { flatten, ProtectedString, protectString } from '../../../lib/lib'
import { IWrappedAdLib } from '../../../lib/api/triggers/actionFilterChainCompilers'
import { Mongo } from 'meteor/mongo'
import { AdLibActionId } from '../../../lib/collections/AdLibActions'
import { RundownBaselineAdLibActionId } from '../../../lib/collections/RundownBaselineAdLibActions'
import { PieceId } from '../../../lib/collections/Pieces'
import { ReactiveVar } from 'meteor/reactive-var'

type HotkeyTriggerListener = (e: KeyboardEvent) => void

interface IProps {
	rundownPlaylistId: RundownPlaylistId
	showStyleBaseId: ShowStyleBaseId
	currentPartId: PartId | null
	nextPartId: PartId | null
	currentSegmentPartIds: PartId[]
	nextSegmentPartIds: PartId[]

	simulateTriggerBinding?: boolean
	sorensen?: typeof Sorensen
}

function useSubscriptions(
	rundownPlaylistId: RundownPlaylistId,
	rundownIds: RundownId[],
	showStyleBaseId: ShowStyleBaseId
) {
	const allReady = [
		useSubscription(PubSub.rundownPlaylists, {
			_id: rundownPlaylistId,
		}),
		useSubscription(PubSub.rundowns, {
			playlistId: rundownPlaylistId,
		}),

		useSubscription(PubSub.adLibActions, {
			rundownId: {
				$in: rundownIds,
			},
		}),
		useSubscription(PubSub.adLibPieces, {
			rundownId: {
				$in: rundownIds,
			},
		}),
		useSubscription(PubSub.rundownBaselineAdLibActions, {
			rundownId: {
				$in: rundownIds,
			},
		}),
		useSubscription(PubSub.rundownBaselineAdLibPieces, {
			rundownId: {
				$in: rundownIds,
			},
		}),
		useSubscription(PubSub.showStyleBases, {
			_id: showStyleBaseId,
		}),
	]

	return !allReady.some((state) => state === false)
}

function createAction(
	id: TriggeredActionId,
	actions: SomeAction[],
	showStyleBase: ShowStyleBase,
	t: TFunction,
	collectContext: () => ActionContext | null
): {
	listener: HotkeyTriggerListener
	preview: () => IWrappedAdLib[]
} {
	const executableActions = actions.map((value) => libCreateAction(value, showStyleBase))
	return {
		preview: () => {
			const ctx = collectContext()
			if (ctx) {
				return flatten(executableActions.map((action) => (isPreviewableAction(action) ? action.preview(ctx) : [])))
			} else {
				return []
			}
		},
		listener: (e) => {
			e.preventDefault()
			e.stopPropagation()

			const ctx = collectContext()
			if (ctx) {
				executableActions.forEach((action) => action.execute(t, e, ctx))
			}
		},
	}
}

const rundownPlaylistContext: ReactiveVar<ActionContext | null> = new ReactiveVar(null)
function setRundownPlaylistContext(ctx: ActionContext | null) {
	rundownPlaylistContext.set(ctx)
}
function getCurrentContext(): ActionContext | null {
	return rundownPlaylistContext.get()
}

type MountedTriggerId = ProtectedString<'mountedTriggerId'>
interface MountedTrigger {
	_id: MountedTriggerId
	triggeredActionId: TriggeredActionId
	type: IWrappedAdLib['type']
	targetId: AdLibActionId | RundownBaselineAdLibActionId | PieceId | ISourceLayer['_id']
	keys: string[]
}

export const MountedTriggers = new Mongo.Collection<MountedTrigger>(null)

function isolatedAutorunWithCleanup(autorun: () => void | (() => void)): Tracker.Computation {
	const computation = Tracker.nonreactive(() =>
		Tracker.autorun((computation) => {
			const cleanUp = autorun()

			if (typeof cleanUp === 'function') {
				computation.onInvalidate(cleanUp)
			}
		})
	)
	if (Tracker.currentComputation) {
		Tracker.currentComputation.onStop(() => {
			computation.stop()
		})
	}
	return computation
}

/**
 * Note: there can only be a single TriggersHandler in the node tree.
 *
 * @param {IProps} props
 * @return {*}
 */
export const TriggersHandler: React.FC<IProps> = function TriggersHandler(
	props: IProps
): React.ReactElement<any, any> | null {
	const [initialized, setInitialized] = useState(false)
	const { t } = useTranslation()
	const localSorensen = props.sorensen || Sorensen

	function bindHotkey(id: TriggeredActionId, keys: string, up: boolean, action: HotkeyTriggerListener) {
		try {
			localSorensen.bind(keys, action, {
				up,
				exclusive: true,
				ordered: 'modifiersFirst',
				tag: id,
			})
		} catch (e) {
			console.error(e)
		}
	}

	function unbindHotkey(keys: string, listener: (e: KeyboardEvent) => void) {
		localSorensen.unbind(keys, listener)
	}

	useEffect(() => {
		if (!props.sorensen) {
			localSorensen
				.init()
				.then(() => {
					setInitialized(true)
				})
				.catch(console.error)
		}

		return () => {
			if (!props.sorensen) {
				localSorensen.destroy().catch(console.error)
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

	useEffect(() => {
		Tracker.nonreactive(() => {
			const playlist = RundownPlaylists.findOne(props.rundownPlaylistId)
			if (playlist) {
				setRundownPlaylistContext({
					rundownPlaylist: playlist,
					currentPartId: props.currentPartId,
					nextPartId: props.nextPartId,
					currentSegmentPartIds: props.currentSegmentPartIds,
					nextSegmentPartIds: props.nextSegmentPartIds,
				})
			}
		})
	}, [
		props.rundownPlaylistId,
		props.currentPartId,
		props.currentSegmentPartIds,
		props.nextPartId,
		props.nextSegmentPartIds,
	])

	const triggerSubReady = useSubscription(PubSub.triggeredActions, {
		$or: [
			{
				showStyleBaseId: props.showStyleBaseId,
			},
			{
				showStyleBaseId: null,
			},
		],
	})

	const rundownIds =
		useTracker(() => {
			const playlist = RundownPlaylists.findOne(props.rundownPlaylistId, {
				fields: {
					_id: 1,
				},
			})
			if (playlist) {
				return playlist.getRundownUnorderedIDs()
			}
			return []
		}, [props.rundownPlaylistId]) || []

	const showStyleBase = useTracker(() => ShowStyleBases.findOne(props.showStyleBaseId), [props.showStyleBaseId])

	useSubscriptions(props.rundownPlaylistId, rundownIds, props.showStyleBaseId)

	const triggeredActions = useTracker(() => {
		return TriggeredActions.find({
			$or: [
				{
					showStyleBaseId: props.showStyleBaseId,
				},
				{
					showStyleBaseId: null,
				},
			],
		}).fetch()
	}, [props.showStyleBaseId])
	useEffect(() => {
		if (!triggeredActions || (!initialized && !props.sorensen) || !showStyleBase || !triggerSubReady) {
			return
		}

		const createdActions: Map<TriggeredActionId, (e) => void> = new Map()
		const previewAutoruns: Tracker.Computation[] = []

		triggeredActions.forEach((pair) => {
			const action = createAction(pair._id, pair.actions, showStyleBase, t, getCurrentContext)
			if (!props.simulateTriggerBinding) {
				createdActions.set(pair._id, action.listener)
				pair.triggers.forEach((trigger) => {
					if (trigger.type === TriggerType.hotkey) {
						bindHotkey(pair._id, trigger.keys, !!trigger.up, action.listener)
					}
				})
			}
			const hotkeyTriggers = pair.triggers
				.filter((trigger) => trigger.type === TriggerType.hotkey)
				.map((trigger) => trigger.keys)

			previewAutoruns.push(
				isolatedAutorunWithCleanup(() => {
					let previewAdLibs: IWrappedAdLib[] = []
					try {
						previewAdLibs = action.preview()
					} catch (e) {
						console.error('Exception thrown while previewing action', e)
					}

					previewAdLibs.forEach((adLib) => {
						const triggerId = protectString(pair._id + '_' + adLib._id + '_' + adLib.type)
						MountedTriggers.upsert(triggerId, {
							$set: {
								_id: triggerId,
								targetId: adLib._id,
								type: adLib.type,
								triggeredActionId: pair._id,
								keys: hotkeyTriggers,
							},
						})
					})

					return () => {
						MountedTriggers.remove({
							triggeredActionId: pair._id,
						})
					}
				})
			)
		})

		return () => {
			if (initialized) {
				triggeredActions.forEach((pair) => {
					const actionListener = createdActions.get(pair._id)
					if (actionListener) {
						pair.triggers.forEach((trigger) => {
							if (trigger.type === TriggerType.hotkey) {
								unbindHotkey(trigger.keys, actionListener)
							}
						})
					}
				})
			}

			previewAutoruns.forEach((autorun) => autorun.stop())
		}
	}, [triggeredActions, initialized, showStyleBase, triggerSubReady])

	return null
}

window['MountedTriggers'] = MountedTriggers
