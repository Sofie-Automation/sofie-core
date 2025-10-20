import { Logger } from 'winston'
import { CoreHandler } from './coreHandler.js'
import { WebSocket, WebSocketServer } from 'ws'
import { StudioHandler } from './collections/studioHandler.js'
import { ShowStyleBaseHandler } from './collections/showStyleBaseHandler.js'
import { PlaylistHandler, PlaylistsHandler } from './collections/playlistHandler.js'
import { RundownHandler } from './collections/rundownHandler.js'
// import { RundownsHandler } from './collections/rundownsHandler.js'
import { SegmentHandler } from './collections/segmentHandler.js'
// import { PartHandler } from './collections/part.js'
import { PartInstancesHandler } from './collections/partInstancesHandler.js'
import { AdLibActionsHandler } from './collections/adLibActionsHandler.js'
import { GlobalAdLibActionsHandler } from './collections/globalAdLibActionsHandler.js'
import { RootChannel } from './topics/root.js'
import { StudioTopic } from './topics/studioTopic.js'
import { ActivePlaylistTopic } from './topics/activePlaylistTopic.js'
import { AdLibsHandler } from './collections/adLibsHandler.js'
import { GlobalAdLibsHandler } from './collections/globalAdLibsHandler.js'
import { SegmentsTopic } from './topics/segmentsTopic.js'
import { SegmentsHandler } from './collections/segmentsHandler.js'
import { PartHandler } from './collections/partHandler.js'
import { PartsHandler } from './collections/partsHandler.js'
import { PieceInstancesHandler } from './collections/pieceInstancesHandler.js'
import { AdLibsTopic } from './topics/adLibsTopic.js'
import { ActivePiecesTopic } from './topics/activePiecesTopic.js'
import { SubscriptionName } from '@sofie-automation/live-status-gateway-api'
import { PieceContentStatusesHandler } from './collections/pieceContentStatusesHandler.js'
import { PackagesTopic } from './topics/packagesTopic.js'
import { BucketsHandler } from './collections/bucketsHandler.js'
import { BucketAdLibsHandler } from './collections/bucketAdLibsHandler.js'
import { BucketAdLibActionsHandler } from './collections/bucketAdLibActionsHandler.js'
import { BucketsTopic } from './topics/bucketsTopic.js'

export interface CollectionHandlers {
	studioHandler: StudioHandler
	showStyleBaseHandler: ShowStyleBaseHandler
	playlistHandler: PlaylistHandler
	playlistsHandler: PlaylistsHandler
	rundownHandler: RundownHandler
	segmentsHandler: SegmentsHandler
	segmentHandler: SegmentHandler
	partsHandler: PartsHandler
	partHandler: PartHandler
	partInstancesHandler: PartInstancesHandler
	pieceInstancesHandler: PieceInstancesHandler
	adLibActionsHandler: AdLibActionsHandler
	adLibsHandler: AdLibsHandler
	globalAdLibActionsHandler: GlobalAdLibActionsHandler
	globalAdLibsHandler: GlobalAdLibsHandler
	pieceContentStatusesHandler: PieceContentStatusesHandler
	bucketsHandler: BucketsHandler
	bucketAdLibsHandler: BucketAdLibsHandler
	bucketAdLibActionsHandler: BucketAdLibActionsHandler
}

export class LiveStatusServer {
	_logger: Logger
	_coreHandler: CoreHandler
	_clients: Set<WebSocket> = new Set()

	constructor(logger: Logger, coreHandler: CoreHandler) {
		this._logger = logger
		this._coreHandler = coreHandler
	}

