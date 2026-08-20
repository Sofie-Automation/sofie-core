/** Serializes `PieceExtended` into a JSON-safe shape without circular references. */
export function serializePiece(pieceExtended: unknown): any {
	const piece = pieceExtended as any
	// `PieceExtended` contains references to `outputLayers/sourceLayers` which then contains pieces again -> circular.
	// We omit `outputLayer` and keep the values used by consumers.
	const { outputLayer: _outputLayer, ...rest } = piece ?? {}
	return {
		renderedInPoint: rest.renderedInPoint,
		renderedDuration: rest.renderedDuration,
		instance: rest.instance,
	}
}

/** Serializes `PartExtended` and nested pieces for deterministic debug logging/testing. */
export function serializePart(partExtended: unknown): any {
	const part = (partExtended as any) ?? {}
	return {
		partId: part?.partId,
		instance: part?.instance,
		renderedDuration: part?.renderedDuration,
		startsAt: part?.startsAt,
		willProbablyAutoNext: part?.willProbablyAutoNext,
		pieces: part.pieces?.map(serializePiece) ?? [],
	}
}

/** Serializes `SegmentExtended` while pruning cyclical layer/piece references. */
export function serializeSegmentExtended(segmentExtended: unknown): any {
	const segment = segmentExtended as any
	if (!segment) return segment
	const { outputLayers, sourceLayers, ...rest } = segment

	const safeOutputLayers: Record<string, any> = {}
	for (const [layerId, layer] of Object.entries<any>(outputLayers ?? {})) {
		safeOutputLayers[layerId] = {
			...layer,
			sourceLayers: [],
		}
	}

	const safeSourceLayers: Record<string, any> = {}
	for (const [layerId, layer] of Object.entries<any>(sourceLayers ?? {})) {
		safeSourceLayers[layerId] = {
			...layer,
			pieces: (layer.pieces ?? []).map((p: any) => p?.instance?._id ?? p?._id),
		}
	}

	return {
		...rest,
		outputLayers: safeOutputLayers,
		sourceLayers: safeSourceLayers,
	}
}
