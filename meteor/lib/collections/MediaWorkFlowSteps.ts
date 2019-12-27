import { TransformedCollection } from '../typings/meteor';
import { registerCollection } from '../lib';
import { Meteor } from 'meteor/meteor';
import { createMongoCollection } from './lib';

export enum WorkStepStatus {
	IDLE = 'idle',
	WORKING = 'working',
	DONE = 'done',
	ERROR = 'error',
	SKIPPED = 'skipped',
	CANCELED = 'canceled',
	BLOCKED = 'blocked'
}

export abstract class MediaWorkFlowStep {
	_id: string;
	_rev: string;

	/** Which device this workflow originated from */
	deviceId: string;
	studioId: string;

	workFlowId: string;
	action: string;
	status: WorkStepStatus;
	messages?: Array<string>;

	priority: number;
	/** 0-1 */
	progress?: number;
	criticalStep?: boolean;
	/** Calculated time left of this step */
	expectedLeft?: number;
}

export const MediaWorkFlowSteps: TransformedCollection<
	MediaWorkFlowStep,
	MediaWorkFlowStep
> = createMongoCollection<MediaWorkFlowStep>('mediaWorkFlowSteps');
registerCollection('MediaWorkFlowSteps', MediaWorkFlowSteps);
Meteor.startup(() => {
	if (Meteor.isServer) {
		MediaWorkFlowSteps._ensureIndex({
			// TODO: add deviceId: 1,
			mediaWorkFlowId: 1
		});
		MediaWorkFlowSteps._ensureIndex({
			status: 1,
			priority: 1
		});
	}
});
