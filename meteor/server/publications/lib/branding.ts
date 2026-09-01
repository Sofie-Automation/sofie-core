import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PartInstances, Parts, RundownPlaylists } from '../../collections'
import type { LiveQueryHandleSync } from '../../lib/lib'
import type { ReadonlyDeep } from 'type-fest'

/**
 * The RundownPlaylist properties needed to know which Branding applies to documents which have no
 * PartInstance of their own
 */
export type PlaylistBranding = Pick<DBRundownPlaylist, '_id' | 'currentPartInfo' | 'nextPartInfo' | 'defaultBrandingId'>
export const playlistBrandingFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<PlaylistBranding>>({
	_id: 1,
	currentPartInfo: 1,
	nextPartInfo: 1,
	defaultBrandingId: 1,
})

/** The Branding a PartInstance is played with. Nothing else about the PartInstance is needed */
export type PartInstanceBranding = Pick<DBPartInstance, '_id' | 'brandingId'>
export const partInstanceBrandingFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<PartInstanceBranding>>({
	_id: 1,
	brandingId: 1,
})

/**
 * The portion of a publication's ContentCache needed to resolve the Branding of documents which have no
 * PartInstance of their own
 */
export interface BrandingContentCache {
	RundownPlaylists: InMemoryMongoCollection<PlaylistBranding>
	PartInstances: InMemoryMongoCollection<PartInstanceBranding>
}

export function createBrandingContentCache(): BrandingContentCache {
	return {
		RundownPlaylists: new InMemoryMongoCollection<PlaylistBranding>('rundownPlaylists'),
		PartInstances: new InMemoryMongoCollection<PartInstanceBranding>('partInstances'),
	}
}

/**
 * Observe the documents needed to know which Branding applies to a set of Rundowns.
 * These are heavily projected, so that they only cause an invalidation when the Branding itself changes.
 */
export function createBrandingObservers(
	rundownIds: readonly RundownId[],
	cache: BrandingContentCache
): Array<Promise<LiveQueryHandleSync>> {
	return [
		RundownPlaylists.observeChanges(
			{ rundownIdsInOrder: { $in: rundownIds as RundownId[] } },
			cache.RundownPlaylists.link(),
			{ projection: playlistBrandingFieldSpecifier }
		),
		PartInstances.observeChanges(
			{ rundownId: { $in: rundownIds as RundownId[] }, reset: { $ne: true } },
			cache.PartInstances.link(),
			{ projection: partInstanceBrandingFieldSpecifier }
		),
	]
}

/**
 * The RundownIds to resolve the Branding from, for a publication which knows a PartId rather than any
 * RundownIds. A Part never moves between Rundowns, so this can be looked up once rather than observed.
 *
 * Note: this must be resolved before any observer is created, so that a failure here cannot leak one.
 */
export async function getBrandingRundownIdsForPart(partId: PartId): Promise<RundownId[]> {
	const part = (await Parts.findOneAsync(partId, { projection: { _id: 1, rundownId: 1 } })) as
		| Pick<DBPart, '_id' | 'rundownId'>
		| undefined

	return part ? [part.rundownId] : []
}

/**
 * The Branding to display documents with which have no PartInstance of their own, such as Parts, Pieces
 * and AdLibs.
 *
 * This follows the current PartInstance, so that the rest of the Rundown is displayed as it will be played
 * if nothing changes, and falls back to the Branding chosen during ingest before anything has been played.
 */
export function getProjectedBrandingId<TPlaylist extends PlaylistBranding, TPartInstance extends PartInstanceBranding>(
	cache: ReadonlyDeep<{
		RundownPlaylists: InMemoryMongoCollection<TPlaylist>
		PartInstances: InMemoryMongoCollection<TPartInstance>
	}>
): string | null {
	const playlist = cache.RundownPlaylists.findOne({})
	if (!playlist) return null

	for (const partInfo of [playlist.currentPartInfo, playlist.nextPartInfo]) {
		if (!partInfo) continue

		const partInstance = cache.PartInstances.findOne(partInfo.partInstanceId)
		if (partInstance) return partInstance.brandingId ?? null
	}

	return playlist.defaultBrandingId ?? null
}

/**
 * The portion of a publication's State needed to track the Branding the published documents were
 * resolved with
 */
export interface BrandingState {
	/**
	 * The BrandingId the published documents were last resolved with.
	 * `undefined` when nothing has been resolved yet.
	 */
	brandingId?: string | null
}

/**
 * Resolve the BrandingId to display documents with, and report whether it differs from the one the
 * published documents were last resolved with.
 *
 * Any change to the observed RundownPlaylist or PartInstances triggers an invalidation of the Branding,
 * but most of those changes (such as taking the next Part) don't affect the resolved BrandingId. Diffing
 * it here avoids resolving every published document again in those cases.
 */
export function updateProjectedBrandingId<
	TPlaylist extends PlaylistBranding,
	TPartInstance extends PartInstanceBranding,
>(
	state: BrandingState,
	cache: ReadonlyDeep<{
		RundownPlaylists: InMemoryMongoCollection<TPlaylist>
		PartInstances: InMemoryMongoCollection<TPartInstance>
	}>
): { brandingId: string | null; brandingChanged: boolean } {
	const brandingId = getProjectedBrandingId(cache)

	const brandingChanged = state.brandingId !== brandingId
	state.brandingId = brandingId

	return { brandingId, brandingChanged }
}
