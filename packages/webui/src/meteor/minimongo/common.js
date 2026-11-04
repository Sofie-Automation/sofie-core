import EJSON from 'ejson'

export const hasOwn = Object.prototype.hasOwnProperty

export function expandArraysInBranches(branches, skipTheArrays) {
	const branchesOut = []

	branches.forEach((branch) => {
		const thisIsArray = Array.isArray(branch.value)

		// We include the branch itself, *UNLESS* we it's an array that we're going
		// to iterate and we're told to skip arrays.  (That's right, we include some
		// arrays even skipTheArrays is true: these are arrays that were found via
		// explicit numerical indices.)
		if (!(skipTheArrays && thisIsArray && !branch.dontIterate)) {
			branchesOut.push({ arrayIndices: branch.arrayIndices, value: branch.value })
		}

		if (thisIsArray && !branch.dontIterate) {
			branch.value.forEach((value, i) => {
				branchesOut.push({
					arrayIndices: (branch.arrayIndices || []).concat(i),
					value,
				})
			})
		}
	})

	return branchesOut
}

// Actually inserts a key value into the selector document
// However, this checks there is no ambiguity in setting
// the value for the given key, throws otherwise
function insertIntoDocument(document, key, value) {
	Object.keys(document).forEach((existingKey) => {
		if (
			(existingKey.length > key.length && existingKey.indexOf(`${key}.`) === 0) ||
			(key.length > existingKey.length && key.indexOf(`${existingKey}.`) === 0)
		) {
			throw new Error(
				`cannot infer query fields to set, both paths '${existingKey}' and ` + `'${key}' are matched`
			)
		} else if (existingKey === key) {
			throw new Error(`cannot infer query fields to set, path '${key}' is matched twice`)
		}
	})

	document[key] = value
}

export function isIndexable(obj) {
	return Array.isArray(obj) || _isPlainObject(obj)
}

export function isNumericKey(s) {
	return /^[0-9]+$/.test(s)
}

// Returns true if this is an object with at least one key and all keys begin
// with $.  Unless inconsistentOK is set, throws if some keys begin with $ and
// others don't.
export function isOperatorObject(valueSelector, inconsistentOK) {
	if (!_isPlainObject(valueSelector)) {
		return false
	}

	let theseAreOperators = undefined
	Object.keys(valueSelector).forEach((selKey) => {
		const thisIsOperator = selKey.substr(0, 1) === '$' || selKey === 'diff'

		if (theseAreOperators === undefined) {
			theseAreOperators = thisIsOperator
		} else if (theseAreOperators !== thisIsOperator) {
			if (!inconsistentOK) {
				throw new Error(`Inconsistent operator: ${JSON.stringify(valueSelector)}`)
			}

			theseAreOperators = false
		}
	})

	return !!theseAreOperators // {} has no operators
}

