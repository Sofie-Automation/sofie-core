import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { WebSocketTopicBase, WebSocketTopic } from '../wsHandler.js'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { IBlueprintActionManifestDisplayContent, JSONBlob } from '@sofie-automation/blueprints-integration'
import { ShowStyleBaseExt } from '../collections/showStyleBaseHandler.js'
import { interpollateTranslation } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { WithSortingMetadata, getRank, sortContent } from './helpers/contentSorting.js'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { AdLibsEvent, AdLibActionType, AdLibStatus, GlobalAdLibStatus } from '@sofie-automation/live-status-gateway-api'
import { CollectionHandlers } from '../liveStatusServer.js'
import { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'

const THROTTLE_PERIOD_MS = 100

const PLAYLIST_KEYS = ['_id', 'rundownIdsInOrder', 'activationId'] as const
type Playlist = PickKeys<DBRundownPlaylist, typeof PLAYLIST_KEYS>

const SHOW_STYLE_BASE_KEYS = ['sourceLayerNamesById', 'outputLayerNamesById'] as const
type ShowStyle = PickKeys<ShowStyleBaseExt, typeof SHOW_STYLE_BASE_KEYS>

export class AdLibsTopic extends WebSocketTopicBase implements WebSocketTopic {
	private _activePlaylist: Playlist | undefined
	private _sourceLayersMap: ReadonlyMap<string, string> = new Map()
	private _outputLayersMap: ReadonlyMap<string, string> = new Map()
	private _adLibActions: AdLibAction[] | undefined
	private _adLibs: AdLibPiece[] | undefined
	private _parts: ReadonlyMap<PartId, DBPart> = new Map()
	private _segments: ReadonlyMap<SegmentId, DBSegment> = new Map()
	private _globalAdLibActions: RundownBaselineAdLibAction[] | undefined
	private _globalAdLibs: RundownBaselineAdLibItem[] | undefined

	constructor(logger: Logger, handlers: CollectionHandlers) {
		super(AdLibsTopic.name, logger, THROTTLE_PERIOD_MS)

		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
		handlers.showStyleBaseHandler.subscribe(this.onShowStyleBaseUpdate, SHOW_STYLE_BASE_KEYS)
		handlers.adLibActionsHandler.subscribe(this.onAdLibActionsUpdate)
		handlers.adLibsHandler.subscribe(this.onAdLibsUpdate)
		handlers.globalAdLibActionsHandler.subscribe(this.onGlobalAdLibActionsUpdate)
		handlers.globalAdLibsHandler.subscribe(this.onGlobalAdLibsUpdate)
		handlers.segmentsHandler.subscribe(this.onSegmentsUpdate)
		handlers.partsHandler.subscribe(this.onPartsUpdate)
	}

	sendStatus(subscribers: Iterable<WebSocket>): void {
		const adLibs: WithSortingMetadata<AdLibStatus>[] = []
		const globalAdLibs: WithSortingMetadata<GlobalAdLibStatus>[] = []

		if (this._adLibActions) {
			adLibs.push(
				...this._adLibActions.map((action) => {
					const sourceLayerName = this._sourceLayersMap.get(
						(action.display as IBlueprintActionManifestDisplayContent).sourceLayerId
					)
					const outputLayerName = this._outputLayersMap.get(
						(action.display as IBlueprintActionManifestDisplayContent).outputLayerId
					)
					const triggerModes = action.triggerModes
						? action.triggerModes.map((t) =>
								literal<AdLibActionType>({
									name: t.data,
									label: interpollateTranslation(t.display.label.key, t.display.label.args),
								})
							)
						: []
					const segmentId = this._parts.get(action.partId)?.segmentId
					const name = interpollateTranslation(action.display.label.key, action.display.label.args)
					return literal<WithSortingMetadata<AdLibStatus>>({
						obj: {
							id: unprotectString(action._id),
							name,
							partId: unprotectString(action.partId),
							segmentId: unprotectString(segmentId) ?? 'invalid',
							sourceLayer: sourceLayerName ?? 'invalid',
							outputLayer: outputLayerName ?? 'invalid',
							actionType: triggerModes,
							tags: action.display.tags,
							publicData: action.publicData,
							optionsSchema: unprotectJsonBlob(action.userDataManifest.optionsSchema),
						},
						id: unprotectString(action._id),
						label: name,
						itemRank: action.display._rank,
						partRank: getRank(this._parts, action.partId),
						segmentRank: getRank(this._segments, segmentId),
						rundownRank: this._activePlaylist?.rundownIdsInOrder.indexOf(action.rundownId),
					})
				})
			)
		}

		if (this._adLibs) {
			adLibs.push(
				...this._adLibs.map((adLib) => {
					const sourceLayerName = this._sourceLayersMap.get(adLib.sourceLayerId)
					const outputLayerName = this._outputLayersMap.get(adLib.outputLayerId)
					const segmentId = adLib.partId ? this._parts.get(adLib.partId)?.segmentId : undefined
					return literal<WithSortingMetadata<AdLibStatus>>({
						obj: {
							id: unprotectString(adLib._id),
							name: adLib.name,
							partId: unprotectString(adLib.partId) ?? 'invalid',
							segmentId: unprotectString(segmentId) ?? 'invalid',
							sourceLayer: sourceLayerName ?? 'invalid',
							outputLayer: outputLayerName ?? 'invalid',
							actionType: [],
							tags: adLib.tags,
							publicData: adLib.publicData,
						},
						id: unprotectString(adLib._id),
						label: adLib.name,
						itemRank: adLib._rank,
						partRank: getRank(this._parts, adLib.partId),
						segmentRank: getRank(this._segments, segmentId),
						rundownRank: this._activePlaylist?.rundownIdsInOrder.indexOf(adLib.rundownId),
					})
				})
			)
		}

		if (this._globalAdLibActions) {
			globalAdLibs.push(
				...this._globalAdLibActions.map((action) => {
					const sourceLayerName = this._sourceLayersMap.get(
						(action.display as IBlueprintActionManifestDisplayContent).sourceLayerId
					)
					const outputLayerName = this._outputLayersMap.get(
						(action.display as IBlueprintActionManifestDisplayContent).outputLayerId
					)
					const triggerModes = action.triggerModes
						? action.triggerModes.map((t) =>
								literal<AdLibActionType>({
									name: t.data,
									label: interpollateTranslation(t.display.label.key, t.display.label.args),
								})
							)
						: []
					const name = interpollateTranslation(action.display.label.key, action.display.label.args)
					return literal<WithSortingMetadata<GlobalAdLibStatus>>({
						obj: {
							id: unprotectString(action._id),
							name,
							sourceLayer: sourceLayerName ?? 'invalid',
							outputLayer: outputLayerName ?? 'invalid',
							actionType: triggerModes,
							tags: action.display.tags,
							publicData: action.publicData,
							optionsSchema: unprotectJsonBlob(action.userDataManifest.optionsSchema),
						},
						id: unprotectString(action._id),
						label: name,
						rundownRank: this._activePlaylist?.rundownIdsInOrder.indexOf(action.rundownId),
						itemRank: action.display._rank,
					})
				})
			)
		}

		if (this._globalAdLibs) {
			globalAdLibs.push(
				...this._globalAdLibs.map((adLib) => {
					const sourceLayerName = this._sourceLayersMap.get(adLib.sourceLayerId)
					const outputLayerName = this._outputLayersMap.get(adLib.outputLayerId)
					return literal<WithSortingMetadata<GlobalAdLibStatus>>({
						obj: {
							id: unprotectString(adLib._id),
							name: adLib.name,
							sourceLayer: sourceLayerName ?? 'invalid',
							outputLayer: outputLayerName ?? 'invalid',
							actionType: [],
							tags: adLib.tags,
							publicData: adLib.publicData,
						},
						id: unprotectString(adLib._id),
						label: adLib.name,
						rundownRank: this._activePlaylist?.rundownIdsInOrder.indexOf(adLib.rundownId),
						itemRank: adLib._rank,
					})
				})
			)
		}

		const adLibsStatus: AdLibsEvent = this._activePlaylist
			? {
					event: 'adLibs',
					rundownPlaylistId: unprotectString(this._activePlaylist._id),
					adLibs: sortContent(adLibs),
					globalAdLibs: sortContent(globalAdLibs),
				}
			: { event: 'adLibs', rundownPlaylistId: null, adLibs: [], globalAdLibs: [] }

		this.sendMessage(subscribers, adLibsStatus)
	}

	private onPlaylistUpdate = (rundownPlaylist: Playlist | undefined): void => {
		this.logUpdateReceived(
			'playlist',
			`rundownPlaylistId ${rundownPlaylist?._id}, activationId ${rundownPlaylist?.activationId}`
		)
		this._activePlaylist = rundownPlaylist
		this.throttledSendStatusToAll()
	}

	private onShowStyleBaseUpdate = (showStyleBase: ShowStyle | undefined): void => {
		this.logUpdateReceived('showStyleBase')
		this._sourceLayersMap = showStyleBase?.sourceLayerNamesById ?? new Map()
		this._outputLayersMap = showStyleBase?.outputLayerNamesById ?? new Map()
		this.throttledSendStatusToAll()
	}

	private onAdLibActionsUpdate = (adLibActions: AdLibAction[] | undefined): void => {
		this.logUpdateReceived('adLibActions')
		this._adLibActions = adLibActions
		this.throttledSendStatusToAll()
	}

	private onAdLibsUpdate = (adLibs: AdLibPiece[] | undefined): void => {
		this.logUpdateReceived('adLibs')
		this._adLibs = adLibs
		this.throttledSendStatusToAll()
	}

	private onGlobalAdLibActionsUpdate = (adLibActions: RundownBaselineAdLibAction[] | undefined): void => {
		this.logUpdateReceived('globalAdLibActions')
		this._globalAdLibActions = adLibActions
		this.throttledSendStatusToAll()
	}

	private onGlobalAdLibsUpdate = (adLibs: RundownBaselineAdLibItem[] | undefined): void => {
		this.logUpdateReceived('globalAdLibs')
		this._globalAdLibs = adLibs
		this.throttledSendStatusToAll()
	}

	private onSegmentsUpdate = (segments: DBSegment[] | undefined): void => {
		this.logUpdateReceived('segments')
		const newSegments = new Map()
		segments ??= []
		segments.forEach((segment) => {
			newSegments.set(segment._id, segment)
		})
		this._segments = newSegments
		this.throttledSendStatusToAll()
	}

	private onPartsUpdate = (parts: DBPart[] | undefined): void => {
		this.logUpdateReceived('parts')
		const newParts = new Map()
		parts ??= []
		parts.forEach((part) => {
			newParts.set(part._id, part)
		})
		this._parts = newParts
		this.throttledSendStatusToAll()
	}
}

function unprotectJsonBlob(blob: JSONBlob<any> | undefined): string | undefined {
	return blob as string | undefined
}
