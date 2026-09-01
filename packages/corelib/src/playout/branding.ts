import type {
	IBlueprintActionManifestBranding,
	IBlueprintPartBranding,
	IBlueprintPieceBranding,
} from '@sofie-automation/blueprints-integration'
import type { ReadonlyDeep } from 'type-fest'

/**
 * The portion of a document which describes how it varies with the selected Branding.
 * This is deliberately structural, so that the same resolution can be performed on the Blueprint types and on the
 * documents stored in the database.
 */
interface BrandableDocument<TBranding> {
	onlyValidForBranding?: readonly string[]
	branding?: Readonly<Record<string, ReadonlyDeep<TBranding> | undefined>>
}

/**
 * Whether a document is used while the given Branding is selected
 * @param doc Document to check
 * @param brandingId Id of the selected Branding, or null when no Branding is selected
 */
export function isValidForBranding(doc: BrandableDocument<unknown>, brandingId: string | null): boolean {
	// Not limited to any Branding, so always used
	if (!doc.onlyValidForBranding) return true

	// Note: a document limited to some Brandings is never used when no Branding is selected
	return brandingId !== null && doc.onlyValidForBranding.includes(brandingId)
}

/**
 * Apply the overrides for the selected Branding to a document.
 * The document is returned unchanged (and with the same identity) when the Branding makes no changes to it,
 * so that callers can cheaply tell whether anything was affected.
 *
 * Only the properties in `brandableProperties` are applied. Blueprints are untyped JS, so the types alone do
 * not stop one naming a property which is not brandable, and the overrides are stored as authored.
 */
function applyBranding<TDoc extends BrandableDocument<TBranding>, TBranding extends object>(
	doc: TDoc,
	brandingId: string | null,
	brandableProperties: ReadonlySet<string>
): TDoc {
	if (brandingId === null) return doc

	const overrides = doc.branding?.[brandingId]
	if (!overrides) return doc

	// Any property named by the Branding replaces the one on the document in full
	let result: TDoc | undefined
	for (const [property, value] of Object.entries<unknown>(overrides as Record<string, unknown>)) {
		if (!brandableProperties.has(property)) continue

		result = { ...(result ?? doc), [property]: value }
	}

	return result ?? doc
}

/** The properties of a Part which a Branding may replace */
const partBrandableProperties: ReadonlySet<string> = new Set<keyof IBlueprintPartBranding>([
	'title',
	'prompterTitle',
	'identifier',
])

/**
 * The properties of a Piece which a Branding may replace.
 * Note: `sourceLayerId` and `outputLayerId` are deliberately absent. Playout groups by them, so a Branding
 * moving a Piece between layers would change what it interrupts and what it is tracked alongside.
 */
const pieceBrandableProperties: ReadonlySet<string> = new Set<keyof IBlueprintPieceBranding>(['name', 'tags'])

/** The properties of an AdLib Action's `display` which a Branding may replace */
const actionDisplayBrandableProperties: ReadonlySet<string> = new Set<
	keyof NonNullable<IBlueprintActionManifestBranding['display']>
>(['label', 'description', '_rank', 'triggerLabel', 'tags'])

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
	return applyBranding(part, brandingId, partBrandableProperties)
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

	return applyBranding(piece, brandingId, pieceBrandableProperties)
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
	if (!displayOverrides) return action

	let display: typeof action.display | undefined
	for (const [property, value] of Object.entries<unknown>(displayOverrides as Record<string, unknown>)) {
		if (!actionDisplayBrandableProperties.has(property)) continue

		display = { ...(display ?? action.display), [property]: value }
	}

	if (!display) return action

	return {
		...action,
		display,
	}
}