// makeLookupFunction(key) returns a lookup function.
//
// A lookup function takes in a document and returns an array of matching
// branches.  If no arrays are found while looking up the key, this array will
// have exactly one branches (possibly 'undefined', if some segment of the key
// was not found).
//
// If arrays are found in the middle, this can have more than one element, since
// we 'branch'. When we 'branch', if there are more key segments to look up,
// then we only pursue branches that are plain objects (not arrays or scalars).
// This means we can actually end up with no branches!
//
// We do *NOT* branch on arrays that are found at the end (ie, at the last
// dotted member of the key). We just return that array; if you want to
// effectively 'branch' over the array's values, post-process the lookup
// function with expandArraysInBranches.
//
// Each branch is an object with keys:
//  - value: the value at the branch
//  - dontIterate: an optional bool; if true, it means that 'value' is an array
//    that expandArraysInBranches should NOT expand. This specifically happens
//    when there is a numeric index in the key, and ensures the
//    perhaps-surprising MongoDB behavior where {'a.0': 5} does NOT
//    match {a: [[5]]}.
//  - arrayIndices: if any array indexing was done during lookup (either due to
//    explicit numeric indices or implicit branching), this will be an array of
//    the array indices used, from outermost to innermost; it is falsey or
//    absent if no array index is used. If an explicit numeric index is used,
//    the index will be followed in arrayIndices by the string 'x'.
//
//    Note: arrayIndices is used for two purposes. First, it is used to
//    implement the '$' modifier feature, which only ever looks at its first
//    element.
//
//    Second, it is used for sort key generation, which needs to be able to tell
//    the difference between different paths. Moreover, it needs to
//    differentiate between explicit and implicit branching, which is why
//    there's the somewhat hacky 'x' entry: this means that explicit and
//    implicit array lookups will have different full arrayIndices paths. (That
//    code only requires that different paths have different arrayIndices; it
//    doesn't actually 'parse' arrayIndices. As an alternative, arrayIndices
//    could contain objects with flags like 'implicit', but I think that only
//    makes the code surrounding them more complex.)
//
//    (By the way, this field ends up getting passed around a lot without
//    cloning, so never mutate any arrayIndices field/var in this package!)
//
//
// At the top level, you may only pass in a plain object or array.
//
// See the test 'minimongo - lookup' for some examples of what lookup functions
// return.
export function makeLookupFunction(key, options = {}) {
	const parts = key.split('.')
	const firstPart = parts.length ? parts[0] : ''
	const lookupRest = parts.length > 1 && makeLookupFunction(parts.slice(1).join('.'), options)

	const omitUnnecessaryFields = (result) => {
		if (!result.dontIterate) {
			delete result.dontIterate
		}

		if (result.arrayIndices && !result.arrayIndices.length) {
			delete result.arrayIndices
		}

		return result
	}

	// Doc will always be a plain object or an array.
	// apply an explicit numeric index, an array.
	return (doc, arrayIndices = []) => {
		if (Array.isArray(doc)) {
			// If we're being asked to do an invalid lookup into an array (non-integer
			// or out-of-bounds), return no results (which is different from returning
			// a single undefined result, in that `null` equality checks won't match).
			if (!(isNumericKey(firstPart) && firstPart < doc.length)) {
				return []
			}

			// Remember that we used this array index. Include an 'x' to indicate that
			// the previous index came from being considered as an explicit array
			// index (not branching).
			arrayIndices = arrayIndices.concat(+firstPart, 'x')
		}

		// Do our first lookup.
		const firstLevel = doc[firstPart]

		// If there is no deeper to dig, return what we found.
		//
		// If what we found is an array, most value selectors will choose to treat
		// the elements of the array as matchable values in their own right, but
		// that's done outside of the lookup function. (Exceptions to this are $size
		// and stuff relating to $elemMatch.  eg, {a: {$size: 2}} does not match {a:
		// [[1, 2]]}.)
		//
		// That said, if we just did an *explicit* array lookup (on doc) to find
		// firstLevel, and firstLevel is an array too, we do NOT want value
		// selectors to iterate over it.  eg, {'a.0': 5} does not match {a: [[5]]}.
		// So in that case, we mark the return value as 'don't iterate'.
		if (!lookupRest) {
			return [
				omitUnnecessaryFields({
					arrayIndices,
					dontIterate: Array.isArray(doc) && Array.isArray(firstLevel),
					value: firstLevel,
				}),
			]
		}

		// We need to dig deeper.  But if we can't, because what we've found is not
		// an array or plain object, we're done. If we just did a numeric index into
		// an array, we return nothing here (this is a change in Mongo 2.5 from
		// Mongo 2.4, where {'a.0.b': null} stopped matching {a: [5]}). Otherwise,
		// return a single `undefined` (which can, for example, match via equality
		// with `null`).
		if (!isIndexable(firstLevel)) {
			if (Array.isArray(doc)) {
				return []
			}

			return [omitUnnecessaryFields({ arrayIndices, value: undefined })]
		}

		const result = []
		const appendToResult = (more) => {
			result.push(...more)
		}

		// Dig deeper: look up the rest of the parts on whatever we've found.
		// (lookupRest is smart enough to not try to do invalid lookups into
		// firstLevel if it's an array.)
		appendToResult(lookupRest(firstLevel, arrayIndices))

		// If we found an array, then in *addition* to potentially treating the next
		// part as a literal integer lookup, we should also 'branch': try to look up
		// the rest of the parts on each array element in parallel.
		//
		// In this case, we *only* dig deeper into array elements that are plain
		// objects. (Recall that we only got this far if we have further to dig.)
		// This makes sense: we certainly don't dig deeper into non-indexable
		// objects. And it would be weird to dig into an array: it's simpler to have
		// a rule that explicit integer indexes only apply to an outer array, not to
		// an array you find after a branching search.
		//
		// In the special case of a numeric part in a *sort selector* (not a query
		// selector), we skip the branching: we ONLY allow the numeric part to mean
		// 'look up this index' in that case, not 'also look up this index in all
		// the elements of the array'.
		if (Array.isArray(firstLevel) && !(isNumericKey(parts[1]) && options.forSort)) {
			firstLevel.forEach((branch, arrayIndex) => {
				if (_isPlainObject(branch)) {
					appendToResult(lookupRest(branch, arrayIndices.concat(arrayIndex)))
				}
			})
		}

		return result
	}
}

