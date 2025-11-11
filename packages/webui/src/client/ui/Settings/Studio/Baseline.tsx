import { useCallback, useEffect, useState } from 'react'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Meteor } from 'meteor/meteor'
import Tooltip from 'rc-tooltip'
import { MeteorCall } from '../../../lib/meteorApi.js'
import { getHelpMode } from '../../../lib/localStorage.js'
import { useTranslation } from 'react-i18next'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { LabelActual } from '../../../lib/Components/LabelAndOverrides.js'
import { logger } from '../../../lib/logging.js'
import Button from 'react-bootstrap/Button'

interface IStudioBaselineStatusProps {
	studioId: StudioId
}

export function StudioBaselineStatus({ studioId }: Readonly<IStudioBaselineStatusProps>): JSX.Element {
	const { t } = useTranslation()

	const [needsUpdate, setNeedsUpdate] = useState(false)
	useEffect(() => {
		const updateStatus = () => {
			MeteorCall.playout
				.shouldUpdateStudioBaseline(studioId)
				.then((result) => {
					setNeedsUpdate(!!result)
				})
				.catch((err) => {
					logger.error('playout.shouldUpdateStudioBaseline', err)
					setNeedsUpdate(false)
				})
		}

		const updatePeriod = 30000 // every 30s
		const interval = Meteor.setInterval(() => updateStatus(), updatePeriod)
		updateStatus()

		return () => {
			Meteor.clearInterval(interval)
		}
	}, [studioId])

	const reloadBaseline = useCallback(() => {
		MeteorCall.playout
			.updateStudioBaseline(studioId)
			.then((result) => {
				setNeedsUpdate(!!result)
			})
			.catch((err) => {
				logger.error('playout.updateStudioBaseline', err)
				setNeedsUpdate(false)
			})
	}, [studioId])

	return (
		<div className="field">
			<LabelActual label={t('Studio Baseline needs update: ')}></LabelActual>
			<div className="field-content">
				{needsUpdate ? (
					<Tooltip
						overlay={t('Baseline needs reload, this studio may not work until reloaded')}
						visible={getHelpMode()}
						placement="right"
					>
						<span>{t('Yes')}</span>
					</Tooltip>
				) : (
					t('No')
				)}
				<Button variant="secondary" className="ms-2 btn-outline-secondary" onClick={reloadBaseline}>
					{t('Reload Baseline')}
				</Button>
				{needsUpdate ? (
					<span className="error-notice inline">
						{t('Reload Baseline')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</span>
				) : null}
			</div>
		</div>
	)
}
