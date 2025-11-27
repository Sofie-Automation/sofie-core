import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import { ShowStyleBases } from '../../../collections'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo } from 'react'
import { DBShowStyleBase, SourceLayers, OutputLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ColumnPackedGrid, ColumnPackedGridGroup, ColumnPackedGridItem } from '../components/ColumnPackedGrid'
import '../components/ColumnPackedGrid.scss'
import './AbChannelDisplay.scss'

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

	const sourceLayerTypeLabels = useMemo<Partial<Record<SourceLayerType, string>>>(
		() => ({
			[SourceLayerType.UNKNOWN]: 'Unknown',
			[SourceLayerType.CAMERA]: 'Camera',
			[SourceLayerType.VT]: 'VT',
			[SourceLayerType.REMOTE]: 'Remote',
			[SourceLayerType.SCRIPT]: 'Script',
			[SourceLayerType.GRAPHICS]: 'Graphics',
			[SourceLayerType.SPLITS]: 'Splits',
			[SourceLayerType.AUDIO]: 'Audio',
			[SourceLayerType.LOWER_THIRD]: 'Lower Third',
			[SourceLayerType.LIVE_SPEAK]: 'Live Speak',
			[SourceLayerType.TRANSITION]: 'Transition',
			[SourceLayerType.LIGHTS]: 'Lights',
			[SourceLayerType.LOCAL]: 'Local',
		}),
		[]
	)

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

	// Group source layers by type for the checkbox grid
	const sourceLayerGroups = useMemo<ColumnPackedGridGroup[]>(() => {
		// Group layers by their type
		const grouped = new Map<SourceLayerType, string[]>()

		Object.entries<SourceLayers[string]>(sourceLayers).forEach(([id, layer]) => {
			const type = layer?.type ?? SourceLayerType.UNKNOWN
			if (!grouped.has(type)) {
				grouped.set(type, [])
			}
			grouped.get(type)!.push(id)
		})

		// Convert to ColumnPackedGridGroup format
		return Array.from(grouped.entries()).map(([type, layerIds]) => ({
			id: String(type),
			title: sourceLayerTypeLabels[type] ?? String(type),
			itemKeys: layerIds,
			isGroupSelected: config.sourceLayerTypes.includes(type),
			onGroupToggle: (groupId: string, checked: boolean) => {
				const typeValue = Number(groupId) as SourceLayerType
				if (checked) {
					if (!config.sourceLayerTypes.includes(typeValue)) {
						updateConfig({ sourceLayerTypes: [...config.sourceLayerTypes, typeValue] })
					}
				} else {
					updateConfig({ sourceLayerTypes: config.sourceLayerTypes.filter((t) => t !== typeValue) })
				}
			},
		}))
	}, [sourceLayers, sourceLayerTypeLabels, config.sourceLayerTypes, updateConfig])

	// Prepare source layer items for rendering
	const sourceLayerItems = useMemo<ColumnPackedGridItem<string>[]>(() => {
		const allLayerIds = Object.keys(sourceLayers)
		return allLayerIds.map((layerId) => {
			const layer = sourceLayers[layerId]
			const layerType = layer?.type ?? SourceLayerType.UNKNOWN
			return {
				data: layerId,
				key: layerId,
				label: layer?.name ?? layerId,
				isSelected: config.sourceLayerIds.includes(layerId),
				isGroupSelected: config.sourceLayerTypes.includes(layerType),
				onToggle: (id: string, checked: boolean) => {
					if (checked) {
						if (!config.sourceLayerIds.includes(id)) {
							updateConfig({ sourceLayerIds: [...config.sourceLayerIds, id] })
						}
					} else {
						updateConfig({ sourceLayerIds: config.sourceLayerIds.filter((existingId) => existingId !== id) })
					}
				},
			}
		})
	}, [sourceLayers, config.sourceLayerIds, config.sourceLayerTypes, updateConfig])

	// Prepare output layer items (no groups, just standalone items)
	const outputLayerItems = useMemo<ColumnPackedGridItem<string>[]>(() => {
		const allLayerIds = Object.keys(outputLayers)
		return allLayerIds.map((layerId) => {
			const layer = outputLayers[layerId]
			return {
				data: layerId,
				key: layerId,
				label: layer?.name ?? layerId,
				isSelected: config.outputLayerIds.includes(layerId),
				isGroupSelected: false,
				onToggle: (id: string, checked: boolean) => {
					if (checked) {
						if (!config.outputLayerIds.includes(id)) {
							updateConfig({ outputLayerIds: [...config.outputLayerIds, id] })
						}
					} else {
						updateConfig({ outputLayerIds: config.outputLayerIds.filter((existingId) => existingId !== id) })
					}
				},
			}
		})
	}, [outputLayers, config.outputLayerIds, updateConfig])

	// Simple height calculation (all items same height for now)
	const getItemHeight = useCallback(() => 30, [])

	return (
		<div className="studio-edit ab-channel-display">
			<h2>{t('AB Resolver Channel Display')}</h2>
			<p>
				{t(
					'Configure which pieces should display their assigned AB resolver channel (e.g., "Server A") on various screens. This helps operators identify which video server is playing each clip.'
				)}
			</p>

			<div className="ab-channel-display__section">
				<p>{t('Display AB channel assignments on:')}</p>
				<label className="field ab-channel-display__checkbox">
					<input type="checkbox" checked={config.showOnDirectorScreen} onChange={toggleDirectorScreen} />
					<strong>{t('Director Screen')}</strong>
				</label>
			</div>

			<div className="ab-channel-display__section ab-channel-display__section--large-gap">
				<h3>{t('Filter by Source Layer')}</h3>
				<p className="muted">
					{t(
						'Check layer types to select all layers of that type, or check individual layers for more specific filtering.'
					)}
				</p>

				<ColumnPackedGrid
					groups={sourceLayerGroups}
					items={sourceLayerItems}
					emptyMessage={t('No source layers available')}
					getItemHeight={getItemHeight}
					targetColumns={3}
				/>
			</div>

			<div className="ab-channel-display__section ab-channel-display__section--large-gap">
				<h3>{t('Filter by Output Layer')}</h3>
				<p className="muted">
					{t(
						'Optionally restrict AB channel display to specific output layers (e.g., only PGM). Leave empty to show for all output layers.'
					)}
				</p>

				<ColumnPackedGrid
					items={outputLayerItems}
					emptyMessage={t('No output layers available')}
					getItemHeight={getItemHeight}
					targetColumns={3}
				/>
			</div>
		</div>
	)
}
