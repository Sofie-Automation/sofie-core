import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { WebSocketTopicBase, WebSocketTopic, PickArr } from '../wsHandler'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import _ = require('underscore')
import { IBlueprintActionManifestDisplayContent } from '@sofie-automation/blueprints-integration'
import { ShowStyleBaseExt } from '../collections/showStyleBaseHandler'
import { Bucket } from '@sofie-automation/corelib/dist/dataModel/Bucket'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { interpollateTranslation } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { AdLibActionType, AdLibStatus } from './adLibsTopic'
import { CollectionHandlers } from '../liveStatusServer'
import { sortContent, WithSortingMetadata } from './helpers/contentSorting'

const THROTTLE_PERIOD_MS = 100

export interface BucketsStatus {
	event: 'buckets'
	buckets: BucketStatus[]
}

interface BucketAdLibStatus extends Omit<AdLibStatus, 'partId' | 'segmentId'> {
	externalId: string
}

export interface BucketStatus {
	id: string
	name: string
	adLibs: BucketAdLibStatus[]
}

const SHOW_STYLE_BASE_KEYS = ['sourceLayerNamesById', 'outputLayerNamesById'] as const
type ShowStyle = PickArr<ShowStyleBaseExt, typeof SHOW_STYLE_BASE_KEYS>

export class BucketsTopic extends WebSocketTopicBase implements WebSocketTopic {
	private _buckets: Bucket[] = []
	private _adLibActionsByBucket: Record<string, BucketAdLibAction[]> | undefined
	private _adLibsByBucket: Record<string, BucketAdLib[]> | undefined
	private _sourceLayersMap: ReadonlyMap<string, string> = new Map()
	private _outputLayersMap: ReadonlyMap<string, string> = new Map()

	constructor(logger: Logger, handlers: CollectionHandlers) {
		super(BucketsTopic.name, logger, THROTTLE_PERIOD_MS)

		handlers.bucketsHandler.subscribe(this.onBucketsUpdate)
		handlers.bucketAdLibActionsHandler.subscribe(this.onBucketAdLibActionsUpdate)
		handlers.bucketAdLibsHandler.subscribe(this.onBucketAdLibsUpdate)
		handlers.showStyleBaseHandler.subscribe(this.onShowStyleBaseUpdate)
	}

	sendStatus(subscribers: Iterable<WebSocket>): void {
		const sortedBuckets = sortContent(this._buckets.map(this.addBucketSortingMetadata))

		const bucketStatuses: BucketStatus[] = sortedBuckets.map((bucket) => {
			const bucketId = unprotectString(bucket._id)

			const bucketAdLibs = (this._adLibsByBucket?.[bucketId] ?? []).map(this.toSortableBucketAdLib)
			const bucketAdLibActions = (this._adLibActionsByBucket?.[bucketId] ?? []).map(
				this.toSortableBucketAdLibAction
			)

			return {
				id: bucketId,
				name: bucket.name,
				adLibs: sortContent([...bucketAdLibs, ...bucketAdLibActions]),
			}
		})

		const bucketsStatus: BucketsStatus = {
			event: 'buckets',
			buckets: bucketStatuses,
		}

		this.sendMessage(subscribers, bucketsStatus)
	}

	private onShowStyleBaseUpdate = (showStyleBase: ShowStyle | undefined): void => {
		this.logUpdateReceived('showStyleBase')
		this._sourceLayersMap = showStyleBase?.sourceLayerNamesById ?? new Map()
		this._outputLayersMap = showStyleBase?.outputLayerNamesById ?? new Map()
		this.throttledSendStatusToAll()
	}

	private onBucketsUpdate = (buckets: Bucket[] | undefined): void => {
		this.logUpdateReceived('buckets')
		buckets ??= []
		this._buckets = sortContent(buckets.map(this.addBucketSortingMetadata))
		this.throttledSendStatusToAll()
	}

	private onBucketAdLibActionsUpdate = (adLibActions: BucketAdLibAction[] | undefined): void => {
		this.logUpdateReceived('buketAdLibActions')
		this._adLibActionsByBucket = _.groupBy(adLibActions ?? [], 'bucketId')
		this.throttledSendStatusToAll()
	}

	private onBucketAdLibsUpdate = (adLibs: BucketAdLib[] | undefined): void => {
		this.logUpdateReceived('bucketAdLibs')
		this._adLibsByBucket = _.groupBy(adLibs ?? [], 'bucketId')
		this.throttledSendStatusToAll()
	}

	private addBucketSortingMetadata = (bucket: Bucket): WithSortingMetadata<Bucket> => {
		return {
			obj: bucket,
			id: unprotectString(bucket._id),
			itemRank: bucket._rank,
			label: bucket.name,
		}
	}

	private toSortableBucketAdLib = (adLib: BucketAdLib): WithSortingMetadata<BucketAdLibStatus> => {
		const sourceLayerName = this._sourceLayersMap.get(adLib.sourceLayerId)
		const outputLayerName = this._outputLayersMap.get(adLib.outputLayerId)
		return {
			obj: {
				id: unprotectString(adLib._id),
				name: adLib.name,
				sourceLayer: sourceLayerName ?? 'invalid',
				outputLayer: outputLayerName ?? 'invalid',
				actionType: [],
				tags: adLib.tags,
				externalId: adLib.externalId,
				publicData: adLib.publicData,
			},
			id: unprotectString(adLib._id),
			itemRank: adLib._rank,
			label: adLib.name,
		}
	}

	private toSortableBucketAdLibAction = (action: BucketAdLibAction): WithSortingMetadata<BucketAdLibStatus> => {
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
		return {
			obj: {
				id: unprotectString(action._id),
				name,
				sourceLayer: sourceLayerName ?? 'invalid',
				outputLayer: outputLayerName ?? 'invalid',
				actionType: triggerModes,
				tags: action.display.tags,
				externalId: action.externalId,
				publicData: action.publicData,
			},
			id: unprotectString(action._id),
			itemRank: action.display._rank,
			label: name,
		}
	}
}
