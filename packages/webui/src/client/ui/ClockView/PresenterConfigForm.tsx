import { useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import Form from 'react-bootstrap/esm/Form'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { RundownLayouts } from '../../collections/index.js'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'

import './PrompterConfigForm.scss'

interface PresenterConfigState {
	presenterLayout: string
}

const initialState: PresenterConfigState = {
	presenterLayout: '',
}

/** Generate the complete presenter screen URL */
function generatePresenterUrl(studioId: StudioId, config: PresenterConfigState): string {
	const params = new URLSearchParams()

	if (config.presenterLayout.trim()) {
		params.set('presenterLayout', config.presenterLayout.trim())
	}

	const queryString = params.toString()
	return `/countdowns/${studioId}/presenter${queryString ? '?' + queryString : ''}`
}

export function PresenterConfigForm({ studioId }: Readonly<{ studioId: StudioId }>): JSX.Element {
	const { t } = useTranslation()
	const [config, setConfig] = useState<PresenterConfigState>(initialState)

	// Subscribe to all rundown layouts
	const subsReady = useSubscription(MeteorPubSub.rundownLayouts, null)

	// Fetch presenter view layouts
	const presenterLayouts = useTracker(
		() =>
			RundownLayouts.find()
				.fetch()
				.filter((layout) => RundownLayoutsAPI.isLayoutForPresenterView(layout))
				.sort((a, b) => a.name.localeCompare(b.name)),
		[],
		[]
	)

	const updateConfig = useCallback(<K extends keyof PresenterConfigState>(key: K, value: PresenterConfigState[K]) => {
		setConfig((prev) => ({ ...prev, [key]: value }))
	}, [])

	const generatedUrl = useMemo(() => generatePresenterUrl(studioId, config), [config, studioId])

	return (
		<div className="prompter-config-form">
			<div className="mb-3">
				<Form.Group className="mb-2">
					<Form.Label>{t('Presenter Layout')}</Form.Label>
					<Form.Select
						size="sm"
						value={config.presenterLayout}
						onChange={(e) => updateConfig('presenterLayout', e.target.value)}
					>
						<option value="">{subsReady ? t('(Default)') : t('Loading...')}</option>
						{presenterLayouts.map((layout) => (
							<option key={unprotectString(layout._id)} value={unprotectString(layout._id)}>
								{layout.name}
							</option>
						))}
					</Form.Select>
					<Form.Text className="text-muted">
						{t('Select a presenter layout. Leave as default to use the first available layout.')}
					</Form.Text>
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
					{t('Open Presenter Screen')}
				</Link>
			</div>
		</div>
	)
}