export const _isPlainObject = (x) => {
	return x && bigBlobF._type(x) === 3
}

// Object exported only for unit testing.
// Use it to export private functions to test in Tinytest.
// MinimongoTest = {makeLookupFunction};
export const MinimongoError = (message, options = {}) => {
	if (typeof message === 'string' && options.field) {
		message += ` for field '${options.field}'`
	}

	const error = new Error(message)
	error.name = 'MinimongoError'
	return error
}

// paths - Array: list of mongo style paths
// newLeafFn - Function: of form function(path) should return a scalar value to
//                       put into list created for that path
// conflictFn - Function: of form function(node, path, fullPath) is called
//                        when building a tree path for 'fullPath' node on
//                        'path' was already a leaf with a value. Must return a
//                        conflict resolution.
// initial tree - Optional Object: starting tree.
// @returns - Object: tree represented as a set of nested objects
export function pathsToTree(paths, newLeafFn, conflictFn, root = {}) {
	paths.forEach((path) => {
		const pathArray = path.split('.')
		let tree = root

		// use .every just for iteration with break
		const success = pathArray.slice(0, -1).every((key, i) => {
			if (!hasOwn.call(tree, key)) {
				tree[key] = {}
			} else if (tree[key] !== Object(tree[key])) {
				tree[key] = conflictFn(tree[key], pathArray.slice(0, i + 1).join('.'), path)

				// break out of loop if we are failing for this path
				if (tree[key] !== Object(tree[key])) {
					return false
				}
			}

			tree = tree[key]

			return true
		})

		if (success) {
			const lastKey = pathArray[pathArray.length - 1]
			if (hasOwn.call(tree, lastKey)) {
				tree[lastKey] = conflictFn(tree[lastKey], path, path)
			} else {
				tree[lastKey] = newLeafFn(path)
			}
		}
	})

	return root
}

// Handles one key/value pair to put in the selector document
function populateDocumentWithKeyValue(document, key, value) {
	if (value && Object.getPrototypeOf(value) === Object.prototype) {
		populateDocumentWithObject(document, key, value)
	} else if (!(value instanceof RegExp)) {
		insertIntoDocument(document, key, value)
	}
}

// Handles a key, value pair to put in the selector document
// if the value is an object
function populateDocumentWithObject(document, key, value) {
	const keys = Object.keys(value)
	const unprefixedKeys = keys.filter((op) => op[0] !== '$')

	if (unprefixedKeys.length > 0 || !keys.length) {
		// Literal (possibly empty) object ( or empty object )
		// Don't allow mixing '$'-prefixed with non-'$'-prefixed fields
		if (keys.length !== unprefixedKeys.length) {
			throw new Error(`unknown operator: ${unprefixedKeys[0]}`)
		}

		validateObject(value, key)
		insertIntoDocument(document, key, value)
	} else {
		Object.keys(value).forEach((op) => {
			const object = value[op]

			if (op === '$eq') {
				populateDocumentWithKeyValue(document, key, object)
			} else if (op === '$all') {
				// every value for $all should be dealt with as separate $eq-s
				object.forEach((element) => populateDocumentWithKeyValue(document, key, element))
			}
		})
	}
}

// Fills a document with certain fields from an upsert selector
export function populateDocumentWithQueryFields(query, document = {}) {
	if (Object.getPrototypeOf(query) === Object.prototype) {
		// handle implicit $and
		Object.keys(query).forEach((key) => {
			const value = query[key]

			if (key === '$and') {
				// handle explicit $and
				value.forEach((element) => populateDocumentWithQueryFields(element, document))
			} else if (key === '$or') {
				// handle $or nodes with exactly 1 child
				if (value.length === 1) {
					populateDocumentWithQueryFields(value[0], document)
				}
			} else if (key[0] !== '$') {
				// Ignore other '$'-prefixed logical selectors
				populateDocumentWithKeyValue(document, key, value)
			}
		})
	} else {
		// Handle meteor-specific shortcut for selecting _id
		if (selectorIsId(query)) {
			insertIntoDocument(document, '_id', query)
		}
	}

	return document
}

