import { PreviewContent } from '@sofie-automation/blueprints-integration'
import { RundownUtils } from '../../../lib/rundown'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'

type layerInfoContent = Extract<PreviewContent, { type: 'layerInfo' }>

export function LayerInfoPreview(content: layerInfoContent): React.ReactElement {
	const { t } = useTranslation()
	const sourceLayerClassName =
		content.layerType !== undefined ? RundownUtils.getSourceLayerClassName(content.layerType) : undefined

	return (
		<div className="preview-popUp__element-with-time-info">
			<div className={classNames('preview-popUp__element-with-time-info__layer-color', sourceLayerClassName)}> </div>
			<div>
				{content.text.map((line, index) => (
					<div key={index} className="preview-popUp__element-with-time-info__text">
						{line}
					</div>
				))}
				<div className="preview-popUp__element-with-time-info__timing">
					{content.inTime !== undefined && (
						<>
							<span className="label">{t('IN')}: </span>
							{typeof content.inTime === 'number'
								? RundownUtils.formatTimeToShortTime(content.inTime || 0)
								: content.inTime}
						</>
					)}
					&nbsp;{' '}
					{content.duration !== undefined && (
						<>
							<span className="label">{t('DURATION')}: </span>
							{typeof content.duration === 'number'
								? RundownUtils.formatTimeToShortTime(content.duration || 0)
								: content.duration}
						</>
					)}
					&nbsp;{' '}
					{content.outTime !== undefined && (
						<>
							<span className="label">{t('OUT')}: </span>
							{typeof content.outTime === 'number'
								? RundownUtils.formatTimeToShortTime(content.outTime || 0)
								: content.outTime}
						</>
					)}
				</div>
			</div>
		</div>
	)
}
