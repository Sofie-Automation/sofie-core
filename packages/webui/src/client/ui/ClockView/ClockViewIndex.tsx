import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import Container from 'react-bootstrap/esm/Container'
import Accordion from 'react-bootstrap/esm/Accordion'
import { PresenterConfigForm } from './PresenterConfigForm'
import { CameraConfigForm } from './CameraConfigForm'
import { PrompterConfigForm } from './PrompterConfigForm'

type AccordionKey = 'presenter' | 'camera' | 'prompter'

export function ClockViewIndex({ studioId }: Readonly<{ studioId: StudioId }>): JSX.Element {
	const { t } = useTranslation()

	// Track which accordions have been opened at least once (for lazy rendering)
	const [openedPanels, setOpenedPanels] = useState<Set<AccordionKey>>(new Set())

	const handleAccordionSelect = useCallback((eventKey: string | string[] | null | undefined) => {
		if (eventKey && typeof eventKey === 'string') {
			setOpenedPanels((prev) => {
				if (prev.has(eventKey as AccordionKey)) return prev
				const next = new Set(prev)
				next.add(eventKey as AccordionKey)
				return next
			})
		}
	}, [])

	return (
		<Container fluid="true" className="header-clear">
			<section className="mt-5 mx-5">
				<header className="my-2">
					<h1>{t('Available Screens for Studio {{studioId}}', { studioId })}</h1>
				</header>
				<section className="my-5">
					<h2>{t('Quick Links')}</h2>
					<ul>
						<li>
							<Link to={`/countdowns/${studioId}/director`}>{t('Director Screen')}</Link>
						</li>
						<li>
							<Link to={`/countdowns/${studioId}/overlay`}>{t('Overlay Screen')}</Link>
						</li>
						<li>
							<Link to={`/countdowns/${studioId}/multiview`}>{t('All Screens in a MultiViewer')}</Link>
						</li>
						<li>
							<Link to={`/activeRundown/${studioId}`}>{t('Active Rundown View')}</Link>
						</li>
					</ul>

					<h2 className="mt-4">{t('Configurable Screens')}</h2>

					<Accordion className="mt-3" onSelect={handleAccordionSelect}>
						<Accordion.Item eventKey="presenter">
							<Accordion.Header>{t('Presenter Screen')}</Accordion.Header>
							<Accordion.Body>
								{openedPanels.has('presenter') && <PresenterConfigForm studioId={studioId} />}
							</Accordion.Body>
						</Accordion.Item>
						<Accordion.Item eventKey="camera">
							<Accordion.Header>{t('Camera Screen')}</Accordion.Header>
							<Accordion.Body>{openedPanels.has('camera') && <CameraConfigForm studioId={studioId} />}</Accordion.Body>
						</Accordion.Item>
						<Accordion.Item eventKey="prompter">
							<Accordion.Header>{t('Prompter')}</Accordion.Header>
							<Accordion.Body>
								{openedPanels.has('prompter') && <PrompterConfigForm studioId={studioId} />}
							</Accordion.Body>
						</Accordion.Item>
					</Accordion>
				</section>
			</section>
		</Container>
	)
}
