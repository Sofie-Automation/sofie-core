import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import {
	PartInstanceId,
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { ContentCache } from '../reactiveContentCache'
import { ResolvedAdLibCache } from '../resolvedAdLibCache'

const playlistId = protectString<RundownPlaylistId>('playlist0')
const showStyleBaseId = protectString<ShowStyleBaseId>('showStyleBase0')
const rundownId = protectString<RundownId>('rundown0')
const partInstanceId = protectString<PartInstanceId>('partInstance0')

function createMockCache(): ContentCache {
	return {
		RundownPlaylists: new InMemoryMongoCollection('rundownPlaylists'),
		Rundowns: new InMemoryMongoCollection('rundowns'),
		ShowStyleBases: new InMemoryMongoCollection('showStyleBases'),
		Segments: new InMemoryMongoCollection('segments'),
		Parts: new InMemoryMongoCollection('parts'),
		PartInstances: new InMemoryMongoCollection('partInstances'),
		AdLibPieces: new InMemoryMongoCollection('adLibPieces'),
		AdLibActions: new InMemoryMongoCollection('adLibActions'),
		RundownBaselineAdLibPieces: new InMemoryMongoCollection('rundownBaselineAdLibPieces'),
		RundownBaselineAdLibActions: new InMemoryMongoCollection('rundownBaselineAdLibActions'),
		TriggeredActions: new InMemoryMongoCollection('triggeredActions'),
	} as unknown as ContentCache
}

/** Select a Branding by putting a current PartInstance carrying it into the cache */
function selectBranding(cache: ContentCache, brandingId: string | null, defaultBrandingId: string | null = null) {
	cache.RundownPlaylists.clear()
	cache.PartInstances.clear()

	cache.RundownPlaylists.insert({
		_id: playlistId,
		showStyleBaseId,
		defaultBrandingId,
		currentPartInfo: brandingId !== null ? { partInstanceId } : null,
	} as unknown as DBRundownPlaylist)

	if (brandingId !== null) {
		cache.PartInstances.insert({ _id: partInstanceId, brandingId } as any)
	}
}

function insertAdLibPiece(cache: ContentCache, id: string, props: Record<string, unknown>) {
	cache.AdLibPieces.insert({
		_id: protectString(id),
		rundownId,
		name: 'unbranded-name',
		tags: ['unbranded-tag'],
		...props,
	} as any)
}

function insertAdLibAction(cache: ContentCache, id: string, props: Record<string, unknown>) {
	cache.AdLibActions.insert({
		_id: protectString(id),
		rundownId,
		display: { label: 'unbranded-label', tags: ['unbranded-tag'] },
		...props,
	} as any)
}

describe('ResolvedAdLibCache', () => {
	test('AdLibs with no Branding are passed through', () => {
		const cache = createMockCache()
		selectBranding(cache, 'brandingA')
		insertAdLibPiece(cache, 'piece0', {})
		insertAdLibAction(cache, 'action0', {})

		const resolved = new ResolvedAdLibCache()
		resolved.update(cache)

		expect(resolved.AdLibPieces.findFetch({}).map((p) => String(p._id))).toEqual(['piece0'])
		expect(resolved.AdLibActions.findFetch({}).map((a) => String(a._id))).toEqual(['action0'])
	})

	test('AdLibs hidden by the selected Branding are dropped, so they produce no trigger', () => {
		const cache = createMockCache()
		selectBranding(cache, 'brandingA')
		insertAdLibPiece(cache, 'pieceA', { onlyValidForBranding: ['brandingA'] })
		insertAdLibPiece(cache, 'pieceB', { onlyValidForBranding: ['brandingB'] })
		insertAdLibAction(cache, 'actionA', { onlyValidForBranding: ['brandingA'] })
		insertAdLibAction(cache, 'actionB', { onlyValidForBranding: ['brandingB'] })

		const resolved = new ResolvedAdLibCache()
		resolved.update(cache)

		expect(resolved.AdLibPieces.findFetch({}).map((p) => String(p._id))).toEqual(['pieceA'])
		expect(resolved.AdLibActions.findFetch({}).map((a) => String(a._id))).toEqual(['actionA'])
	})

	test('the overrides of the selected Branding are applied', () => {
		const cache = createMockCache()
		selectBranding(cache, 'brandingA')
		insertAdLibPiece(cache, 'piece0', {
			branding: { brandingA: { name: 'branded-name', tags: ['branded-tag'] } },
		})
		insertAdLibAction(cache, 'action0', {
			branding: { brandingA: { display: { label: 'branded-label' } } },
		})

		const resolved = new ResolvedAdLibCache()
		resolved.update(cache)

		const piece = resolved.AdLibPieces.findOne(protectString('piece0'))
		expect(piece?.name).toBe('branded-name')
		expect(piece?.tags).toEqual(['branded-tag'])

		const action = resolved.AdLibActions.findOne(protectString('action0'))
		expect(action?.display.label).toBe('branded-label')
		// Properties the Branding does not name are kept
		expect(action?.display.tags).toEqual(['unbranded-tag'])
	})

	test('the filter chains can query the branded values, as the documents are resolved before the query', () => {
		const cache = createMockCache()
		selectBranding(cache, 'brandingA')
		insertAdLibPiece(cache, 'piece0', { branding: { brandingA: { tags: ['branded-tag'] } } })

		const resolved = new ResolvedAdLibCache()
		resolved.update(cache)

		expect(resolved.AdLibPieces.findFetch({ tags: { $in: ['branded-tag'] } })).toHaveLength(1)
		expect(resolved.AdLibPieces.findFetch({ tags: { $in: ['unbranded-tag'] } })).toHaveLength(0)
	})

	test('with no Branding selected, limited AdLibs are dropped and no overrides are applied', () => {
		const cache = createMockCache()
		selectBranding(cache, null)
		insertAdLibPiece(cache, 'pieceA', { onlyValidForBranding: ['brandingA'] })
		insertAdLibPiece(cache, 'piece0', { branding: { brandingA: { name: 'branded-name' } } })

		const resolved = new ResolvedAdLibCache()
		resolved.update(cache)

		expect(resolved.AdLibPieces.findFetch({}).map((p) => String(p._id))).toEqual(['piece0'])
		expect(resolved.AdLibPieces.findOne(protectString('piece0'))?.name).toBe('unbranded-name')
	})

	test('the Branding falls back to the one chosen during ingest', () => {
		const cache = createMockCache()
		selectBranding(cache, null, 'brandingA')
		insertAdLibPiece(cache, 'pieceA', { onlyValidForBranding: ['brandingA'] })
		insertAdLibPiece(cache, 'pieceB', { onlyValidForBranding: ['brandingB'] })

		const resolved = new ResolvedAdLibCache()
		resolved.update(cache)

		expect(resolved.AdLibPieces.findFetch({}).map((p) => String(p._id))).toEqual(['pieceA'])
	})

	test('a later update replaces the previous contents', () => {
		const cache = createMockCache()
		selectBranding(cache, 'brandingA')
		insertAdLibPiece(cache, 'pieceA', { onlyValidForBranding: ['brandingA'] })

		const resolved = new ResolvedAdLibCache()
		resolved.update(cache)
		expect(resolved.AdLibPieces.findFetch({})).toHaveLength(1)

		// The Branding is changed to one the AdLib is not used with
		selectBranding(cache, 'brandingB')
		resolved.update(cache)

		expect(resolved.AdLibPieces.findFetch({})).toHaveLength(0)
	})

	test('baseline AdLibs are resolved too', () => {
		const cache = createMockCache()
		selectBranding(cache, 'brandingA')
		cache.RundownBaselineAdLibPieces.insert({
			_id: protectString('baselinePieceB'),
			rundownId,
			name: 'unbranded-name',
			onlyValidForBranding: ['brandingB'],
		} as any)
		cache.RundownBaselineAdLibActions.insert({
			_id: protectString('baselineActionA'),
			rundownId,
			display: { label: 'unbranded-label' },
			branding: { brandingA: { display: { label: 'branded-label' } } },
		} as any)

		const resolved = new ResolvedAdLibCache()
		resolved.update(cache)

		expect(resolved.RundownBaselineAdLibPieces.findFetch({})).toHaveLength(0)
		expect(resolved.RundownBaselineAdLibActions.findOne(protectString('baselineActionA'))?.display.label).toBe(
			'branded-label'
		)
	})
})
