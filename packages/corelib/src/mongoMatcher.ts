/**
 * A compiled MongoDB selector matcher, shared by the server (via `mongoWhere`) and the webui (as minimongo's
 * `LocalCollection.Matcher`), so that the same selector gives the same answer everywhere.
 *
 * The selector is compiled once into a tree of functions, so testing many documents against it is cheap.
 *
 * Ported from Meteor's minimongo (`packages/minimongo/common.js` and `local_collection.js`),
 * Copyright (c) 2011 - present Meteor Software Ltd., MIT License: https://github.com/meteor/meteor/blob/devel/LICENSE
 *
 * Differences from minimongo:
 *  - `$where`, function selectors, `$near`/`$maxDistance`, the `$bits*` operators and Decimal/ObjectID/binary
 *    support are not implemented. Unknown operators throw.
 *  - `$regex` follows MongoDB: the `i`, `m`, `s`, `u` and `x` options are supported, and options given both on a
 *    RegExp and in `$options` are rejected.
 *  - A sub-document key named `diff` is not treated as an operator.
 *  - `$type` accepts the `number` alias, as MongoDB does.
 *  - Equality against a plain value, and `$in`/`$nin` with only plain values, have fast paths.
 */

function hasOwn(obj: object, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(obj, key)
}

/** The array indices followed to reach a value, outermost first. `'x'` follows an explicit numeric index. */
export type MongoArrayIndices = ReadonlyArray<number | 'x'>

export interface MongoMatchResult {
	result: boolean
	/** When matched through an array, the indices of the element that matched (used for the positional `$` update) */
	arrayIndices?: MongoArrayIndices
}

/** A value found by looking up a path in a document */
interface Branch {
	value: any
	arrayIndices?: MongoArrayIndices
	/** The value is an array that must not be expanded, as it was reached with an explicit numeric index */
	dontIterate?: boolean
}

/**
 * Every matcher can also have a boolean-only fast path. It must give the same `result`, but can skip building
 * branches and result objects, which is most of the cost of matching.
 */
type DocumentMatcher = ((doc: any) => MongoMatchResult) & {
	/** Equivalent to `matcher(doc).result` */
	test?: (doc: any) => boolean
}
type BranchedMatcher = ((branches: Branch[]) => MongoMatchResult) & {
	/** Equivalent to `matcher([{ value }]).result`: a value found with no arrays along the way */
	testValue?: (value: any) => boolean
}
/** Returns a number (an array index) from `$elemMatch`, which counts as a match */
type ElementMatcher = (value: any) => boolean | number
type LookupFunction = (doc: any, arrayIndices?: MongoArrayIndices) => Branch[]

interface ElementOperator {
	/** Don't expand arrays at the end of the path into their elements */
	dontExpandLeafArrays?: boolean
	/** Expand arrays at the end of the path into their elements, but don't test the array itself */
	dontIncludeLeafArrays?: boolean
	compileElementSelector(operand: any, valueSelector: Record<string, any>, matcher: MongoMatcher): ElementMatcher
}

type ValueOperator = (operand: any, valueSelector: Record<string, any>, matcher: MongoMatcher) => BranchedMatcher

type LogicalOperator = (subSelector: any, matcher: MongoMatcher, inElemMatch: boolean) => DocumentMatcher

/**
 * A compiled selector. Construct it once, then test documents with {@link documentMatches}.
 *
 * Has the same surface as minimongo's `LocalCollection.Matcher`, so that the webui can use it in its place.
 */
export class MongoMatcher {
	/** The document paths looked at by the selector */
	_paths: Record<string, true> = {}
	_hasGeoQuery = false
	_hasWhere = false
	/** False if the selector uses anything other than simple equality, or range/inclusion checks against plain values */
	_isSimple = true
	_matchingDocument: unknown = undefined
	/** The selector, with a plain id translated into `{ _id: id }` */
	_selector: unknown = null
	_isUpdate: boolean

	readonly #docMatcher: DocumentMatcher

	constructor(selector: unknown, isUpdate = false) {
		this.#docMatcher = this._compileSelector(selector)
		this._isUpdate = isUpdate
	}

	/** Test a document against the selector */
	documentMatches(doc: unknown): MongoMatchResult {
		if (doc !== Object(doc)) throw new Error('documentMatches needs a document')

		return this.#docMatcher(doc)
	}

