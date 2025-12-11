import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import './MultiviewScreen.scss'

interface MultiviewScreenProps {
	studioId: StudioId
}

export function MultiviewScreen({ studioId }: Readonly<MultiviewScreenProps>): JSX.Element {
	return (
		<div className="multiview-grid">
			<div className="multiview-item multiview-presenter">
				<iframe src={`/countdowns/${studioId}/presenter`} title="Presenter Screen" />
				<div className="multiview-label">Presenter Screen</div>
			</div>
			<div className="multiview-item multiview-director">
				<iframe src={`/countdowns/${studioId}/director`} title="Director Screen" />
				<div className="multiview-label">Director Screen</div>
			</div>
			<div className="multiview-item multiview-prompter">
				<iframe src={`/prompter/${studioId}`} title="Prompter" />
				<div className="multiview-label">Prompter</div>
			</div>
			<div className="multiview-item multiview-overlay">
				<iframe src={`/countdowns/${studioId}/overlay`} title="Overlay Screen" />
				<div className="multiview-label">Overlay Screen</div>
			</div>
			<div className="multiview-item multiview-camera">
				<iframe src={`/countdowns/${studioId}/camera`} title="Camera Screen" />
				<div className="multiview-label">Camera Screen</div>
			</div>
		</div>
	)
}
