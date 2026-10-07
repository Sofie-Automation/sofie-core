import type {
	IBlueprintActionManifestBranding,
	IBlueprintBrandableActionManifestDisplay,
	IBlueprintPartBranding,
	IBlueprintPieceBranding,
} from '@sofie-automation/blueprints-integration'
import type { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	isTranslatableMessage,
	wrapTranslatableMessageFromBlueprints,
} from '@sofie-automation/corelib/dist/TranslatableMessage'
import { logger } from '../logging.js'

/*
 * Blueprints are untyped JS, so the Branding data they provide is validated here before it is stored.
 * Anything invalid is dropped with a warning rather than failing the whole operation, so that a mistake in the
 * Branding of one document doesn't stop the rest from being ingested or played.
 */

/** Sanitise a value from a Blueprint, returning `undefined` when it is not valid */
type PropertySanitiser<T> = (value: unknown, blueprintId: BlueprintId) => T | undefined
type PropertySanitisers<T> = { [K in keyof Required<T>]: PropertySanitiser<T[K]> }

function sanitiseString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined
}
function sanitiseNumber(value: unknown): number | undefined {
	return typeof value === 'number' && !Number.isNaN(value) ? value : undefined
}
function sanitiseStringArray(value: unknown): string[] | undefined {
	return Array.isArray(value) && value.every((v) => typeof v === 'string') ? [...value] : undefined
}
function sanitiseTranslatableMessage(
	value: unknown,
	blueprintId: BlueprintId
): ReturnType<typeof wrapTranslatableMessageFromBlueprints> | undefined {
	return isTranslatableMessage(value) ? wrapTranslatableMessageFromBlueprints(value, [blueprintId]) : undefined
}

const partSanitisers: PropertySanitisers<IBlueprintPartBranding> = {
	title: sanitiseString,
	prompterTitle: sanitiseString,
	identifier: sanitiseString,
}

const pieceSanitisers: PropertySanitisers<IBlueprintPieceBranding> = {
	name: sanitiseString,
}

