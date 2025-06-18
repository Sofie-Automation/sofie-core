import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { unprotectString } from '../../../lib/tempLib'
import { EditAttribute } from '../../../lib/EditAttribute'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { Link } from 'react-router-dom'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ShowStyleBases } from '../../../collections'
import { LabelActual } from '../../../lib/Components/LabelAndOverrides'

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
		<div>
			<div>
				<label className="field">
					<LabelActual label={t('Show Style Base Name')} />
					{!showStyleBase?.name ? (
						<div className="error-notice inline">
							<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No name set')}
						</div>
					) : null}
					<div className="mdi">
						<EditAttribute
							modifiedClassName="bghl"
							attribute="name"
							obj={showStyleBase}
							type="text"
							collection={ShowStyleBases}
							className="mdinput"
						></EditAttribute>
						<span className="mdfx"></span>
					</div>
				</label>
			</div>
			<div>
				<p className="mod mhn mvs">{t('Compatible Studios:')}</p>
				<p className="mod mhn mvs">
					{compatibleStudios.length > 0
						? compatibleStudios.map((i) => (
								<span key={unprotectString(i._id)} className="pill">
									<Link className="pill-link" to={`/settings/studio/${i._id}`}>
										{i.name}
									</Link>
								</span>
						  ))
						: t('This Show Style is not compatible with any Studio')}
				</p>
			</div>
		</div>
	)
}
