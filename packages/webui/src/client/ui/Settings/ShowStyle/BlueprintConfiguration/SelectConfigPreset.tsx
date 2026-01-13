import { useMemo } from 'react'
import { useTracker } from '../../../../lib/ReactMeteorData/react-meteor-data.js'
import { BlueprintManifestType, IShowStyleConfigPreset } from '@sofie-automation/blueprints-integration'
import { Blueprints, ShowStyleBases } from '../../../../collections/index.js'
import { useTranslation } from 'react-i18next'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { EditAttribute } from '../../../../lib/EditAttribute.js'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { LabelActual } from '../../../../lib/Components/LabelAndOverrides.js'

interface SelectConfigPresetProps {
	showStyleBase: DBShowStyleBase
}

export function SelectConfigPreset({ showStyleBase }: Readonly<SelectConfigPresetProps>): JSX.Element {
	const { t } = useTranslation()

	const blueprint = useTracker(() => {
		return showStyleBase.blueprintId
			? Blueprints.findOne({
					_id: showStyleBase.blueprintId,
					blueprintType: BlueprintManifestType.SHOWSTYLE,
				})
			: undefined
	}, [showStyleBase.blueprintId])

	const configPresetOptions = useMemo(() => {
		const options: { name: string; value: string | null }[] = []

		if (blueprint?.showStyleConfigPresets) {
			if (blueprint.showStyleConfigPresets) {
				for (const [id, preset] of Object.entries<IShowStyleConfigPreset>(blueprint.showStyleConfigPresets)) {
					options.push({
						value: id,
						name: preset.name,
					})
				}
			}
		}

		return options
	}, [blueprint?.showStyleConfigPresets])

	return (
		<label className="field">
			<LabelActual label={t('Blueprint config preset')} />

			<EditAttribute
				attribute="blueprintConfigPresetId"
				obj={showStyleBase}
				type="dropdown"
				options={configPresetOptions}
				mutateDisplayValue={(v) => v || ''}
				mutateUpdateValue={(v) => (v === '' ? undefined : v)}
				collection={ShowStyleBases}
			/>
			<div>
				{!showStyleBase.blueprintConfigPresetId && (
					<div className="error-notice inline">
						{t('Blueprint config preset not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				)}
				{showStyleBase.blueprintConfigPresetIdUnlinked && showStyleBase.blueprintConfigPresetId && (
					<div className="error-notice inline">
						{t('Blueprint config preset is missing')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				)}
			</div>
		</label>
	)
}
