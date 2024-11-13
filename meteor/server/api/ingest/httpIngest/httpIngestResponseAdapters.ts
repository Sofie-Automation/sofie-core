import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { PartResponse, PlaylistResponse, RundownResponse, SegmentResponse } from './httpIngestTypes'

export const adaptPlaylist = (rawPlaylist: DBRundownPlaylist): PlaylistResponse => {
	return {
		id: unprotectString(rawPlaylist._id),
		externalId: rawPlaylist.externalId,
		rundownIds: rawPlaylist.rundownIdsInOrder.map((id) => unprotectString(id)),
		studioId: unprotectString(rawPlaylist.studioId),
	}
}

export const adaptRundown = (rawRundown: Rundown): RundownResponse => {
	return {
		id: unprotectString(rawRundown._id),
		externalId: rawRundown.externalId,
		playlistId: unprotectString(rawRundown.playlistId),
		playlistExternalId: rawRundown.playlistExternalId,
		studioId: unprotectString(rawRundown.studioId),
		name: rawRundown.name,
	}
}

export const adaptSegment = (rawSegment: DBSegment): SegmentResponse => {
	return {
		id: unprotectString(rawSegment._id),
		externalId: rawSegment.externalId,
		name: rawSegment.name,
		rank: rawSegment._rank,
		rundownId: unprotectString(rawSegment.rundownId),
		isHidden: rawSegment.isHidden,
	}
}

export const adaptPart = (rawPart: DBPart): PartResponse => {
	return {
		id: unprotectString(rawPart._id),
		externalId: rawPart.externalId,
		title: rawPart.title,
		rank: rawPart._rank,
		rundownId: unprotectString(rawPart.rundownId),
		autoNext: rawPart.autoNext,
		expectedDuration: rawPart.expectedDuration,
		segmentId: unprotectString(rawPart.segmentId),
	}
}
