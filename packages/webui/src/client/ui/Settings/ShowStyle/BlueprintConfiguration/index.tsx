import { useCallback, useMemo } from 'react'
import { JSONSchema } from '@sofie-automation/blueprints-integration'
import { BlueprintConfigSchemaSettings } from '../../BlueprintConfigSchema'
import { SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleBases } from '../../../../collections'
import { useTranslation } from 'react-i18next'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DBShowStyleBase, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { SelectConfigPreset } from './SelectConfigPreset'
import { SelectBlueprint } from './SelectBlueprint'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { useSubscription, useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData'
import { UIBlueprintUpgradeStatuses } from '../../../Collections'
import { getUpgradeStatusMessage, UpgradeStatusButtons } from '../../Upgrades/Components'
import { UIBlueprintUpgradeStatusShowStyle } from '@sofie-automation/meteor-lib/dist/api/upgradeStatus'

interface ShowStyleBaseBlueprintConfigurationSettingsProps {
	showStyleBase: DBShowStyleBase

	schema: JSONSchema | undefined

	layerMappings: { [studioId: string]: MappingsExt } | undefined
	sourceLayers: SourceLayers | undefined
}

export function ShowStyleBaseBlueprintConfigurationSettings(
	props: Readonly<ShowStyleBaseBlueprintConfigurationSettingsProps>
): JSX.Element {
	const { t } = useTranslation()

	const isStatusReady = useSubscription(MeteorPubSub.uiBlueprintUpgradeStatuses)
	const status = useTracker(
		() =>
			UIBlueprintUpgradeStatuses.findOne({
				documentId: props.showStyleBase._id,
				documentType: 'showStyle',
			}) as UIBlueprintUpgradeStatusShowStyle | undefined,
		[props.showStyleBase._id]
	)
	const statusMessage = isStatusReady && status ? getUpgradeStatusMessage(t, status) ?? t('OK') : t('Loading...')

	const translationNamespaces = useMemo(
		() => ['blueprint_' + props.showStyleBase.blueprintId],
		[props.showStyleBase.blueprintId]
	)

	const saveBlueprintConfigOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			ShowStyleBases.update(props.showStyleBase._id, {
				$set: {
					'blueprintConfigWithOverrides.overrides': newOps,
				},
			})
		},
		[props.showStyleBase._id]
	)

	return (
		<>
			<h2 className="mhn">{t('Blueprint Configuration')}</h2>

			<SelectBlueprint showStyleBase={props.showStyleBase} />
			<SelectConfigPreset showStyleBase={props.showStyleBase} />

			<p>
				{t('Upgrade Status')}: {statusMessage}
				{status && <UpgradeStatusButtons upgradeResult={status} />}
			</p>

			{!status || status.pendingRunOfFixupFunction ? (
				!status ? (
					<p>{t('Loading')}</p>
				) : (
					<p>{t('Config Fix Up must be run or ignored before the configuration can be edited')}</p>
				)
			) : (
				<BlueprintConfigSchemaSettings
					schema={props.schema}
					translationNamespaces={translationNamespaces}
					layerMappings={props.layerMappings}
					sourceLayers={props.sourceLayers}
					configObject={props.showStyleBase.blueprintConfigWithOverrides}
					saveOverrides={saveBlueprintConfigOverrides}
					alternateConfig={undefined}
				/>
			)}
		</>
	)
}
