import { useMemo } from 'react'
import { useTracker } from '../../../../lib/ReactMeteorData/react-meteor-data'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { Blueprints, Studios } from '../../../../collections'
import { useTranslation } from 'react-i18next'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { EditAttribute } from '../../../../lib/EditAttribute'
import { RedirectToBlueprintButton } from '../../../../lib/SettingsNavigation'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { LabelActual } from '../../../../lib/Components/LabelAndOverrides'

interface SelectBlueprintProps {
	studio: DBStudio
}

export function SelectBlueprint({ studio }: Readonly<SelectBlueprintProps>): JSX.Element {
	const { t } = useTranslation()

	const allStudioBlueprints = useTracker(() => {
		return Blueprints.find({
			blueprintType: BlueprintManifestType.STUDIO,
		}).fetch()
	}, [])
	const blueprintOptions = useMemo(() => {
		const options: { name: string; value: BlueprintId | null }[] = [
			{
				name: t('None'),
				value: protectString(''),
			},
		]

		if (allStudioBlueprints) {
			options.push(
				...allStudioBlueprints.map((blueprint) => {
					return {
						name: blueprint.name ? blueprint.name + ` (${blueprint._id})` : unprotectString(blueprint._id),
						value: blueprint._id,
					}
				})
			)
		}

		return options
	}, [t, allStudioBlueprints])

	return (
		<div className="mod mvs mhs">
			<label className="field">
				<LabelActual label={t('Blueprint')} />
				{!studio.blueprintId ? (
					<div className="error-notice inline">
						{t('Blueprint not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				) : null}

				<EditAttribute
					modifiedClassName="bghl"
					attribute="blueprintId"
					obj={studio}
					type="dropdown"
					options={blueprintOptions}
					mutateDisplayValue={(v) => v || ''}
					mutateUpdateValue={(v) => (v === '' ? undefined : v)}
					collection={Studios}
					className="input text-input input-l"
				/>
				<RedirectToBlueprintButton id={studio.blueprintId} />
			</label>
		</div>
	)
}
