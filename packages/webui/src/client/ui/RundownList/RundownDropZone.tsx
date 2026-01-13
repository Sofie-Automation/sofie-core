import { useDrop } from 'react-dnd'
import { useTranslation } from 'react-i18next'
import { MeteorCall } from '../../lib/meteorApi.js'
import { doUserAction, UserAction } from '../../lib/clientUserAction.js'
import { IRundownDragObject, RundownListDragDropTypes } from './DragAndDropTypes.js'

export function RundownDropZone(): JSX.Element {
	const { t } = useTranslation()
	const [dropState, connectDropTarget] = useDrop<
		IRundownDragObject,
		void,
		{
			activated: boolean
		}
	>({
		accept: RundownListDragDropTypes.RUNDOWN,
		collect: (monitor) => {
			return {
				activated: !!monitor.getItemType() && !monitor.getItem<IRundownDragObject>()?.isOnlyRundownInPlaylist,
			}
		},
		drop: (item) => {
			const dropped = item
			const rundownId = dropped?.id

			if (rundownId) {
				doUserAction(t, 'drag&drop in dropzone', UserAction.RUNDOWN_ORDER_MOVE, (e, ts) =>
					MeteorCall.userAction.moveRundown(e, ts, rundownId, null, [rundownId])
				)
			}
		},
	})

	return (
		<div className={`rundown-dropzone ${dropState.activated ? 'open' : ''}`} ref={connectDropTarget}>
			<p>
				<b>{t('Drop Rundown here to move it out of its current Playlist')}</b>
			</p>
		</div>
	)
}
