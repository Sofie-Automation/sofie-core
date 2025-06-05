import { ResultingMappingRoutes } from '@sofie-automation/corelib/dist/dataModel/Studio'

import { TimelineObjGeneric, updateLookaheadLayer } from '@sofie-automation/corelib/dist/dataModel/Timeline'

export function getRoutedTimeline(
	inputTimelineObjs: TimelineObjGeneric[],
	mappingRoutes: ResultingMappingRoutes
): TimelineObjGeneric[] {
	const outputTimelineObjs: TimelineObjGeneric[] = []

	for (const obj of inputTimelineObjs) {
		let inputLayer = obj.layer + ''
		if (obj.isLookahead && obj.lookaheadForLayer) {
			// For lookahead objects, .layer doesn't point to any real layer
			inputLayer = obj.lookaheadForLayer + ''
		}
		const routes = mappingRoutes.existing[inputLayer]
		if (routes) {
			for (let i = 0; i < routes.length; i++) {
				const route = routes[i]
				const routedObj: TimelineObjGeneric = {
					...obj,
					layer: route.outputMappedLayer,
				}
				if (routedObj.isLookahead && routedObj.lookaheadForLayer) {
					// Update lookaheadForLayer to reference the original routed layer:
					updateLookaheadLayer(routedObj)
				}
				if (i > 0) {
					// If there are multiple routes we must rename the ids, so that they stay unique.
					routedObj.id = `_${i}_${routedObj.id}`

					if (routedObj.keyframes) {
						routedObj.keyframes = routedObj.keyframes.map((keyframe) => ({
							...keyframe,
							id: `_${i}_${keyframe.id}`,
						}))
					}
				}
				outputTimelineObjs.push(routedObj)
			}
		} else {
			// If no route is found at all, pass it through (backwards compatibility)
			outputTimelineObjs.push(obj)
		}
	}
	return outputTimelineObjs
}
