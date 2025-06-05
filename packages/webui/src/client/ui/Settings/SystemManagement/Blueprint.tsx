import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { UIBlueprintUpgradeStatusCoreSystem } from '@sofie-automation/meteor-lib/dist/api/upgradeStatus'
import { useTranslation } from 'react-i18next'
import { useSubscription, useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { UIBlueprintUpgradeStatuses } from '../../Collections'
import { getUpgradeStatusMessage, SystemUpgradeStatusButtons } from '../Upgrades/Components'
import { ICoreSystem } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { Blueprints, CoreSystem } from '../../../collections'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { useMemo } from 'react'
import { LabelActual } from '../../../lib/Components/LabelAndOverrides'
import { EditAttribute } from '../../../lib/EditAttribute'
import { RedirectToBlueprintButton } from '../../../lib/SettingsNavigation'

interface SystemManagementBlueprintProps {
	coreSystem: ICoreSystem | undefined
}
export function SystemManagementBlueprint({ coreSystem }: Readonly<SystemManagementBlueprintProps>): JSX.Element {
	const { t } = useTranslation()

	const isStatusReady = useSubscription(MeteorPubSub.uiBlueprintUpgradeStatuses)
	const status = useTracker(
		() =>
			coreSystem &&
			(UIBlueprintUpgradeStatuses.findOne({
				documentId: coreSystem._id,
				documentType: 'coreSystem',
			}) as UIBlueprintUpgradeStatusCoreSystem | undefined),
		[coreSystem?._id]
	)
	const statusMessage = isStatusReady && status ? getUpgradeStatusMessage(t, status) ?? t('OK') : t('Loading...')

	return (
		<div className="row">
			<div className="col c12 r1-c12">
				<SelectBlueprint coreSystem={coreSystem} />

				<p>
					{t('Upgrade Status')}: {statusMessage}
					{status && <SystemUpgradeStatusButtons upgradeResult={status} />}
				</p>
			</div>
		</div>
	)
}

interface SelectBlueprintProps {
	coreSystem: ICoreSystem | undefined
}

function SelectBlueprint({ coreSystem }: Readonly<SelectBlueprintProps>): JSX.Element {
	const { t } = useTranslation()

	const allSystemBlueprints = useTracker(() => {
		return Blueprints.find({
			blueprintType: BlueprintManifestType.SYSTEM,
		}).fetch()
	}, [])
	const blueprintOptions: { name: string; value: BlueprintId | null }[] = useMemo(() => {
		if (allSystemBlueprints) {
			return allSystemBlueprints.map((blueprint) => {
				return {
					name: blueprint.name ? `${blueprint.name} (${blueprint._id})` : unprotectString(blueprint._id),
					value: blueprint._id,
				}
			})
		} else {
			return []
		}
	}, [allSystemBlueprints])

	return (
		<div className="mod mvs mhs">
			<label className="field">
				<LabelActual label={t('Blueprint')} />
				{!coreSystem?.blueprintId ? (
					<div className="error-notice inline">
						{t('Blueprint not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				) : null}

				<EditAttribute
					modifiedClassName="bghl"
					attribute="blueprintId"
					obj={coreSystem}
					type="dropdown"
					options={blueprintOptions}
					collection={CoreSystem}
					className="input text-input input-l"
				/>
				<RedirectToBlueprintButton id={coreSystem?.blueprintId} />
			</label>
		</div>
	)
}
