import _ from 'underscore'
import { useTranslation } from 'react-i18next'
import { PlayoutActions, SomeAction } from '@sofie-automation/blueprints-integration'
import { useTracker } from '../../../../../../../lib/ReactMeteorData/ReactMeteorData'
import { AdLibActions, RundownBaselineAdLibActions } from '../../../../../../../collections'
import { ToggleSwitchControl } from '../../../../../../../lib/Components/ToggleSwitch'
import { TextInputControl, TextInputSuggestion } from '../../../../../../../lib/Components/TextInput'

export function AdLibActionEditor({
	action,
	onChange,
}: Readonly<{
	action: SomeAction
	onChange: (newVal: Partial<typeof action>) => void
}>): JSX.Element | null {
	const { t } = useTranslation()
	const allTriggerModes = useTracker<TextInputSuggestion[]>(
		() => {
			const triggerModes = _.chain([
				...RundownBaselineAdLibActions.find().map((action) =>
					action.triggerModes?.map((triggerMode) => triggerMode.data)
				),
				...AdLibActions.find().map((action) => action.triggerModes?.map((triggerMode) => triggerMode.data)),
			])
				.flatten()
				.compact()
				.uniq()
				.sort()
				.value()

			return triggerModes.map((triggerMode, i): TextInputSuggestion => ({ name: triggerMode, value: triggerMode, i }))
		},
		[],
		[]
	)

	// this Editor only renders for AdLib
	if (action.action !== PlayoutActions.adlib) return null

	return (
		<>
			<div className="mts">
				<ToggleSwitchControl
					classNames={'form-control'}
					value={!!action.arguments}
					label={t('Use Trigger Mode')}
					handleUpdate={(newVal) => {
						onChange({
							...action,
							arguments: newVal ? { triggerMode: '' } : null,
						})
					}}
				/>
			</div>
			{action.arguments && (
				<div className="mts">
					<label className="block">{t('Trigger Mode')}</label>
					<TextInputControl
						classNames={`input text-input input-m`}
						updateOnKey={true}
						value={action.arguments.triggerMode ?? ''}
						handleUpdate={(newVal) =>
							onChange({
								...action,
								arguments: {
									...action.arguments,
									triggerMode: newVal,
								},
							})
						}
						spellCheck={false}
						suggestions={allTriggerModes}
					/>
				</div>
			)}
		</>
	)
}