	/** Whether the document matches the selector. Faster than {@link documentMatches}, when the details aren't needed */
	test(doc: unknown): boolean {
		if (doc !== Object(doc)) throw new Error('documentMatches needs a document')

		return testDocument(this.#docMatcher, doc)
	}

	hasGeoQuery(): boolean {
		return this._hasGeoQuery
	}

	hasWhere(): boolean {
		return this._hasWhere
	}

	isSimple(): boolean {
		return this._isSimple
	}

	_getPaths(): string[] {
		return Object.keys(this._paths)
	}

	_recordPathUsed(path: string): void {
		this._paths[path] = true
	}

	private _compileSelector(selector: unknown): DocumentMatcher {
		if (typeof selector === 'function') throw new Error('Function selectors are not supported')

		// Shorthand for a plain id
		if (selectorIsId(selector)) {
			this._selector = { _id: selector }
			this._recordPathUsed('_id')

			const idMatcher = equalityElementMatcher(selector)
			return withDocumentTest(
				(doc) => ({ result: !!idMatcher(doc._id) }),
				(doc) => !!idMatcher(doc._id)
			)
		}

		// Protect against dangerous selectors: a falsy selector, or `{ _id: falsy }`, are likely programmer errors
		// and not what you want, particularly for destructive operations
		if (!selector || (hasOwn(selector, '_id') && !(selector as any)._id)) {
			this._isSimple = false
			return nothingMatcher
		}

		// The top level can't be an array, or true, or binary
		if (Array.isArray(selector) || selector instanceof Uint8Array || typeof selector !== 'object') {
			throw new Error(`Invalid selector: ${JSON.stringify(selector)}`)
		}

		this._selector = selector

		return compileDocumentSelector(selector as Record<string, any>, this, { isRoot: true })
	}
}

// --- Operators ---------------------------------------------------------------------------------------------------

const ELEMENT_OPERATORS: Record<string, ElementOperator> = {
	$lt: makeInequality((cmpValue) => cmpValue < 0),
	$gt: makeInequality((cmpValue) => cmpValue > 0),
	$lte: makeInequality((cmpValue) => cmpValue <= 0),
	$gte: makeInequality((cmpValue) => cmpValue >= 0),
	$mod: {
		compileElementSelector(operand) {
			if (
				!(
					Array.isArray(operand) &&
					operand.length === 2 &&
					typeof operand[0] === 'number' &&
					typeof operand[1] === 'number'
				)
			) {
				throw new Error('argument to $mod must be an array of two numbers')
			}

			const divisor = operand[0]
			const remainder = operand[1]
			return (value) => typeof value === 'number' && value % divisor === remainder
		},
	},
	$in: {
		compileElementSelector(operand) {
			if (!Array.isArray(operand)) throw new Error('$in needs an array')

			if (operand.every(isPlainValue)) {
				// Fast path: a Set lookup, instead of testing every member in turn
				const members = new Set<unknown>(operand)
				// Allow `{a: {$in: [null]}}` to match when 'a' does not exist
				const includesNull = members.has(null)
				return (value) => (value == null ? includesNull : members.has(value))
			}

			const elementMatchers = operand.map((option) => {
				if (option instanceof RegExp) return regexpElementMatcher(normalizeRegExp(option, undefined))
				if (isOperatorObject(option)) throw new Error('cannot nest $ under $in')

				return equalityElementMatcher(option)
			})

			return (value) => {
				// Allow `{a: {$in: [null]}}` to match when 'a' does not exist
				if (value === undefined) value = null

				return elementMatchers.some((matcher) => matcher(value))
			}
		},
	},
	$size: {
		// `{a: [[5, 5]]}` must match `{a: {$size: 1}}` but not `{a: {$size: 2}}`, so the element `[5,5]` in the
		// leaf array `[[5,5]]` must not be considered as a possible value
		dontExpandLeafArrays: true,
		compileElementSelector(operand) {
			if (typeof operand === 'string') {
				// This is what MongoDB does, by experimentation
				operand = 0
			} else if (typeof operand !== 'number') {
				throw new Error('$size needs a number')
			}

			return (value) => Array.isArray(value) && value.length === operand
		},
	},
	$type: {
		// `{a: [5]}` must not match `{a: {$type: 4}}` (4 means array), but it should match `{a: {$type: 1}}` (1 means
		// number), and `{a: [[5]]}` must match `{a: {$type: 4}}`. So a leaf array should be expanded, but not
		// included itself
		dontIncludeLeafArrays: true,
		compileElementSelector(operand) {
			if (operand === 'number') {
				// The alias for any numeric type. All numbers are doubles here
				operand = TYPE_ALIASES.double
			} else if (typeof operand === 'string') {
				if (!hasOwn(TYPE_ALIASES, operand)) throw new Error(`unknown string alias for $type: ${operand}`)
				operand = TYPE_ALIASES[operand]
			} else if (typeof operand === 'number') {
				if (operand === 0 || operand < -1 || (operand > 19 && operand !== 127)) {
					throw new Error(`Invalid numerical $type code: ${operand}`)
				}
			} else {
				throw new Error('argument to $type is not a number or a string')
			}

			return (value) => value !== undefined && typeOf(value) === operand
		},
	},
	$regex: {
		compileElementSelector(operand, valueSelector) {
			if (!(typeof operand === 'string' || operand instanceof RegExp)) {
				throw new Error('$regex has to be a string or RegExp')
			}

			return regexpElementMatcher(normalizeRegExp(operand, valueSelector.$options))
		},
	},
	$elemMatch: {
		dontExpandLeafArrays: true,
		compileElementSelector(operand, _valueSelector, matcher) {
			if (!isPlainObject(operand)) throw new Error('$elemMatch need an object')

			const nonLogicalKeys: Record<string, unknown> = {}
			for (const key of Object.keys(operand)) {
				if (!hasOwn(LOGICAL_OPERATORS, key)) nonLogicalKeys[key] = operand[key]
			}
			const isDocMatcher = !isOperatorObject(nonLogicalKeys, true)

			// `{$elemMatch: {x: 3}}` means "an element has a field x:3", not "consists only of a field x:3", so this is
			// not the same as compileValueSelector(operand)
			const subMatcher = isDocMatcher
				? compileDocumentSelector(operand, matcher, { inElemMatch: true })
				: compileValueSelector(operand, matcher)

			return (value) => {
				if (!Array.isArray(value)) return false

				for (let i = 0; i < value.length; ++i) {
					const arrayElement = value[i]
					let arg: any
					if (isDocMatcher) {
						// `{$elemMatch: {b: 3}}` can only match objects, or arrays through numeric indices
						if (!isIndexable(arrayElement)) return false

						arg = arrayElement
					} else {
						// dontIterate ensures that `{a: {$elemMatch: {$gt: 5}}}` matches `{a: [8]}` but not `{a: [[8]]}`
						arg = [{ value: arrayElement, dontIterate: true }]
					}

					// A number is understood to mean "use this as the arrayIndices"
					if (subMatcher(arg).result) return i
				}

				return false
			}
		},
	},
}

/** Operators that appear at the top level of a document selector */
const LOGICAL_OPERATORS: Record<string, LogicalOperator> = {
	$and(subSelector, matcher, inElemMatch) {
		return andDocumentMatchers(compileArrayOfDocumentSelectors(subSelector, matcher, inElemMatch))
	},

	$or(subSelector, matcher, inElemMatch) {
		const matchers = compileArrayOfDocumentSelectors(subSelector, matcher, inElemMatch)

		// With only one matcher, use it directly, preserving any arrayIndices it returns
		if (matchers.length === 1) return matchers[0]

		// $or does not set arrayIndices when it has multiple sub-expressions (as MongoDB)
		const test = (doc: any) => matchers.some((fn) => testDocument(fn, doc))
		return withDocumentTest((doc) => ({ result: test(doc) }), test)
	},

	$nor(subSelector, matcher, inElemMatch) {
		const matchers = compileArrayOfDocumentSelectors(subSelector, matcher, inElemMatch)

		// Never sets arrayIndices, as this only matches if nothing in particular matched (as MongoDB)
		const test = (doc: any) => matchers.every((fn) => !testDocument(fn, doc))
		return withDocumentTest((doc) => ({ result: test(doc) }), test)
	},

	$where() {
		throw new Error('Operand "$where" is not implemented')
	},

	// A comment in the query, with no effect on the result
	$comment() {
		return everythingMatcher
	},
}

/**
 * Operators that apply to a path in a document, but which (unlike ELEMENT_OPERATORS) aren't simply "match each
 * branched value independently"
 */
const VALUE_OPERATORS: Record<string, ValueOperator> = {
	$eq(operand) {
		return convertElementMatcherToBranchedMatcher(equalityElementMatcher(operand))
	},
	$not(operand, _valueSelector, matcher) {
		return invertBranchedMatcher(compileValueSelector(operand, matcher))
	},
	$ne(operand) {
		return invertBranchedMatcher(convertElementMatcherToBranchedMatcher(equalityElementMatcher(operand)))
	},
	$nin(operand, valueSelector, matcher) {
		return invertBranchedMatcher(
			convertElementMatcherToBranchedMatcher(
				ELEMENT_OPERATORS.$in.compileElementSelector(operand, valueSelector, matcher)
			)
		)
	},
	$exists(operand) {
		const exists = convertElementMatcherToBranchedMatcher((value) => value !== undefined)
		return operand ? exists : invertBranchedMatcher(exists)
	},
	// Only provides options for $regex, whose logic is inside $regex
	$options(_operand, valueSelector) {
		if (!hasOwn(valueSelector, '$regex')) throw new Error('Operand "$options" requires a sibling "$regex"')

		return everythingMatcher
	},
	$all(operand, _valueSelector, matcher) {
		if (!Array.isArray(operand)) throw new Error('$all requires array')

		// This is what MongoDB does
		if (operand.length === 0) return nothingMatcher

		const branchedMatchers = operand.map((criterion) => {
			if (isOperatorObject(criterion)) throw new Error('no $ expressions in $all')

			// This is always a regexp or equality selector
			return compileValueSelector(criterion, matcher)
		})

		// Each criterion may match a different element
		return andBranchedMatchers(branchedMatchers)
	},
}

const TYPE_ALIASES: Record<string, number> = {
	double: 1,
	string: 2,
	object: 3,
	array: 4,
	binData: 5,
	undefined: 6,
	objectId: 7,
	bool: 8,
	date: 9,
	null: 10,
	regex: 11,
	dbPointer: 12,
	javascript: 13,
	symbol: 14,
	javascriptWithScope: 15,
	int: 16,
	timestamp: 17,
	long: 18,
	decimal: 19,
	minKey: -1,
	maxKey: 127,
}

// --- Compilation -------------------------------------------------------------------------------------------------

function compileDocumentSelector(
	docSelector: Record<string, any>,
	matcher: MongoMatcher,
	options: { inElemMatch?: boolean; isRoot?: boolean } = {}
): DocumentMatcher {
	const docMatchers: DocumentMatcher[] = []
	for (const key of Object.keys(docSelector)) {
		const subSelector = docSelector[key]

		if (key.startsWith('$')) {
			// Outer operators are logical operators, which recurse back into this function
			if (!hasOwn(LOGICAL_OPERATORS, key)) throw new Error(`Operand "${key}" is not implemented`)

			matcher._isSimple = false
			docMatchers.push(LOGICAL_OPERATORS[key](subSelector, matcher, !!options.inElemMatch))
			continue
		}

		// Inside an $elemMatch this is a path inside an object in an array, not in the document root
		if (!options.inElemMatch) matcher._recordPathUsed(key)

		// Ignore any part of a selector which is a function, as Meteor (and the node mongodb driver) do
		if (typeof subSelector === 'function') continue

		const lookUpByIndex = makeLookupFunction(key)
		const valueMatcher = compileValueSelector(subSelector, matcher)
		const docMatcher: DocumentMatcher = (doc) => valueMatcher(lookUpByIndex(doc))
		const lookUpPlainValue = makePlainValueLookup(key)

		docMatchers.push(
			withDocumentTest(docMatcher, (doc) => {
				const value = lookUpPlainValue(doc)
				return value === ARRAY_IN_PATH ? docMatcher(doc).result : testValue(valueMatcher, value)
			})
		)
	}

	return andDocumentMatchers(docMatchers)
}

function compileArrayOfDocumentSelectors(
	selectors: unknown,
	matcher: MongoMatcher,
	inElemMatch: boolean
): DocumentMatcher[] {
	if (!Array.isArray(selectors) || selectors.length === 0) throw new Error('$and/$or/$nor must be nonempty array')

	return selectors.map((subSelector) => {
		if (!isPlainObject(subSelector)) throw new Error('$or/$and/$nor entries need to be full objects')

		return compileDocumentSelector(subSelector, matcher, { inElemMatch })
	})
}

/**
 * Compile a selector for a value in a document: eg `{$gt: 5, $lt: 9}`, a regular expression, or any non-operator
 * value (meaning equality)
 */
function compileValueSelector(valueSelector: any, matcher: MongoMatcher): BranchedMatcher {
	if (valueSelector instanceof RegExp) {
		matcher._isSimple = false
		return convertElementMatcherToBranchedMatcher(regexpElementMatcher(normalizeRegExp(valueSelector, undefined)))
	}

	if (isOperatorObject(valueSelector)) return operatorBranchedMatcher(valueSelector, matcher)

	return convertElementMatcherToBranchedMatcher(equalityElementMatcher(valueSelector))
}

/** Compile an operator object (an object with `$` keys). Each operator must match, but possibly on different branches */
function operatorBranchedMatcher(valueSelector: Record<string, any>, matcher: MongoMatcher): BranchedMatcher {
	const operatorMatchers = Object.keys(valueSelector).map((operator) => {
		const operand = valueSelector[operator]

		const simpleRange = ['$lt', '$lte', '$gt', '$gte'].includes(operator) && typeof operand === 'number'
		const simpleEquality = ['$ne', '$eq'].includes(operator) && operand !== Object(operand)
		const simpleInclusion =
			['$in', '$nin'].includes(operator) &&
			Array.isArray(operand) &&
			!operand.some((x: unknown) => x === Object(x))

		if (!(simpleRange || simpleInclusion || simpleEquality)) matcher._isSimple = false

		if (hasOwn(VALUE_OPERATORS, operator)) {
			return VALUE_OPERATORS[operator](operand, valueSelector, matcher)
		}

		if (hasOwn(ELEMENT_OPERATORS, operator)) {
			const elementOperator = ELEMENT_OPERATORS[operator]
			return convertElementMatcherToBranchedMatcher(
				elementOperator.compileElementSelector(operand, valueSelector, matcher),
				elementOperator
			)
		}

		throw new Error(`Operand "${operator}" is not implemented`)
	})

	return andBranchedMatchers(operatorMatchers)
}

// --- Matcher combinators -----------------------------------------------------------------------------------------

function withDocumentTest(matcher: DocumentMatcher, test: (doc: any) => boolean): DocumentMatcher {
	matcher.test = test
	return matcher
}

function withValueTest(matcher: BranchedMatcher, test: (value: any) => boolean): BranchedMatcher {
	matcher.testValue = test
	return matcher
}

function testDocument(matcher: DocumentMatcher, doc: any): boolean {
	return matcher.test ? matcher.test(doc) : matcher(doc).result
}

function testValue(matcher: BranchedMatcher, value: any): boolean {
	return matcher.testValue ? matcher.testValue(value) : matcher([{ value }]).result
}

/** Matches anything. Usable as both a document matcher and a branched matcher */
const everythingMatcher = Object.assign((): MongoMatchResult => ({ result: true }), {
	test: () => true,
	testValue: () => true,
})

/** Matches nothing. Usable as both a document matcher and a branched matcher */
const nothingMatcher = Object.assign((): MongoMatchResult => ({ result: false }), {
	test: () => false,
	testValue: () => false,
})

/**
 * AND together matchers. Works for both document matchers and branched matchers, as both return result objects.
 * The arrayIndices of the last sub-matcher to return some are used, as MongoDB does.
 */
function andSomeMatchers<T>(subMatchers: Array<(arg: T) => MongoMatchResult>): (arg: T) => MongoMatchResult {
	return (docOrBranches) => {
		let arrayIndices: MongoArrayIndices | undefined
		for (const fn of subMatchers) {
			const subResult = fn(docOrBranches)
			if (!subResult.result) return { result: false }
			if (subResult.arrayIndices) arrayIndices = subResult.arrayIndices
		}
		return arrayIndices ? { result: true, arrayIndices } : { result: true }
	}
}

function andDocumentMatchers(subMatchers: DocumentMatcher[]): DocumentMatcher {
	if (subMatchers.length === 0) return everythingMatcher
	if (subMatchers.length === 1) return subMatchers[0]

	return withDocumentTest(andSomeMatchers(subMatchers), (doc) => {
		for (const fn of subMatchers) if (!testDocument(fn, doc)) return false
		return true
	})
}

function andBranchedMatchers(subMatchers: BranchedMatcher[]): BranchedMatcher {
	if (subMatchers.length === 0) return everythingMatcher
	if (subMatchers.length === 1) return subMatchers[0]

	return withValueTest(andSomeMatchers(subMatchers), (value) => {
		for (const fn of subMatchers) if (!testValue(fn, value)) return false
		return true
	})
}

/** A branched matcher that matches when the given one doesn't, on every branch */
function invertBranchedMatcher(branchedMatcher: BranchedMatcher): BranchedMatcher {
	// arrayIndices are dropped: "update the array element that does not match something" makes no sense
	return withValueTest(
		(branches) => ({ result: !branchedMatcher(branches).result }),
		(value) => !testValue(branchedMatcher, value)
	)
}

/**
 * Turn an element matcher (testing a single value) into a branched matcher, which tests every branch found by the
 * lookup, expanding arrays into their elements unless told not to.
 */
function convertElementMatcherToBranchedMatcher(
	elementMatcher: ElementMatcher,
	options: Pick<ElementOperator, 'dontExpandLeafArrays' | 'dontIncludeLeafArrays'> = {}
): BranchedMatcher {
	const testBranch = (branch: Branch): MongoMatchResult | undefined => {
		let matched = elementMatcher(branch.value)
		let arrayIndices = branch.arrayIndices

		// From $elemMatch: true, and use this as the array index if there isn't already one
		if (typeof matched === 'number') {
			if (!arrayIndices) arrayIndices = [matched]
			matched = true
		}

		if (!matched) return undefined
		return arrayIndices ? { result: true, arrayIndices } : { result: true }
	}

	const branchedMatcher: BranchedMatcher = (branches) => {
		// Fast path: the common case of a single value which isn't an array has nothing to expand
		if (branches.length === 1 && !Array.isArray(branches[0].value)) {
			return testBranch(branches[0]) ?? { result: false }
		}

		const expanded = options.dontExpandLeafArrays
			? branches
			: expandArraysInBranches(branches, options.dontIncludeLeafArrays)

		for (const branch of expanded) {
			const match = testBranch(branch)
			if (match) return match
		}
		return { result: false }
	}

	return withValueTest(branchedMatcher, (value) => {
		if (Array.isArray(value)) return branchedMatcher([{ value }]).result

		// A number is an array index from $elemMatch, which counts as a match
		const matched = elementMatcher(value)
		return matched === true || typeof matched === 'number'
	})
}

function expandArraysInBranches(branches: Branch[], skipTheArrays?: boolean): Branch[] {
	const branchesOut: Branch[] = []

	for (const branch of branches) {
		const thisIsArray = Array.isArray(branch.value)

		// Include the branch itself, unless it's an array that will be iterated and arrays are to be skipped. (Arrays
		// found through explicit numeric indices are included even then)
		if (!(skipTheArrays && thisIsArray && !branch.dontIterate)) {
			branchesOut.push(makeBranch(branch.value, branch.arrayIndices))
		}

		if (thisIsArray && !branch.dontIterate) {
			const arrayIndices = branch.arrayIndices ?? []
			branch.value.forEach((value: unknown, i: number) => {
				branchesOut.push({ arrayIndices: [...arrayIndices, i], value })
			})
		}
	}

	return branchesOut
}

// --- Element matchers --------------------------------------------------------------------------------------------

/** An element matcher for equality with something that isn't an operator object */
function equalityElementMatcher(elementSelector: unknown): ElementMatcher {
	if (isOperatorObject(elementSelector)) throw new Error("Can't create equalityValueSelector for operator object")

	// null and undefined are equal (a missing field matches null)
	if (elementSelector == null) return (value) => value == null

	// Fast path for plain values. NaN is equal to itself, as in EJSON
	if (typeof elementSelector === 'string' || typeof elementSelector === 'boolean') {
		return (value) => value === elementSelector
	}
	if (typeof elementSelector === 'number') {
		if (Number.isNaN(elementSelector)) return (value) => typeof value === 'number' && Number.isNaN(value)
		return (value) => value === elementSelector
	}

	return (value) => deepEqual(elementSelector, value)
}

function regexpElementMatcher(regexp: RegExp): ElementMatcher {
	return (value) => {
		if (value instanceof RegExp) return value.toString() === regexp.toString()

		// Regexps only work against strings
		if (typeof value !== 'string') return false

		return regexp.test(value)
	}
}

/** Helper for $lt/$gt/$lte/$gte */
function makeInequality(cmpValueComparator: (cmpValue: number) => boolean): ElementOperator {
	return {
		compileElementSelector(operand) {
			// Arrays never compare true with anything for an inequality
			if (Array.isArray(operand)) return () => false

			// undefined and null are the same (so true with $gte/$lte)
			if (operand === undefined) operand = null

			const operandType = typeOf(operand)

			return (value) => {
				if (value === undefined) value = null

				// Comparisons are never true among things of different types (except null vs undefined)
				if (typeOf(value) !== operandType) return false

				return cmpValueComparator(compareValues(value, operand))
			}
		},
	}
}

/**
 * Build the RegExp for a `$regex` (or a bare RegExp value), following MongoDB:
 *  - The `g`/`y` flags are stripped, because `RegExp.test` advances `lastIndex` with them set, which would make
 *    repeated matches against the same compiled selector return alternating results.
 *  - `$options` applies to a RegExp pattern too, but not when the RegExp carries its own flags.
 *  - MongoDB's `x` (extended) option has no JS equivalent, so it is applied by rewriting the pattern.
 */
function normalizeRegExp(pattern: string | RegExp, options: string | undefined): RegExp {
	let source = pattern instanceof RegExp ? pattern.source : pattern
	let flags = (pattern instanceof RegExp ? pattern.flags : '').replace(/[gy]/g, '')
	if (options) {
		if (flags) throw new Error('options set in both $regex and $options')
		// MongoDB only supports these; JS-only flags such as `g` would otherwise be accepted by `RegExp`
		const invalidOption = options.match(/[^imsux]/)
		if (invalidOption) throw new Error(`invalid flag in regex options: ${invalidOption[0]}`)
		flags = options
	}
	if (flags.includes('x')) {
		source = stripExtendedRegexSyntax(source)
		flags = flags.replace(/x/g, '')
	}
	return new RegExp(source, flags)
}

/**
 * Apply PCRE extended-mode (MongoDB's `x` option) to a pattern: unescaped whitespace, and `#` comments up to
 * the end of the line, are removed, except inside a character class.
 */
function stripExtendedRegexSyntax(source: string): string {
	let result = ''
	let inClass = false
	for (let i = 0; i < source.length; i++) {
		const char = source[i]
		if (char === '\\') {
			// Keep the escape and the escaped character verbatim
			result += source.slice(i, i + 2)
			i++
		} else if (inClass) {
			if (char === ']') inClass = false
			result += char
		} else if (char === '[') {
			inClass = true
			result += char
		} else if (char === '#') {
			while (i + 1 < source.length && source[i + 1] !== '\n') i++
		} else if (!/\s/.test(char)) {
			result += char
		}
	}
	return result
}

// --- Path lookup -------------------------------------------------------------------------------------------------

function makeBranch(value: unknown, arrayIndices: MongoArrayIndices | undefined, dontIterate?: boolean): Branch {
	const branch: Branch = { value }
	if (arrayIndices && arrayIndices.length) branch.arrayIndices = arrayIndices
	if (dontIterate) branch.dontIterate = true
	return branch
}

/**
 * Build a function to look up a (possibly dotted) path in a document, returning every value found ('branches').
 *
 * With no arrays in the way there is exactly one branch, possibly with an undefined value. Arrays in the middle of the
 * path branch out: the rest of the path is looked up both as a numeric index into the array (if it is one), and in
 * every element that is a plain object. Arrays at the end of the path are returned as they are, and are expanded into
 * their elements by {@link expandArraysInBranches} when matching.
 *
 * If an array was reached with an explicit numeric index, eg `{'a.0': 5}`, the branch is marked `dontIterate` so that
 * it doesn't match `{a: [[5]]}`, as in MongoDB.
 */
function makeLookupFunction(key: string): LookupFunction {
	const dotIndex = key.indexOf('.')
	const firstPart = dotIndex === -1 ? key : key.slice(0, dotIndex)
	const firstPartIsNumeric = isNumericKey(firstPart)
	const lookupRest = dotIndex === -1 ? undefined : makeLookupFunction(key.slice(dotIndex + 1))

	return (doc, arrayIndices = []) => {
		const docIsArray = Array.isArray(doc)
		if (docIsArray) {
			// An invalid lookup into an array (non-integer or out-of-bounds) returns no results, which is different
			// from returning a single undefined result, in that null equality checks won't match
			if (!(firstPartIsNumeric && Number(firstPart) < doc.length)) return []

			// The 'x' marks that the index came from an explicit array index, not from branching
			arrayIndices = [...arrayIndices, +firstPart, 'x']
		}

		const firstLevel = doc[firstPart]

		// Nothing deeper to look up. If an array was just indexed explicitly and the value is an array too, mark it
		// to not be iterated: `{'a.0': 5}` does not match `{a: [[5]]}`
		if (!lookupRest) return [makeBranch(firstLevel, arrayIndices, docIsArray && Array.isArray(firstLevel))]

		// Can't dig deeper into a value which isn't an array or plain object. After a numeric index into an array that
		// gives nothing, otherwise a single undefined (which can match null)
		if (!isIndexable(firstLevel)) {
			if (docIsArray) return []
			return [makeBranch(undefined, arrayIndices)]
		}

		const result = lookupRest(firstLevel, arrayIndices)

		// For an array, as well as treating the next part as an index into it, branch out: look up the rest of the path
		// in every element that is a plain object
		if (Array.isArray(firstLevel)) {
			firstLevel.forEach((branch, arrayIndex) => {
				if (isPlainObject(branch)) result.push(...lookupRest(branch, [...arrayIndices, arrayIndex]))
			})
		}

		return result
	}
}

/** Returned by a plain value lookup when the path passes through an array, so needs a full lookup */
const ARRAY_IN_PATH = Symbol('ARRAY_IN_PATH')

/**
 * Build a function to look up a (possibly dotted) path in a document, for the common case where there are no arrays
 * along the way. Then the lookup finds exactly one value, the same as {@link makeLookupFunction} would.
 * Returns {@link ARRAY_IN_PATH} if an array is met before the end of the path (or the document is an array), as that
 * needs the full lookup.
 */
function makePlainValueLookup(key: string): (doc: any) => unknown {
	const parts = key.split('.')
	if (parts.length === 1) {
		return (doc) => (Array.isArray(doc) ? ARRAY_IN_PATH : doc[key])
	}

	return (doc) => {
		let value = doc
		for (const part of parts) {
			if (Array.isArray(value)) return ARRAY_IN_PATH
			// Can't dig into a value which isn't a plain object (or array): the lookup gives a single undefined
			if (value !== doc && !isPlainObject(value)) return undefined
			value = value[part]
		}
		return value
	}
}

// --- Values ------------------------------------------------------------------------------------------------------

/** A string, number, boolean or null: compared by value, so usable in a Set */
function isPlainValue(value: unknown): boolean {
	return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function selectorIsId(selector: unknown): selector is string | number {
	return typeof selector === 'number' || typeof selector === 'string'
}

function isNumericKey(s: string): boolean {
	return /^[0-9]+$/.test(s)
}

function isPlainObject(x: unknown): x is Record<string, any> {
	return !!x && typeOf(x) === 3
}

function isIndexable(obj: unknown): boolean {
	return Array.isArray(obj) || isPlainObject(obj)
}

/**
 * True if this is an object with at least one key, and all of its keys begin with `$`. Unless `inconsistentOK` is set,
 * throws if some keys begin with `$` and others don't.
 */
function isOperatorObject(valueSelector: unknown, inconsistentOK?: boolean): valueSelector is Record<string, any> {
	if (!isPlainObject(valueSelector)) return false

	let theseAreOperators: boolean | undefined = undefined
	for (const selKey of Object.keys(valueSelector)) {
		const thisIsOperator = selKey.startsWith('$')

		if (theseAreOperators === undefined) {
			theseAreOperators = thisIsOperator
		} else if (theseAreOperators !== thisIsOperator) {
			if (!inconsistentOK) throw new Error(`Inconsistent operator: ${JSON.stringify(valueSelector)}`)

			theseAreOperators = false
		}
	}

	return !!theseAreOperators // {} has no operators
}

/** The BSON type number of a value */
function typeOf(v: unknown): number {
	if (typeof v === 'number') return 1
	if (typeof v === 'string') return 2
	if (typeof v === 'boolean') return 8
	if (Array.isArray(v)) return 4
	if (v === null) return 10
	// Note that typeof(/x/) === "object"
	if (v instanceof RegExp) return 11
	if (typeof v === 'function') return 13
	if (v instanceof Date) return 9
	if (v instanceof Uint8Array) return 5
	return 3 // object
}

/** Maps a type number to a value which orders values of different types, as MongoDB does */
function typeOrder(t: number): number {
	return [
		-1, // (not a type)
		1, // number
		2, // string
		3, // object
		4, // array
		5, // binary
		-1, // deprecated
		6, // ObjectID
		7, // bool
		8, // Date
		0, // null
		9, // RegExp
		-1, // deprecated
		100, // JS code
		2, // deprecated (symbol)
		100, // JS code
		1, // 32-bit int
		8, // Mongo timestamp
		1, // 64-bit int
	][t]
}

/**
 * Compare two values of any type, in BSON order. As an extension, undefined is less than any other value.
 * Returns a negative number if `a` is less, positive if `b` is less, or 0 if they are equal.
 */
function compareValues(a: any, b: any): number {
	if (a === undefined) return b === undefined ? 0 : -1
	if (b === undefined) return 1

	let ta = typeOf(a)
	const tb = typeOf(b)

	const oa = typeOrder(ta)
	const ob = typeOrder(tb)
	if (oa !== ob) return oa < ob ? -1 : 1

	if (ta !== tb) throw new Error('Missing type coercion logic in compareValues')

	if (ta === 9) {
		// Date: compare as millis
		ta = 1
		a = a.getTime()
		b = b.getTime()
	}

	if (ta === 1) return a - b // number

	if (ta === 2) return a < b ? -1 : a === b ? 0 : 1 // string

	if (ta === 3) {
		// Object: compare as a list of keys and values
		const toArray = (object: Record<string, unknown>) => Object.entries<unknown>(object).flat()
		return compareValues(toArray(a), toArray(b))
	}

	if (ta === 4) {
		// Array
		for (let i = 0; ; i++) {
			if (i === a.length) return i === b.length ? 0 : -1
			if (i === b.length) return 1

			const s = compareValues(a[i], b[i])
			if (s !== 0) return s
		}
	}

	if (ta === 5) {
		// Binary: a smaller blob is always less than a larger one, as in MongoDB
		if (a.length !== b.length) return a.length - b.length

		for (let i = 0; i < a.length; i++) {
			if (a[i] < b[i]) return -1
			if (a[i] > b[i]) return 1
		}

		return 0
	}

	if (ta === 8) {
		// boolean
		if (a) return b ? 0 : 1
		return b ? -1 : 0
	}

	if (ta === 10) return 0 // null

	if (ta === 11) throw new Error('Sorting not supported on regular expression')

	if (ta === 13) throw new Error('Sorting not supported on Javascript code')

	throw new Error('Unknown type to sort')
}

/**
 * Deep equality, as MongoDB compares embedded documents and arrays: sensitive to the order of keys.
 * Dates are equal when they are the same time, and NaN is equal to itself.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
	return deepEqualInner(a, b)
}

function deepEqualInner(a: any, b: any): boolean {
	if (a === b) return true
	if (Number.isNaN(a) && Number.isNaN(b)) return true
	if (!a || !b) return false
	if (typeof a !== 'object' || typeof b !== 'object') return false

	if (a instanceof Date || b instanceof Date) {
		return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
	}

	if (a instanceof Uint8Array || b instanceof Uint8Array) {
		if (!(a instanceof Uint8Array && b instanceof Uint8Array) || a.length !== b.length) return false
		for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
		return true
	}

	if (typeof a.equals === 'function') return a.equals(b)

	if (Array.isArray(a) || Array.isArray(b)) {
		if (!(Array.isArray(a) && Array.isArray(b)) || a.length !== b.length) return false
		for (let i = 0; i < a.length; i++) if (!deepEqualInner(a[i], b[i])) return false
		return true
	}

	const aKeys = Object.keys(a)
	const bKeys = Object.keys(b)
	if (aKeys.length !== bKeys.length) return false
	for (let i = 0; i < aKeys.length; i++) {
		if (aKeys[i] !== bKeys[i]) return false
		if (!deepEqualInner(a[aKeys[i]], b[bKeys[i]])) return false
	}
	return true
}
