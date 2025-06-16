import { FieldNames } from '@sofie-automation/meteor-lib/dist/collections/lib'

/**
 * Allow only edits to the fields specified. Edits to any other fields will be rejected
 * @param doc
 * @param fieldNames
 * @param allowFields
 */
export function allowOnlyFields<T>(_doc: T, fieldNames: FieldNames<T>, allowFields: FieldNames<T>): boolean {
	// Note: _doc is only included to set the type T in this generic function
	for (const field of fieldNames) {
		if (allowFields.indexOf(field) === -1) {
			return false
		}
	}

	return true
}
/**
 * Don't allow edits to the fields specified. All other edits are approved
 * @param doc
 * @param fieldNames
 * @param rejectFields
 */
export function rejectFields<T>(_doc: T, fieldNames: FieldNames<T>, rejectFields: FieldNames<T>): boolean {
	// Note: _doc is only included to set the type T in this generic function
	for (const field of fieldNames) {
		if (rejectFields.indexOf(field) !== -1) {
			return false
		}
	}

	return true
}
