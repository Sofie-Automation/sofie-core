import { useMemo } from 'react'
import { useTracker } from '../../../../lib/ReactMeteorData/react-meteor-data.js'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { Blueprints, ShowStyleBases } from '../../../../collections/index.js'
import { useTranslation } from 'react-i18next'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { EditAttribute } from '../../../../lib/EditAttribute.js'
import { RedirectToBlueprintButton } from '../../../../lib/SettingsNavigation.js'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { LabelActual } from '../../../../lib/Components/LabelAndOverrides.js'

interface SelectBlueprintProps {
	showStyleBase: DBShowStyleBase
}

export function SelectBlueprint({ showStyleBase }: Readonly<SelectBlueprintProps>): JSX.Element {
	const { t } = useTranslation()

	const allShowStyleBlueprints = useTracker(() => {
		return Blueprints.find({
			blueprintType: BlueprintManifestType.SHOWSTYLE,
		}).fetch()
	}, [])
	const blueprintOptions: { name: string; value: BlueprintId | null }[] = useMemo(() => {
		if (allShowStyleBlueprints) {
			return allShowStyleBlueprints.map((blueprint) => {
				return {
					name: blueprint.name ? `${blueprint.name} (${blueprint._id})` : unprotectString(blueprint._id),
					value: blueprint._id,
				}
			})
		} else {
			return []
		}
	}, [allShowStyleBlueprints])

	return (
		<label className="field">
			<LabelActual label={t('Blueprint')} />

			<EditAttribute
				attribute="blueprintId"
				obj={showStyleBase}
				type="dropdown"
				options={blueprintOptions}
				collection={ShowStyleBases}
			/>
			<div>
				{!showStyleBase.blueprintId ? (
					<div className="error-notice inline">
						{t('Blueprint not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				) : null}
			</div>
			<div>
				<RedirectToBlueprintButton id={showStyleBase.blueprintId} />
			</div>
		</label>
	)
}
