import { useContext } from 'react'
import { useSubscription, useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData.js'
import { Rundown as RundownObj } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { Segments } from '../../../collections/index.js'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { Segment as SegmentComponent } from './Segment.js'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { UIShowStyleBases } from '../../Collections.js'
import { RundownToShowStyleContext, StudioContext } from './index.js'
import { RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface IProps {
	playlist: DBRundownPlaylist
	rundown: RundownObj
	rundownIdsBefore: RundownId[]
}

export function Rundown({ playlist, rundown, rundownIdsBefore }: Readonly<IProps>): JSX.Element | null {
	const rundownId = rundown._id

	useSubscription(MeteorPubSub.uiShowStyleBase, rundown.showStyleBaseId)

	const segments = useTracker(() => Segments.find({ rundownId }).fetch(), [rundownId], [] as DBSegment[])

	const showStyleBase = useTracker(
		() => UIShowStyleBases.findOne(rundown.showStyleBaseId),
		[rundown.showStyleBaseId],
		undefined
	)

	const studio = useContext(StudioContext)

	if (!showStyleBase || !studio) return null

	const segmentsIdsBefore: Set<SegmentId> = new Set()

	return (
		<div className="camera-screen__rundown">
			{segments.map((segment, index) => (
				<RundownToShowStyleContext.Consumer key={unprotectString(segment._id)}>
					{(rundownToShowStyle) => {
						const thisSegmentsSegmentIdsBefore = new Set(segmentsIdsBefore)
						segmentsIdsBefore.add(segment._id)

						return (
							<SegmentComponent
								index={index}
								rundown={rundown}
								rundownId={rundownId}
								playlist={playlist}
								segmentId={segment._id}
								showStyleBase={showStyleBase}
								studio={studio}
								timeScale={1}
								studioMode={false}
								countdownToSegmentRequireLayers={undefined}
								fixedSegmentDuration={false}
								followLiveSegments={true}
								isFollowingOnAirSegment={true}
								isLastSegment={false} // TODO: fix
								miniShelfFilter={undefined}
								ownCurrentPartInstance={undefined}
								ownNextPartInstance={undefined}
								rundownViewLayout={undefined}
								rundownsToShowstyles={rundownToShowStyle}
								rundownIdsBefore={rundownIdsBefore}
								segmentsIdsBefore={thisSegmentsSegmentIdsBefore}
							/>
						)
					}}
				</RundownToShowStyleContext.Consumer>
			))}
		</div>
	)
}
