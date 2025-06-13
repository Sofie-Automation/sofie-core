import React, { useContext } from 'react'
import type { Sorensen } from '@sofie-automation/sorensen'
import { useTranslation } from 'react-i18next'
import { hotkeyHelper } from '../../lib/hotkeyHelper.js'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { MountedAdLibTriggers, MountedGenericTriggers } from '../../lib/triggers/TriggersHandler.js'
import { SorensenContext } from '../../lib/SorensenContext.js'
import { codesToKeyLabels } from '../../lib/triggers/codesToKeyLabels.js'
import { TFunction } from 'i18next'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { MongoCursor } from '../../collections/lib.js'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { MountedTrigger } from '@sofie-automation/meteor-lib/dist/api/MountedTriggers'

interface IProps {
	visible?: boolean
	showStyleBase: UIShowStyleBase

	hotkeys: Array<{
		key: string
		label: string
	}>
}

const _isMacLike = navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i) ? true : false

function mountedTriggerToHotkeyList(
	hotkeys: MongoCursor<MountedTrigger>,
	sorensen: typeof Sorensen | null,
	t: TFunction
) {
	return hotkeys.map((mountedTrigger) => ({
		key: (sorensen ? mountedTrigger.keys.map((codes) => codesToKeyLabels(codes, sorensen)) : mountedTrigger.keys).join(
			', '
		),
		label: mountedTrigger.name
			? typeof mountedTrigger.name === 'string'
				? mountedTrigger.name
				: translateMessage(mountedTrigger.name, t)
			: '',
	}))
}

export const HotkeyHelpPanel: React.FC<IProps> = function HotkeyHelpPanel({ visible, showStyleBase, hotkeys }: IProps) {
	const { t } = useTranslation()
	const sorensen = useContext(SorensenContext)

	const genericMountedTriggers = useTracker(
		() =>
			mountedTriggerToHotkeyList(
				MountedGenericTriggers.find(
					{},
					{
						sort: {
							_rank: 1,
						},
					}
				),
				sorensen,
				t
			),
		[sorensen],
		[]
	)

	const adLibMountedTriggers = useTracker(
		() =>
			mountedTriggerToHotkeyList(
				MountedAdLibTriggers.find(
					{
						name: {
							$exists: true,
						},
					},
					{
						sort: {
							_rank: 1,
						},
					}
				),
				sorensen,
				t
			),
		[sorensen],
		[]
	)

	if (visible) {
		return (
			<div className="adlib-panel super-dark">
				<div className="adlib-panel__hotkeys">
					{hotkeys
						.concat(genericMountedTriggers)
						.concat(adLibMountedTriggers)
						.concat(showStyleBase.hotkeyLegend || [])
						.map((hotkey, index) => (
							<div className="adlib-panel__hotkeys__hotkey" key={`${hotkey.key}_${index}`}>
								<div className="adlib-panel__hotkeys__hotkey__keys">
									{hotkeyHelper.shortcutLabel(hotkey.key, _isMacLike)}
								</div>
								<div className="adlib-panel__hotkeys__hotkey__action">{hotkey.label}</div>
							</div>
						))}
				</div>
			</div>
		)
	} else {
		return null
	}
}
