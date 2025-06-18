import React from 'react'
import { useTranslation } from 'react-i18next'
import { RundownLayouts } from '../../../../collections'
import { RundownLayoutBase, RundownLayoutType } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { EditAttribute } from '../../../../lib/EditAttribute'
import { LabelActual } from '../../../../lib/Components/LabelAndOverrides'

interface IProps {
	item: RundownLayoutBase
}

export default function RundownHeaderLayoutSettings(props: Readonly<IProps>): JSX.Element | null {
	const { t } = useTranslation()

	if (props.item.type !== RundownLayoutType.RUNDOWN_HEADER_LAYOUT) return null

	return (
		<React.Fragment>
			<label className="field">
				<LabelActual label={t('Expected End text')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={'plannedEndText'}
					obj={props.item}
					type="text"
					collection={RundownLayouts}
					className="input text-input input-l"
				></EditAttribute>
				<span className="text-s dimmed field-hint">{t('Text to show above countdown to end of show')}</span>
			</label>

			<label className="field">
				<LabelActual label={t('Hide Expected End timing when a break is next')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={'hideExpectedEndBeforeBreak'}
					obj={props.item}
					type="checkbox"
					collection={RundownLayouts}
					className="input"
				></EditAttribute>
				<span className="text-s dimmed field-hint">
					{t('While there are still breaks coming up in the show, hide the Expected End timers')}
				</span>
			</label>
			<label className="field">
				<LabelActual label={t('Show next break timing')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={'showNextBreakTiming'}
					obj={props.item}
					type="checkbox"
					collection={RundownLayouts}
					className="input"
				></EditAttribute>
				<span className="text-s dimmed field-hint">{t('Whether to show countdown to next break')}</span>
			</label>
			<label className="field">
				<LabelActual label={t('Last rundown is not break')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={'lastRundownIsNotBreak'}
					obj={props.item}
					type="checkbox"
					collection={RundownLayouts}
					className="input"
				></EditAttribute>
				<span className="text-s dimmed field-hint">
					{t("Don't treat the end of the last rundown in a playlist as a break")}
				</span>
			</label>
			<label className="field">
				<LabelActual label={t('Next Break text')} />
				<EditAttribute
					modifiedClassName="bghl"
					attribute={'nextBreakText'}
					obj={props.item}
					type="text"
					collection={RundownLayouts}
					className="input text-input input-l"
				></EditAttribute>
				<span className="text-s dimmed field-hint">{t('Text to show above countdown to next break')}</span>
			</label>
		</React.Fragment>
	)
}
