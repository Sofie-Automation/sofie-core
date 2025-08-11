import { useMemo } from 'react'
import { getScriptPreview } from '../../../lib/ui/scriptPreview.js'
import { useTranslation } from 'react-i18next'
import Moment from 'react-moment'

interface ScriptPreviewProps {
	content: {
		type: 'script'
		script?: string
		lastWords?: string
		comment?: string
		lastModified?: number
	}
}

export function ScriptPreview({ content }: ScriptPreviewProps): React.ReactElement {
	const { t } = useTranslation()
	const { startOfScript, endOfScript, breakScript } = getScriptPreview(content.script ?? '')

	const fullScript = useMemo(() => content?.script?.trim(), [content?.script])

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
						<span className="mini-inspector__full-text">{fullScript}</span>
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
