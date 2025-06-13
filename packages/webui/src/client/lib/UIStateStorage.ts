import * as _ from 'underscore'

export namespace UIStateStorage {
	let _collapsedState: {
		[key: string]: {
			_modified: number | null
			[key: string]: boolean | BooleanMap | string | number | null
		}
	} = {}
	const NAMESPACE = 'uiState'
	const EXPIRATION_DATE = 90 * 24 * 60 * 60 * 1000

	type BooleanMap = {
		[key: string]: boolean
	}

	// Remove legacy storage for collapsedItems
	localStorage.removeItem('collapsedItems')
	try {
		_collapsedState = JSON.parse(localStorage.getItem(NAMESPACE) || '') || {}
	} catch (e) {
		_collapsedState = {}
	}
	_cleanUp()

	export function setItem(
		scope: string,
		tag: string,
		value: boolean | BooleanMap | string | number | Record<string, any>,
		permament?: boolean
	): void {
		_collapsedState[scope] = _collapsedState[scope] || {}
		_collapsedState[scope]['_modified'] = permament ? null : Date.now()
		_collapsedState[scope][tag] = value
		_persist()
	}

	export function getItemRecord<T extends Record<string, any>>(scope: string, tag: string, defaultValue: T): T {
		return typeof (_collapsedState[scope] || {})[tag] === 'object'
			? (_collapsedState[scope][tag] as T)
			: defaultValue
	}

	export function getItemBooleanMap(scope: string, tag: string, defaultValue: BooleanMap): BooleanMap {
		return typeof (_collapsedState[scope] || {})[tag] === 'object'
			? (_collapsedState[scope][tag] as BooleanMap)
			: defaultValue
	}

	export function getItemBoolean(scope: string, tag: string, defaultValue: boolean): boolean {
		return typeof (_collapsedState[scope] || {})[tag] === 'boolean' ? !!_collapsedState[scope][tag] : defaultValue
	}

	export function getItemString(scope: string, tag: string, defaultValue: string): string {
		return typeof (_collapsedState[scope] || {})[tag] === 'string'
			? String(_collapsedState[scope][tag])
			: defaultValue
	}

	export function getItemNumber(scope: string, tag: string, defaultValue: number): number {
		return typeof (_collapsedState[scope] || {})[tag] === 'number'
			? Number(_collapsedState[scope][tag])
			: defaultValue
	}

	export function getItem(
		scope: string,
		tag: string,
		defaultValue: boolean | BooleanMap | string | number | undefined
	): boolean | BooleanMap | string | number | undefined {
		return (_collapsedState[scope] || {})[tag] !== undefined
			? _collapsedState[scope][tag] || undefined
			: defaultValue
	}

	function _persist() {
		localStorage.setItem(NAMESPACE, JSON.stringify(_collapsedState))
	}

	function _cleanUp() {
		_.each(_collapsedState, (object, key) => {
			const modified = object['_modified']
			if (modified === undefined || Date.now() - Number(modified) > EXPIRATION_DATE) {
				delete _collapsedState[key]
			}
		})
		_persist()
	}
}
