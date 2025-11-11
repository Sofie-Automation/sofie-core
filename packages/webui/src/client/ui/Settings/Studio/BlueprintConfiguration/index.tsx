import { useCallback, useMemo } from 'react'
import { useSubscription, useTracker } from '../../../../lib/ReactMeteorData/react-meteor-data.js'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { BlueprintConfigSchemaSettings } from '../../BlueprintConfigSchema/index.js'
import {
	applyAndValidateOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Blueprints, Studios } from '../../../../collections/index.js'
import { JSONBlobParse } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { useTranslation } from 'react-i18next'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { SelectConfigPreset } from './SelectConfigPreset.js'
import { SelectBlueprint } from './SelectBlueprint.js'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { UIBlueprintUpgradeStatuses } from '../../../Collections.js'
import { getUpgradeStatusMessage, UpgradeStatusButtons } from '../../Upgrades/Components.js'
import { UIBlueprintUpgradeStatusStudio } from '@sofie-automation/meteor-lib/dist/api/upgradeStatus'

interface StudioBlueprintConfigurationSettingsProps {
	studio: DBStudio
}

export function StudioBlueprintConfigurationSettings(
	props: Readonly<StudioBlueprintConfigurationSettingsProps>
): JSX.Element {
	const { t } = useTranslation()

	const isStatusReady = useSubscription(MeteorPubSub.uiBlueprintUpgradeStatuses)
	const status = useTracker(
		() =>
			UIBlueprintUpgradeStatuses.findOne({
				documentId: props.studio._id,
				documentType: 'studio',
			}) as UIBlueprintUpgradeStatusStudio | undefined,
		[props.studio._id]
	)
	const statusMessage = isStatusReady && status ? (getUpgradeStatusMessage(t, status) ?? t('OK')) : t('Loading...')

	const blueprint = useTracker(() => {
		return props.studio.blueprintId
			? Blueprints.findOne({
					_id: props.studio.blueprintId,
					blueprintType: BlueprintManifestType.STUDIO,
				})
			: undefined
	}, [props.studio.blueprintId])
	const configSchema = useMemo(
		() => (blueprint?.studioConfigSchema ? JSONBlobParse(blueprint.studioConfigSchema) : undefined),
		[blueprint?.studioConfigSchema]
	)
	const translationNamespaces = useMemo(() => ['blueprint_' + props.studio.blueprintId], [props.studio.blueprintId])

	const layerMappings = useMemo(() => {
		return {
			[props.studio.name]: applyAndValidateOverrides(props.studio.mappingsWithOverrides).obj,
		}
	}, [props.studio.name, props.studio.mappingsWithOverrides])

	const saveBlueprintConfigOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(props.studio._id, {
				$set: {
					'blueprintConfigWithOverrides.overrides': newOps,
				},
			})
		},
		[props.studio._id]
	)

	return (
		<>
			<h2 className="mb-4">{t('Blueprint Configuration')}</h2>

			<div className="properties-grid">
				<SelectBlueprint studio={props.studio} />
				<SelectConfigPreset studio={props.studio} blueprint={blueprint} />

				<label className="field">
					<div className="label-actual">{t('Upgrade Status')}</div>
					<div className="field-content">{statusMessage}</div>
				</label>
				{status && (
					<div className="field">
						<div className="label-actual"></div>
						<div className="field-content">
							<UpgradeStatusButtons upgradeResult={status} />
						</div>
					</div>
				)}
			</div>

			{!status || status.pendingRunOfFixupFunction ? (
				!status ? (
					<p>{t('Loading')}</p>
				) : (
					<p>{t('Config Fix Up must be run or ignored before the configuration can be edited')}</p>
				)
			) : (
				<BlueprintConfigSchemaSettings
					schema={configSchema}
					translationNamespaces={translationNamespaces}
					layerMappings={layerMappings}
					configObject={props.studio.blueprintConfigWithOverrides}
					saveOverrides={saveBlueprintConfigOverrides}
					alternateConfig={undefined}
				/>
			)}
		</>
	)
}
