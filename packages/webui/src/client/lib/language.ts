import { TFunction } from 'i18next'

/** For phrases like "a, b, c, d or e" */
export function languageOr(t: TFunction, statements: string[]): string {
	if (statements.length === 0) return ''
	if (statements.length === 1) return statements[0]

	return t('{{prevStatements}} or {{finalStatement}}', {
		prevStatements: statements.slice(0, -1).join(', '),
		finalStatement: statements[statements.length - 1],
	})
}
/** For phrases like "a, b, c, d and e" */
export function languageAnd(t: TFunction, statements: string[]): string {
	if (statements.length === 0) return ''
	if (statements.length === 1) return statements[0]

	return t('{{prevStatements}} and {{finalStatement}}', {
		prevStatements: statements.slice(0, -1).join(', '),
		finalStatement: statements[statements.length - 1],
	})
}
