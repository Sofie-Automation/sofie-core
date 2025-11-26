import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import { ShowStyleBases } from '../../../collections'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { DBShowStyleBase, SourceLayers, OutputLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

interface AbChannelDisplaySettingsProps {
	showStyleBase: DBShowStyleBase
}

export function AbChannelDisplaySettings({ showStyleBase }: Readonly<AbChannelDisplaySettingsProps>): JSX.Element {
	const { t } = useTranslation()

	const sourceLayers: SourceLayers = useMemo(
		() => applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj,
		[showStyleBase.sourceLayersWithOverrides]
	)

	const outputLayers: OutputLayers = useMemo(
		() => applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj,
		[showStyleBase.outputLayersWithOverrides]
	)

	const sourceLayerOptions = useMemo(() => {
		return Object.entries<SourceLayers[string]>(sourceLayers).map(([id, layer]) => ({
			value: id,
			label: layer?.name ?? id,
		}))
	}, [sourceLayers])

	const outputLayerOptions = useMemo(() => {
		return Object.entries<OutputLayers[string]>(outputLayers).map(([id, layer]) => ({
			value: id,
			label: layer?.name ?? id,
		}))
	}, [outputLayers])

	const sourceLayerTypeOptions = useMemo(() => {
		return [
			{ value: SourceLayerType.UNKNOWN, label: 'Unknown' },
			{ value: SourceLayerType.CAMERA, label: 'Camera' },
			{ value: SourceLayerType.VT, label: 'VT' },
			{ value: SourceLayerType.REMOTE, label: 'Remote' },
			{ value: SourceLayerType.SCRIPT, label: 'Script' },
			{ value: SourceLayerType.GRAPHICS, label: 'Graphics' },
			{ value: SourceLayerType.SPLITS, label: 'Splits' },
			{ value: SourceLayerType.AUDIO, label: 'Audio' },
			{ value: SourceLayerType.LOWER_THIRD, label: 'Lower Third' },
			{ value: SourceLayerType.LIVE_SPEAK, label: 'Live Speak' },
			{ value: SourceLayerType.TRANSITION, label: 'Transition' },
			{ value: SourceLayerType.LIGHTS, label: 'Lights' },
			{ value: SourceLayerType.LOCAL, label: 'Local' },
		]
	}, [])

	const config = showStyleBase.abChannelDisplay ?? {
		sourceLayerIds: [],
		sourceLayerTypes: [SourceLayerType.VT, SourceLayerType.LIVE_SPEAK],
		outputLayerIds: [],
		showOnDirectorScreen: false,
	}

	const updateConfig = useCallback(
		(updates: Partial<NonNullable<DBShowStyleBase['abChannelDisplay']>>) => {
			const newConfig: NonNullable<DBShowStyleBase['abChannelDisplay']> = {
				sourceLayerIds: config.sourceLayerIds,
				sourceLayerTypes: config.sourceLayerTypes,
				outputLayerIds: config.outputLayerIds,
				showOnDirectorScreen: config.showOnDirectorScreen,
				...updates,
			}

			ShowStyleBases.update(showStyleBase._id, {
				$set: {
					abChannelDisplay: newConfig,
				},
			})
		},
		[showStyleBase._id, config]
	)

	const toggleDirectorScreen = useCallback(() => {
		updateConfig({ showOnDirectorScreen: !config.showOnDirectorScreen })
	}, [updateConfig, config.showOnDirectorScreen])

	const addSourceLayerId = useCallback(
		(layerId: string) => {
			if (!config.sourceLayerIds.includes(layerId)) {
				updateConfig({ sourceLayerIds: [...config.sourceLayerIds, layerId] })
			}
		},
		[updateConfig, config.sourceLayerIds]
	)

	const removeSourceLayerId = useCallback(
		(layerId: string) => {
			updateConfig({ sourceLayerIds: config.sourceLayerIds.filter((id) => id !== layerId) })
		},
		[updateConfig, config.sourceLayerIds]
	)

	const addSourceLayerType = useCallback(
		(type: SourceLayerType) => {
			if (!config.sourceLayerTypes.includes(type)) {
				updateConfig({ sourceLayerTypes: [...config.sourceLayerTypes, type] })
			}
		},
		[updateConfig, config.sourceLayerTypes]
	)

	const removeSourceLayerType = useCallback(
		(type: SourceLayerType) => {
			updateConfig({ sourceLayerTypes: config.sourceLayerTypes.filter((t) => t !== type) })
		},
		[updateConfig, config.sourceLayerTypes]
	)

	const addOutputLayerId = useCallback(
		(layerId: string) => {
			if (!config.outputLayerIds.includes(layerId)) {
				updateConfig({ outputLayerIds: [...config.outputLayerIds, layerId] })
			}
		},
		[updateConfig, config.outputLayerIds]
	)

	const removeOutputLayerId = useCallback(
		(layerId: string) => {
			updateConfig({ outputLayerIds: config.outputLayerIds.filter((id) => id !== layerId) })
		},
		[updateConfig, config.outputLayerIds]
	)

	return (
		<div className="studio-edit mod mhl mvn">
			<h2 className="mhn">{t('AB Resolver Channel Display')}</h2>
			<p className="mhn">
				{t(
					'Configure which pieces should display their assigned AB resolver channel (e.g., "Server A") on various screens. This helps operators identify which video server is playing each clip.'
				)}
			</p>

			<div className="mod mvs mhs">
				<label className="field">
					<input
						type="checkbox"
						className="mod mas"
						checked={config.showOnDirectorScreen}
						onChange={toggleDirectorScreen}
					/>
					{t('Show on Director Screen')}
				</label>
				<p className="muted">{t('Display AB channel assignments on the director countdown screen')}</p>
			</div>

			<div className="mod mvs mhs">
				<h3>{t('Filter by Source Layer')}</h3>
				<p className="muted">
					{t(
						'Select specific source layers that should display AB channel info. Leave empty to use type-based filtering.'
					)}
				</p>

				<div className="mod mvs">
					<select
						className="input text-input input-l"
						title={t('Add source layer')}
						onChange={(e) => {
							if (e.target.value) {
								addSourceLayerId(e.target.value)
								e.target.value = ''
							}
						}}
					>
						<option value="">{t('Add source layer...')}</option>
						{sourceLayerOptions
							.filter((opt) => !config.sourceLayerIds.includes(opt.value))
							.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
					</select>
				</div>

				<table className="table expando settings-studio-source-table">
					<tbody>
						{config.sourceLayerIds.map((layerId) => (
							<tr key={layerId}>
								<td>{sourceLayers[layerId]?.name ?? layerId}</td>
								<td className="actions">
									<button className="action-btn" title={t('Remove')} onClick={() => removeSourceLayerId(layerId)}>
										<FontAwesomeIcon icon={faTrash} />
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="mod mvs mhs">
				<h3>{t('Filter by Source Layer Type')}</h3>
				<p className="muted">
					{t('Select source layer types that should display AB channel info (e.g., VT, Live Speak).')}
				</p>

				<div className="mod mvs">
					<select
						className="input text-input input-l"
						title={t('Add source layer type')}
						onChange={(e) => {
							if (e.target.value) {
								addSourceLayerType(Number(e.target.value) as SourceLayerType)
								e.target.value = ''
							}
						}}
					>
						<option value="">{t('Add source layer type...')}</option>
						{sourceLayerTypeOptions
							.filter((opt) => !config.sourceLayerTypes.includes(opt.value))
							.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
					</select>
				</div>

				<table className="table expando settings-studio-source-table">
					<tbody>
						{config.sourceLayerTypes.map((type) => {
							const option = sourceLayerTypeOptions.find((opt) => opt.value === type)
							return (
								<tr key={type}>
									<td>{option?.label ?? type}</td>
									<td className="actions">
										<button className="action-btn" title={t('Remove')} onClick={() => removeSourceLayerType(type)}>
											<FontAwesomeIcon icon={faTrash} />
										</button>
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>

			<div className="mod mvs mhs">
				<h3>{t('Filter by Output Layer')}</h3>
				<p className="muted">
					{t(
						'Optionally restrict AB channel display to specific output layers (e.g., only PGM). Leave empty to show for all output layers.'
					)}
				</p>

				<div className="mod mvs">
					<select
						className="input text-input input-l"
						title={t('Add output layer')}
						onChange={(e) => {
							if (e.target.value) {
								addOutputLayerId(e.target.value)
								e.target.value = ''
							}
						}}
					>
						<option value="">{t('Add output layer...')}</option>
						{outputLayerOptions
							.filter((opt) => !config.outputLayerIds.includes(opt.value))
							.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
					</select>
				</div>

				<table className="table expando settings-studio-output-table">
					<tbody>
						{config.outputLayerIds.map((layerId) => (
							<tr key={layerId}>
								<td>{outputLayers[layerId]?.name ?? layerId}</td>
								<td className="actions">
									<button className="action-btn" title={t('Remove')} onClick={() => removeOutputLayerId(layerId)}>
										<FontAwesomeIcon icon={faTrash} />
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}
