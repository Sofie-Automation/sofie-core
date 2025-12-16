import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MappingExt, MappingsExt, StudioRouteSet } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ReadonlyDeep } from 'type-fest'
import { getActiveRoutes, getRoutedMappings } from '@sofie-automation/meteor-lib/dist/collections/Studios'

type MappingExtWithOriginalName = MappingExt & { originalLayerName: string }
type MappingsExtWithOriginalName = {
	[layerName: string]: ReadonlyDeep<MappingExtWithOriginalName>
}
export function buildMappingsToDeviceIdMap(
	routeSets: Record<string, StudioRouteSet>,
	studioMappings: ReadonlyDeep<MappingsExt>
): Map<string, PeripheralDeviceId[]> {
	// Map the expectedPackages onto their specified layer:
	const mappingsWithPackages: MappingsExtWithOriginalName = {}
	for (const [layerName, mapping] of Object.entries<ReadonlyDeep<MappingExt>>(studioMappings)) {
		mappingsWithPackages[layerName] = {
			...mapping,
			originalLayerName: layerName,
		}
	}

	// Route the mappings
	const routes = getActiveRoutes(routeSets)
	const routedMappings = getRoutedMappings(mappingsWithPackages, routes)

	// Compile the result
	const result = new Map<string, PeripheralDeviceId[]>()
	for (const item of Object.values<ReadonlyDeep<MappingExtWithOriginalName>>(routedMappings)) {
		const key = item.originalLayerName
		const existing = result.get(key)
		if (existing) {
			existing.push(item.deviceId)
		} else {
			result.set(key, [item.deviceId])
		}
	}

	return result
}
