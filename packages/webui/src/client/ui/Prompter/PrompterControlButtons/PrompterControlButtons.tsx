import type React from 'react'
import Button from 'react-bootstrap/Button'
import './PrompterControlButtons.scss'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons/faChevronLeft'
import { MeteorCall } from '../../../lib/meteorApi'
import { doUserAction, UserAction } from '../../../lib/clientUserAction'
import type { RundownPlaylistId } from '@sofie-automation/corelib/src/dataModel/Ids'
import type { TFunction } from 'i18next'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown'
import { faChevronUp } from '@fortawesome/free-solid-svg-icons/faChevronUp'
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/src/dataModel/RundownPlaylist/RundownPlaylist'
import { useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { RundownPlaylists } from '../../../collections'
import classNames from 'classnames'

export const PrompterControlButtons: React.FC<{
	playlistId: RundownPlaylistId
	t: TFunction
	controlButtons: 'bottom' | 'left' | 'right' | 'top'
}> = ({ playlistId, t, controlButtons }) => {
	const playlist = useTracker(
		() =>
			RundownPlaylists.findOne(playlistId, {
				fields: {
					_id: 1,
					activationId: 1,
					currentPartInfo: 1,
				},
			}) as Pick<DBRundownPlaylist, '_id' | 'activationId' | 'currentPartInfo'> | undefined,
		[playlistId]
	)

	return (
		<div className={classNames('prompter-control-buttons', `prompter-control-buttons__${controlButtons}`)}>
			<Button
				variant="outline-secondary"
				className="outlined"
				size="lg"
				title={t('Move Next backwards')}
				onClick={(e) => {
					doUserAction(t, e, UserAction.MOVE_NEXT, (e, ts) => MeteorCall.userAction.moveNext(e, ts, playlistId, -1, 0))
				}}
			>
				<FontAwesomeIcon icon={faChevronLeft} />
			</Button>
			<Button
				variant="outline-secondary"
				className="outlined"
				size="lg"
				title={t('Move Next to the previous segment')}
				onClick={(e) => {
					doUserAction(t, e, UserAction.MOVE_NEXT, (e, ts) => MeteorCall.userAction.moveNext(e, ts, playlistId, 0, -1))
				}}
			>
				<FontAwesomeIcon icon={faChevronUp} />
			</Button>
			<Button
				variant="outline-secondary"
				className="outlined"
				size="lg"
				title={t('Move Next to the following segment')}
				onClick={(e) => {
					doUserAction(t, e, UserAction.MOVE_NEXT, (e, ts) => MeteorCall.userAction.moveNext(e, ts, playlistId, 0, 1))
				}}
			>
				<FontAwesomeIcon icon={faChevronDown} />
			</Button>

			<Button
				variant="outline-secondary"
				className="outlined"
				size="lg"
				title={t('Move Next forwards')}
				onClick={(e) => {
					doUserAction(t, e, UserAction.MOVE_NEXT, (e, ts) => MeteorCall.userAction.moveNext(e, ts, playlistId, 1, 0))
				}}
			>
				<FontAwesomeIcon icon={faChevronRight} />
			</Button>
			<Button
				variant="primary"
				className="outlined"
				size="lg"
				onClick={(e) => {
					doUserAction(t, e, UserAction.TAKE, (e, ts) =>
						MeteorCall.userAction.take(e, ts, playlistId, playlist?.currentPartInfo?.partInstanceId ?? null)
					)
				}}
			>
				{t('Take')}
			</Button>
		</div>
	)
}
