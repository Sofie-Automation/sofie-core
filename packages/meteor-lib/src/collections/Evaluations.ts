import { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import {
	EvaluationId,
	StudioId,
	RundownPlaylistId,
	SnapshotId,
	OrganizationId,
	UserId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'

export interface Evaluation extends EvaluationBase {
	_id: EvaluationId
	organizationId: OrganizationId | null
	userId: UserId | null
	timestamp: Time
}
export interface EvaluationBase {
	studioId: StudioId
	playlistId: RundownPlaylistId
	answers: {
		[key: string]: string
	}
	snapshots?: Array<SnapshotId>
}