// Is this selector just shorthand for lookup by _id?
export function selectorIsId(selector) {
	return typeof selector === 'number' || typeof selector === 'string'
}

// Traverses the keys of passed projection and constructs a tree where all
// leaves are either all True or all False
// @returns Object:
//  - tree - Object - tree representation of keys involved in projection
//  (exception for '_id' as it is a special case handled separately)
//  - including - Boolean - "take only certain fields" type of projection
export function projectionDetails(fields) {
	// Find the non-_id keys (_id is handled specially because it is included
	// unless explicitly excluded). Sort the keys, so that our code to detect
	// overlaps like 'foo' and 'foo.bar' can assume that 'foo' comes first.
	let fieldsKeys = Object.keys(fields).sort()

	// If _id is the only field in the projection, do not remove it, since it is
	// required to determine if this is an exclusion or exclusion. Also keep an
	// inclusive _id, since inclusive _id follows the normal rules about mixing
	// inclusive and exclusive fields. If _id is not the only field in the
	// projection and is exclusive, remove it so it can be handled later by a
	// special case, since exclusive _id is always allowed.
	if (!(fieldsKeys.length === 1 && fieldsKeys[0] === '_id') && !(fieldsKeys.includes('_id') && fields._id)) {
		fieldsKeys = fieldsKeys.filter((key) => key !== '_id')
	}

	let including = null // Unknown

	fieldsKeys.forEach((keyPath) => {
		const rule = !!fields[keyPath]

		if (including === null) {
			including = rule
		}

		// This error message is copied from MongoDB shell
		if (including !== rule) {
			throw MinimongoError('You cannot currently mix including and excluding fields.')
		}
	})

	const projectionRulesTree = pathsToTree(
		fieldsKeys,
		(path) => including,
		(node, path, fullPath) => {
			// Check passed projection fields' keys: If you have two rules such as
			// 'foo.bar' and 'foo.bar.baz', then the result becomes ambiguous. If
			// that happens, there is a probability you are doing something wrong,
			// framework should notify you about such mistake earlier on cursor
			// compilation step than later during runtime.  Note, that real mongo
			// doesn't do anything about it and the later rule appears in projection
			// project, more priority it takes.
			//
			// Example, assume following in mongo shell:
			// > db.coll.insert({ a: { b: 23, c: 44 } })
			// > db.coll.find({}, { 'a': 1, 'a.b': 1 })
			// {"_id": ObjectId("520bfe456024608e8ef24af3"), "a": {"b": 23}}
			// > db.coll.find({}, { 'a.b': 1, 'a': 1 })
			// {"_id": ObjectId("520bfe456024608e8ef24af3"), "a": {"b": 23, "c": 44}}
			//
			// Note, how second time the return set of keys is different.
			const currentPath = fullPath
			const anotherPath = path
			throw MinimongoError(
				`both ${currentPath} and ${anotherPath} found in fields option, ` +
					'using both of them may trigger unexpected behavior. Did you mean to ' +
					'use only one of them?'
			)
		}
	)

	return { including, tree: projectionRulesTree }
}

// Validates the key in a path.
// Objects that are nested more then 1 level cannot have dotted fields
// or fields starting with '$'
function validateKeyInPath(key, path) {
	if (key.includes('.')) {
		throw new Error(`The dotted field '${key}' in '${path}.${key} is not valid for storage.`)
	}

	if (key[0] === '$') {
		throw new Error(`The dollar ($) prefixed field  '${path}.${key} is not valid for storage.`)
	}
}

// Recursively validates an object that is nested more than one level deep
function validateObject(object, path) {
	if (object && Object.getPrototypeOf(object) === Object.prototype) {
		Object.keys(object).forEach((key) => {
			validateKeyInPath(key, path)
			validateObject(object[key], path + '.' + key)
		})
	}
}

const Decimal = /*Package['mongo-decimal']?.Decimal ||*/ class DecimalStub {}

