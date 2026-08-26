import { PublicationRegistry } from './publicationRegistry'

import { registerBucketsPublications } from './publications/buckets'
import { registerBlueprintUpgradeStatusPublications } from './publications/blueprintUpgradeStatus/publication'
import { registerIngestStatusPublications } from './publications/ingestStatus/publication'
import { registerExternalEventSubscriptionsPublications } from './publications/externalEventSubscriptions'
import { registerExpectedPackagesPublications } from './publications/packageManager/expectedPackages/publication'
import { registerPackageContainersPublications } from './publications/packageManager/packageContainers'
import { registerPlayoutContextPublications } from './publications/packageManager/playoutContext'
import { registerBucketContentStatusUIPublications } from './publications/pieceContentStatusUI/bucket/publication'
import { registerRundownContentStatusUIPublications } from './publications/pieceContentStatusUI/rundown/publication'
import { registerOrganizationPublications } from './publications/organization'
import { registerPartsUIPublications } from './publications/partsUI/publication'
import { registerPartInstancesUIPublications } from './publications/partInstancesUI/publication'
import { registerPieceInstancesUIPublications } from './publications/pieceInstancesUI/publication'
import { registerPiecesUIPublications } from './publications/piecesUI/publication'
import { registerPeripheralDevicePublications } from './publications/peripheralDevice'
import { registerPeripheralDeviceForDevicePublications } from './publications/peripheralDeviceForDevice'
import { registerRundownPublications } from './publications/rundown'
import { registerRundownPlaylistPublications } from './publications/rundownPlaylist'
import { registerSegmentPartNotesUIPublications } from './publications/segmentPartNotesUI/publication'
import { registerShowStylePublications } from './publications/showStyle'
import { registerShowStyleUIPublications } from './publications/showStyleUI'
import { registerStudioPublications } from './publications/studio'
import { registerStudioUIPublications } from './publications/studioUI'
import { registerSystemPublications } from './publications/system'
import { registerTimelinePublications } from './publications/timeline'
import { registerTranslationsBundlesPublications } from './publications/translationsBundles'
import { registerTriggeredActionsUIPublications } from './publications/triggeredActionsUI'
import { registerMountedTriggersPublications } from './publications/mountedTriggers'
import { registerDeviceTriggersPreviewPublications } from './publications/deviceTriggersPreview'

/** Register every DDP publication on the given registry. */
export function registerAllPublications(registry: PublicationRegistry): void {
	registerBucketsPublications(registry)
	registerBlueprintUpgradeStatusPublications(registry)
	registerIngestStatusPublications(registry)
	registerExternalEventSubscriptionsPublications(registry)
	registerExpectedPackagesPublications(registry)
	registerPackageContainersPublications(registry)
	registerPlayoutContextPublications(registry)
	registerBucketContentStatusUIPublications(registry)
	registerRundownContentStatusUIPublications(registry)
	registerOrganizationPublications(registry)
	registerPartsUIPublications(registry)
	registerPartInstancesUIPublications(registry)
	registerPieceInstancesUIPublications(registry)
	registerPiecesUIPublications(registry)
	registerPeripheralDevicePublications(registry)
	registerPeripheralDeviceForDevicePublications(registry)
	registerRundownPublications(registry)
	registerRundownPlaylistPublications(registry)
	registerSegmentPartNotesUIPublications(registry)
	registerShowStylePublications(registry)
	registerShowStyleUIPublications(registry)
	registerStudioPublications(registry)
	registerStudioUIPublications(registry)
	registerSystemPublications(registry)
	registerTimelinePublications(registry)
	registerTranslationsBundlesPublications(registry)
	registerTriggeredActionsUIPublications(registry)
	registerMountedTriggersPublications(registry)
	registerDeviceTriggersPreviewPublications(registry)
}
