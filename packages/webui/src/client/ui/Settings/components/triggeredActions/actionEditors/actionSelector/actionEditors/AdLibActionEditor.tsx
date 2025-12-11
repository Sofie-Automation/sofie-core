import _ from 'underscore'
import { useTranslation } from 'react-i18next'
import { PlayoutActions, SomeAction } from '@sofie-automation/blueprints-integration'
import { useTracker } from '../../../../../../../lib/ReactMeteorData/ReactMeteorData.js'
import { AdLibActions, RundownBaselineAdLibActions } from '../../../../../../../collections/index.js'
import { ToggleSwitchControl } from '../../../../../../../lib/Components/ToggleSwitch.js'
import { TextInputControl, TextInputSuggestion } from '../../../../../../../lib/Components/TextInput.js'

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
			<div className="mt-2">
				<ToggleSwitchControl
					classNames="mb-2"
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
				<div className="mt-2">
					<label className="block">{t('Trigger Mode')}</label>
					<TextInputControl
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
