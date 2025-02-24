import _ = require('underscore')

export function arePropertiesShallowEqual<T extends Record<string, any>>(
	a: T,
	b: Partial<T>,
	omitProperties?: readonly (keyof T)[],
	selectProperties?: readonly (keyof T)[]
): boolean {
	if (typeof a !== 'object' || a == null || typeof b !== 'object' || b == null) {
		return false
	}

	const keysA = Object.keys(a).filter(
		omitProperties
			? (key) => !omitProperties.includes(key)
			: selectProperties
			? (key) => selectProperties.includes(key)
			: () => true
	)
	const keysB = Object.keys(b).filter(
		omitProperties
			? (key) => !omitProperties.includes(key)
			: selectProperties
			? (key) => selectProperties.includes(key)
			: () => true
	)

	if (keysA.length !== keysB.length) return false

	for (const key of keysA) {
		if (!keysB.includes(key) || a[key] !== b[key]) {
			return false
		}
	}

	return true
}

export function arePropertiesDeepEqual<T extends Record<string, any>>(
	a: T,
	b: Partial<T>,
	omitProperties?: readonly (keyof T)[],
	selectProperties?: readonly (keyof T)[]
): boolean {
	if (typeof a !== 'object' || a == null || typeof b !== 'object' || b == null) {
		return false
	}

	const keysA = Object.keys(a).filter(
		omitProperties
			? (key) => !omitProperties.includes(key)
			: selectProperties
			? (key) => selectProperties.includes(key)
			: () => true
	)
	const keysB = Object.keys(b).filter(
		omitProperties
			? (key) => !omitProperties.includes(key)
			: selectProperties
			? (key) => selectProperties.includes(key)
			: () => true
	)

	if (keysA.length !== keysB.length) {
		return false
	}

	for (const key of keysA) {
		if (!keysB.includes(key) || !_.isEqual(a[key], b[key])) {
			return false
		}
	}

	return true
}
