import { useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ISourceLayer, SourceLayerType } from '@sofie-automation/blueprints-integration'
import Form from 'react-bootstrap/esm/Form'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { ShowStyleBases } from '../../collections/index.js'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

import './PrompterConfigForm.scss'

interface CameraConfigState {
	selectedSourceLayerIds: Set<string>
	studioLabels: string
	fullscreen: boolean
}

const initialState: CameraConfigState = {
	selectedSourceLayerIds: new Set(),
	studioLabels: '',
	fullscreen: false,
}

/** Source layer types that are relevant for the camera screen */
const CAMERA_SOURCE_LAYER_TYPES = new Set([SourceLayerType.CAMERA, SourceLayerType.REMOTE, SourceLayerType.SPLITS])

/** Generate the complete camera screen URL */
function generateCameraUrl(studioId: StudioId, config: CameraConfigState): string {
	const params = new URLSearchParams()

	if (config.selectedSourceLayerIds.size > 0) {
		params.set('sourceLayerIds', Array.from(config.selectedSourceLayerIds).join(','))
	}
	if (config.studioLabels.trim()) {
		params.set('studioLabels', config.studioLabels.trim())
	}
	if (config.fullscreen) {
		params.set('fullscreen', '1')
	}

	const queryString = params.toString()
	return `/countdowns/${studioId}/camera${queryString ? '?' + queryString : ''}`
}

export function CameraConfigForm({ studioId }: Readonly<{ studioId: StudioId }>): JSX.Element {
	const { t } = useTranslation()
	const [config, setConfig] = useState<CameraConfigState>(initialState)

	// Subscribe to all ShowStyleBases
	const subsReady = useSubscription(CorelibPubSub.showStyleBases, null)

	// Get all camera-related source layers from all show styles (union)
	const allSourceLayers = useTracker(
		() => {
			const showStyles = ShowStyleBases.find().fetch()
			const layerMap = new Map<string, ISourceLayer>()

			for (const showStyle of showStyles) {
				const resolvedLayers = applyAndValidateOverrides(showStyle.sourceLayersWithOverrides).obj
				for (const [id, layer] of Object.entries<ISourceLayer | undefined>(resolvedLayers)) {
					if (layer && CAMERA_SOURCE_LAYER_TYPES.has(layer.type) && !layerMap.has(id)) {
						layerMap.set(id, layer)
					}
				}
			}

			return Array.from(layerMap.values()).sort((a, b) => {
				// Sort by type first, then by rank
				if (a.type !== b.type) return a.type - b.type
				return a._rank - b._rank
			})
		},
		[],
		[]
	)

	const toggleSourceLayer = useCallback((layerId: string, checked: boolean) => {
		setConfig((prev) => {
			const newSet = new Set(prev.selectedSourceLayerIds)
			if (checked) {
				newSet.add(layerId)
			} else {
				newSet.delete(layerId)
			}
			return { ...prev, selectedSourceLayerIds: newSet }
		})
	}, [])

	const updateConfig = useCallback(<K extends keyof CameraConfigState>(key: K, value: CameraConfigState[K]) => {
		setConfig((prev) => ({ ...prev, [key]: value }))
	}, [])

	const generatedUrl = useMemo(() => generateCameraUrl(studioId, config), [config, studioId])

	const getSourceLayerTypeName = useCallback(
		(type: SourceLayerType): string => {
			switch (type) {
				case SourceLayerType.CAMERA:
					return t('Camera')
				case SourceLayerType.REMOTE:
					return t('Remote')
				case SourceLayerType.SPLITS:
					return t('Splits')
				default:
					return t('Other')
			}
		},
		[t]
	)

	const renderSourceLayers = () => {
		if (!subsReady) {
			return <div className="text-muted">{t('Loading...')}</div>
		}
		if (allSourceLayers.length === 0) {
			return <div className="text-muted">{t('No camera-related source layers found')}</div>
		}
		return (
			<div className="nested-section">
				{allSourceLayers.map((layer) => (
					<Form.Check
						key={layer._id}
						type="checkbox"
						id={`source-layer-${layer._id}`}
						label={`${layer.name} (${getSourceLayerTypeName(layer.type)})`}
						checked={config.selectedSourceLayerIds.has(layer._id)}
						onChange={(e) => toggleSourceLayer(layer._id, e.target.checked)}
					/>
				))}
			</div>
		)
	}

	return (
		<div className="prompter-config-form">
			<div className="mb-3">
				<Form.Group className="mb-3">
					<Form.Label>{t('Source Layers')}</Form.Label>
					{renderSourceLayers()}
					<Form.Text className="text-muted">
						{t('Select source layers to display. Leave all unchecked to show all camera-related layers.')}
					</Form.Text>
				</Form.Group>

				<Form.Group className="mb-2">
					<Form.Label>{t('Studio Labels')}</Form.Label>
					<Form.Control
						type="text"
						size="sm"
						placeholder={t('e.g., Studio A,Studio B')}
						value={config.studioLabels}
						onChange={(e) => updateConfig('studioLabels', e.target.value)}
					/>
					<Form.Text className="text-muted">
						{t('Comma-separated list of studio labels to filter by. Leave empty for all.')}
					</Form.Text>
				</Form.Group>

				<Form.Group className="mb-2">
					<Form.Check
						type="checkbox"
						id="camera-fullscreen"
						label={t('Fullscreen mode')}
						checked={config.fullscreen}
						onChange={(e) => updateConfig('fullscreen', e.target.checked)}
					/>
					<Form.Text className="text-muted">{t('Click anywhere on the screen to enter fullscreen.')}</Form.Text>
				</Form.Group>
			</div>

			{/* Generated URL and Open Button */}
			<div className="nested-section mt-3">
				<Form.Group className="mb-2">
					<Form.Label>
						<strong>{t('Generated URL')}:</strong>
					</Form.Label>
					<Form.Control type="text" size="sm" readOnly value={generatedUrl} onClick={(e) => e.currentTarget.select()} />
				</Form.Group>
				<Link to={generatedUrl} className="btn btn-primary">
					{t('Open Camera Screen')}
				</Link>
			</div>
		</div>
	)
}
