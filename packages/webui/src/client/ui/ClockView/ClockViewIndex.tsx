import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import Container from 'react-bootstrap/esm/Container'

export function ClockViewIndex({ studioId }: Readonly<{ studioId: StudioId }>): JSX.Element {
	const { t } = useTranslation()

	return (
		<Container fluid="true" className="header-clear">
			<section className="mt-5 mx-5">
				<header className="my-2">
					<h1>{t('Available Screens for Studio {{studioId}}', { studioId })}</h1>
				</header>
				<section className="my-5">
					<ul>
						<li>
							<Link to={`/countdowns/${studioId}/presenter`}>{t('Presenter Screen')}</Link>
						</li>
						<li>
							<Link to={`/countdowns/${studioId}/director`}>{t('Director Screen')}</Link>
						</li>
						<li>
							<Link to={`/countdowns/${studioId}/overlay`}>{t('Overlay Screen')}</Link>
						</li>
						<li>
							<Link to={`/countdowns/${studioId}/camera`}>{t('Camera Screen')}</Link>
						</li>
						<li>
							<Link to={`/prompter/${studioId}`}>{t('Prompter Screen')}</Link>
						</li>
						<li>
							<Link to={`/countdowns/${studioId}/multiview`}>{t('All Screens in a MultiViewer')}</Link>
						</li>
					</ul>
				</section>
			</section>
		</Container>
	)
}