	async init(): Promise<void> {
		this._logger.info('Initializing WebSocket server...')

		const rootChannel = new RootChannel(this._logger)

		const studioHandler = new StudioHandler(this._logger, this._coreHandler)
		const showStyleBaseHandler = new ShowStyleBaseHandler(this._logger, this._coreHandler)
		const playlistHandler = new PlaylistHandler(this._logger, this._coreHandler)
		const playlistsHandler = playlistHandler.playlistsHandler
		const rundownHandler = new RundownHandler(this._logger, this._coreHandler)
		const segmentsHandler = new SegmentsHandler(this._logger, this._coreHandler)
		const segmentHandler = new SegmentHandler(this._logger, this._coreHandler, segmentsHandler)
		const partsHandler = new PartsHandler(this._logger, this._coreHandler)
		const partHandler = new PartHandler(this._logger, this._coreHandler, partsHandler)
		const partInstancesHandler = new PartInstancesHandler(this._logger, this._coreHandler)
		const pieceInstancesHandler = new PieceInstancesHandler(this._logger, this._coreHandler)
		const adLibActionsHandler = new AdLibActionsHandler(this._logger, this._coreHandler)
		const adLibsHandler = new AdLibsHandler(this._logger, this._coreHandler)
		const globalAdLibActionsHandler = new GlobalAdLibActionsHandler(this._logger, this._coreHandler)
		const globalAdLibsHandler = new GlobalAdLibsHandler(this._logger, this._coreHandler)
		const pieceContentStatusesHandler = new PieceContentStatusesHandler(this._logger, this._coreHandler)
		const bucketsHandler = new BucketsHandler(this._logger, this._coreHandler)
		const bucketAdLibsHandler = new BucketAdLibsHandler(this._logger, this._coreHandler)
		const bucketAdLibActionsHandler = new BucketAdLibActionsHandler(this._logger, this._coreHandler)

		const handlers: CollectionHandlers = {
			studioHandler,
			showStyleBaseHandler,
			playlistHandler,
			playlistsHandler,
			rundownHandler,
			segmentsHandler,
			segmentHandler,
			partsHandler,
			partHandler,
			partInstancesHandler,
			pieceInstancesHandler,
			adLibActionsHandler,
			adLibsHandler,
			globalAdLibActionsHandler,
			globalAdLibsHandler,
			pieceContentStatusesHandler,
			bucketsHandler,
			bucketAdLibsHandler,
			bucketAdLibActionsHandler,
		}

		for (const handlerName in handlers) {
			handlers[handlerName as keyof CollectionHandlers].init(handlers)
		}

		const studioTopic = new StudioTopic(this._logger, handlers)
		const activePiecesTopic = new ActivePiecesTopic(this._logger, handlers)
		const activePlaylistTopic = new ActivePlaylistTopic(this._logger, handlers)
		const segmentsTopic = new SegmentsTopic(this._logger, handlers)
		const adLibsTopic = new AdLibsTopic(this._logger, handlers)
		const packageStatusTopic = new PackagesTopic(this._logger, handlers)
		const bucketsTopic = new BucketsTopic(this._logger, handlers)

		rootChannel.addTopic(SubscriptionName.STUDIO, studioTopic)
		rootChannel.addTopic(SubscriptionName.ACTIVE_PLAYLIST, activePlaylistTopic)
		rootChannel.addTopic(SubscriptionName.ACTIVE_PIECES, activePiecesTopic)
		rootChannel.addTopic(SubscriptionName.SEGMENTS, segmentsTopic)
		rootChannel.addTopic(SubscriptionName.AD_LIBS, adLibsTopic)
		rootChannel.addTopic(SubscriptionName.RESERVED_PACKAGES, packageStatusTopic)
		rootChannel.addTopic(SubscriptionName.BUCKETS, bucketsTopic)

		const wss = new WebSocketServer({ port: 8080 })
		wss.on('connection', (ws, request) => {
			this._logger.info(`WebSocket connection requested for path '${request.url}'`)

			ws.on('close', () => {
				this._logger.info(`Closing websocket`)
				rootChannel.removeSubscriber(ws)
				this._clients.delete(ws)
			})
			this._clients.add(ws)

			if (typeof request.url === 'string' && request.url === '/') {
				rootChannel.addSubscriber(ws)
				ws.on('message', (data) => rootChannel.processMessage(ws, data))
			} else {
				this._logger.error(`WebSocket connection request for unsupported path '${request.url}'`)
			}
		})
		wss.on('close', () => {
			this._logger.info(`WebSocket connection closed`)
			rootChannel.close()
		})
		wss.on('error', (err) => this._logger.error(err.message))

		this._logger.info('WebSocket server initialized')
	}
}
