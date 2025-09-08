import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { UIBlueprintUpgradeStatusCoreSystem } from '@sofie-automation/meteor-lib/dist/api/upgradeStatus'
import { useTranslation } from 'react-i18next'
import { useSubscription, useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData.js'
import { UIBlueprintUpgradeStatuses } from '../../Collections.js'
import { getUpgradeStatusMessage, SystemUpgradeStatusButtons } from '../Upgrades/Components.js'
import { ICoreSystem } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { Blueprints, CoreSystem } from '../../../collections/index.js'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { useMemo } from 'react'
import { LabelActual } from '../../../lib/Components/LabelAndOverrides.js'
import { EditAttribute } from '../../../lib/EditAttribute.js'
import { RedirectToBlueprintButton } from '../../../lib/SettingsNavigation.js'

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
	const statusMessage = isStatusReady && status ? (getUpgradeStatusMessage(t, status) ?? t('OK')) : t('Loading...')

	return (
		<div className="properties-grid">
			<SelectBlueprint coreSystem={coreSystem} />

			<label className="field">
				<div className="label-actual">{t('Upgrade Status')}</div>
				<div className="field-content">{statusMessage}</div>
			</label>
			{status && (
				<div className="field">
					<div className="label-actual"></div>
					<div className="field-content">
						<SystemUpgradeStatusButtons upgradeResult={status} />
					</div>
				</div>
			)}
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
		<label className="field">
			<LabelActual label={t('Blueprint')} />

			<EditAttribute
				attribute="blueprintId"
				obj={coreSystem}
				type="dropdown"
				options={blueprintOptions}
				collection={CoreSystem}
			/>

			<div>
				{!coreSystem?.blueprintId ? (
					<div className="error-notice inline">
						{t('Blueprint not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				) : null}
			</div>
			<div>
				<RedirectToBlueprintButton id={coreSystem?.blueprintId} />
			</div>
		</label>
	)
}
