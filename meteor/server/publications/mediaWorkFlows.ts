import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { MediaWorkFlowsSecurity, MediaWorkFlowStepsSecurity } from '../security/mediaWorkFlows'
import { MediaWorkFlows } from '../../lib/collections/MediaWorkFlows'
import { MediaWorkFlowSteps } from '../../lib/collections/MediaWorkFlowSteps'
import { check } from '../../lib/lib'

meteorPublish(PubSub.mediaWorkFlowSteps, (selector, token) => {
	selector = selector || {}
	check(selector, Object)

	if (MediaWorkFlowStepsSecurity.allowReadAccess(selector, token, this)) {
		// TODO: require deviceId
		return MediaWorkFlowSteps.find(selector)
	}
	return null
})

meteorPublish(PubSub.mediaWorkFlows, (selector, token) => {
	selector = selector || {}
	check(selector, Object)

	if (MediaWorkFlowsSecurity.allowReadAccess(selector, token, this)) {
		// TODO: require deviceId
		return MediaWorkFlows.find(selector)
	}
	return null
})
