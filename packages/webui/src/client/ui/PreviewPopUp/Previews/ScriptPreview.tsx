import { getScriptPreview } from '../../../lib/ui/scriptPreview.js'
import { useTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { MdDisplay } from '../../Prompter/Formatted/MdDisplay.js'
import classNames from 'classnames'

interface ScriptPreviewProps {
	content: {
		type: 'script'
		script?: string
		scriptFormatted?: string
		lastWords?: string
		comment?: string
		lastModified?: number
	}
}

export function ScriptPreview({ content }: ScriptPreviewProps): React.ReactElement {
	const { t } = useTranslation()

	const fullScript = content?.script?.trim() ?? ''

	const { startOfScript, endOfScript, breakScript } = getScriptPreview(fullScript)

	return (
		<div>
			<div className="preview-popUp__script">
				{fullScript ? (
					breakScript ? (
						<>
							<span className="mini-inspector__full-text text-broken">{startOfScript + '\u2026'}</span>
							<span className="mini-inspector__full-text text-broken text-end">{'\u2026' + endOfScript}</span>
						</>
					) : (
						<span
							className={classNames('mini-inspector__full-text', {
								'script-text-formatted': content.scriptFormatted !== undefined,
							})}
						>
							{content.scriptFormatted !== undefined ? <MdDisplay source={content.scriptFormatted} /> : fullScript}
						</span>
					)
				) : content.lastWords ? (
					<span className="mini-inspector__full-text">{'\u2026' + content.lastWords}</span>
				) : !content?.comment ? (
					<span className="mini-inspector__system">{t('Script is empty')}</span>
				) : null}
			</div>
			{content?.comment && <div className="preview-popUp__script-comment">{content.comment}</div>}
			{content.lastModified && (
				<div className="preview-popUp__script-last-modified">
					<span className="mini-inspector__changed">
						<Moment date={content.lastModified} calendar={true} />
					</span>
				</div>
			)}
		</div>
	)
}
