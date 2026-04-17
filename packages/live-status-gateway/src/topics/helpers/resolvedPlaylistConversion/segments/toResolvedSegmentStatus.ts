import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { getResolvedSegment } from '@sofie-automation/corelib/dist/playout/stateCacheResolver'
import { ResolvedPlaylistConversionContext, getOrderedPartsInRundown } from '../context/conversionContext.js'
import { toResolvedPartStatus } from '../parts/toResolvedPartStatus.js'
import type { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import type { DBSegment, SegmentExtended } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { ResolvedSegment, SourceLayer, OutputLayer } from '@sofie-automation/live-status-gateway-api'
import { literal } from '@sofie-automation/server-core-integration'

type NameableSourceLayer = {
	name?: string
	abbreviation?: string
	isHidden?: boolean
	type?: number
	_rank?: number
}

type NameableOutputLayer = {
	name?: string
	isFlattened?: boolean
	isPGM?: boolean
	sourceLayers?: Array<{ _id?: string }>
}

export function toResolvedSegmentStatus(
	ctx: ResolvedPlaylistConversionContext,
	segment: DBSegment,
	rundown: Rundown
): ResolvedSegment {
	const resolvedSegment = getResolvedSegment({
		showStyleBase: ctx.showStyleBaseExt,
		studio: undefined,
		playlist: ctx.playlist,
		rundown,
		segment,
		segmentsToReceiveOnRundownEndFromSet: getSegmentsToReceiveOnRundownEndFromSet(ctx, segment),
		rundownsToReceiveOnShowStyleEndFrom: [],
		rundownsToShowStyles: ctx.rundownsToShowStyles as any,
		orderedAllPartIds: getOrderedPartsInRundown(ctx, unprotectString(segment.rundownId)).map((p) => p._id),
		currentPartInstance: ctx.currentPartInstance,
		nextPartInstance: ctx.nextPartInstance,
		accessors: ctx.accessors,
		options: {
			getCurrentTime: () => Date.now(),
			invalidateAfter: (_timeoutMs: number) => {},
			includeDisabledPieces: false,
			showHiddenSourceLayers: false,
			defaultDisplayDuration: 0,
		},
	})

	const segmentExtended = resolvedSegment.segmentExtended
	const sourceLayers = toSourceLayers(ctx, segmentExtended)
	const outputLayers = toOutputLayers(ctx, segmentExtended)

	const budgetDurationMs = segment?.segmentTiming?.budgetDuration ?? 0

	return {
		id: unprotectString(segment._id),
		externalId: segment.externalId,
		identifier: segment.identifier ?? '',
		name: segment.name ?? '',
		rank: segment._rank,
		isHidden: segment.isHidden ?? false,
		sourceLayers,
		outputLayers,
		publicData: segment.publicData,
		timing: {
			startMs: 0,
			endMs: budgetDurationMs,
			budgetDurationMs,
		},
		parts: (resolvedSegment.parts ?? []).map((part) => toResolvedPartStatus(ctx, part)),
	}
}

function getSegmentsToReceiveOnRundownEndFromSet(
	ctx: ResolvedPlaylistConversionContext,
	segment: DBSegment
): Set<DBSegment['_id']> {
	const segmentsInThisRundown = ctx.segmentsByRundownId.get(String(segment.rundownId)) ?? []
	return new Set(segmentsInThisRundown.map((s) => s._id))
}

function toSourceLayers(ctx: ResolvedPlaylistConversionContext, segmentExtended: SegmentExtended): SourceLayer[] {
	return Object.entries<NameableSourceLayer>(segmentExtended?.sourceLayers ?? {})
		.map(([id, layer]) => ({
			id,
			name: layer?.name ?? ctx.showStyleBaseExt?.sourceLayerNamesById?.get?.(id) ?? '',
			abbreviation: layer?.abbreviation ?? '',
			isHidden: layer?.isHidden ?? false,
			type: layer?.type ?? 0,
			rank: layer?._rank ?? 0,
		}))
		.sort((a, b) => a.rank - b.rank)
}

function toOutputLayers(ctx: ResolvedPlaylistConversionContext, segmentExtended: SegmentExtended): OutputLayer[] {
	return Object.entries<NameableOutputLayer>(segmentExtended?.outputLayers ?? {})
		.map(([id, layer]) =>
			literal<OutputLayer>({
				id,
				name: layer?.name ?? ctx.showStyleBaseExt?.outputLayerNamesById?.get?.(id) ?? '',
				isFlattened: layer?.isFlattened ?? false,
				isPGM: layer?.isPGM ?? false,
				sourceLayerIds: (layer?.sourceLayers ?? [])
					.map((sl) => sl?._id)
					.filter((slId): slId is string => !!slId),
			})
		)
		.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}
