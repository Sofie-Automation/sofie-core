import { useTranslation } from 'react-i18next'
import { useTracker } from '../../../../../../../lib/ReactMeteorData/ReactMeteorData.js'
import { Studios } from '../../../../../../../collections/index.js'
import { DropdownInputControl, DropdownInputOption } from '../../../../../../../lib/Components/DropdownInput.js'
import { SwitchRouteSetProps } from '@sofie-automation/corelib/dist/worker/studio'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { StudioRouteSet } from '@sofie-automation/blueprints-integration'

export function SwitchRouteSetEditor({
	action,
	onChange,
}: Readonly<{
	action: SwitchRouteSetProps
	onChange: (newVal: Partial<typeof action>) => void
}>): JSX.Element | null {
	const { t } = useTranslation()
	const allRouteSetOptions = useTracker<DropdownInputOption<string>[]>(
		() => {
			const studios = Studios.find({}, { sort: { name: 1 } }).fetch()
			const routeSetOptions = studios.flatMap((studio) => {
				const routeSets = applyAndValidateOverrides(studio.routeSetsWithOverrides).obj
				return Object.entries<StudioRouteSet>(routeSets).map(
					([id, routeSet]): Omit<DropdownInputOption<string>, 'i'> => ({
						value: id,
						name: studios.length > 1 ? `${studio.name} - ${routeSet.name}` : routeSet.name,
					})
				)
			})

			return routeSetOptions.map((option, i): DropdownInputOption<string> => ({ ...option, i }))
		},
		[],
		[]
	)

	return (
		<>
			<div className="mt-2">
				<label className="block">{t('Route Set')}</label>
				<DropdownInputControl<typeof action.routeSetId>
					value={action.routeSetId}
					options={allRouteSetOptions}
					handleUpdate={(newVal) => {
						onChange({
							...action,
							routeSetId: newVal,
						})
					}}
				/>
			</div>

			<div className="mt-2">
				<label className="block">{t('State')}</label>
				<DropdownInputControl<typeof action.state>
					value={action.state}
					options={[
						{
							name: t('Enabled'),
							value: true,
							i: 0,
						},
						{
							name: t('Disabled'),
							value: false,
							i: 1,
						},
						{
							name: t('Toggle'),
							value: 'toggle',
							i: 2,
						},
					]}
					handleUpdate={(newVal) => {
						onChange({
							...action,
							state: newVal,
						})
					}}
				/>
			</div>
		</>
	)
}
