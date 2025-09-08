import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { unprotectString } from '../../../lib/tempLib.js'
import { EditAttribute } from '../../../lib/EditAttribute.js'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { Link } from 'react-router-dom'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ShowStyleBases } from '../../../collections/index.js'
import { LabelActual } from '../../../lib/Components/LabelAndOverrides.js'

interface IShowStyleGenericPropertiesProps {
	showStyleBase: DBShowStyleBase
	compatibleStudios: Array<DBStudio>
}
export function ShowStyleGenericProperties({
	showStyleBase,
	compatibleStudios,
}: Readonly<IShowStyleGenericPropertiesProps>): JSX.Element {
	const { t } = useTranslation()

	return (
		<div className="properties-grid">
			<h2 className="mb-4">{t('Generic Properties')}</h2>

			<label className="field">
				<LabelActual label={t('Show Style Base Name')} />

				<div className="field-content">
					<EditAttribute attribute="name" obj={showStyleBase} type="text" collection={ShowStyleBases}></EditAttribute>
				</div>
				<div></div>
				<div>
					{!showStyleBase?.name ? (
						<div className="error-notice inline">
							<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No name set')}
						</div>
					) : null}
				</div>
			</label>

			<div className="field">
				<LabelActual label={t('Compatible Studios')} />
				<div className="field-content">
					{compatibleStudios.length > 0
						? compatibleStudios.map((i) => (
								<span key={unprotectString(i._id)} className="pill">
									<Link className="pill-link" to={`/settings/studio/${i._id}`}>
										{i.name}
									</Link>
								</span>
							))
						: t('This Show Style is not compatible with any Studio')}
				</div>
			</div>
		</div>
	)
}
