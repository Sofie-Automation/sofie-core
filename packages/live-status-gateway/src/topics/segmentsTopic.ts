import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { WebSocketTopicBase, WebSocketTopic, CollectionObserver } from '../wsHandler'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PlaylistHandler } from '../collections/playlistHandler'
import { groupByToMap } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { SegmentsHandler } from '../collections/segmentsHandler'
import areElementsShallowEqual from '@sofie-automation/shared-lib/dist/lib/isShallowEqual'
import { PartsHandler } from '../collections/partsHandler'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import _ = require('underscore')
import { SegmentTiming, calculateSegmentTiming } from './helpers/segmentTiming'

const THROTTLE_PERIOD_MS = 200

interface SegmentStatus {
	id: string
	identifier?: string
	rundownId: string
	name: string
	timing: SegmentTiming
	publicData: unknown
}

export interface SegmentsStatus {
	event: 'segments'
	rundownPlaylistId: string | null
	segments: SegmentStatus[]
}

export class SegmentsTopic
	extends WebSocketTopicBase
	implements
		WebSocketTopic,
		CollectionObserver<DBSegment[]>,
		CollectionObserver<DBRundownPlaylist>,
		CollectionObserver<DBPart[]>
{
	public observerName = SegmentsTopic.name
	private _activePlaylist: DBRundownPlaylist | undefined
	private _segments: DBSegment[] = []
	private _partsBySegment: Record<string, DBPart[]> = {}
	private _orderedSegments: DBSegment[] = []
	private throttledSendStatusToAll: () => void

	constructor(logger: Logger) {
		super(SegmentsTopic.name, logger)
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
		const segmentsStatus: SegmentsStatus = {
			event: 'segments',
			rundownPlaylistId: this._activePlaylist ? unprotectString(this._activePlaylist._id) : null,
			segments: this._orderedSegments.map((segment) => {
				const segmentId = unprotectString(segment._id)
				return {
					id: segmentId,
					rundownId: unprotectString(segment.rundownId),
					name: segment.name,
					timing: calculateSegmentTiming(segment, this._partsBySegment[segmentId] ?? []),
					identifier: segment.identifier,
					publicData: segment.publicData,
				}
			}),
		}

		this.sendMessage(subscribers, segmentsStatus)
	}

	async update(source: string, data: DBRundownPlaylist | DBSegment[] | DBPart[] | undefined): Promise<void> {
		const prevSegments = this._segments
		const prevRundownOrder = this._activePlaylist?.rundownIdsInOrder ?? []
		const prevParts = this._partsBySegment
		const prevPlaylistId = this._activePlaylist?._id
		switch (source) {
			case PlaylistHandler.name: {
				this._activePlaylist = data as DBRundownPlaylist | undefined
				this.logUpdateReceived('playlist', source)
				break
			}
			case SegmentsHandler.name: {
				this._segments = data as DBSegment[]
				this.logUpdateReceived('segments', source)
				break
			}
			case PartsHandler.name: {
				this._partsBySegment = _.groupBy(data as DBPart[], 'segmentId')
				this.logUpdateReceived('parts', source)
				break
			}
			default:
				throw new Error(`${this._name} received unsupported update from ${source}}`)
		}

		if (this._activePlaylist) {
			if (
				this._activePlaylist._id !== prevPlaylistId ||
				prevSegments !== this._segments ||
				prevParts !== this._partsBySegment ||
				!areElementsShallowEqual(prevRundownOrder, this._activePlaylist.rundownIdsInOrder)
			) {
				const segmentsByRundownId = groupByToMap(this._segments, 'rundownId')
				this._orderedSegments = this._activePlaylist.rundownIdsInOrder.flatMap((rundownId) => {
					return segmentsByRundownId.get(rundownId)?.sort((a, b) => a._rank - b._rank) ?? []
				})
				this.throttledSendStatusToAll()
			}
		} else {
			this._orderedSegments = []
			this.throttledSendStatusToAll()
		}
	}

	private sendStatusToAll() {
		this.sendStatus(this._subscribers)
	}
}
