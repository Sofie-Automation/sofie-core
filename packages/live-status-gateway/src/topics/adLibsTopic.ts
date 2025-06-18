import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { WebSocketTopicBase, WebSocketTopic, CollectionObserver } from '../wsHandler'
import { PlaylistHandler } from '../collections/playlistHandler'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import _ = require('underscore')
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { AdLibActionsHandler } from '../collections/adLibActionsHandler'
import { GlobalAdLibActionsHandler } from '../collections/globalAdLibActionsHandler'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { IBlueprintActionManifestDisplayContent } from '@sofie-automation/blueprints-integration'
import { ShowStyleBaseExt, ShowStyleBaseHandler } from '../collections/showStyleBaseHandler'
import { interpollateTranslation } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { AdLibsHandler } from '../collections/adLibsHandler'
import { GlobalAdLibsHandler } from '../collections/globalAdLibsHandler'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartsHandler } from '../collections/partsHandler'
import { PartId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { WithSortingMetadata, getRank, sortContent } from './helpers/contentSorting'
import { isDeepStrictEqual } from 'util'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { SegmentsHandler } from '../collections/segmentsHandler'

const THROTTLE_PERIOD_MS = 100

export interface AdLibsStatus {
	event: 'adLibs'
	rundownPlaylistId: string | null
	adLibs: AdLibStatus[]
	globalAdLibs: GlobalAdLibStatus[]
}

interface AdLibActionType {
	name: string
	label: string
}

interface AdLibStatus extends AdLibStatusBase {
	segmentId: string
	partId: string
}

type GlobalAdLibStatus = AdLibStatusBase

interface AdLibStatusBase {
	id: string
	name: string
	sourceLayer: string
	outputLayer: string
	actionType: AdLibActionType[]
	tags?: string[]
	publicData: unknown
	optionsSchema?: any
}

export class AdLibsTopic
	extends WebSocketTopicBase
	implements
		WebSocketTopic,
		CollectionObserver<DBRundownPlaylist>,
		CollectionObserver<ShowStyleBaseExt>,
		CollectionObserver<AdLibAction[]>,
		CollectionObserver<RundownBaselineAdLibAction[]>,
		CollectionObserver<DBPart[]>
{
	public observerName = AdLibsTopic.name
	private _activePlaylist: DBRundownPlaylist | undefined
	private _sourceLayersMap: ReadonlyMap<string, string> = new Map()
	private _outputLayersMap: ReadonlyMap<string, string> = new Map()
	private _adLibActions: AdLibAction[] | undefined
	private _abLibs: AdLibPiece[] | undefined
	private _parts: ReadonlyMap<PartId, DBPart> = new Map()
	private _segments: ReadonlyMap<SegmentId, DBSegment> = new Map()
	private _globalAdLibActions: RundownBaselineAdLibAction[] | undefined
	private _globalAdLibs: RundownBaselineAdLibItem[] | undefined
	private throttledSendStatusToAll: () => void

	constructor(logger: Logger) {
		super(AdLibsTopic.name, logger)
		this.throttledSendStatusToAll = _.throttle(this.sendStatusToAll.bind(this), THROTTLE_PERIOD_MS, {
			leading: true,
			trailing: true,
		})
	}

	addSubscriber(ws: WebSocket): void {
		super.addSubscriber(ws)
		this.sendStatus([ws])
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
							optionsSchema: action.userDataManifest.optionsSchema,
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

		if (this._abLibs) {
			adLibs.push(
				...this._abLibs.map((adLib) => {
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
							optionsSchema: action.userDataManifest.optionsSchema,
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

		const adLibsStatus: AdLibsStatus = this._activePlaylist
			? {
					event: 'adLibs',
					rundownPlaylistId: unprotectString(this._activePlaylist._id),
					adLibs: sortContent(adLibs),
					globalAdLibs: sortContent(globalAdLibs),
			  }
			: { event: 'adLibs', rundownPlaylistId: null, adLibs: [], globalAdLibs: [] }

		this.sendMessage(subscribers, adLibsStatus)
	}

	async update(
		source: string,
		data:
			| DBRundownPlaylist
			| ShowStyleBaseExt
			| AdLibAction[]
			| RundownBaselineAdLibAction[]
			| AdLibPiece[]
			| RundownBaselineAdLibItem[]
			| DBPart[]
			| DBSegment[]
			| undefined
	): Promise<void> {
		switch (source) {
			case PlaylistHandler.name: {
				const previousPlaylist = this._activePlaylist
				this.logUpdateReceived('playlist', source)
				this._activePlaylist = data as DBRundownPlaylist | undefined
				// PlaylistHandler is quite chatty (will update on every take), so let's make sure there's a point
				// in sending a status
				if (
					previousPlaylist?._id === this._activePlaylist?._id &&
					isDeepStrictEqual(previousPlaylist?.rundownIdsInOrder, this._activePlaylist?.rundownIdsInOrder)
				)
					return
				break
			}
			case AdLibActionsHandler.name: {
				const adLibActions = data ? (data as AdLibAction[]) : []
				this.logUpdateReceived('adLibActions', source)
				this._adLibActions = adLibActions
				break
			}
			case GlobalAdLibActionsHandler.name: {
				const globalAdLibActions = data ? (data as RundownBaselineAdLibAction[]) : []
				this.logUpdateReceived('globalAdLibActions', source)
				this._globalAdLibActions = globalAdLibActions
				break
			}
			case AdLibsHandler.name: {
				const adLibs = data ? (data as AdLibPiece[]) : []
				this.logUpdateReceived('adLibs', source)
				this._abLibs = adLibs
				break
			}
			case GlobalAdLibsHandler.name: {
				const globalAdLibs = data ? (data as RundownBaselineAdLibItem[]) : []
				this.logUpdateReceived('globalAdLibs', source)
				this._globalAdLibs = globalAdLibs
				break
			}
			case ShowStyleBaseHandler.name: {
				const showStyleBaseExt = data ? (data as ShowStyleBaseExt) : undefined
				this.logUpdateReceived('showStyleBase', source)
				this._sourceLayersMap = showStyleBaseExt?.sourceLayerNamesById ?? new Map()
				this._outputLayersMap = showStyleBaseExt?.outputLayerNamesById ?? new Map()
				break
			}
			case SegmentsHandler.name: {
				const segments = data ? (data as DBPart[]) : []
				this.logUpdateReceived('segments', source)
				const newSegments = new Map()
				segments.forEach((segment) => {
					newSegments.set(segment._id, segment)
				})
				this._segments = newSegments
				break
			}
			case PartsHandler.name: {
				const parts = data ? (data as DBPart[]) : []
				this.logUpdateReceived('parts', source)
				const newParts = new Map()
				parts.forEach((part) => {
					newParts.set(part._id, part)
				})
				this._parts = newParts
				break
			}
			default:
				throw new Error(`${this._name} received unsupported update from ${source}}`)
		}

		this.throttledSendStatusToAll()
	}

	private sendStatusToAll() {
		this.sendStatus(this._subscribers)
	}
}
