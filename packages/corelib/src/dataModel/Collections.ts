/** List of the mongo collection names */
export enum CollectionName {
	AdLibActions = 'adLibActions',
	AdLibPieces = 'adLibPieces',
	Blueprints = 'blueprints',
	BucketAdLibActions = 'bucketAdlibActions',
	BucketAdLibPieces = 'bucketAdlibs',
	Buckets = 'buckets',
	CoreSystem = 'coreSystem',
	Evaluations = 'evaluations',
	ExpectedPackages = 'expectedPackages',
	ExpectedPackageWorkStatuses = 'expectedPackageWorkStatuses',
	ExpectedPlayoutItems = 'expectedPlayoutItems',
	ExternalMessageQueue = 'externalMessageQueue',
	NrcsIngestDataCache = 'ingestDataCache', // Future: this could be renamed to nrcsIngestDataCache
	SofieIngestDataCache = 'sofieIngestDataCache',
	MediaObjects = 'mediaObjects',
	Notifications = 'notifications',
	PartInstances = 'partInstances',
	PackageInfos = 'packageInfos',
	PackageContainerPackageStatuses = 'packageContainerPackageStatuses',
	PackageContainerStatuses = 'packageContainerStatuses',
	Parts = 'parts',
	PeripheralDeviceCommands = 'peripheralDeviceCommands',
	PeripheralDevices = 'peripheralDevices',
	PieceInstances = 'pieceInstances',
	Pieces = 'pieces',
	RundownBaselineAdLibActions = 'rundownBaselineAdLibActions',
	RundownBaselineAdLibPieces = 'rundownBaselineAdLibPieces',
	RundownBaselineObjects = 'rundownBaselineObjs',
	RundownLayouts = 'rundownLayouts',
	RundownPlaylists = 'rundownPlaylists',
	Rundowns = 'rundowns',
	Segments = 'segments',
	ShowStyleBases = 'showStyleBases',
	ShowStyleVariants = 'showStyleVariants',
	Snapshots = 'snapshots',
	Studios = 'studios',
	Timelines = 'timeline',
	TimelineDatastore = 'timelineDatastore',
	TriggeredActions = 'triggeredActions',
	TranslationsBundles = 'translationsBundles',
	UserActionsLog = 'userActionsLog',
	Workers = 'workers',
	WorkerThreads = 'workersThreads',
}

/**
 * Ids of possible Custom collections, populated by DDP subscriptions
 */
export enum CustomCollectionName {
	UIPieceContentStatuses = 'uiPieceContentStatuses',
}
