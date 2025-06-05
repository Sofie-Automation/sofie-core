import React from 'react'
import { useTranslation } from 'react-i18next'
import { RundownLayouts } from '../../../../collections'
import { RundownLayoutBase, RundownLayoutType } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { EditAttribute } from '../../../../lib/EditAttribute'
import { LabelActual } from '../../../../lib/Components/LabelAndOverrides'

interface IProps {
	item: RundownLayoutBase
}

export default function ShelfLayoutSettings(props: Readonly<IProps>): JSX.Element {
	const { t } = useTranslation()

	return (
		<React.Fragment>
			<label className="field">
				<LabelActual label={t('Expose layout as a standalone page')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={'exposeAsStandalone'}
					obj={props.item}
					type="checkbox"
					collection={RundownLayouts}
					className="mod mas"
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Open shelf by default')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={'openByDefault'}
					obj={props.item}
					type="checkbox"
					collection={RundownLayouts}
					className="mod mas"
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Default shelf height')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={`startingHeight`}
					obj={props.item}
					type="int"
					collection={RundownLayouts}
					className="input text-input input-l"
				/>
			</label>

			<label className="field">
				<LabelActual label={t('Disable Context Menu')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={'disableContextMenu'}
					obj={props.item}
					options={RundownLayoutType}
					type="checkbox"
					collection={RundownLayouts}
					className="mod mas"
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Show Inspector')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={'showInspector'}
					obj={props.item}
					options={RundownLayoutType}
					type="checkbox"
					collection={RundownLayouts}
					className="mod mas"
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Hide default AdLib Start/Execute options')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={'hideDefaultStartExecute'}
					obj={props.item}
					options={RundownLayoutType}
					type="checkbox"
					collection={RundownLayouts}
					className="mod mas"
				></EditAttribute>
				<span className="text-s dimmed field-hint">{t('Only custom trigger modes will be shown')}</span>
			</label>
		</React.Fragment>
	)
}