export const bigBlobF = {
	// XXX for _all and _in, consider building 'inquery' at compile time..
	_type(v) {
		if (typeof v === 'number') {
			return 1
		}

		if (typeof v === 'string') {
			return 2
		}

		if (typeof v === 'boolean') {
			return 8
		}

		if (Array.isArray(v)) {
			return 4
		}

		if (v === null) {
			return 10
		}

		// note that typeof(/x/) === "object"
		if (v instanceof RegExp) {
			return 11
		}

		if (typeof v === 'function') {
			return 13
		}

		if (v instanceof Date) {
			return 9
		}

		if (EJSON.isBinary(v)) {
			return 5
		}

		if (v instanceof Decimal) {
			return 1
		}

		// object
		return 3

		// XXX support some/all of these:
		// 14, symbol
		// 15, javascript code with scope
		// 16, 18: 32-bit/64-bit integer
		// 17, timestamp
		// 255, minkey
		// 127, maxkey
	},

	// deep equality test: use for literal document and array matches
	_equal(a, b) {
		return EJSON.equals(a, b, { keyOrderSensitive: true })
	},

	// maps a type code to a value that can be used to sort values of different
	// types
	_typeorder(t) {
		// http://www.mongodb.org/display/DOCS/What+is+the+Compare+Order+for+BSON+Types
		// XXX what is the correct sort position for Javascript code?
		// ('100' in the matrix below)
		// XXX minkey/maxkey
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
	},

	// compare two values of unknown type according to BSON ordering
	// semantics. (as an extension, consider 'undefined' to be less than
	// any other value.) return negative if a is less, positive if b is
	// less, or 0 if equal
	_cmp(a, b) {
		if (a === undefined) {
			return b === undefined ? 0 : -1
		}

		if (b === undefined) {
			return 1
		}

		let ta = bigBlobF._type(a)
		let tb = bigBlobF._type(b)

		const oa = bigBlobF._typeorder(ta)
		const ob = bigBlobF._typeorder(tb)

		if (oa !== ob) {
			return oa < ob ? -1 : 1
		}

		// XXX need to implement this if we implement Symbol or integers, or
		// Timestamp
		if (ta !== tb) {
			throw Error('Missing type coercion logic in _cmp')
		}

		if (ta === 7) {
			// ObjectID
			// Convert to string.
			ta = tb = 2
			a = a.toHexString()
			b = b.toHexString()
		}

		if (ta === 9) {
			// Date
			// Convert to millis.
			ta = tb = 1
			a = a.getTime()
			b = b.getTime()
		}

		if (ta === 1) {
			// double
			if (a instanceof Decimal) {
				return a.minus(b).toNumber()
			} else {
				return a - b
			}
		}

		if (tb === 2)
			// string
			return a < b ? -1 : a === b ? 0 : 1

		if (ta === 3) {
			// Object
			// this could be much more efficient in the expected case ...
			const toArray = (object) => {
				const result = []

				Object.keys(object).forEach((key) => {
					result.push(key, object[key])
				})

				return result
			}

			return bigBlobF._cmp(toArray(a), toArray(b))
		}

		if (ta === 4) {
			// Array
			for (let i = 0; ; i++) {
				if (i === a.length) {
					return i === b.length ? 0 : -1
				}

				if (i === b.length) {
					return 1
				}

				const s = bigBlobF._cmp(a[i], b[i])
				if (s !== 0) {
					return s
				}
			}
		}

		if (ta === 5) {
			// binary
			// Surprisingly, a small binary blob is always less than a large one in
			// Mongo.
			if (a.length !== b.length) {
				return a.length - b.length
			}

			for (let i = 0; i < a.length; i++) {
				if (a[i] < b[i]) {
					return -1
				}

				if (a[i] > b[i]) {
					return 1
				}
			}

			return 0
		}

		if (ta === 8) {
			// boolean
			if (a) {
				return b ? 0 : 1
			}

			return b ? -1 : 0
		}

		if (ta === 10)
			// null
			return 0

		if (ta === 11)
			// regexp
			throw Error('Sorting not supported on regular expression') // XXX

		// 13: javascript code
		// 14: symbol
		// 15: javascript code with scope
		// 16: 32-bit integer
		// 17: timestamp
		// 18: 64-bit integer
		// 255: minkey
		// 127: maxkey
		if (ta === 13)
			// javascript code
			throw Error('Sorting not supported on Javascript code') // XXX

		throw Error('Unknown type to sort')
	},
}
