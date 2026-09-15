import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { resolveAdLibActionForBranding, resolvePieceForBranding } from '@sofie-automation/corelib/dist/playout/branding'
import { getProjectedBrandingId } from '../../publications/lib/branding'
import { AdLibActionFields, AdLibPieceFields, ContentCache } from './reactiveContentCache'

type ResolvedAdLibAction = Pick<AdLibAction, AdLibActionFields>
type ResolvedAdLibPiece = Pick<AdLibPiece, AdLibPieceFields>
type ResolvedRundownBaselineAdLibAction = Pick<RundownBaselineAdLibAction, AdLibActionFields>
type ResolvedRundownBaselineAdLibPiece = Pick<RundownBaselineAdLibItem, AdLibPieceFields>

/**
 * The AdLibs of the active RundownPlaylist, resolved for the Branding it is being played with.
 *
 * The compiled filter chains match AdLibs on properties a Branding can change — `tags` and `display.label`
 * above all — so they have to run against resolved documents. Resolving into collections of their own keeps
 * the filter chains untouched: they run exactly the same queries, against documents which are already
 * correct for the Branding. Resolving lazily per query would not work, because the query is applied by the
 * collection and would match the values as authored.
 */
export class ResolvedAdLibCache {
	readonly AdLibActions = new InMemoryMongoCollection<ResolvedAdLibAction>('adLibActions')
	readonly AdLibPieces = new InMemoryMongoCollection<ResolvedAdLibPiece>('adLibPieces')
	readonly RundownBaselineAdLibActions = new InMemoryMongoCollection<ResolvedRundownBaselineAdLibAction>(
		'rundownBaselineAdLibActions'
	)
	readonly RundownBaselineAdLibPieces = new InMemoryMongoCollection<ResolvedRundownBaselineAdLibPiece>(
		'rundownBaselineAdLibPieces'
	)

	/** Rebuild from the current contents of the ContentCache */
	update(cache: ContentCache): void {
		const brandingId = getProjectedBrandingId(cache)

		replaceContents(this.AdLibActions, cache.AdLibActions.findFetch({}), (doc) =>
			resolveAdLibActionForBranding(doc, brandingId)
		)
		replaceContents(this.AdLibPieces, cache.AdLibPieces.findFetch({}), (doc) =>
			resolvePieceForBranding(doc, brandingId)
		)
		replaceContents(this.RundownBaselineAdLibActions, cache.RundownBaselineAdLibActions.findFetch({}), (doc) =>
			resolveAdLibActionForBranding(doc, brandingId)
		)
		replaceContents(this.RundownBaselineAdLibPieces, cache.RundownBaselineAdLibPieces.findFetch({}), (doc) =>
			resolvePieceForBranding(doc, brandingId)
		)
	}
}

function replaceContents<TDoc extends { _id: any }>(
	collection: InMemoryMongoCollection<TDoc>,
	docs: TDoc[],
	resolve: (doc: TDoc) => TDoc | null
): void {
	collection.clear()

	for (const doc of docs) {
		const resolved = resolve(doc)

		// Not used with this Branding, so it must produce no trigger, preview or tally
		if (!resolved) continue

		collection.insert(resolved)
	}
}
