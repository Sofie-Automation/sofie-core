export { TranslationsBundle, TranslationsBundleType, I18NextData, ITranslatableMessage }

enum TranslationsBundleType {
	/** i18next JSON data */
	I18NEXT = 'i18next',
}

interface I18NextData {
	[key: string]: string
}

/**
 * A bundle of translations
 */
interface TranslationsBundle {
	type: TranslationsBundleType
	/** language code (example: 'nb'), annotates what language the translations are for */
	language: string
	/** optional namespace for the bundle */
	namespace?: string
	/** encoding used for the data, typically utf-8 */
	encoding?: string
	/** the actual translations as key/value pairs */
	data: I18NextData
}

interface ITranslatableMessage {
	key: string
	args?: { [key: string]: any }
}

export function isITranslatableMessage(obj: unknown): obj is ITranslatableMessage {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'key' in obj &&
		typeof (obj as any).key === 'string' &&
		(!('args' in obj) || (typeof (obj as any).args === 'object' && (obj as any).args !== null))
	)
}
