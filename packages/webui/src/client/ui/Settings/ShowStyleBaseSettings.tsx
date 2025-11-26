import { useTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'
import { Spinner } from '../../lib/Spinner.js'
import RundownLayoutEditor from './RundownLayoutEditor.js'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { TriggeredActionsEditor } from './components/triggeredActions/TriggeredActionsEditor.js'
import { SourceLayerSettings } from './ShowStyle/SourceLayer.js'
import { OutputLayerSettings } from './ShowStyle/OutputLayer.js'
import { HotkeyLegendSettings } from './ShowStyle/HotkeyLegend.js'
import { ShowStyleVariantsSettings } from './ShowStyle/VariantSettings.js'
import { ShowStyleGenericProperties } from './ShowStyle/Generic.js'
import { AbChannelDisplaySettings } from './ShowStyle/AbChannelDisplay.js'
import { Switch, Route, Redirect } from 'react-router-dom'
import { ErrorBoundary } from '../../lib/ErrorBoundary.js'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Blueprints, ShowStyleBases, ShowStyleVariants, Studios } from '../../collections/index.js'
import { JSONBlobParse } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { ShowStyleBaseBlueprintConfigurationSettings } from './ShowStyle/BlueprintConfiguration/index.js'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'

interface IProps {
	match: {
		url: string
		path: string
		params: {
			showStyleBaseId: ShowStyleBaseId
		}
	}
}

export default function ShowStyleBaseSettings({ match }: IProps): JSX.Element {
	const { t } = useTranslation()

	const { showStyleBaseId } = match.params
	const showStyleBase = useTracker(() => ShowStyleBases.findOne(showStyleBaseId), [showStyleBaseId])

	const showStyleVariants = useTracker(
		() =>
			showStyleBase
				? ShowStyleVariants.find(
						{
							showStyleBaseId: showStyleBase._id,
						},
						{
							sort: {
								_rank: 1,
								_id: 1,
							},
						}
					).fetch()
				: [],
		[showStyleBase?._id],
		[]
	)

	const compatibleStudios = useTracker(
		() =>
			showStyleBase
				? Studios.find({
						supportedShowStyleBase: {
							$in: [showStyleBase._id],
						},
					}).fetch()
				: [],
		[showStyleBase?._id],
		[]
	)

	const blueprint = useTracker(
		() =>
			showStyleBase
				? Blueprints.findOne({
						_id: showStyleBase.blueprintId,
						blueprintType: BlueprintManifestType.SHOWSTYLE,
					})
				: undefined,
		[showStyleBase?.blueprintId]
	)

	const blueprintConfigPreset =
		blueprint && blueprint.showStyleConfigPresets && showStyleBase?.blueprintConfigPresetId
			? blueprint.showStyleConfigPresets[showStyleBase.blueprintConfigPresetId]
			: undefined

	const blueprintConfigSchema = useMemo(
		() => (blueprint?.showStyleConfigSchema ? JSONBlobParse(blueprint.showStyleConfigSchema) : undefined),
		[blueprint?.showStyleConfigSchema]
	)

	const layerMappings = useMemo(() => {
		const mappings: { [studioId: string]: MappingsExt } = {}
		for (const studio of compatibleStudios) {
			mappings[studio.name] = applyAndValidateOverrides(studio.mappingsWithOverrides).obj
		}
		return mappings
	}, [compatibleStudios])

	const sourceLayers = useMemo(
		() => (showStyleBase ? applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj : {}),
		[showStyleBase?.sourceLayersWithOverrides]
	)
	const outputLayers = useMemo(
		() => (showStyleBase ? applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj : {}),
		[showStyleBase?.outputLayersWithOverrides]
	)

	if (!showStyleBase) return <Spinner />

	return (
		<div className="studio-edit mx-4">
			<ErrorBoundary>
				<Switch>
					<Route path={`${match.path}/generic`}>
						<ShowStyleGenericProperties showStyleBase={showStyleBase} compatibleStudios={compatibleStudios} />
					</Route>
					<Route path={`${match.path}/layers`}>
						<>
							<SourceLayerSettings showStyleBase={showStyleBase} />
							<OutputLayerSettings showStyleBase={showStyleBase} />
						</>
					</Route>
					<Route path={`${match.path}/action-triggers`}>
						<TriggeredActionsEditor
							showStyleBaseId={showStyleBase._id}
							sourceLayers={sourceLayers}
							outputLayers={outputLayers}
						/>
					</Route>
					<Route path={`${match.path}/hotkey-labels`}>
						<HotkeyLegendSettings showStyleBase={showStyleBase} />
					</Route>
					<Route path={`${match.path}/ab-channel-display`}>
						<AbChannelDisplaySettings showStyleBase={showStyleBase} />
					</Route>

					{RundownLayoutsAPI.getSettingsManifest(t).map((region) => {
						return (
							<Route key={region._id} path={`${match.path}/layouts-${region._id}`}>
								<RundownLayoutEditor
									showStyleBaseId={showStyleBase._id}
									sourceLayers={sourceLayers}
									outputLayers={outputLayers}
									studios={compatibleStudios}
									customRegion={region}
								/>
							</Route>
						)
					})}

					<Route path={`${match.path}/blueprint-config`}>
						<ShowStyleBaseBlueprintConfigurationSettings
							showStyleBase={showStyleBase}
							schema={blueprintConfigSchema}
							layerMappings={layerMappings}
							sourceLayers={sourceLayers}
						/>
					</Route>
					<Route path={`${match.path}/variants`}>
						<ShowStyleVariantsSettings
							showStyleVariants={showStyleVariants}
							blueprintConfigSchema={blueprintConfigSchema}
							blueprintTranslationNamespaces={['blueprint_' + showStyleBase?.blueprintId]}
							blueprintConfigPreset={blueprintConfigPreset}
							showStyleBase={showStyleBase}
							layerMappings={layerMappings}
							sourceLayers={sourceLayers}
						/>
					</Route>

					<Redirect to={`${match.path}/generic`} />
				</Switch>
			</ErrorBoundary>
		</div>
	)
}
