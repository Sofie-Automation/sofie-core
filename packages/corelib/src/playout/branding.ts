import type {
	IBlueprintActionManifestBranding,
	IBlueprintPartBranding,
	IBlueprintPieceBranding,
} from '@sofie-automation/blueprints-integration'

/**
 * The portion of a document which describes how it varies with the selected Branding.
 * This is deliberately structural, so that the same resolution can be performed on the Blueprint types and on the
 * documents stored in the database.
 */
interface BrandableDocument<TBranding> {
	onlyValidForBranding?: string[]
	branding?: Record<string, TBranding | undefined>
}

/**
 * Whether a document is used while the given Branding is selected
 * @param doc Document to check
 * @param brandingId Id of the selected Branding, or null when no Branding is selected
 */
function isValidForBranding(doc: BrandableDocument<unknown>, brandingId: string | null): boolean {
	// Not limited to any Branding, so always used
	if (!doc.onlyValidForBranding) return true

	// Note: a document limited to some Brandings is never used when no Branding is selected
	return brandingId !== null && doc.onlyValidForBranding.includes(brandingId)
}

/**
 * Apply the overrides for the selected Branding to a document.
 * Note: this is intended for the documents as they are stored, where `content` does not carry the timeline objects.
 * The document is returned unchanged (and with the same identity) when the Branding makes no changes to it,
 * so that callers can cheaply tell whether anything was affected.
 */
function applyBranding<TDoc extends BrandableDocument<TBranding>, TBranding extends object>(
	doc: TDoc,
	brandingId: string | null
): TDoc {
	if (brandingId === null) return doc

	const overrides = doc.branding?.[brandingId]
	if (!overrides || Object.keys(overrides).length === 0) return doc

	// Any property named by the Branding replaces the one on the document in full
	return {
		...doc,
		...overrides,
	}
}

/**
 * Resolve a Part for the selected Branding
 * @param part Part to resolve
 * @param brandingId Id of the selected Branding, or null when no Branding is selected
 * @returns The Part with any overrides applied. This is the same object when the Branding makes no changes to it.
 */
export function resolvePartForBranding<TPart extends BrandableDocument<IBlueprintPartBranding>>(
	part: TPart,
	brandingId: string | null
): TPart {
	return applyBranding(part, brandingId)
}

/**
 * Resolve a Piece or AdLib Piece for the selected Branding
 * @param piece Piece to resolve
 * @param brandingId Id of the selected Branding, or null when no Branding is selected
 * @returns The Piece with any overrides applied, or null when it is not used with this Branding.
 * This is the same object when the Branding makes no changes to it.
 */
export function resolvePieceForBranding<TPiece extends BrandableDocument<IBlueprintPieceBranding>>(
	piece: TPiece,
	brandingId: string | null
): TPiece | null {
	if (!isValidForBranding(piece, brandingId)) return null

	return applyBranding(piece, brandingId)
}

/**
 * Resolve an AdLib Action for the selected Branding
 * @param action AdLib Action to resolve
 * @param brandingId Id of the selected Branding, or null when no Branding is selected
 * @returns The Action with any overrides applied, or null when it is not used with this Branding.
 * This is the same object when the Branding makes no changes to it.
 */
export function resolveAdLibActionForBranding<
	TAction extends BrandableDocument<IBlueprintActionManifestBranding> & { display: object },
>(action: TAction, brandingId: string | null): TAction | null {
	if (!isValidForBranding(action, brandingId)) return null

	if (brandingId === null) return action

	const displayOverrides = action.branding?.[brandingId]?.display
	if (!displayOverrides || Object.keys(displayOverrides).length === 0) return action

	return {
		...action,
		display: {
			...action.display,
			...displayOverrides,
		},
	}
}
