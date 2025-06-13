import React from 'react'
import ClassNames from 'classnames'
import { RundownUtils } from '../../../lib/rundown'
import { ILayerItemRendererProps } from './ItemRendererFactory'
import { ActionAdLibHotkeyPreview } from '../../../lib/triggers/ActionAdLibHotkeyPreview'

export const DefaultListItemRenderer: React.FunctionComponent<ILayerItemRendererProps> = (
	props: Readonly<ILayerItemRendererProps>
) => {
	const type = props.adLibListItem.isAction
		? props.adLibListItem.isGlobal
			? 'rundownBaselineAdLibAction'
			: 'adLibAction'
		: props.adLibListItem.isClearSourceLayer
		? 'clearSourceLayer'
		: props.adLibListItem.isSticky
		? 'sticky'
		: props.adLibListItem.isGlobal
		? 'rundownBaselineAdLibItem'
		: 'adLibPiece'

	return (
		<>
			<td
				className={ClassNames(
					'adlib-panel__list-view__list__table__cell--icon',
					props.layer && RundownUtils.getSourceLayerClassName(props.layer.type),
					props.status && RundownUtils.getPieceStatusClassName(props.status)
				)}
			>
				<div className="adlib-panel__list-view__list__table__cell--layer">
					{(props.layer && (props.layer.abbreviation || props.layer.name)) || null}
				</div>
			</td>
			<td className="adlib-panel__list-view__list__table__cell--shortcut">
				<ActionAdLibHotkeyPreview targetId={props.adLibListItem._id as any} type={type} />
			</td>
			<td className="adlib-panel__list-view__list__table__cell--output">
				{(props.outputLayer && props.outputLayer.name) || null}
			</td>
			<td className="adlib-panel__list-view__list__table__cell--name">{props.adLibListItem.name}</td>
			<td className="adlib-panel__list-view__list__table__cell--duration">&nbsp;</td>
			{/*<td className='adlib-panel__list-view__list__table__cell--data'>
			&nbsp;
		</td>
		<td className='adlib-panel__list-view__list__table__cell--resolution'>
			&nbsp;
		</td>
		<td className='adlib-panel__list-view__list__table__cell--fps'>
			&nbsp;
		</td>
		<td className='adlib-panel__list-view__list__table__cell--tc-start'>
			&nbsp;
		</td> */}
		</>
	)
}
