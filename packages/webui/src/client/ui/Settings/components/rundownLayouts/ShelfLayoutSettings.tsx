import React from 'react'
import { useTranslation } from 'react-i18next'
import { RundownLayouts } from '../../../../collections/index.js'
import { RundownLayoutBase, RundownLayoutType } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { EditAttribute } from '../../../../lib/EditAttribute.js'
import { LabelActual } from '../../../../lib/Components/LabelAndOverrides.js'

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
					attribute={'exposeAsStandalone'}
					obj={props.item}
					type="checkbox"
					collection={RundownLayouts}
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Open shelf by default')} />
				<EditAttribute
					attribute={'openByDefault'}
					obj={props.item}
					type="checkbox"
					collection={RundownLayouts}
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Default shelf height')} />
				<EditAttribute attribute={`startingHeight`} obj={props.item} type="int" collection={RundownLayouts} />
			</label>

			<label className="field">
				<LabelActual label={t('Disable Context Menu')} />
				<EditAttribute
					attribute={'disableContextMenu'}
					obj={props.item}
					options={RundownLayoutType}
					type="checkbox"
					collection={RundownLayouts}
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Show Inspector')} />
				<EditAttribute
					attribute={'showInspector'}
					obj={props.item}
					options={RundownLayoutType}
					type="checkbox"
					collection={RundownLayouts}
				></EditAttribute>
			</label>

			<label className="field">
				<LabelActual label={t('Hide default AdLib Start/Execute options')} />
				<EditAttribute
					attribute={'hideDefaultStartExecute'}
					obj={props.item}
					options={RundownLayoutType}
					type="checkbox"
					collection={RundownLayouts}
				></EditAttribute>
				<span className="text-s dimmed field-hint">{t('Only custom trigger modes will be shown')}</span>
			</label>
		</React.Fragment>
	)
}
