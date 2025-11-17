import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { unprotectString, protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { IBlueprintPieceType, PieceLifespan } from '@sofie-automation/blueprints-integration'
import { Piece, EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	PartId,
	PartInstanceId,
	PeripheralDeviceId,
	PieceId,
	PieceInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	SegmentId,
	SegmentPlayoutId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DEFAULT_MINIMUM_TAKE_SPAN } from '@sofie-automation/shared-lib/dist/core/constants'

export function defaultRundownPlaylist(_id: RundownPlaylistId, studioId: StudioId): DBRundownPlaylist {
	return {
		_id: _id,

		externalId: 'MOCK_RUNDOWNPLAYLIST',
		studioId: studioId,

		name: 'Default RundownPlaylist',
		created: Date.now(),
		modified: Date.now(),

		// activationId: undefined,
		rehearsal: false,
		currentPartInfo: null,
		nextPartInfo: null,
		previousPartInfo: null,
		timing: {
			type: 'none' as any,
		},
		rundownIdsInOrder: [],
	}
}
export function defaultRundown(
	externalId: string,
	studioId: StudioId,
	ingestDeviceId: PeripheralDeviceId,
	playlistId: RundownPlaylistId,
	showStyleBaseId: ShowStyleBaseId,
	showStyleVariantId: ShowStyleVariantId
): DBRundown {
	return {
		studioId: studioId,
		showStyleBaseId: showStyleBaseId,
		showStyleVariantId: showStyleVariantId,

		playlistId: playlistId,

		_id: protectString(`rundown_${studioId}_${externalId}`),
		externalId: externalId,
		name: 'Default Rundown',

		created: Date.now(),
		modified: Date.now(),
		importVersions: {
			studio: '',
			showStyleBase: '',
			showStyleVariant: '',
			blueprint: '',
			core: '',
		},

		timing: {
			type: 'none' as any,
		},
		source: {
			type: 'nrcs',
			peripheralDeviceId: ingestDeviceId,
			nrcsName: 'mock',
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
			allowHold: true,
			allowPieceDirectPlay: true,
			enableBuckets: true,
			enableEvaluationForm: true,
		}),
		_rundownVersionHash: '',
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
		pieceType: IBlueprintPieceType.Normal,
		invalid: false,
		enable: {
			start: 0,
		},
		sourceLayerId: '',
		outputLayerId: '',
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
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
export function defaultPartInstance(
	_id: PartInstanceId,
	playlistActivationId: RundownPlaylistActivationId,
	segmentPlayoutId: SegmentPlayoutId,
	part: DBPart
): PartInstance {
	return {
		_id,
		isTemporary: false,
		part: clone(part),
		playlistActivationId,
		rehearsal: false,
		rundownId: part.rundownId,
		segmentId: part.segmentId,
		takeCount: 0,
		segmentPlayoutId,
	}
}
export function defaultPieceInstance(
	_id: PieceInstanceId,
	playlistActivationId: RundownPlaylistActivationId,
	rundownId: RundownId,
	partInstanceId: PartInstanceId,
	piece: Piece
): PieceInstance {
	return {
		_id,
		partInstanceId,
		piece: clone(piece),
		playlistActivationId,
		rundownId,
		isTemporary: false,
	}
}
