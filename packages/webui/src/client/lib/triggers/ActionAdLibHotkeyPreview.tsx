import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import React, { useContext, useState, useEffect } from 'react'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { useTracker } from '../ReactMeteorData/ReactMeteorData.js'
import { SorensenContext } from '../SorensenContext.js'
import { MountedAdLibTriggers } from './TriggersHandler.js'
import { codesToKeyLabels } from './codesToKeyLabels.js'
import { AdLibActionId, PieceId, RundownBaselineAdLibActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	MountedAdLibTrigger,
	MountedAdLibTriggerType,
	MountedHotkeyMixin,
} from '@sofie-automation/meteor-lib/dist/api/MountedTriggers'
import { FindOptions, MongoQuery } from '@sofie-automation/corelib/dist/mongo'

type IProps =
	| {
			type: 'adLibAction'
			targetId: AdLibActionId
	  }
	| {
			type: 'rundownBaselineAdLibAction'
			targetId: RundownBaselineAdLibActionId
	  }
	| {
			type: 'rundownBaselineAdLibItem'
			targetId: PieceId
	  }
	| {
			type: 'adLibPiece'
			targetId: PieceId
	  }
	| {
			type: 'sticky'
			targetId: ISourceLayer['_id']
	  }
	| {
			type: 'clearSourceLayer'
			targetId: ISourceLayer['_id']
	  }

/** This is a utility component that provides a preview of keys that will trigger an AdLib with the given Id */
export const ActionAdLibHotkeyPreview: React.FC<IProps> = function AdLibActionHotkeyPreview(props: IProps) {
	const [_updatedKeyboardMap, setUpdatedKeyboardMap] = useState(Symbol())
	const Sorensen = useContext(SorensenContext)

	function handleLayoutChange() {
		setUpdatedKeyboardMap(Symbol())
	}

	useEffect(() => {
		Sorensen?.addEventListener('layoutchange', handleLayoutChange)

		return () => {
			Sorensen?.removeEventListener('layoutchange', handleLayoutChange)
		}
	}, [Sorensen])

	const findOptions: FindOptions<MountedAdLibTrigger & MountedHotkeyMixin> = {
		fields: {
			keys: 1,
		},
		sort: {
			_rank: 1,
		},
	}

	const allKeys = useTracker(() => {
		let selector: MongoQuery<MountedAdLibTrigger>
		switch (props.type) {
			case 'adLibAction':
				selector = {
					type: MountedAdLibTriggerType.adLibAction,
					targetId: props.targetId,
				}
				break
			case 'adLibPiece':
				selector = {
					type: MountedAdLibTriggerType.adLibPiece,
					targetId: props.targetId,
				}
				break
			case 'rundownBaselineAdLibAction':
				selector = {
					type: MountedAdLibTriggerType.rundownBaselineAdLibAction,
					targetId: props.targetId,
				}
				break
			case 'rundownBaselineAdLibItem':
				selector = {
					type: MountedAdLibTriggerType.rundownBaselineAdLibItem,
					targetId: props.targetId,
				}
				break
			case 'clearSourceLayer':
				selector = {
					type: MountedAdLibTriggerType.clearSourceLayer,
					targetId: props.targetId,
				}
				break
			case 'sticky':
				selector = {
					type: MountedAdLibTriggerType.sticky,
					targetId: props.targetId,
				}
				break
			default:
				assertNever(props)
				selector = {
					type: {
						$exists: false,
					},
				}
				break
		}
		return MountedAdLibTriggers.find(selector, findOptions).fetch() as Pick<
			MountedAdLibTrigger & MountedHotkeyMixin,
			'keys'
		>[]
	}, [props.targetId, props.type])

	let hotkeys: React.ReactElement[] | null = null
	if (Sorensen) {
		hotkeys =
			allKeys
				?.map((item, index0) =>
					item.keys.map((combo, index1) => (
						<span key={`${index0}_${index1}`}>
							{codesToKeyLabels(combo, Sorensen).replace(/(?<!\+)\+/gi, '+\u200b')}
						</span>
					))
				)
				.flat(3) ?? null
	}

	return hotkeys ? <span className="hotkeys">{hotkeys}</span> : null
}
