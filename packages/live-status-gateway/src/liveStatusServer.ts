import { Logger } from 'winston'
import { CoreHandler } from './coreHandler'
import { WebSocket, WebSocketServer } from 'ws'
import { StudioHandler } from './collections/studioHandler'
import { ShowStyleBaseHandler } from './collections/showStyleBaseHandler'
import { PlaylistHandler } from './collections/playlistHandler'
import { RundownHandler } from './collections/rundownHandler'
// import { RundownsHandler } from './collections/rundownsHandler'
import { SegmentHandler } from './collections/segmentHandler'
// import { PartHandler } from './collections/part'
import { PartInstancesHandler } from './collections/partInstancesHandler'
import { AdLibActionsHandler } from './collections/adLibActionsHandler'
import { GlobalAdLibActionsHandler } from './collections/globalAdLibActionsHandler'
import { RootChannel, StatusChannels } from './topics/root'
import { StudioTopic } from './topics/studioTopic'
import { ActivePlaylistTopic } from './topics/activePlaylistTopic'
import { AdLibsHandler } from './collections/adLibsHandler'
import { GlobalAdLibsHandler } from './collections/globalAdLibsHandler'
import { SegmentsTopic } from './topics/segmentsTopic'
import { SegmentsHandler } from './collections/segmentsHandler'
import { PartHandler } from './collections/partHandler'
import { PartsHandler } from './collections/partsHandler'
import { PieceInstancesHandler } from './collections/pieceInstancesHandler'
import { AdLibsTopic } from './topics/adLibsTopic'
import { ActivePiecesTopic } from './topics/activePiecesTopic'

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

		const studioTopic = new StudioTopic(this._logger)
		const activePiecesTopic = new ActivePiecesTopic(this._logger)
		const activePlaylistTopic = new ActivePlaylistTopic(this._logger)
		const segmentsTopic = new SegmentsTopic(this._logger)
		const adLibsTopic = new AdLibsTopic(this._logger)

		rootChannel.addTopic(StatusChannels.studio, studioTopic)
		rootChannel.addTopic(StatusChannels.activePlaylist, activePlaylistTopic)
		rootChannel.addTopic(StatusChannels.activePieces, activePiecesTopic)
		rootChannel.addTopic(StatusChannels.segments, segmentsTopic)
		rootChannel.addTopic(StatusChannels.adLibs, adLibsTopic)

		const studioHandler = new StudioHandler(this._logger, this._coreHandler)
		await studioHandler.init()
		const showStyleBaseHandler = new ShowStyleBaseHandler(this._logger, this._coreHandler)
		await showStyleBaseHandler.init()
		const playlistHandler = new PlaylistHandler(this._logger, this._coreHandler)
		await playlistHandler.init()
		// const rundownsHandler = new RundownsHandler(this._logger, this._coreHandler)
		// await rundownsHandler.init()
		const rundownHandler = new RundownHandler(this._logger, this._coreHandler)
		await rundownHandler.init()
		const segmentsHandler = new SegmentsHandler(this._logger, this._coreHandler)
		await segmentsHandler.init()
		const segmentHandler = new SegmentHandler(this._logger, this._coreHandler, segmentsHandler)
		await segmentHandler.init()
		const partsHandler = new PartsHandler(this._logger, this._coreHandler)
		await partsHandler.init()
		const partHandler = new PartHandler(this._logger, this._coreHandler, partsHandler)
		await partHandler.init()
		const partInstancesHandler = new PartInstancesHandler(this._logger, this._coreHandler)
		await partInstancesHandler.init()
		const pieceInstancesHandler = new PieceInstancesHandler(this._logger, this._coreHandler)
		await pieceInstancesHandler.init()
		const adLibActionsHandler = new AdLibActionsHandler(this._logger, this._coreHandler)
		await adLibActionsHandler.init()
		const adLibsHandler = new AdLibsHandler(this._logger, this._coreHandler)
		await adLibsHandler.init()
		const globalAdLibActionsHandler = new GlobalAdLibActionsHandler(this._logger, this._coreHandler)
		await globalAdLibActionsHandler.init()
		const globalAdLibsHandler = new GlobalAdLibsHandler(this._logger, this._coreHandler)
		await globalAdLibsHandler.init()

		// add observers for collection subscription updates
		await playlistHandler.subscribe(rundownHandler)
		await playlistHandler.subscribe(segmentHandler)
		await playlistHandler.subscribe(partHandler)
		await playlistHandler.subscribe(partInstancesHandler)
		await playlistHandler.subscribe(pieceInstancesHandler)
		await rundownHandler.subscribe(showStyleBaseHandler)
		await partInstancesHandler.subscribe(rundownHandler)
		await partInstancesHandler.subscribe(segmentHandler)
		// partInstancesHandler.subscribe(partHandler)
		await partInstancesHandler.subscribe(adLibActionsHandler)
		await partInstancesHandler.subscribe(globalAdLibActionsHandler)
		await partInstancesHandler.subscribe(adLibsHandler)
		await partInstancesHandler.subscribe(globalAdLibsHandler)
		await showStyleBaseHandler.subscribe(pieceInstancesHandler)
		await partInstancesHandler.subscribe(pieceInstancesHandler)

		// add observers for websocket topic updates
		await studioHandler.subscribe(studioTopic)
		await playlistHandler.playlistsHandler.subscribe(studioTopic)

		await playlistHandler.subscribe(activePlaylistTopic)
		await showStyleBaseHandler.subscribe(activePlaylistTopic)
		await partInstancesHandler.subscribe(activePlaylistTopic)
		await partsHandler.subscribe(activePlaylistTopic)
		await pieceInstancesHandler.subscribe(activePlaylistTopic)
		await segmentHandler.subscribe(activePlaylistTopic)
		await segmentsHandler.subscribe(activePlaylistTopic)

		await playlistHandler.subscribe(activePiecesTopic)
		await showStyleBaseHandler.subscribe(activePiecesTopic)
		await pieceInstancesHandler.subscribe(activePiecesTopic)

		await playlistHandler.subscribe(segmentsTopic)
		await segmentsHandler.subscribe(segmentsTopic)
		await partsHandler.subscribe(segmentsTopic)

		await showStyleBaseHandler.subscribe(adLibsTopic)
		await partsHandler.subscribe(adLibsTopic)
		await segmentsHandler.subscribe(adLibsTopic)
		await playlistHandler.subscribe(adLibsTopic)
		await adLibActionsHandler.subscribe(adLibsTopic)
		await adLibsHandler.subscribe(adLibsTopic)
		await globalAdLibActionsHandler.subscribe(adLibsTopic)
		await globalAdLibsHandler.subscribe(adLibsTopic)

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
