import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { OutputLayers, DBShowStyleBase, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import RundownLayoutEditor from './RundownLayoutEditor'
import { DBStudio, MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { BlueprintManifestType, IShowStyleConfigPreset } from '@sofie-automation/blueprints-integration'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts'
import { TriggeredActionsEditor } from './components/triggeredActions/TriggeredActionsEditor'
import { SourceLayerSettings } from './ShowStyle/SourceLayer'
import { OutputLayerSettings } from './ShowStyle/OutputLayer'
import { HotkeyLegendSettings } from './ShowStyle/HotkeyLegend'
import { ShowStyleVariantsSettings } from './ShowStyle/VariantSettings'
import { ShowStyleGenericProperties } from './ShowStyle/Generic'
import { Switch, Route, Redirect } from 'react-router-dom'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Blueprints, ShowStyleBases, ShowStyleVariants, Studios } from '../../collections'
import { JSONBlobParse } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { ShowStyleBaseBlueprintConfigurationSettings } from './ShowStyle/BlueprintConfiguration'

interface IProps {
	match: {
		url: string
		path: string
		params: {
			showStyleBaseId: ShowStyleBaseId
		}
	}
}
interface IState {
	uploadFileKey: number // Used to force clear the input after use
	showUploadConfirm: boolean
	uploadFileName?: string
	uploadFileContents?: string
}
interface ITrackedProps {
	showStyleBase?: DBShowStyleBase
	showStyleVariants: Array<DBShowStyleVariant>
	compatibleStudios: Array<DBStudio>
	blueprintConfigSchema: JSONSchema | undefined
	blueprintConfigPreset: IShowStyleConfigPreset | undefined
	sourceLayers: SourceLayers
	outputLayers: OutputLayers
	layerMappings: { [studioId: string]: MappingsExt }
}
export default translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	const showStyleBase = ShowStyleBases.findOne(props.match.params.showStyleBaseId)
	const compatibleStudios = showStyleBase
		? Studios.find({
				supportedShowStyleBase: {
					$in: [showStyleBase._id],
				},
		  }).fetch()
		: []
	const blueprint = showStyleBase
		? Blueprints.findOne({
				_id: showStyleBase.blueprintId,
				blueprintType: BlueprintManifestType.SHOWSTYLE,
		  })
		: undefined

	const mappings: { [studioId: string]: MappingsExt } = {}
	for (const studio of compatibleStudios) {
		mappings[studio.name] = applyAndValidateOverrides(studio.mappingsWithOverrides).obj
	}

	const sourceLayers = showStyleBase ? applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj : {}
	const outputLayers = showStyleBase ? applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj : {}

	return {
		showStyleBase: showStyleBase,
		showStyleVariants: showStyleBase
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
		compatibleStudios: compatibleStudios,
		blueprintConfigSchema: blueprint?.showStyleConfigSchema
			? JSONBlobParse(blueprint.showStyleConfigSchema)
			: undefined,
		blueprintConfigPreset:
			blueprint && blueprint.showStyleConfigPresets && showStyleBase?.blueprintConfigPresetId
				? blueprint.showStyleConfigPresets[showStyleBase.blueprintConfigPresetId]
				: undefined,
		sourceLayers,
		outputLayers,
		layerMappings: mappings,
	}
})(
	class ShowStyleBaseSettings extends React.Component<Translated<IProps & ITrackedProps>, IState> {
		constructor(props: Translated<IProps & ITrackedProps>) {
			super(props)
			this.state = {
				uploadFileKey: Date.now(),
				showUploadConfirm: false,
			}
		}

		onUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
			const file = e.target.files?.[0]
			if (!file) {
				return
			}

			const reader = new FileReader()
			reader.onload = (e2) => {
				this.setState({
					uploadFileKey: Date.now(),
					showUploadConfirm: true,
					uploadFileName: file.name,
					uploadFileContents: (e2.target as any).result,
				})
			}

			reader.readAsText(file)
		}

		renderEditForm(showStyleBase: DBShowStyleBase) {
			const { t } = this.props
			return (
				<div className="studio-edit mod mhl mvn">
					<div className="row">
						<div className="col c12 r1-c12">
							<ErrorBoundary>
								<Switch>
									<Route path={`${this.props.match.path}/generic`}>
										<ShowStyleGenericProperties
											showStyleBase={showStyleBase}
											compatibleStudios={this.props.compatibleStudios}
										/>
									</Route>
									<Route path={`${this.props.match.path}/layers`}>
										<>
											<SourceLayerSettings showStyleBase={showStyleBase} />
											<OutputLayerSettings showStyleBase={showStyleBase} />
										</>
									</Route>
									<Route path={`${this.props.match.path}/action-triggers`}>
										<TriggeredActionsEditor
											showStyleBaseId={showStyleBase._id}
											sourceLayers={this.props.sourceLayers}
											outputLayers={this.props.outputLayers}
										/>
									</Route>
									<Route path={`${this.props.match.path}/hotkey-labels`}>
										<HotkeyLegendSettings showStyleBase={showStyleBase} />
									</Route>

									{RundownLayoutsAPI.getSettingsManifest(t).map((region) => {
										return (
											<Route key={region._id} path={`${this.props.match.path}/layouts-${region._id}`}>
												<RundownLayoutEditor
													showStyleBaseId={showStyleBase._id}
													sourceLayers={this.props.sourceLayers}
													outputLayers={this.props.outputLayers}
													studios={this.props.compatibleStudios}
													customRegion={region}
												/>
											</Route>
										)
									})}

									<Route path={`${this.props.match.path}/blueprint-config`}>
										<ShowStyleBaseBlueprintConfigurationSettings
											showStyleBase={showStyleBase}
											schema={this.props.blueprintConfigSchema}
											layerMappings={this.props.layerMappings}
											sourceLayers={this.props.sourceLayers}
										/>
									</Route>
									<Route path={`${this.props.match.path}/variants`}>
										<ShowStyleVariantsSettings
											showStyleVariants={this.props.showStyleVariants}
											blueprintConfigSchema={this.props.blueprintConfigSchema}
											blueprintTranslationNamespaces={['blueprint_' + this.props.showStyleBase?.blueprintId]}
											blueprintConfigPreset={this.props.blueprintConfigPreset}
											showStyleBase={showStyleBase}
											layerMappings={this.props.layerMappings}
											sourceLayers={this.props.sourceLayers}
										/>
									</Route>

									<Redirect to={`${this.props.match.path}/generic`} />
								</Switch>
							</ErrorBoundary>
						</div>
					</div>
				</div>
			)
		}

		render(): JSX.Element {
			if (this.props.showStyleBase) {
				return this.renderEditForm(this.props.showStyleBase)
			} else {
				return <Spinner />
			}
		}
	}
)
