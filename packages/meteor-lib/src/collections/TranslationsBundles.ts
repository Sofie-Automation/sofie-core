import { TranslationsBundleType } from '@sofie-automation/blueprints-integration'
import { TranslationsBundleId, TranslationsBundleOriginId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export type Translation = { original: string; translation: string }

/**
 * Interface for the DB collection type for translation bundles.
 *
 * Note that this interface is slightly divergent from the TranslationsBundle
 * type used by the blueprints, specifically in the data property.
 *
 * The reason for this is that (Mini)Mongo does not allow property names with dots,
 * so using the literal original strings (which frequently have punctuation) as
 * property names won't work. Therefore it is stored to the database as an array
 * of object with explicitly names original and translated properties.
 */
export interface TranslationsBundle {
	_id: TranslationsBundleId

	type: TranslationsBundleType

	/** the id of the blueprint the translations were bundled with */
	originId: TranslationsBundleOriginId

	/** language code (example: 'nb'), annotates what language the translations are for */
	language: string
	/** optional namespace for the bundle */
	namespace?: string
	/** encoding used for the data, typically utf-8 */
	encoding?: string

	/** A unique hash of the `data` object, to signal that the contents have updated */
	hash: string

	/** the actual translations */
	data: Translation[]
}
