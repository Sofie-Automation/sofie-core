import { PackageContainerOnPackage, Accessor, AccessorOnPackage } from '@sofie-automation/blueprints-integration'
import { getContentVersionHash, getExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { PeripheralDeviceId, ExpectedPackageId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	PackageManagerExpectedPackage,
	PackageManagerExpectedPackageBase,
	PackageManagerExpectedPackageId,
} from '@sofie-automation/shared-lib/dist/package-manager/publications'
import deepExtend from 'deep-extend'
import { ReadonlyDeep } from 'type-fest'
import _ from 'underscore'
import { getSideEffect } from '@sofie-automation/meteor-lib/dist/collections/ExpectedPackages'
import { DBStudio, StudioLight, StudioPackageContainer } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { clone, omit } from '../../../lib/tempLib'
import { CustomPublishCollection } from '../../../lib/customPublication'
import { logger } from '../../../logging'
import { ExpectedPackagesContentCache } from './contentCache'
import type { StudioFields } from './publication'

/**
 * Regenerate the output for the provided ExpectedPackage `regenerateIds`, updating the data in `collection` as needed
 * @param contentCache Cache of the database documents used
 * @param studio Minimal studio document
 * @param layerNameToDeviceIds Lookup table of package layers, to PeripheralDeviceIds the layer could be used with
 * @param collection Output collection of the publication
 * @param filterPlayoutDeviceIds PeripheralDeviceId filter applied to this publication
 * @param regenerateIds Ids of ExpectedPackage documents to be recalculated
 */
export async function updateCollectionForExpectedPackageIds(
	contentCache: ReadonlyDeep<ExpectedPackagesContentCache>,
	studio: Pick<DBStudio, StudioFields>,
	layerNameToDeviceIds: Map<string, PeripheralDeviceId[]>,
	packageContainers: Record<string, StudioPackageContainer>,
	collection: CustomPublishCollection<PackageManagerExpectedPackage>,
	filterPlayoutDeviceIds: ReadonlyDeep<PeripheralDeviceId[]> | undefined,
	regenerateIds: Set<ExpectedPackageId>
): Promise<void> {
	const updatedDocIds = new Set<PackageManagerExpectedPackageId>()
	const missingExpectedPackageIds = new Set<ExpectedPackageId>()

	for (const packageId of regenerateIds) {
		const packageDoc = contentCache.ExpectedPackages.findOne(packageId)
		if (!packageDoc) {
			missingExpectedPackageIds.add(packageId)
			continue
		}

		// Map the expectedPackages onto their specified layer:
		const allDeviceIds = new Set<PeripheralDeviceId>()
		for (const layerName of packageDoc.layers) {
			const layerDeviceIds = layerNameToDeviceIds.get(layerName)
			for (const deviceId of layerDeviceIds || []) {
				allDeviceIds.add(deviceId)
			}
		}

		for (const deviceId of allDeviceIds) {
			// Filter, keep only the routed mappings for this device:
			if (filterPlayoutDeviceIds && !filterPlayoutDeviceIds.includes(deviceId)) continue

			const routedPackage = generateExpectedPackageForDevice(
				studio,
				{
					...packageDoc,
					_id: unprotectString(packageDoc._id),
				},
				deviceId,
				null,
				Priorities.OTHER, // low priority
				packageContainers
			)

			updatedDocIds.add(routedPackage._id)
			collection.replace(routedPackage)
		}
	}

	// Remove all documents for an ExpectedPackage that was regenerated, and no update was issues
	collection.remove((doc) => {
		if (doc.pieceInstanceId) return false

		if (missingExpectedPackageIds.has(protectString(doc.expectedPackage._id))) return true

		if (updatedDocIds.has(doc._id) && !regenerateIds.has(protectString(doc.expectedPackage._id))) return true

		return false
	})
}

/**
 * Regenerate the output for the provided PieceInstance `regenerateIds`, updating the data in `collection` as needed
 * @param contentCache Cache of the database documents used
 * @param studio Minimal studio document
 * @param layerNameToDeviceIds Lookup table of package layers, to PeripheralDeviceIds the layer could be used with
 * @param collection Output collection of the publication
 * @param filterPlayoutDeviceIds PeripheralDeviceId filter applied to this publication
 * @param regenerateIds Ids of PieceInstance documents to be recalculated
 */
export async function updateCollectionForPieceInstanceIds(
	contentCache: ReadonlyDeep<ExpectedPackagesContentCache>,
	studio: Pick<DBStudio, StudioFields>,
	layerNameToDeviceIds: Map<string, PeripheralDeviceId[]>,
	packageContainers: Record<string, StudioPackageContainer>,
	collection: CustomPublishCollection<PackageManagerExpectedPackage>,
	filterPlayoutDeviceIds: ReadonlyDeep<PeripheralDeviceId[]> | undefined,
	regenerateIds: Set<PieceInstanceId>
): Promise<void> {
	const updatedDocIds = new Set<PackageManagerExpectedPackageId>()
	const missingPieceInstanceIds = new Set<PieceInstanceId>()

	for (const pieceInstanceId of regenerateIds) {
		const pieceInstanceDoc = contentCache.PieceInstances.findOne(pieceInstanceId)
		if (!pieceInstanceDoc) {
			missingPieceInstanceIds.add(pieceInstanceId)
			continue
		}
		if (!pieceInstanceDoc.piece?.expectedPackages) continue

		pieceInstanceDoc.piece.expectedPackages.forEach((expectedPackage, i) => {
			const sanitisedPackageId = getExpectedPackageId(pieceInstanceId, expectedPackage._id || '__unnamed' + i)

			// Map the expectedPackages onto their specified layer:
			const allDeviceIds = new Set<PeripheralDeviceId>()
			for (const layerName of expectedPackage.layers) {
				const layerDeviceIds = layerNameToDeviceIds.get(layerName)
				for (const deviceId of layerDeviceIds || []) {
					allDeviceIds.add(deviceId)
				}
			}

			for (const deviceId of allDeviceIds) {
				// Filter, keep only the routed mappings for this device:
				if (filterPlayoutDeviceIds && !filterPlayoutDeviceIds.includes(deviceId)) continue

				const routedPackage = generateExpectedPackageForDevice(
					studio,
					{
						...expectedPackage,
						_id: unprotectString(sanitisedPackageId),
						rundownId: pieceInstanceDoc.rundownId,
						contentVersionHash: getContentVersionHash(expectedPackage),
					},
					deviceId,
					pieceInstanceId,
					Priorities.OTHER, // low priority
					packageContainers
				)

				updatedDocIds.add(routedPackage._id)
				collection.replace(routedPackage)
			}
		})
	}

	// Remove all documents for an ExpectedPackage that was regenerated, and no update was issues
	collection.remove((doc) => {
		if (!doc.pieceInstanceId) return false

		if (missingPieceInstanceIds.has(doc.pieceInstanceId)) return true

		if (updatedDocIds.has(doc._id) && !regenerateIds.has(doc.pieceInstanceId)) return true

		return false
	})
}

enum Priorities {
	// Lower priorities are done first

	/** Highest priority */
	PLAYOUT_CURRENT = 0,
	/** Second-to-highest priority */
	PLAYOUT_NEXT = 1,
	OTHER = 9,
}

function generateExpectedPackageForDevice(
	studio: Pick<
		StudioLight,
		'_id' | 'packageContainersWithOverrides' | 'previewContainerIds' | 'thumbnailContainerIds'
	>,
	expectedPackage: PackageManagerExpectedPackageBase,
	deviceId: PeripheralDeviceId,
	pieceInstanceId: PieceInstanceId | null,
	priority: Priorities,
	packageContainers: Record<string, StudioPackageContainer>
): PackageManagerExpectedPackage {
	// Lookup Package sources:
	const combinedSources: PackageContainerOnPackage[] = []

	for (const packageSource of expectedPackage.sources) {
		const lookedUpSource = packageContainers[packageSource.containerId]
		if (lookedUpSource) {
			combinedSources.push(calculateCombinedSource(packageSource, lookedUpSource))
		} else {
			// This can happen if the blueprints reference a Package Container that is for another studio.
			// checkPieceContentStatus will formulate a proper status for this situation

			// Add a placeholder source, it's used to provide users with a hint of what's wrong
			combinedSources.push({
				containerId: packageSource.containerId,
				accessors: {},
				label: `PackageContainer missing in config: ${packageSource.containerId}`,
			})
		}
	}

	// Lookup Package targets:
	const combinedTargets = calculateCombinedTargets(expectedPackage, deviceId, packageContainers)

	if (!combinedSources.length && expectedPackage.sources.length !== 0) {
		logger.warn(`Pub.expectedPackagesForDevice: No sources found for "${expectedPackage._id}"`)
	}
	if (!combinedTargets.length) {
		logger.warn(`Pub.expectedPackagesForDevice: No targets found for "${expectedPackage._id}"`)
	}
	expectedPackage.sideEffect = getSideEffect(expectedPackage, studio)

	return {
		_id: protectString(`${expectedPackage._id}_${deviceId}_${pieceInstanceId}`),
		expectedPackage: expectedPackage,
		sources: combinedSources,
		targets: combinedTargets,
		priority: priority,
		playoutDeviceId: deviceId,
		pieceInstanceId,
	}
}

function calculateCombinedSource(
	packageSource: PackageManagerExpectedPackageBase['sources'][0],
	lookedUpSource: StudioPackageContainer
) {
	// We're going to combine the accessor attributes set on the Package with the ones defined on the source
	const combinedSource: PackageContainerOnPackage = {
		...omit(clone(lookedUpSource.container), 'accessors'),
		accessors: {},
		containerId: packageSource.containerId,
	}

	/** Array of both the accessors of the expected package and the source */
	const accessorIds = _.uniq(
		Object.keys(lookedUpSource.container.accessors).concat(Object.keys(packageSource.accessors || {}))
	)

	for (const accessorId of accessorIds) {
		const sourceAccessor: Accessor.Any | undefined = lookedUpSource.container.accessors[accessorId]

		const packageAccessor: AccessorOnPackage.Any | undefined = packageSource.accessors?.[accessorId]

		if (packageAccessor && sourceAccessor && packageAccessor.type === sourceAccessor.type) {
			combinedSource.accessors[accessorId] = deepExtend({}, sourceAccessor, packageAccessor)
		} else if (packageAccessor) {
			combinedSource.accessors[accessorId] = clone<AccessorOnPackage.Any>(packageAccessor)
		} else if (sourceAccessor) {
			combinedSource.accessors[accessorId] = clone<Accessor.Any>(sourceAccessor) as AccessorOnPackage.Any
		}
	}

	return combinedSource
}
function calculateCombinedTargets(
	expectedPackage: PackageManagerExpectedPackageBase,
	deviceId: PeripheralDeviceId,
	packageContainers: Record<string, StudioPackageContainer>
): PackageContainerOnPackage[] {
	const mappingDeviceId = unprotectString(deviceId)

	let packageContainerId: string | undefined
	for (const [containerId, packageContainer] of Object.entries<StudioPackageContainer>(packageContainers)) {
		if (packageContainer.deviceIds.includes(mappingDeviceId)) {
			// TODO: how to handle if a device has multiple containers?
			packageContainerId = containerId
			break // just picking the first one found, for now
		}
	}

	const combinedTargets: PackageContainerOnPackage[] = []
	if (packageContainerId) {
		const lookedUpTarget = packageContainers[packageContainerId]
		if (lookedUpTarget) {
			// Todo: should the be any combination of properties here?
			combinedTargets.push({
				...omit(clone(lookedUpTarget.container), 'accessors'),
				accessors:
					(lookedUpTarget.container.accessors as {
						[accessorId: string]: AccessorOnPackage.Any
					}) || {},
				containerId: packageContainerId,
			})
		}
	} else {
		logger.warn(
			`Pub.expectedPackagesForDevice: No package container found for "${mappingDeviceId}" from one of (${JSON.stringify(
				expectedPackage.layers
			)})`
		)
		// Add a placeholder target, it's used to provide users with a hint of what's wrong
		combinedTargets.push({
			containerId: '__placeholder-target',
			accessors: {},
			label: `No target found for Device "${mappingDeviceId}"`,
		})
	}

	return combinedTargets
}
