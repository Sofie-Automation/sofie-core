import { LookaheadMode } from '@sofie-automation/blueprints-integration'
import {
	ResultingMappingRoutes,
	MappingExt,
	StudioRouteType,
	StudioRouteSet,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { omit } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'

export function getActiveRoutes(routeSets: Record<string, StudioRouteSet>): ResultingMappingRoutes {
	const routes: ResultingMappingRoutes = {
		existing: {},
		inserted: [],
	}

	const exclusivityGroups: { [groupId: string]: true } = {}

	for (const routeSet of Object.values<StudioRouteSet>(routeSets)) {
		if (routeSet.active) {
			let useRoute = true
			if (routeSet.exclusivityGroup) {
				// Fail-safe: To really make sure we're not using more than one route in the same exclusivity group:
				if (exclusivityGroups[routeSet.exclusivityGroup]) {
					useRoute = false
				}
				exclusivityGroups[routeSet.exclusivityGroup] = true
			}
			if (useRoute) {
				for (const routeMapping of routeSet.routes || []) {
					if (routeMapping.outputMappedLayer) {
						if (routeMapping.mappedLayer) {
							// Route an existing layer
							if (!routes.existing[routeMapping.mappedLayer]) {
								routes.existing[routeMapping.mappedLayer] = []
							}
							routes.existing[routeMapping.mappedLayer].push(omit(routeMapping, 'mappedLayer'))
						} else {
							// Insert a new routed layer
							routes.inserted.push(omit(routeMapping, 'mappedLayer'))
						}
					}
				}
			}
		}
	}

	return routes
}
export function getRoutedMappings<M extends MappingExt>(
	inputMappings: { [layerName: string]: M },
	mappingRoutes: ResultingMappingRoutes
): { [layerName: string]: M } {
	const outputMappings: { [layerName: string]: M } = {}

	// Re-route existing layers:
	for (const [inputLayer, inputMapping] of Object.entries<M>(inputMappings)) {
		const routes = mappingRoutes.existing[inputLayer]
		if (routes) {
			for (const route of routes) {
				const routedMapping: M =
					route.routeType === StudioRouteType.REMAP &&
					route.deviceType &&
					route.remapping &&
					route.remapping.deviceId
						? ({
								...route.remapping,
								lookahead: route.remapping.lookahead ?? LookaheadMode.NONE,
								device: route.deviceType,
								deviceId: protectString<any>(route.remapping.deviceId),
							} as M)
						: {
								...inputMapping,
								...(route.remapping || {}),
							}
				outputMappings[route.outputMappedLayer] = routedMapping
			}
		} else {
			// If no route is found at all for a mapping, pass the mapping through un-modified for backwards compatibility.
			outputMappings[inputLayer] = inputMapping
		}
	}

	// also insert new routed layers:
	for (const route of mappingRoutes.inserted) {
		if (route.remapping && route.deviceType && route.remapping.deviceId) {
			const routedMapping: MappingExt = {
				lookahead: route.remapping.lookahead || LookaheadMode.NONE,
				device: route.deviceType,
				deviceId: protectString<any>(route.remapping.deviceId),
				options: {},
				...route.remapping,
			}
			outputMappings[route.outputMappedLayer] = routedMapping as M
		}
	}
	return outputMappings
}