const actionDisplaySanitisers: PropertySanitisers<IBlueprintBrandableActionManifestDisplay> = {
	label: sanitiseTranslatableMessage,
	description: sanitiseTranslatableMessage,
	_rank: sanitiseNumber,
	triggerLabel: sanitiseTranslatableMessage,
	tags: sanitiseStringArray,
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function warnInvalid(blueprintId: BlueprintId, label: string, problem: string): void {
	logger.warn(`Ignoring invalid Branding from Blueprint "${blueprintId}": ${label} ${problem}`)
}

/**
 * Sanitise an object of overrides, keeping only the properties which have a sanitiser and a valid value
 * @returns The sanitised overrides, or undefined when none are valid
 */
function sanitiseProperties<T extends object>(
	value: unknown,
	sanitisers: PropertySanitisers<T>,
	blueprintId: BlueprintId,
	label: string
): Partial<T> | undefined {
	if (!isPlainObject(value)) {
		warnInvalid(blueprintId, label, 'is not an object')
		return undefined
	}

	const entries: [string, unknown][] = []
	for (const [property, propertyValue] of Object.entries<unknown>(value)) {
		if (propertyValue === undefined) continue

		const sanitiser: PropertySanitiser<unknown> | undefined = Object.hasOwn(sanitisers, property)
			? sanitisers[property as keyof T]
			: undefined
		if (!sanitiser) {
			warnInvalid(blueprintId, `${label}.${property}`, 'cannot be changed by a Branding')
			continue
		}

		const sanitised = sanitiser(propertyValue, blueprintId)
		if (sanitised === undefined) {
			warnInvalid(blueprintId, `${label}.${property}`, 'is not a valid value')
			continue
		}

		entries.push([property, sanitised])
	}

	// Note: fromEntries defines the properties, so a property named `__proto__` can't replace the prototype
	return entries.length ? (Object.fromEntries(entries) as Partial<T>) : undefined
}

function sanitiseActionOverrides(
	value: unknown,
	blueprintId: BlueprintId,
	label: string
): IBlueprintActionManifestBranding | undefined {
	if (!isPlainObject(value)) {
		warnInvalid(blueprintId, label, 'is not an object')
		return undefined
	}

	for (const [property, propertyValue] of Object.entries<unknown>(value)) {
		if (property !== 'display' && propertyValue !== undefined) {
			warnInvalid(blueprintId, `${label}.${property}`, 'cannot be changed by a Branding')
		}
	}

	if (value.display === undefined) return undefined

	const display = sanitiseProperties(value.display, actionDisplaySanitisers, blueprintId, `${label}.display`)
	return display ? { display } : undefined
}

/**
 * Sanitise the overrides for each Branding
 * @returns The sanitised overrides, or undefined when there are none
 */
function sanitiseBrandingRecord<T>(
	branding: unknown,
	sanitiseOverrides: (overrides: unknown, label: string) => T | undefined,
	blueprintId: BlueprintId,
	label: string
): Record<string, T> | undefined {
	if (!isPlainObject(branding)) {
		warnInvalid(blueprintId, `${label}.branding`, 'is not an object')
		return undefined
	}

	const entries: [string, T][] = []
	for (const [brandingId, overrides] of Object.entries<unknown>(branding)) {
		if (overrides === undefined) continue

		const sanitised = sanitiseOverrides(overrides, `${label}.branding["${brandingId}"]`)
		if (sanitised) entries.push([brandingId, sanitised])
	}

	return entries.length ? Object.fromEntries(entries) : undefined
}

/**
 * Sanitise the Brandings a document is limited to. Any which are not strings are dropped.
 * @returns The sanitised Brandings, or undefined when the value is not an array
 */
function sanitiseOnlyValidForBranding(value: unknown, blueprintId: BlueprintId, label: string): string[] | undefined {
	if (!Array.isArray(value)) {
		warnInvalid(blueprintId, `${label}.onlyValidForBranding`, 'is not an array')
		return undefined
	}

	const brandingIds = value.filter((v): v is string => typeof v === 'string')
	if (brandingIds.length !== value.length) {
		warnInvalid(blueprintId, `${label}.onlyValidForBranding`, 'contains values which are not strings')
	}
	return brandingIds
}

/**
 * Replace a property with its sanitised value, or remove it when that is undefined.
 * Properties which are absent, or explicitly undefined, are left untouched so that partial updates can clear them.
 */
function sanitiseProperty<TDoc extends object>(
	doc: TDoc,
	property: keyof TDoc & string,
	sanitise: (value: unknown) => unknown
): void {
	const value = doc[property]
	if (value === undefined) return

	const sanitised = sanitise(value)
	if (sanitised === undefined) {
		delete doc[property]
	} else {
		doc[property] = sanitised as TDoc[typeof property]
	}
}

/**
 * Sanitise the Branding properties of a Part from a Blueprint, in place
 * @param part Part, or partial update to a Part, to sanitise
 * @param blueprintId Id of the Blueprint the Part is from
 * @param label Description of the Part, for any warnings
 */
export function sanitisePartBrandingFromBlueprint(
	part: { branding?: Record<string, IBlueprintPartBranding> },
	blueprintId: BlueprintId,
	label: string
): void {
	sanitiseProperty(part, 'branding', (value) =>
		sanitiseBrandingRecord(
			value,
			(overrides, overridesLabel) => sanitiseProperties(overrides, partSanitisers, blueprintId, overridesLabel),
			blueprintId,
			label
		)
	)
}

/**
 * Sanitise the Branding properties of a Piece or AdLib Piece from a Blueprint, in place
 * @param piece Piece, or partial update to a Piece, to sanitise
 * @param blueprintId Id of the Blueprint the Piece is from
 * @param label Description of the Piece, for any warnings
 */
export function sanitisePieceBrandingFromBlueprint(
	piece: { branding?: Record<string, IBlueprintPieceBranding>; onlyValidForBranding?: string[] },
	blueprintId: BlueprintId,
	label: string
): void {
	sanitiseProperty(piece, 'onlyValidForBranding', (value) => sanitiseOnlyValidForBranding(value, blueprintId, label))
	sanitiseProperty(piece, 'branding', (value) =>
		sanitiseBrandingRecord(
			value,
			(overrides, overridesLabel) => sanitiseProperties(overrides, pieceSanitisers, blueprintId, overridesLabel),
			blueprintId,
			label
		)
	)
}

/**
 * Sanitise the Branding properties of an AdLib Action from a Blueprint, in place.
 * This also wraps the translatable messages of the overrides with the namespace of the Blueprint.
 * @param action AdLib Action to sanitise
 * @param blueprintId Id of the Blueprint the AdLib Action is from
 * @param label Description of the AdLib Action, for any warnings
 */
export function sanitiseActionBrandingFromBlueprint(
	action: { branding?: Record<string, IBlueprintActionManifestBranding>; onlyValidForBranding?: string[] },
	blueprintId: BlueprintId,
	label: string
): void {
	sanitiseProperty(action, 'onlyValidForBranding', (value) => sanitiseOnlyValidForBranding(value, blueprintId, label))
	sanitiseProperty(action, 'branding', (value) =>
		sanitiseBrandingRecord(
			value,
			(overrides, overridesLabel) => sanitiseActionOverrides(overrides, blueprintId, overridesLabel),
			blueprintId,
			label
		)
	)
}
