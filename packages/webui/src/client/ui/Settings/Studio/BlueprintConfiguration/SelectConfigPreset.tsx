import { useMemo } from 'react'
import { Studios } from '../../../../collections/index.js'
import { useTranslation } from 'react-i18next'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { EditAttribute } from '../../../../lib/EditAttribute.js'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { IStudioConfigPreset } from '@sofie-automation/blueprints-integration'
import { LabelActual } from '../../../../lib/Components/LabelAndOverrides.js'

interface SelectConfigPresetProps {
	studio: DBStudio
	blueprint: Blueprint | undefined
}

export function SelectConfigPreset({ studio, blueprint }: Readonly<SelectConfigPresetProps>): JSX.Element {
	const { t } = useTranslation()

	const configPresetOptions = useMemo(() => {
		const options: { name: string; value: string | null }[] = []

		if (blueprint?.studioConfigPresets) {
			if (blueprint.studioConfigPresets) {
				for (const [id, preset] of Object.entries<IStudioConfigPreset>(blueprint.studioConfigPresets)) {
					options.push({
						value: id,
						name: preset.name,
					})
				}
			}
		}

		return options
	}, [blueprint?.studioConfigPresets])

	return (
		<label className="field">
			<LabelActual label={t('Blueprint config preset')} />

			<EditAttribute
				attribute="blueprintConfigPresetId"
				obj={studio}
				type="dropdown"
				options={configPresetOptions}
				mutateDisplayValue={(v) => v || ''}
				mutateUpdateValue={(v) => (v === '' ? undefined : v)}
				collection={Studios}
			/>
			<div>
				{!studio.blueprintConfigPresetId && (
					<div className="error-notice inline">
						{t('Blueprint config preset not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				)}
				{studio.blueprintConfigPresetIdUnlinked && studio.blueprintConfigPresetId && (
					<div className="error-notice inline">
						{t('Blueprint config preset is missing')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				)}
			</div>
		</label>
	)
}
