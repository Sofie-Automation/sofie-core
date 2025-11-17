import { IBlueprintPieceType, PieceLifespan, PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import {
	PartId,
	PeripheralDeviceId,
	PieceId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { EmptyPieceTimelineObjectsBlob, Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { DEFAULT_MINIMUM_TAKE_SPAN } from '@sofie-automation/shared-lib/dist/core/constants'
import { getRundownId } from '../ingest/lib.js'
import { getCurrentTime } from '../lib/index.js'

export function defaultRundownPlaylist(_id: RundownPlaylistId, studioId: StudioId): DBRundownPlaylist {
	return {
		_id: _id,

		externalId: 'MOCK_RUNDOWNPLAYLIST',
		studioId: studioId,

		name: 'Default RundownPlaylist',
		created: getCurrentTime(),
		modified: getCurrentTime(),

		// activationId: undefined,
		rehearsal: false,
		currentPartInfo: null,
		nextPartInfo: null,
		previousPartInfo: null,

		timing: {
			type: PlaylistTimingType.None,
		},
		rundownIdsInOrder: [],
	}
}
export function defaultRundown(
	externalId: string,
	studioId: StudioId,
	ingestDeviceId: PeripheralDeviceId | null,
	playlistId: RundownPlaylistId,
	showStyleBaseId: ShowStyleBaseId,
	showStyleVariantId: ShowStyleVariantId
): DBRundown {
	return {
		studioId: studioId,
		showStyleBaseId: showStyleBaseId,
		showStyleVariantId: showStyleVariantId,

		playlistId: playlistId,

		_id: getRundownId(studioId, externalId),
		externalId: externalId,
		name: 'Default Rundown',

		created: getCurrentTime(),
		modified: getCurrentTime(),
		importVersions: {
			studio: '',
			showStyleBase: '',
			showStyleVariant: '',
			blueprint: '',
			core: '',
		},

		timing: {
			type: PlaylistTimingType.None,
		},
		source: ingestDeviceId
			? {
					type: 'nrcs',
					peripheralDeviceId: ingestDeviceId,
					nrcsName: 'mock',
				}
			: {
					type: 'http',
				},
	}
}

export function defaultStudio(_id: StudioId): DBStudio {
	return {
		_id: _id,

		name: 'mockStudio',
		mappingsWithOverrides: wrapDefaultObject({}),
		supportedShowStyleBase: [],
		blueprintConfigWithOverrides: wrapDefaultObject({}),
		settingsWithOverrides: wrapDefaultObject({
			frameRate: 25,
			mediaPreviewsUrl: '',
			minimumTakeSpan: DEFAULT_MINIMUM_TAKE_SPAN,
			allowAdlibTestingSegment: true,
			allowHold: true,
			allowPieceDirectPlay: true,
			enableBuckets: true,
			enableEvaluationForm: true,
		}),
		routeSetsWithOverrides: wrapDefaultObject({}),
		routeSetExclusivityGroupsWithOverrides: wrapDefaultObject({}),
		packageContainersWithOverrides: wrapDefaultObject({}),
		previewContainerIds: [],
		thumbnailContainerIds: [],
		peripheralDeviceSettings: {
			deviceSettings: wrapDefaultObject({}),
			playoutDevices: wrapDefaultObject({}),
			ingestDevices: wrapDefaultObject({}),
			inputDevices: wrapDefaultObject({}),
		},
		_rundownVersionHash: '',
		lastBlueprintConfig: undefined,
		lastBlueprintFixUpHash: undefined,
	}
}

export function defaultSegment(_id: SegmentId, rundownId: RundownId): DBSegment {
	return {
		_id: _id,
		_rank: 0,
		externalId: unprotectString(_id),
		rundownId: rundownId,
		name: 'Default Segment',
	}
}

export function defaultPart(_id: PartId, rundownId: RundownId, segmentId: SegmentId): DBPart {
	return {
		_id: _id,
		rundownId: rundownId,
		segmentId: segmentId,
		_rank: 0,
		externalId: unprotectString(_id),
		title: 'Default Part',
		expectedDurationWithTransition: undefined,
	}
}
export function defaultPiece(_id: PieceId, rundownId: RundownId, segmentId: SegmentId, partId: PartId): Piece {
	return {
		_id: _id,
		externalId: 'MOCK_PIECE',
		startRundownId: rundownId,
		startSegmentId: segmentId,
		startPartId: partId,
		name: 'Default Piece',
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		enable: {
			start: 0,
		},
		sourceLayerId: '',
		outputLayerId: '',
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		pieceType: IBlueprintPieceType.Normal,
	}
}
export function defaultAdLibPiece(_id: PieceId, rundownId: RundownId, partId: PartId): AdLibPiece {
	return {
		_id: _id,
		externalId: 'MOCK_ADLIB',
		rundownId: rundownId,
		partId: partId,
		_rank: 0,
		name: 'Default Adlib',
		lifespan: PieceLifespan.WithinPart,
		sourceLayerId: '',
		outputLayerId: '',
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
}
