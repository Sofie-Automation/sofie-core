import { SourceLayerType } from '../core/model/ShowStyle.js'
import { ExpectedPackage } from './package.js'

export interface SplitBoxPreviewUrlsLike {
	thumbnailUrl?: string
	previewUrl?: string
}

/** Box entry with optional media file name (VT / graphics / live speak). */
export interface SplitBoxWithOptionalFileName {
	type: SourceLayerType
	fileName?: string
}

export interface SplitsContentLike {
	boxSourceConfiguration: SplitBoxWithOptionalFileName[]
}

/** Same normalization as MediaObject `mediaId` and VT `getMediaObjectMediaId`. */
export function normalizeSplitBoxMediaId(filePath: string): string {
	return filePath.toUpperCase()
}

export function getExpectedPackageMediaId(expectedPackage: ExpectedPackage.Any): string | undefined {
	if (expectedPackage.type === ExpectedPackage.PackageType.MEDIA_FILE) {
		return expectedPackage.content.filePath
	}
	return undefined
}

export function getMediaIdFromSplitBox(box: SplitBoxWithOptionalFileName): string | undefined {
	const fileName = box.fileName
	if (!fileName) return undefined

	switch (box.type) {
		case SourceLayerType.VT:
		case SourceLayerType.LIVE_SPEAK:
		case SourceLayerType.GRAPHICS:
		case SourceLayerType.TRANSITION:
			return normalizeSplitBoxMediaId(fileName)
		default:
			return undefined
	}
}

export function getMediaIdsFromSplitsContent(content: SplitsContentLike): string[] {
	const ids = new Set<string>()
	for (const box of content.boxSourceConfiguration) {
		const mediaId = getMediaIdFromSplitBox(box)
		if (mediaId) ids.add(mediaId)
	}
	return [...ids]
}

export function findExpectedPackageForMediaId(
	packages: ReadonlyArray<ExpectedPackage.Any>,
	mediaId: string
): ExpectedPackage.Any | undefined {
	const normalized = normalizeSplitBoxMediaId(mediaId)
	return packages.find((pkg) => {
		const pkgMediaId = getExpectedPackageMediaId(pkg)
		return pkgMediaId !== undefined && normalizeSplitBoxMediaId(pkgMediaId) === normalized
	})
}

export function buildPublishedBoxPreviews(
	boxes: ReadonlyArray<SplitBoxWithOptionalFileName>,
	previewByMediaId: ReadonlyMap<string, SplitBoxPreviewUrlsLike>
): SplitBoxPreviewUrlsLike[] {
	return boxes.map((box) => {
		const mediaId = getMediaIdFromSplitBox(box)
		if (!mediaId) return {}
		return previewByMediaId.get(mediaId) ?? {}
	})
}
