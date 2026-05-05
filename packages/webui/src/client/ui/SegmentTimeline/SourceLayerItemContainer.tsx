import { type ISourceLayerItemProps, SourceLayerItem } from './SourceLayerItem.js'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { useContentStatusForPieceInstance } from './withMediaObjectStatus.js'
import type { UIStudio } from '@sofie-automation/corelib/src/dataModel/Studio.js'

interface IPropsHeader extends Omit<ISourceLayerItemProps, 'contentStatus'> {
	playlist: DBRundownPlaylist
	studio: UIStudio
}

export function SourceLayerItemContainer(props: IPropsHeader): JSX.Element {
	const contentStatus = useContentStatusForPieceInstance(props.piece.instance)

	return <SourceLayerItem {...props} contentStatus={contentStatus} />
}
