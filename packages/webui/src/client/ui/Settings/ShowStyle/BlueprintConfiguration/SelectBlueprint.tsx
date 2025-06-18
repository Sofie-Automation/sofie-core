import { useMemo } from 'react'
import { useTracker } from '../../../../lib/ReactMeteorData/react-meteor-data'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { Blueprints, ShowStyleBases } from '../../../../collections'
import { useTranslation } from 'react-i18next'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { EditAttribute } from '../../../../lib/EditAttribute'
import { RedirectToBlueprintButton } from '../../../../lib/SettingsNavigation'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { LabelActual } from '../../../../lib/Components/LabelAndOverrides'

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
		<div className="mod mvs mhs">
			<label className="field">
				<LabelActual label={t('Blueprint')} />
				{!showStyleBase.blueprintId ? (
					<div className="error-notice inline">
						{t('Blueprint not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				) : null}

				<EditAttribute
					modifiedClassName="bghl"
					attribute="blueprintId"
					obj={showStyleBase}
					type="dropdown"
					options={blueprintOptions}
					collection={ShowStyleBases}
					className="input text-input input-l"
				/>
				<RedirectToBlueprintButton id={showStyleBase.blueprintId} />
			</label>
		</div>
	)
}
