import { MediaWorkFlowId, MediaWorkFlowStepId } from '../core/model/Ids.js'

export interface MediaObjectRevision {
	id: string
	rev: string
}
export interface MediaWorkFlowRevision {
	_id: MediaWorkFlowId
	_rev: string
}
export interface MediaWorkFlowStepRevision {
	_id: MediaWorkFlowStepId
	_rev: string
}

// Note: These are just the enums from media-manager that core needs to be aware of

export enum WorkStepStatus {
	IDLE = 'idle',
	WORKING = 'working',
	DONE = 'done',
	ERROR = 'error',
	CANCELED = 'canceled',
	SKIPPED = 'skipped',
	BLOCKED = 'blocked',
}

export enum WorkStepAction {
	COPY = 'copy',
	DELETE = 'delete',
	SCAN = 'scan',
	GENERATE_PREVIEW = 'generate_preview',
	GENERATE_THUMBNAIL = 'generate_thumbnail',
	GENERATE_METADATA = 'generate_metadata',
}
