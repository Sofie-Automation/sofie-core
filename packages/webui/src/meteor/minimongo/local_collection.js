import ObserveHandle from './observe_handle.js'
import {
	hasOwn,
	isIndexable,
	isNumericKey,
	isOperatorObject,
	populateDocumentWithQueryFields,
	projectionDetails,
	MinimongoError,
	compileDocumentSelector,
	nothingMatcher,
	expandArraysInBranches,
	makeLookupFunction,
	selectorIsId,
	bigBlobF,
	_isPlainObject,
} from './common.js'
import { Meteor } from '../meteor'
import EJSON from 'ejson'
import { MongoID } from '../mongo-id'
import { DiffSequence } from '../diff-sequence'
import { Tracker } from '../tracker'
import { IdMap } from './lib/id-map.js'
import { OrderedDict } from './lib/ordered-dict.js'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { SynchronousQueue } from './lib/synchronous-queue.js'

// XXX type checking on selectors (graceful error if malformed)

// LocalCollection: a set of documents that supports queries and modifiers.
export class LocalCollection {
	constructor(name) {
		this.name = name
		// _id -> document (also containing id)
		this._docs = new LocalCollection._IdMap()

		this._observeQueue = new SynchronousQueue()

		this.next_qid = 1 // live query id generator

		// qid -> live query object. keys:
		//  ordered: bool. ordered queries have addedBefore/movedBefore callbacks.
		//  results: array (ordered) or object (unordered) of current results
		//    (aliased with this._docs!)
		//  resultsSnapshot: snapshot of results. null if not paused.
		//  cursor: Cursor object for the query.
		//  selector, sorter, (callbacks): functions
		this.queries = Object.create(null)

		// null if not saving originals; an IdMap from id to original document value
		// if saving originals. See comments before saveOriginals().
		this._savedOriginals = null

		// True when observers are paused and we should not send callbacks.
		this.paused = false
	}

	// options may include sort, skip, limit, reactive
	// sort may be any of these forms:
	//     {a: 1, b: -1}
	//     [["a", "asc"], ["b", "desc"]]
	//     ["a", ["b", "desc"]]
	//   (in the first form you're beholden to key enumeration order in
	//   your javascript VM)
	//
	// reactive: if given, and false, don't register with Tracker (default
	// is true)
	//
	// XXX possibly should support retrieving a subset of fields? and
	// have it be a hint (ignored on the client, when not copying the
	// doc?)
	//
	// XXX sort does not yet support subkeys ('a.b') .. fix that!
	// XXX add one more sort form: "key"
	// XXX tests
	find(selector, options) {
		// default syntax for everything is to omit the selector argument.
		// but if selector is explicitly passed in as false or undefined, we
		// want a selector that matches nothing.
		if (arguments.length === 0) {
			selector = {}
		}

		return new LocalCollection.Cursor(this, selector, options)
	}

	findOne(selector, options = {}) {
		if (arguments.length === 0) {
			selector = {}
		}

		// NOTE: by setting limit 1 here, we end up using very inefficient
		// code that recomputes the whole query on each update. The upside is
		// that when you reactively depend on a findOne you only get
		// invalidated when the found object changes, not any object in the
		// collection. Most findOne will be by id, which has a fast path, so
		// this might not be a big deal. In most cases, invalidation causes
		// the called to re-query anyway, so this should be a net performance
		// improvement.
		options.limit = 1

		return this.find(selector, options).fetch()[0]
	}

	// XXX possibly enforce that 'undefined' does not appear (we assume
	// this in our handling of null and $exists)
	insert(doc, callback) {
		doc = EJSON.clone(doc)

		assertHasValidFieldNames(doc)

		// if you really want to use ObjectIDs, set this global.
		// Mongo.Collection specifies its own ids and does not use this code.
		if (!hasOwn.call(doc, '_id')) {
			doc._id = getRandomString()
		}

		const id = doc._id

		if (this._docs.has(id)) {
			throw MinimongoError(`Duplicate _id '${id}'`)
		}

		this._saveOriginal(id, undefined)
		this._docs.set(id, doc)

		const queriesToRecompute = []

		// trigger live queries that match
		Object.keys(this.queries).forEach((qid) => {
			const query = this.queries[qid]

			if (query.dirty) {
				return
			}

			const matchResult = query.matcher.documentMatches(doc)

			if (matchResult.result) {
				if (query.distances && matchResult.distance !== undefined) {
					query.distances.set(id, matchResult.distance)
				}

				if (query.cursor.skip || query.cursor.limit) {
					queriesToRecompute.push(qid)
				} else {
					LocalCollection._insertInResults(query, doc)
				}
			}
		})

		queriesToRecompute.forEach((qid) => {
			if (this.queries[qid]) {
				this._recomputeResults(this.queries[qid])
			}
		})

		this._observeQueue.drain()

		// Defer because the caller likely doesn't expect the callback to be run
		// immediately.
		if (callback) {
			Meteor.defer(() => {
				callback(null, id)
			})
		}

		return id
	}

	// Pause the observers. No callbacks from observers will fire until
	// 'resumeObservers' is called.
	pauseObservers() {
		// No-op if already paused.
		if (this.paused) {
			return
		}

		// Set the 'paused' flag such that new observer messages don't fire.
		this.paused = true

		// Take a snapshot of the query results for each query.
		Object.keys(this.queries).forEach((qid) => {
			const query = this.queries[qid]
			query.resultsSnapshot = EJSON.clone(query.results)
		})
	}

	remove(selector, callback) {
		// Easy special case: if we're not calling observeChanges callbacks and
		// we're not saving originals and we got asked to remove everything, then
		// just empty everything directly.
		if (this.paused && !this._savedOriginals && EJSON.equals(selector, {})) {
			const result = this._docs.size()

			this._docs.clear()

			Object.keys(this.queries).forEach((qid) => {
				const query = this.queries[qid]

				if (query.ordered) {
					query.results = []
				} else {
					query.results.clear()
				}
			})

			if (callback) {
				Meteor.defer(() => {
					callback(null, result)
				})
			}

			return result
		}

		const matcher = new LocalCollection.Matcher(selector)
		const remove = []

		this._eachPossiblyMatchingDoc(selector, (doc, id) => {
			if (matcher.documentMatches(doc).result) {
				remove.push(id)
			}
		})

		const queriesToRecompute = []
		const queryRemove = []

		for (let i = 0; i < remove.length; i++) {
			const removeId = remove[i]
			const removeDoc = this._docs.get(removeId)

			Object.keys(this.queries).forEach((qid) => {
				const query = this.queries[qid]

				if (query.dirty) {
					return
				}

				if (query.matcher.documentMatches(removeDoc).result) {
					if (query.cursor.skip || query.cursor.limit) {
						queriesToRecompute.push(qid)
					} else {
						queryRemove.push({ qid, doc: removeDoc })
					}
				}
			})

			this._saveOriginal(removeId, removeDoc)
			this._docs.remove(removeId)
		}

		// run live query callbacks _after_ we've removed the documents.
		queryRemove.forEach((remove) => {
			const query = this.queries[remove.qid]

			if (query) {
				query.distances && query.distances.remove(remove.doc._id)
				LocalCollection._removeFromResults(query, remove.doc)
			}
		})

		queriesToRecompute.forEach((qid) => {
			const query = this.queries[qid]

			if (query) {
				this._recomputeResults(query)
			}
		})

		this._observeQueue.drain()

		const result = remove.length

		if (callback) {
			Meteor.defer(() => {
				callback(null, result)
			})
		}

		return result
	}

	// Resume the observers. Observers immediately receive change
	// notifications to bring them to the current state of the
	// database. Note that this is not just replaying all the changes that
	// happened during the pause, it is a smarter 'coalesced' diff.
	resumeObservers() {
		// No-op if not paused.
		if (!this.paused) {
			return
		}

		// Unset the 'paused' flag. Make sure to do this first, otherwise
		// observer methods won't actually fire when we trigger them.
		this.paused = false

		Object.keys(this.queries).forEach((qid) => {
			const query = this.queries[qid]

			if (query.dirty) {
				query.dirty = false

				// re-compute results will perform `LocalCollection._diffQueryChanges`
				// automatically.
				this._recomputeResults(query, query.resultsSnapshot)
			} else {
				// Diff the current results against the snapshot and send to observers.
				// pass the query object for its observer callbacks.
				LocalCollection._diffQueryChanges(query.ordered, query.resultsSnapshot, query.results, query, {
					projectionFn: query.projectionFn,
				})
			}

			query.resultsSnapshot = null
		})

		this._observeQueue.drain()
	}

	retrieveOriginals() {
		if (!this._savedOriginals) {
			throw new Error('Called retrieveOriginals without saveOriginals')
		}

		const originals = this._savedOriginals

		this._savedOriginals = null

		return originals
	}

	// To track what documents are affected by a piece of code, call
	// saveOriginals() before it and retrieveOriginals() after it.
	// retrieveOriginals returns an object whose keys are the ids of the documents
	// that were affected since the call to saveOriginals(), and the values are
	// equal to the document's contents at the time of saveOriginals. (In the case
	// of an inserted document, undefined is the value.) You must alternate
	// between calls to saveOriginals() and retrieveOriginals().
	saveOriginals() {
		if (this._savedOriginals) {
			throw new Error('Called saveOriginals twice without retrieveOriginals')
		}

		this._savedOriginals = new LocalCollection._IdMap()
	}

	// XXX atomicity: if multi is true, and one modification fails, do
	// we rollback the whole operation, or what?
	update(selector, mod, options, callback) {
		if (!callback && options instanceof Function) {
			callback = options
			options = null
		}

		if (!options) {
			options = {}
		}

		const matcher = new LocalCollection.Matcher(selector, true)

		// Save the original results of any query that we might need to
		// _recomputeResults on, because _modifyAndNotify will mutate the objects in
		// it. (We don't need to save the original results of paused queries because
		// they already have a resultsSnapshot and we won't be diffing in
		// _recomputeResults.)
		const qidToOriginalResults = {}

		// We should only clone each document once, even if it appears in multiple
		// queries
		const docMap = new LocalCollection._IdMap()
		const idsMatched = LocalCollection._idsMatchedBySelector(selector)

		Object.keys(this.queries).forEach((qid) => {
			const query = this.queries[qid]

			if ((query.cursor.skip || query.cursor.limit) && !this.paused) {
				// Catch the case of a reactive `count()` on a cursor with skip
				// or limit, which registers an unordered observe. This is a
				// pretty rare case, so we just clone the entire result set with
				// no optimizations for documents that appear in these result
				// sets and other queries.
				if (query.results instanceof LocalCollection._IdMap) {
					qidToOriginalResults[qid] = query.results.clone()
					return
				}

				if (!(query.results instanceof Array)) {
					throw new Error('Assertion failed: query.results not an array')
				}

				// Clones a document to be stored in `qidToOriginalResults`
				// because it may be modified before the new and old result sets
				// are diffed. But if we know exactly which document IDs we're
				// going to modify, then we only need to clone those.
				const memoizedCloneIfNeeded = (doc) => {
					if (docMap.has(doc._id)) {
						return docMap.get(doc._id)
					}

					const docToMemoize =
						idsMatched && !idsMatched.some((id) => EJSON.equals(id, doc._id)) ? doc : EJSON.clone(doc)

					docMap.set(doc._id, docToMemoize)

					return docToMemoize
				}

				qidToOriginalResults[qid] = query.results.map(memoizedCloneIfNeeded)
			}
		})

		const recomputeQids = {}

		let updateCount = 0

		this._eachPossiblyMatchingDoc(selector, (doc, id) => {
			const queryResult = matcher.documentMatches(doc)

			if (queryResult.result) {
				// XXX Should we save the original even if mod ends up being a no-op?
				this._saveOriginal(id, doc)
				this._modifyAndNotify(doc, mod, recomputeQids, queryResult.arrayIndices)

				++updateCount

				if (!options.multi) {
					return false // break
				}
			}

			return true
		})

		Object.keys(recomputeQids).forEach((qid) => {
			const query = this.queries[qid]

			if (query) {
				this._recomputeResults(query, qidToOriginalResults[qid])
			}
		})

		this._observeQueue.drain()

		// If we are doing an upsert, and we didn't modify any documents yet, then
		// it's time to do an insert. Figure out what document we are inserting, and
		// generate an id for it.
		let insertedId
		if (updateCount === 0 && options.upsert) {
			const doc = LocalCollection._createUpsertDocument(selector, mod)
			if (!doc._id && options.insertedId) {
				doc._id = options.insertedId
			}

			insertedId = this.insert(doc)
			updateCount = 1
		}

		// Return the number of affected documents, or in the upsert case, an object
		// containing the number of affected docs and the id of the doc that was
		// inserted, if any.
		let result
		if (options._returnObject) {
			result = { numberAffected: updateCount }

			if (insertedId !== undefined) {
				result.insertedId = insertedId
			}
		} else {
			result = updateCount
		}

		if (callback) {
			Meteor.defer(() => {
				callback(null, result)
			})
		}

		return result
	}

	// A convenience wrapper on update. LocalCollection.upsert(sel, mod) is
	// equivalent to LocalCollection.update(sel, mod, {upsert: true,
	// _returnObject: true}).
	upsert(selector, mod, options, callback) {
		if (!callback && typeof options === 'function') {
			callback = options
			options = {}
		}

		return this.update(selector, mod, Object.assign({}, options, { upsert: true, _returnObject: true }), callback)
	}

	// Iterates over a subset of documents that could match selector; calls
	// fn(doc, id) on each of them.  Specifically, if selector specifies
	// specific _id's, it only looks at those.  doc is *not* cloned: it is the
	// same object that is in _docs.
	_eachPossiblyMatchingDoc(selector, fn) {
		const specificIds = LocalCollection._idsMatchedBySelector(selector)

		if (specificIds) {
			specificIds.some((id) => {
				const doc = this._docs.get(id)

				if (doc) {
					return fn(doc, id) === false
				}
			})
		} else {
			this._docs.forEach(fn)
		}
	}

	_modifyAndNotify(doc, mod, recomputeQids, arrayIndices) {
		const matched_before = {}

		Object.keys(this.queries).forEach((qid) => {
			const query = this.queries[qid]

			if (query.dirty) {
				return
			}

			if (query.ordered) {
				matched_before[qid] = query.matcher.documentMatches(doc).result
			} else {
				// Because we don't support skip or limit (yet) in unordered queries, we
				// can just do a direct lookup.
				matched_before[qid] = query.results.has(doc._id)
			}
		})

		const old_doc = EJSON.clone(doc)

		LocalCollection._modify(doc, mod, { arrayIndices })

		Object.keys(this.queries).forEach((qid) => {
			const query = this.queries[qid]

			if (query.dirty) {
				return
			}

			const afterMatch = query.matcher.documentMatches(doc)
			const after = afterMatch.result
			const before = matched_before[qid]

			if (after && query.distances && afterMatch.distance !== undefined) {
				query.distances.set(doc._id, afterMatch.distance)
			}

			if (query.cursor.skip || query.cursor.limit) {
				// We need to recompute any query where the doc may have been in the
				// cursor's window either before or after the update. (Note that if skip
				// or limit is set, "before" and "after" being true do not necessarily
				// mean that the document is in the cursor's output after skip/limit is
				// applied... but if they are false, then the document definitely is NOT
				// in the output. So it's safe to skip recompute if neither before or
				// after are true.)
				if (before || after) {
					recomputeQids[qid] = true
				}
			} else if (before && !after) {
				LocalCollection._removeFromResults(query, doc)
			} else if (!before && after) {
				LocalCollection._insertInResults(query, doc)
			} else if (before && after) {
				LocalCollection._updateInResults(query, doc, old_doc)
			}
		})
	}

	// Recomputes the results of a query and runs observe callbacks for the
	// difference between the previous results and the current results (unless
	// paused). Used for skip/limit queries.
	//
	// When this is used by insert or remove, it can just use query.results for
	// the old results (and there's no need to pass in oldResults), because these
	// operations don't mutate the documents in the collection. Update needs to
	// pass in an oldResults which was deep-copied before the modifier was
	// applied.
	//
	// oldResults is guaranteed to be ignored if the query is not paused.
	_recomputeResults(query, oldResults) {
		if (this.paused) {
			// There's no reason to recompute the results now as we're still paused.
			// By flagging the query as "dirty", the recompute will be performed
			// when resumeObservers is called.
			query.dirty = true
			return
		}

		if (!this.paused && !oldResults) {
			oldResults = query.results
		}

		if (query.distances) {
			query.distances.clear()
		}

		query.results = query.cursor._getRawObjects({
			distances: query.distances,
			ordered: query.ordered,
		})

		if (!this.paused) {
			LocalCollection._diffQueryChanges(query.ordered, oldResults, query.results, query, {
				projectionFn: query.projectionFn,
			})
		}
	}

	_saveOriginal(id, doc) {
		// Are we even trying to save originals?
		if (!this._savedOriginals) {
			return
		}

		// Have we previously mutated the original (and so 'doc' is not actually
		// original)?  (Note the 'has' check rather than truth: we store undefined
		// here for inserted docs!)
		if (this._savedOriginals.has(id)) {
			return
		}

		this._savedOriginals.set(id, EJSON.clone(doc))
	}
}

LocalCollection.ObserveHandle = ObserveHandle

// XXX maybe move these into another ObserveHelpers package or something

// _CachingChangeObserver is an object which receives observeChanges callbacks
// and keeps a cache of the current cursor state up to date in this.docs. Users
// of this class should read the docs field but not modify it. You should pass
// the "applyChange" field as the callbacks to the underlying observeChanges
// call. Optionally, you can specify your own observeChanges callbacks which are
// invoked immediately before the docs field is updated; this object is made
// available as `this` to those callbacks.
LocalCollection._CachingChangeObserver = class _CachingChangeObserver {
	constructor(options = {}) {
		const orderedFromCallbacks =
			options.callbacks && LocalCollection._observeChangesCallbacksAreOrdered(options.callbacks)

		if (hasOwn.call(options, 'ordered')) {
			this.ordered = options.ordered

			if (options.callbacks && options.ordered !== orderedFromCallbacks) {
				throw Error("ordered option doesn't match callbacks")
			}
		} else if (options.callbacks) {
			this.ordered = orderedFromCallbacks
		} else {
			throw Error('must provide ordered or callbacks')
		}

		const callbacks = options.callbacks || {}

		if (this.ordered) {
			this.docs = new OrderedDict(MongoID.idStringify)
			this.applyChange = {
				addedBefore: (id, fields, before) => {
					// Take a shallow copy since the top-level properties can be changed
					const doc = { ...fields }

					doc._id = id

					if (callbacks.addedBefore) {
						callbacks.addedBefore.call(this, id, EJSON.clone(fields), before)
					}

					// This line triggers if we provide added with movedBefore.
					if (callbacks.added) {
						callbacks.added.call(this, id, EJSON.clone(fields))
					}

					// XXX could `before` be a falsy ID?  Technically
					// idStringify seems to allow for them -- though
					// OrderedDict won't call stringify on a falsy arg.
					this.docs.putBefore(id, doc, before || null)
				},
				movedBefore: (id, before) => {
					const doc = this.docs.get(id)

					if (callbacks.movedBefore) {
						callbacks.movedBefore.call(this, id, before)
					}

					this.docs.moveBefore(id, before || null)
				},
			}
		} else {
			this.docs = new LocalCollection._IdMap()
			this.applyChange = {
				added: (id, fields) => {
					// Take a shallow copy since the top-level properties can be changed
					const doc = { ...fields }

					if (callbacks.added) {
						callbacks.added.call(this, id, EJSON.clone(fields))
					}

					doc._id = id

					this.docs.set(id, doc)
				},
			}
		}

		// The methods in _IdMap and OrderedDict used by these callbacks are
		// identical.
		this.applyChange.changed = (id, fields) => {
			const doc = this.docs.get(id)

			if (!doc) {
				throw new Error(`Unknown id for changed: ${id}`)
			}

			if (callbacks.changed) {
				callbacks.changed.call(this, id, EJSON.clone(fields))
			}

			DiffSequence.applyChanges(doc, fields)
		}

		this.applyChange.removed = (id) => {
			if (callbacks.removed) {
				callbacks.removed.call(this, id)
			}

			this.docs.remove(id)
		}
	}
}

LocalCollection._IdMap = class _IdMap extends IdMap {
	constructor() {
		super(MongoID.idStringify, MongoID.idParse)
	}
}

// XXX the sorted-query logic below is laughably inefficient. we'll
// need to come up with a better datastructure for this.
//
// XXX the logic for observing with a skip or a limit is even more
// laughably inefficient. we recompute the whole results every time!

// This binary search puts a value between any equal values, and the first
// lesser value.
LocalCollection._binarySearch = (cmp, array, value) => {
	let first = 0
	let range = array.length

	while (range > 0) {
		const halfRange = Math.floor(range / 2)

		if (cmp(value, array[first + halfRange]) >= 0) {
			first += halfRange + 1
			range -= halfRange + 1
		} else {
			range = halfRange
		}
	}

	return first
}

LocalCollection._checkSupportedProjection = (fields) => {
	if (fields !== Object(fields) || Array.isArray(fields)) {
		throw MinimongoError('fields option must be an object')
	}

	Object.keys(fields).forEach((keyPath) => {
		if (keyPath.split('.').includes('$')) {
			throw MinimongoError("Minimongo doesn't support $ operator in projections yet.")
		}

		const value = fields[keyPath]

		if (typeof value === 'object' && ['$elemMatch', '$meta', '$slice'].some((key) => hasOwn.call(value, key))) {
			throw MinimongoError("Minimongo doesn't support operators in projections yet.")
		}

		if (![1, 0, true, false].includes(value)) {
			throw MinimongoError('Projection values should be one of 1, 0, true, or false')
		}
	})
}

// Knows how to compile a fields projection to a predicate function.
// @returns - Function: a closure that filters out an object according to the
//            fields projection rules:
//            @param obj - Object: MongoDB-styled document
//            @returns - Object: a document with the fields filtered out
//                       according to projection rules. Doesn't retain subfields
//                       of passed argument.
LocalCollection._compileProjection = (fields) => {
	LocalCollection._checkSupportedProjection(fields)

	const _idProjection = fields._id === undefined ? true : fields._id
	const details = projectionDetails(fields)

	// returns transformed doc according to ruleTree
	const transform = (doc, ruleTree) => {
		// Special case for "sets"
		if (Array.isArray(doc)) {
			return doc.map((subdoc) => transform(subdoc, ruleTree))
		}

		const result = details.including ? {} : EJSON.clone(doc)

		Object.keys(ruleTree).forEach((key) => {
			if (doc == null || !hasOwn.call(doc, key)) {
				return
			}

			const rule = ruleTree[key]

			if (rule === Object(rule)) {
				// For sub-objects/subsets we branch
				if (doc[key] === Object(doc[key])) {
					result[key] = transform(doc[key], rule)
				}
			} else if (details.including) {
				// Otherwise we don't even touch this subfield
				result[key] = EJSON.clone(doc[key])
			} else {
				delete result[key]
			}
		})

		return doc != null ? result : doc
	}

	return (doc) => {
		const result = transform(doc, details.tree)

		if (_idProjection && hasOwn.call(doc, '_id')) {
			result._id = doc._id
		}

		if (!_idProjection && hasOwn.call(result, '_id')) {
			delete result._id
		}

		return result
	}
}

// Calculates the document to insert in case we're doing an upsert and the
// selector does not match any elements
LocalCollection._createUpsertDocument = (selector, modifier) => {
	const selectorDocument = populateDocumentWithQueryFields(selector)
	const isModify = LocalCollection._isModificationMod(modifier)

	const newDoc = {}

	if (selectorDocument._id) {
		newDoc._id = selectorDocument._id
		delete selectorDocument._id
	}

	// This double _modify call is made to help with nested properties (see issue
	// #8631). We do this even if it's a replacement for validation purposes (e.g.
	// ambiguous id's)
	LocalCollection._modify(newDoc, { $set: selectorDocument })
	LocalCollection._modify(newDoc, modifier, { isInsert: true })

	if (isModify) {
		return newDoc
	}

	// Replacement can take _id from query document
	const replacement = Object.assign({}, modifier)
	if (newDoc._id) {
		replacement._id = newDoc._id
	}

	return replacement
}

LocalCollection._diffObjects = (left, right, callbacks) => {
	return DiffSequence.diffObjects(left, right, callbacks)
}

// ordered: bool.
// old_results and new_results: collections of documents.
//    if ordered, they are arrays.
//    if unordered, they are IdMaps
LocalCollection._diffQueryChanges = (ordered, oldResults, newResults, observer, options) =>
	DiffSequence.diffQueryChanges(ordered, oldResults, newResults, observer, options)

LocalCollection._diffQueryOrderedChanges = (oldResults, newResults, observer, options) =>
	DiffSequence.diffQueryOrderedChanges(oldResults, newResults, observer, options)

LocalCollection._diffQueryUnorderedChanges = (oldResults, newResults, observer, options) =>
	DiffSequence.diffQueryUnorderedChanges(oldResults, newResults, observer, options)

LocalCollection._findInOrderedResults = (query, doc) => {
	if (!query.ordered) {
		throw new Error("Can't call _findInOrderedResults on unordered query")
	}

	for (let i = 0; i < query.results.length; i++) {
		if (query.results[i] === doc) {
			return i
		}
	}

	throw Error('object missing from query')
}

// If this is a selector which explicitly constrains the match by ID to a finite
// number of documents, returns a list of their IDs.  Otherwise returns
// null. Note that the selector may have other restrictions so it may not even
// match those document!  We care about $in and $and since those are generated
// access-controlled update and remove.
LocalCollection._idsMatchedBySelector = (selector) => {
	// Is the selector just an ID?
	if (LocalCollection._selectorIsId(selector)) {
		return [selector]
	}

	if (!selector) {
		return null
	}

	// Do we have an _id clause?
	if (hasOwn.call(selector, '_id')) {
		// Is the _id clause just an ID?
		if (LocalCollection._selectorIsId(selector._id)) {
			return [selector._id]
		}

		// Is the _id clause {_id: {$in: ["x", "y", "z"]}}?
		if (
			selector._id &&
			Array.isArray(selector._id.$in) &&
			selector._id.$in.length &&
			selector._id.$in.every(LocalCollection._selectorIsId)
		) {
			return selector._id.$in
		}

		return null
	}

	// If this is a top-level $and, and any of the clauses constrain their
	// documents, then the whole selector is constrained by any one clause's
	// constraint. (Well, by their intersection, but that seems unlikely.)
	if (Array.isArray(selector.$and)) {
		for (let i = 0; i < selector.$and.length; ++i) {
			const subIds = LocalCollection._idsMatchedBySelector(selector.$and[i])

			if (subIds) {
				return subIds
			}
		}
	}

	return null
}

LocalCollection._insertInResults = (query, doc) => {
	const fields = EJSON.clone(doc)

	delete fields._id

	if (query.ordered) {
		if (!query.sorter) {
			query.addedBefore(doc._id, query.projectionFn(fields), null)
			query.results.push(doc)
		} else {
			const i = LocalCollection._insertInSortedList(
				query.sorter.getComparator({ distances: query.distances }),
				query.results,
				doc
			)

			let next = query.results[i + 1]
			if (next) {
				next = next._id
			} else {
				next = null
			}

			query.addedBefore(doc._id, query.projectionFn(fields), next)
		}

		query.added(doc._id, query.projectionFn(fields))
	} else {
		query.added(doc._id, query.projectionFn(fields))
		query.results.set(doc._id, doc)
	}
}

LocalCollection._insertInSortedList = (cmp, array, value) => {
	if (array.length === 0) {
		array.push(value)
		return 0
	}

	const i = LocalCollection._binarySearch(cmp, array, value)

	array.splice(i, 0, value)

	return i
}

LocalCollection._isModificationMod = (mod) => {
	let isModify = false
	let isReplace = false

	Object.keys(mod).forEach((key) => {
		if (key.substr(0, 1) === '$') {
			isModify = true
		} else {
			isReplace = true
		}
	})

	if (isModify && isReplace) {
		throw new Error('Update parameter cannot have both modifier and non-modifier fields.')
	}

	return isModify
}

// XXX maybe this should be EJSON.isObject, though EJSON doesn't know about
// RegExp
// XXX note that _type(undefined) === 3!!!!
LocalCollection._isPlainObject = _isPlainObject

// XXX need a strategy for passing the binding of $ into this
// function, from the compiled selector
//
// maybe just {key.up.to.just.before.dollarsign: array_index}
//
// XXX atomicity: if one modification fails, do we roll back the whole
// change?
//
// options:
//   - isInsert is set when _modify is being called to compute the document to
//     insert as part of an upsert operation. We use this primarily to figure
//     out when to set the fields in $setOnInsert, if present.
LocalCollection._modify = (doc, modifier, options = {}) => {
	if (!LocalCollection._isPlainObject(modifier)) {
		throw MinimongoError('Modifier must be an object')
	}

	// Make sure the caller can't mutate our data structures.
	modifier = EJSON.clone(modifier)

	const isModifier = isOperatorObject(modifier)
	const newDoc = isModifier ? EJSON.clone(doc) : modifier

	if (isModifier) {
		// apply modifiers to the doc.
		Object.keys(modifier).forEach((operator) => {
			// Treat $setOnInsert as $set if this is an insert.
			const setOnInsert = options.isInsert && operator === '$setOnInsert'
			const modFunc = MODIFIERS[setOnInsert ? '$set' : operator]
			const operand = modifier[operator]

			if (!modFunc) {
				throw MinimongoError(`Invalid modifier specified ${operator}`)
			}

			Object.keys(operand).forEach((keypath) => {
				const arg = operand[keypath]

				if (keypath === '') {
					throw MinimongoError('An empty update path is not valid.')
				}

				const keyparts = keypath.split('.')

				if (!keyparts.every(Boolean)) {
					throw MinimongoError(
						`The update path '${keypath}' contains an empty field name, ` + 'which is not allowed.'
					)
				}

				const target = findModTarget(newDoc, keyparts, {
					arrayIndices: options.arrayIndices,
					forbidArray: operator === '$rename',
					noCreate: NO_CREATE_MODIFIERS[operator],
				})

				modFunc(target, keyparts.pop(), arg, keypath, newDoc)
			})
		})

		if (doc._id && !EJSON.equals(doc._id, newDoc._id)) {
			throw MinimongoError(
				`After applying the update to the document {_id: "${doc._id}", ...},` +
					" the (immutable) field '_id' was found to have been altered to " +
					`_id: "${newDoc._id}"`
			)
		}
	} else {
		if (doc._id && modifier._id && !EJSON.equals(doc._id, modifier._id)) {
			throw MinimongoError(
				`The _id field cannot be changed from {_id: "${doc._id}"} to ` + `{_id: "${modifier._id}"}`
			)
		}

		// replace the whole document
		assertHasValidFieldNames(modifier)
	}

	// move new document into place.
	Object.keys(doc).forEach((key) => {
		// Note: this used to be for (var key in doc) however, this does not
		// work right in Opera. Deleting from a doc while iterating over it
		// would sometimes cause opera to skip some keys.
		if (key !== '_id') {
			delete doc[key]
		}
	})

	Object.keys(newDoc).forEach((key) => {
		doc[key] = newDoc[key]
	})
}

LocalCollection._observeFromObserveChanges = (cursor, observeCallbacks) => {
	let suppressed = !!observeCallbacks._suppress_initial

	let observeChangesCallbacks
	if (LocalCollection._observeCallbacksAreOrdered(observeCallbacks)) {
		// The "_no_indices" option sets all index arguments to -1 and skips the
		// linear scans required to generate them.  This lets observers that don't
		// need absolute indices benefit from the other features of this API --
		// relative order, transforms, and applyChanges -- without the speed hit.
		const indices = !observeCallbacks._no_indices

		observeChangesCallbacks = {
			addedBefore(id, fields, before) {
				if (suppressed || !(observeCallbacks.addedAt || observeCallbacks.added)) {
					return
				}

				const doc = Object.assign(fields, { _id: id })

				if (observeCallbacks.addedAt) {
					observeCallbacks.addedAt(
						doc,
						indices ? (before ? this.docs.indexOf(before) : this.docs.size()) : -1,
						before
					)
				} else {
					observeCallbacks.added(doc)
				}
			},
			changed(id, fields) {
				if (!(observeCallbacks.changedAt || observeCallbacks.changed)) {
					return
				}

				let doc = EJSON.clone(this.docs.get(id))
				if (!doc) {
					throw new Error(`Unknown id for changed: ${id}`)
				}

				const oldDoc = EJSON.clone(doc)

				DiffSequence.applyChanges(doc, fields)

				if (observeCallbacks.changedAt) {
					observeCallbacks.changedAt(doc, oldDoc, indices ? this.docs.indexOf(id) : -1)
				} else {
					observeCallbacks.changed(doc, oldDoc)
				}
			},
			movedBefore(id, before) {
				if (!observeCallbacks.movedTo) {
					return
				}

				const from = indices ? this.docs.indexOf(id) : -1
				let to = indices ? (before ? this.docs.indexOf(before) : this.docs.size()) : -1

				// When not moving backwards, adjust for the fact that removing the
				// document slides everything back one slot.
				if (to > from) {
					--to
				}

				observeCallbacks.movedTo(EJSON.clone(this.docs.get(id)), from, to, before || null)
			},
			removed(id) {
				if (!(observeCallbacks.removedAt || observeCallbacks.removed)) {
					return
				}

				// technically maybe there should be an EJSON.clone here, but it's about
				// to be removed from this.docs!
				const doc = this.docs.get(id)

				if (observeCallbacks.removedAt) {
					observeCallbacks.removedAt(doc, indices ? this.docs.indexOf(id) : -1)
				} else {
					observeCallbacks.removed(doc)
				}
			},
		}
	} else {
		observeChangesCallbacks = {
			added(id, fields) {
				if (!suppressed && observeCallbacks.added) {
					observeCallbacks.added(Object.assign(fields, { _id: id }))
				}
			},
			changed(id, fields) {
				if (observeCallbacks.changed) {
					const oldDoc = this.docs.get(id)
					const doc = EJSON.clone(oldDoc)

					DiffSequence.applyChanges(doc, fields)

					observeCallbacks.changed(doc, EJSON.clone(oldDoc))
				}
			},
			removed(id) {
				if (observeCallbacks.removed) {
					observeCallbacks.removed(this.docs.get(id))
				}
			},
		}
	}

	const changeObserver = new LocalCollection._CachingChangeObserver({
		callbacks: observeChangesCallbacks,
	})

	// CachingChangeObserver clones all received input on its callbacks
	// So we can mark it as safe to reduce the ejson clones.
	// This is tested by the `mongo-livedata - (extended) scribbling` tests
	changeObserver.applyChange._fromObserve = true
	const handle = cursor.observeChanges(changeObserver.applyChange, { nonMutatingCallbacks: true })

	suppressed = false

	return handle
}

LocalCollection._observeCallbacksAreOrdered = (callbacks) => {
	if (callbacks.added && callbacks.addedAt) {
		throw new Error('Please specify only one of added() and addedAt()')
	}

	if (callbacks.changed && callbacks.changedAt) {
		throw new Error('Please specify only one of changed() and changedAt()')
	}

	if (callbacks.removed && callbacks.removedAt) {
		throw new Error('Please specify only one of removed() and removedAt()')
	}

	return !!(callbacks.addedAt || callbacks.changedAt || callbacks.movedTo || callbacks.removedAt)
}

LocalCollection._observeChangesCallbacksAreOrdered = (callbacks) => {
	if (callbacks.added && callbacks.addedBefore) {
		throw new Error('Please specify only one of added() and addedBefore()')
	}

	return !!(callbacks.addedBefore || callbacks.movedBefore)
}

LocalCollection._removeFromResults = (query, doc) => {
	if (query.ordered) {
		const i = LocalCollection._findInOrderedResults(query, doc)

		query.removed(doc._id)
		query.results.splice(i, 1)
	} else {
		const id = doc._id // in case callback mutates doc

		query.removed(doc._id)
		query.results.remove(id)
	}
}

// Is this selector just shorthand for lookup by _id?
LocalCollection._selectorIsId = selectorIsId

// Is the selector just lookup by _id (shorthand or not)?
LocalCollection._selectorIsIdPerhapsAsObject = (selector) =>
	LocalCollection._selectorIsId(selector) ||
	(LocalCollection._selectorIsId(selector && selector._id) && Object.keys(selector).length === 1)

LocalCollection._updateInResults = (query, doc, old_doc) => {
	if (!EJSON.equals(doc._id, old_doc._id)) {
		throw new Error("Can't change a doc's _id while updating")
	}

	const projectionFn = query.projectionFn
	const changedFields = DiffSequence.makeChangedFields(projectionFn(doc), projectionFn(old_doc))

	if (!query.ordered) {
		if (Object.keys(changedFields).length) {
			query.changed(doc._id, changedFields)
			query.results.set(doc._id, doc)
		}

		return
	}

	const old_idx = LocalCollection._findInOrderedResults(query, doc)

	if (Object.keys(changedFields).length) {
		query.changed(doc._id, changedFields)
	}

	if (!query.sorter) {
		return
	}

	// just take it out and put it back in again, and see if the index changes
	query.results.splice(old_idx, 1)

	const new_idx = LocalCollection._insertInSortedList(
		query.sorter.getComparator({ distances: query.distances }),
		query.results,
		doc
	)

	if (old_idx !== new_idx) {
		let next = query.results[new_idx + 1]
		if (next) {
			next = next._id
		} else {
			next = null
		}

		query.movedBefore && query.movedBefore(doc._id, next)
	}
}

const MODIFIERS = {
	$currentDate(target, field, arg) {
		if (typeof arg === 'object' && hasOwn.call(arg, '$type')) {
			if (arg.$type !== 'date') {
				throw MinimongoError(
					'Minimongo does currently only support the date type in ' + '$currentDate modifiers',
					{ field }
				)
			}
		} else if (arg !== true) {
			throw MinimongoError('Invalid $currentDate modifier', { field })
		}

		target[field] = new Date()
	},
	$inc(target, field, arg) {
		if (typeof arg !== 'number') {
			throw MinimongoError('Modifier $inc allowed for numbers only', { field })
		}

		if (field in target) {
			if (typeof target[field] !== 'number') {
				throw MinimongoError('Cannot apply $inc modifier to non-number', { field })
			}

			target[field] += arg
		} else {
			target[field] = arg
		}
	},
	$min(target, field, arg) {
		if (typeof arg !== 'number') {
			throw MinimongoError('Modifier $min allowed for numbers only', { field })
		}

		if (field in target) {
			if (typeof target[field] !== 'number') {
				throw MinimongoError('Cannot apply $min modifier to non-number', { field })
			}

			if (target[field] > arg) {
				target[field] = arg
			}
		} else {
			target[field] = arg
		}
	},
	$max(target, field, arg) {
		if (typeof arg !== 'number') {
			throw MinimongoError('Modifier $max allowed for numbers only', { field })
		}

		if (field in target) {
			if (typeof target[field] !== 'number') {
				throw MinimongoError('Cannot apply $max modifier to non-number', { field })
			}

			if (target[field] < arg) {
				target[field] = arg
			}
		} else {
			target[field] = arg
		}
	},
	$mul(target, field, arg) {
		if (typeof arg !== 'number') {
			throw MinimongoError('Modifier $mul allowed for numbers only', { field })
		}

		if (field in target) {
			if (typeof target[field] !== 'number') {
				throw MinimongoError('Cannot apply $mul modifier to non-number', { field })
			}

			target[field] *= arg
		} else {
			target[field] = 0
		}
	},
	$rename(target, field, arg, keypath, doc) {
		// no idea why mongo has this restriction..
		if (keypath === arg) {
			throw MinimongoError('$rename source must differ from target', { field })
		}

		if (target === null) {
			throw MinimongoError('$rename source field invalid', { field })
		}

		if (typeof arg !== 'string') {
			throw MinimongoError('$rename target must be a string', { field })
		}

		if (arg.includes('\0')) {
			// Null bytes are not allowed in Mongo field names
			// https://docs.mongodb.com/manual/reference/limits/#Restrictions-on-Field-Names
			throw MinimongoError("The 'to' field for $rename cannot contain an embedded null byte", { field })
		}

		if (target === undefined) {
			return
		}

		const object = target[field]

		delete target[field]

		const keyparts = arg.split('.')
		const target2 = findModTarget(doc, keyparts, { forbidArray: true })

		if (target2 === null) {
			throw MinimongoError('$rename target field invalid', { field })
		}

		target2[keyparts.pop()] = object
	},
	$set(target, field, arg) {
		if (target !== Object(target)) {
			// not an array or an object
			const error = MinimongoError('Cannot set property on non-object field', { field })
			error.setPropertyError = true
			throw error
		}

		if (target === null) {
			const error = MinimongoError('Cannot set property on null', { field })
			error.setPropertyError = true
			throw error
		}

		assertHasValidFieldNames(arg)

		target[field] = arg
	},
	$setOnInsert(target, field, arg) {
		// converted to `$set` in `_modify`
	},
	$unset(target, field, arg) {
		if (target !== undefined) {
			if (target instanceof Array) {
				if (field in target) {
					target[field] = null
				}
			} else {
				delete target[field]
			}
		}
	},
	$push(target, field, arg) {
		if (target[field] === undefined) {
			target[field] = []
		}

		if (!(target[field] instanceof Array)) {
			throw MinimongoError('Cannot apply $push modifier to non-array', { field })
		}

		if (!(arg && arg.$each)) {
			// Simple mode: not $each
			assertHasValidFieldNames(arg)

			target[field].push(arg)

			return
		}

		// Fancy mode: $each (and maybe $slice and $sort and $position)
		const toPush = arg.$each
		if (!(toPush instanceof Array)) {
			throw MinimongoError('$each must be an array', { field })
		}

		assertHasValidFieldNames(toPush)

		// Parse $position
		let position = undefined
		if ('$position' in arg) {
			if (typeof arg.$position !== 'number') {
				throw MinimongoError('$position must be a numeric value', { field })
			}

			// XXX should check to make sure integer
			if (arg.$position < 0) {
				throw MinimongoError('$position in $push must be zero or positive', { field })
			}

			position = arg.$position
		}

		// Parse $slice.
		let slice = undefined
		if ('$slice' in arg) {
			if (typeof arg.$slice !== 'number') {
				throw MinimongoError('$slice must be a numeric value', { field })
			}

			// XXX should check to make sure integer
			slice = arg.$slice
		}

		// Parse $sort.
		let sortFunction = undefined
		if (arg.$sort) {
			if (slice === undefined) {
				throw MinimongoError('$sort requires $slice to be present', { field })
			}

			// XXX this allows us to use a $sort whose value is an array, but that's
			// actually an extension of the Node driver, so it won't work
			// server-side. Could be confusing!
			// XXX is it correct that we don't do geo-stuff here?
			sortFunction = new LocalCollection.Sorter(arg.$sort).getComparator()

			toPush.forEach((element) => {
				if (LocalCollection._f._type(element) !== 3) {
					throw MinimongoError('$push like modifiers using $sort require all elements to be ' + 'objects', {
						field,
					})
				}
			})
		}

		// Actually push.
		if (position === undefined) {
			toPush.forEach((element) => {
				target[field].push(element)
			})
		} else {
			const spliceArguments = [position, 0]

			toPush.forEach((element) => {
				spliceArguments.push(element)
			})

			target[field].splice(...spliceArguments)
		}

		// Actually sort.
		if (sortFunction) {
			target[field].sort(sortFunction)
		}

		// Actually slice.
		if (slice !== undefined) {
			if (slice === 0) {
				target[field] = [] // differs from Array.slice!
			} else if (slice < 0) {
				target[field] = target[field].slice(slice)
			} else {
				target[field] = target[field].slice(0, slice)
			}
		}
	},
	$pushAll(target, field, arg) {
		if (!(typeof arg === 'object' && arg instanceof Array)) {
			throw MinimongoError('Modifier $pushAll/pullAll allowed for arrays only')
		}

		assertHasValidFieldNames(arg)

		const toPush = target[field]

		if (toPush === undefined) {
			target[field] = arg
		} else if (!(toPush instanceof Array)) {
			throw MinimongoError('Cannot apply $pushAll modifier to non-array', { field })
		} else {
			toPush.push(...arg)
		}
	},
	$addToSet(target, field, arg) {
		let isEach = false

		if (typeof arg === 'object') {
			// check if first key is '$each'
			const keys = Object.keys(arg)
			if (keys[0] === '$each') {
				isEach = true
			}
		}

		const values = isEach ? arg.$each : [arg]

		assertHasValidFieldNames(values)

		const toAdd = target[field]
		if (toAdd === undefined) {
			target[field] = values
		} else if (!(toAdd instanceof Array)) {
			throw MinimongoError('Cannot apply $addToSet modifier to non-array', { field })
		} else {
			values.forEach((value) => {
				if (toAdd.some((element) => LocalCollection._f._equal(value, element))) {
					return
				}

				toAdd.push(value)
			})
		}
	},
	$pop(target, field, arg) {
		if (target === undefined) {
			return
		}

		const toPop = target[field]

		if (toPop === undefined) {
			return
		}

		if (!(toPop instanceof Array)) {
			throw MinimongoError('Cannot apply $pop modifier to non-array', { field })
		}

		if (typeof arg === 'number' && arg < 0) {
			toPop.splice(0, 1)
		} else {
			toPop.pop()
		}
	},
	$pull(target, field, arg) {
		if (target === undefined) {
			return
		}

		const toPull = target[field]
		if (toPull === undefined) {
			return
		}

		if (!(toPull instanceof Array)) {
			throw MinimongoError('Cannot apply $pull/pullAll modifier to non-array', { field })
		}

		let out
		if (arg != null && typeof arg === 'object' && !(arg instanceof Array)) {
			// XXX would be much nicer to compile this once, rather than
			// for each document we modify.. but usually we're not
			// modifying that many documents, so we'll let it slide for
			// now

			// XXX Minimongo.Matcher isn't up for the job, because we need
			// to permit stuff like {$pull: {a: {$gt: 4}}}.. something
			// like {$gt: 4} is not normally a complete selector.
			// same issue as $elemMatch possibly?
			const matcher = new LocalCollection.Matcher(arg)

			out = toPull.filter((element) => !matcher.documentMatches(element).result)
		} else {
			out = toPull.filter((element) => !LocalCollection._f._equal(element, arg))
		}

		target[field] = out
	},
	$pullAll(target, field, arg) {
		if (!(typeof arg === 'object' && arg instanceof Array)) {
			throw MinimongoError('Modifier $pushAll/pullAll allowed for arrays only', { field })
		}

		if (target === undefined) {
			return
		}

		const toPull = target[field]

		if (toPull === undefined) {
			return
		}

		if (!(toPull instanceof Array)) {
			throw MinimongoError('Cannot apply $pull/pullAll modifier to non-array', { field })
		}

		target[field] = toPull.filter((object) => !arg.some((element) => LocalCollection._f._equal(object, element)))
	},
	$bit(target, field, arg) {
		// XXX mongo only supports $bit on integers, and we only support
		// native javascript numbers (doubles) so far, so we can't support $bit
		throw MinimongoError('$bit is not supported', { field })
	},
	$v() {
		// As discussed in https://github.com/meteor/meteor/issues/9623,
		// the `$v` operator is not needed by Meteor, but problems can occur if
		// it's not at least callable (as of Mongo >= 3.6). It's defined here as
		// a no-op to work around these problems.
	},
}

const NO_CREATE_MODIFIERS = {
	$pop: true,
	$pull: true,
	$pullAll: true,
	$rename: true,
	$unset: true,
}

// Make sure field names do not contain Mongo restricted
// characters ('.', '$', '\0').
// https://docs.mongodb.com/manual/reference/limits/#Restrictions-on-Field-Names
const invalidCharMsg = {
	$: "start with '$'",
	'.': "contain '.'",
	'\0': 'contain null bytes',
}

// checks if all field names in an object are valid
function assertHasValidFieldNames(doc) {
	if (doc && typeof doc === 'object') {
		JSON.stringify(doc, (key, value) => {
			assertIsValidFieldName(key)
			return value
		})
	}
}

function assertIsValidFieldName(key) {
	let match
	if (typeof key === 'string' && (match = key.match(/^\$|\.|\0/))) {
		throw MinimongoError(`Key ${key} must not ${invalidCharMsg[match[0]]}`)
	}
}

// for a.b.c.2.d.e, keyparts should be ['a', 'b', 'c', '2', 'd', 'e'],
// and then you would operate on the 'e' property of the returned
// object.
//
// if options.noCreate is falsey, creates intermediate levels of
// structure as necessary, like mkdir -p (and raises an exception if
// that would mean giving a non-numeric property to an array.) if
// options.noCreate is true, return undefined instead.
//
// may modify the last element of keyparts to signal to the caller that it needs
// to use a different value to index into the returned object (for example,
// ['a', '01'] -> ['a', 1]).
//
// if forbidArray is true, return null if the keypath goes through an array.
//
// if options.arrayIndices is set, use its first element for the (first) '$' in
// the path.
function findModTarget(doc, keyparts, options = {}) {
	let usedArrayIndex = false

	for (let i = 0; i < keyparts.length; i++) {
		const last = i === keyparts.length - 1
		let keypart = keyparts[i]

		if (!isIndexable(doc)) {
			if (options.noCreate) {
				return undefined
			}

			const error = MinimongoError(`cannot use the part '${keypart}' to traverse ${doc}`)
			error.setPropertyError = true
			throw error
		}

		if (doc instanceof Array) {
			if (options.forbidArray) {
				return null
			}

			if (keypart === '$') {
				if (usedArrayIndex) {
					throw MinimongoError("Too many positional (i.e. '$') elements")
				}

				if (!options.arrayIndices || !options.arrayIndices.length) {
					throw MinimongoError('The positional operator did not find the match needed from the ' + 'query')
				}

				keypart = options.arrayIndices[0]
				usedArrayIndex = true
			} else if (isNumericKey(keypart)) {
				keypart = parseInt(keypart)
			} else {
				if (options.noCreate) {
					return undefined
				}

				throw MinimongoError(`can't append to array using string field name [${keypart}]`)
			}

			if (last) {
				keyparts[i] = keypart // handle 'a.01'
			}

			if (options.noCreate && keypart >= doc.length) {
				return undefined
			}

			while (doc.length < keypart) {
				doc.push(null)
			}

			if (!last) {
				if (doc.length === keypart) {
					doc.push({})
				} else if (typeof doc[keypart] !== 'object') {
					throw MinimongoError(
						`can't modify field '${keyparts[i + 1]}' of list value ` + JSON.stringify(doc[keypart])
					)
				}
			}
		} else {
			assertIsValidFieldName(keypart)

			if (!(keypart in doc)) {
				if (options.noCreate) {
					return undefined
				}

				if (!last) {
					doc[keypart] = {}
				}
			}
		}

		if (last) {
			return doc
		}

		doc = doc[keypart]
	}

	// notreached
}

// The minimongo selector compiler!

// Terminology:
//  - a 'selector' is the EJSON object representing a selector
//  - a 'matcher' is its compiled form (whether a full Minimongo.Matcher
//    object or one of the component lambdas that matches parts of it)
//  - a 'result object' is an object with a 'result' field and maybe
//    distance and arrayIndices.
//  - a 'branched value' is an object with a 'value' field and maybe
//    'dontIterate' and 'arrayIndices'.
//  - a 'document' is a top-level object that can be stored in a collection.
//  - a 'lookup function' is a function that takes in a document and returns
//    an array of 'branched values'.
//  - a 'branched matcher' maps from an array of branched values to a result
//    object.
//  - an 'element matcher' maps from a single value to a bool.

// Main entry point.
//   var matcher = new Minimongo.Matcher({a: {$gt: 5}});
//   if (matcher.documentMatches({a: 7})) ...
LocalCollection.Matcher = class Matcher {
	constructor(selector, isUpdate) {
		// A set (object mapping string -> *) of all of the document paths looked
		// at by the selector. Also includes the empty string if it may look at any
		// path (eg, $where).
		this._paths = {}
		// Set to true if compilation finds a $near.
		this._hasGeoQuery = false
		// Set to true if compilation finds a $where.
		this._hasWhere = false
		// Set to false if compilation finds anything other than a simple equality
		// or one or more of '$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin' used
		// with scalars as operands.
		this._isSimple = true
		// Set to a dummy document which always matches this Matcher. Or set to null
		// if such document is too hard to find.
		this._matchingDocument = undefined
		// A clone of the original selector. It may just be a function if the user
		// passed in a function; otherwise is definitely an object (eg, IDs are
		// translated into {_id: ID} first. Used by canBecomeTrueByModifier and
		// Sorter._useWithMatcher.
		this._selector = null
		this._docMatcher = this._compileSelector(selector)
		// Set to true if selection is done for an update operation
		// Default is false
		// Used for $near array update (issue #3599)
		this._isUpdate = isUpdate
	}

	documentMatches(doc) {
		if (doc !== Object(doc)) {
			throw Error('documentMatches needs a document')
		}

		return this._docMatcher(doc)
	}

	hasGeoQuery() {
		return this._hasGeoQuery
	}

	hasWhere() {
		return this._hasWhere
	}

	isSimple() {
		return this._isSimple
	}

	// Given a selector, return a function that takes one argument, a
	// document. It returns a result object.
	_compileSelector(selector) {
		// you can pass a literal function instead of a selector
		if (selector instanceof Function) {
			this._isSimple = false
			this._selector = selector
			this._recordPathUsed('')

			return (doc) => ({ result: !!selector.call(doc) })
		}

		// shorthand -- scalar _id
		if (LocalCollection._selectorIsId(selector)) {
			this._selector = { _id: selector }
			this._recordPathUsed('_id')

			return (doc) => ({ result: EJSON.equals(doc._id, selector) })
		}

		// protect against dangerous selectors.  falsey and {_id: falsey} are both
		// likely programmer error, and not what you want, particularly for
		// destructive operations.
		if (!selector || (hasOwn.call(selector, '_id') && !selector._id)) {
			this._isSimple = false
			return nothingMatcher
		}

		// Top level can't be an array or true or binary.
		if (Array.isArray(selector) || EJSON.isBinary(selector) || typeof selector === 'boolean') {
			throw new Error(`Invalid selector: ${selector}`)
		}

		this._selector = EJSON.clone(selector)

		return compileDocumentSelector(selector, this, { isRoot: true })
	}

	// Returns a list of key paths the given selector is looking for. It includes
	// the empty string if there is a $where.
	_getPaths() {
		return Object.keys(this._paths)
	}

	_recordPathUsed(path) {
		this._paths[path] = true
	}
}

// helpers used by compiled selector code
LocalCollection._f = bigBlobF

// Give a sort spec, which can be in any of these forms:
//   {"key1": 1, "key2": -1}
//   [["key1", "asc"], ["key2", "desc"]]
//   ["key1", ["key2", "desc"]]
//
// (.. with the first form being dependent on the key enumeration
// behavior of your javascript VM, which usually does what you mean in
// this case if the key names don't look like integers ..)
//
// return a function that takes two objects, and returns -1 if the
// first object comes first in order, 1 if the second object comes
// first, or 0 if neither object comes before the other.

LocalCollection.Sorter = class Sorter {
	constructor(spec) {
		this._sortSpecParts = []
		this._sortFunction = null

		const addSpecPart = (path, ascending) => {
			if (!path) {
				throw Error('sort keys must be non-empty')
			}

			if (path.charAt(0) === '$') {
				throw Error(`unsupported sort key: ${path}`)
			}

			this._sortSpecParts.push({
				ascending,
				lookup: makeLookupFunction(path, { forSort: true }),
				path,
			})
		}

		if (spec instanceof Array) {
			spec.forEach((element) => {
				if (typeof element === 'string') {
					addSpecPart(element, true)
				} else {
					addSpecPart(element[0], element[1] !== 'desc')
				}
			})
		} else if (typeof spec === 'object') {
			Object.keys(spec).forEach((key) => {
				addSpecPart(key, spec[key] >= 0)
			})
		} else if (typeof spec === 'function') {
			this._sortFunction = spec
		} else {
			throw Error(`Bad sort specification: ${JSON.stringify(spec)}`)
		}

		// If a function is specified for sorting, we skip the rest.
		if (this._sortFunction) {
			return
		}

		// To implement affectedByModifier, we piggy-back on top of Matcher's
		// affectedByModifier code; we create a selector that is affected by the
		// same modifiers as this sort order. This is only implemented on the
		// server.
		if (this.affectedByModifier) {
			const selector = {}

			this._sortSpecParts.forEach((spec) => {
				selector[spec.path] = 1
			})

			this._selectorForAffectedByModifier = new LocalCollection.Matcher(selector)
		}

		this._keyComparator = composeComparators(this._sortSpecParts.map((spec, i) => this._keyFieldComparator(i)))
	}

	getComparator(options) {
		// If sort is specified or have no distances, just use the comparator from
		// the source specification (which defaults to "everything is equal".
		// issue #3599
		// https://docs.mongodb.com/manual/reference/operator/query/near/#sort-operation
		// sort effectively overrides $near
		if (this._sortSpecParts.length || !options || !options.distances) {
			return this._getBaseComparator()
		}

		const distances = options.distances

		// Return a comparator which compares using $near distances.
		return (a, b) => {
			if (!distances.has(a._id)) {
				throw Error(`Missing distance for ${a._id}`)
			}

			if (!distances.has(b._id)) {
				throw Error(`Missing distance for ${b._id}`)
			}

			return distances.get(a._id) - distances.get(b._id)
		}
	}

	// Takes in two keys: arrays whose lengths match the number of spec
	// parts. Returns negative, 0, or positive based on using the sort spec to
	// compare fields.
	_compareKeys(key1, key2) {
		if (key1.length !== this._sortSpecParts.length || key2.length !== this._sortSpecParts.length) {
			throw Error('Key has wrong length')
		}

		return this._keyComparator(key1, key2)
	}

	// Iterates over each possible "key" from doc (ie, over each branch), calling
	// 'cb' with the key.
	_generateKeysFromDoc(doc, cb) {
		if (this._sortSpecParts.length === 0) {
			throw new Error("can't generate keys without a spec")
		}

		const pathFromIndices = (indices) => `${indices.join(',')},`

		let knownPaths = null

		// maps index -> ({'' -> value} or {path -> value})
		const valuesByIndexAndPath = this._sortSpecParts.map((spec) => {
			// Expand any leaf arrays that we find, and ignore those arrays
			// themselves.  (We never sort based on an array itself.)
			let branches = expandArraysInBranches(spec.lookup(doc), true)

			// If there are no values for a key (eg, key goes to an empty array),
			// pretend we found one undefined value.
			if (!branches.length) {
				branches = [{ value: void 0 }]
			}

			const element = Object.create(null)
			let usedPaths = false

			branches.forEach((branch) => {
				if (!branch.arrayIndices) {
					// If there are no array indices for a branch, then it must be the
					// only branch, because the only thing that produces multiple branches
					// is the use of arrays.
					if (branches.length > 1) {
						throw Error('multiple branches but no array used?')
					}

					element[''] = branch.value
					return
				}

				usedPaths = true

				const path = pathFromIndices(branch.arrayIndices)

				if (hasOwn.call(element, path)) {
					throw Error(`duplicate path: ${path}`)
				}

				element[path] = branch.value

				// If two sort fields both go into arrays, they have to go into the
				// exact same arrays and we have to find the same paths.  This is
				// roughly the same condition that makes MongoDB throw this strange
				// error message.  eg, the main thing is that if sort spec is {a: 1,
				// b:1} then a and b cannot both be arrays.
				//
				// (In MongoDB it seems to be OK to have {a: 1, 'a.x.y': 1} where 'a'
				// and 'a.x.y' are both arrays, but we don't allow this for now.
				// #NestedArraySort
				// XXX achieve full compatibility here
				if (knownPaths && !hasOwn.call(knownPaths, path)) {
					throw Error('cannot index parallel arrays')
				}
			})

			if (knownPaths) {
				// Similarly to above, paths must match everywhere, unless this is a
				// non-array field.
				if (!hasOwn.call(element, '') && Object.keys(knownPaths).length !== Object.keys(element).length) {
					throw Error('cannot index parallel arrays!')
				}
			} else if (usedPaths) {
				knownPaths = {}

				Object.keys(element).forEach((path) => {
					knownPaths[path] = true
				})
			}

			return element
		})

		if (!knownPaths) {
			// Easy case: no use of arrays.
			const soleKey = valuesByIndexAndPath.map((values) => {
				if (!hasOwn.call(values, '')) {
					throw Error('no value in sole key case?')
				}

				return values['']
			})

			cb(soleKey)

			return
		}

		Object.keys(knownPaths).forEach((path) => {
			const key = valuesByIndexAndPath.map((values) => {
				if (hasOwn.call(values, '')) {
					return values['']
				}

				if (!hasOwn.call(values, path)) {
					throw Error('missing path?')
				}

				return values[path]
			})

			cb(key)
		})
	}

	// Returns a comparator that represents the sort specification (but not
	// including a possible geoquery distance tie-breaker).
	_getBaseComparator() {
		if (this._sortFunction) {
			return this._sortFunction
		}

		// If we're only sorting on geoquery distance and no specs, just say
		// everything is equal.
		if (!this._sortSpecParts.length) {
			return (doc1, doc2) => 0
		}

		return (doc1, doc2) => {
			const key1 = this._getMinKeyFromDoc(doc1)
			const key2 = this._getMinKeyFromDoc(doc2)
			return this._compareKeys(key1, key2)
		}
	}

	// Finds the minimum key from the doc, according to the sort specs.  (We say
	// "minimum" here but this is with respect to the sort spec, so "descending"
	// sort fields mean we're finding the max for that field.)
	//
	// Note that this is NOT "find the minimum value of the first field, the
	// minimum value of the second field, etc"... it's "choose the
	// lexicographically minimum value of the key vector, allowing only keys which
	// you can find along the same paths".  ie, for a doc {a: [{x: 0, y: 5}, {x:
	// 1, y: 3}]} with sort spec {'a.x': 1, 'a.y': 1}, the only keys are [0,5] and
	// [1,3], and the minimum key is [0,5]; notably, [0,3] is NOT a key.
	_getMinKeyFromDoc(doc) {
		let minKey = null

		this._generateKeysFromDoc(doc, (key) => {
			if (minKey === null) {
				minKey = key
				return
			}

			if (this._compareKeys(key, minKey) < 0) {
				minKey = key
			}
		})

		return minKey
	}

	_getPaths() {
		return this._sortSpecParts.map((part) => part.path)
	}

	// Given an index 'i', returns a comparator that compares two key arrays based
	// on field 'i'.
	_keyFieldComparator(i) {
		const invert = !this._sortSpecParts[i].ascending

		return (key1, key2) => {
			const compare = LocalCollection._f._cmp(key1[i], key2[i])
			return invert ? -compare : compare
		}
	}
}

// Given an array of comparators
// (functions (a,b)->(negative or positive or zero)), returns a single
// comparator which uses each comparator in order and returns the first
// non-zero value.
function composeComparators(comparatorArray) {
	return (a, b) => {
		for (let i = 0; i < comparatorArray.length; ++i) {
			const compare = comparatorArray[i](a, b)
			if (compare !== 0) {
				return compare
			}
		}

		return 0
	}
}

// Cursor: a specification for a particular subset of documents, w/ a defined
// order, limit, and offset.  creating a Cursor with LocalCollection.find(),
LocalCollection.Cursor = class Cursor {
	// don't call this ctor directly.  use LocalCollection.find().
	constructor(collection, selector, options = {}) {
		this.collection = collection
		this.sorter = null
		this.matcher = new LocalCollection.Matcher(selector)

		if (LocalCollection._selectorIsIdPerhapsAsObject(selector)) {
			// stash for fast _id and { _id }
			this._selectorId = hasOwn.call(selector, '_id') ? selector._id : selector
		} else {
			this._selectorId = undefined

			if (this.matcher.hasGeoQuery() || options.sort) {
				this.sorter = new LocalCollection.Sorter(options.sort || [])
			}
		}

		this.skip = options.skip || 0
		this.limit = options.limit
		this.fields = options.projection || options.fields

		this._projectionFn = LocalCollection._compileProjection(this.fields || {})

		// by default, queries register w/ Tracker when it is available.
		if (typeof Tracker !== 'undefined') {
			this.reactive = options.reactive === undefined ? true : options.reactive
		}
	}

	/**
	 * @summary Returns the number of documents that match a query.
	 * @memberOf Mongo.Cursor
	 * @method  count
	 * @instance
	 * @locus Anywhere
	 * @returns {Number}
	 */
	count() {
		if (this.reactive) {
			// allow the observe to be unordered
			this._depend({ added: true, removed: true }, true)
		}

		return this._getRawObjects({
			ordered: true,
		}).length
	}

	/**
	 * @summary Return all matching documents as an Array.
	 * @memberOf Mongo.Cursor
	 * @method  fetch
	 * @instance
	 * @locus Anywhere
	 * @returns {Object[]}
	 */
	fetch() {
		const result = []

		this.forEach((doc) => {
			result.push(doc)
		})

		return result
	}

	[Symbol.iterator]() {
		if (this.reactive) {
			this._depend({
				addedBefore: true,
				removed: true,
				changed: true,
				movedBefore: true,
			})
		}

		let index = 0
		const objects = this._getRawObjects({ ordered: true })

		return {
			next: () => {
				if (index < objects.length) {
					// This doubles as a clone operation.
					let element = this._projectionFn(objects[index++])

					return { value: element }
				}

				return { done: true }
			},
		}
	}

	/**
	 * @callback IterationCallback
	 * @param {Object} doc
	 * @param {Number} index
	 */
	/**
	 * @summary Call `callback` once for each matching document, sequentially and
	 *          synchronously.
	 * @locus Anywhere
	 * @method  forEach
	 * @instance
	 * @memberOf Mongo.Cursor
	 * @param {IterationCallback} callback Function to call. It will be called
	 *                                     with three arguments: the document, a
	 *                                     0-based index, and <em>cursor</em>
	 *                                     itself.
	 * @param {Any} [thisArg] An object which will be the value of `this` inside
	 *                        `callback`.
	 */
	forEach(callback, thisArg) {
		if (this.reactive) {
			this._depend({
				addedBefore: true,
				removed: true,
				changed: true,
				movedBefore: true,
			})
		}

		this._getRawObjects({ ordered: true }).forEach((element, i) => {
			// This doubles as a clone operation.
			element = this._projectionFn(element)

			callback.call(thisArg, element, i, this)
		})
	}

	/**
	 * @summary Map callback over all matching documents.  Returns an Array.
	 * @locus Anywhere
	 * @method map
	 * @instance
	 * @memberOf Mongo.Cursor
	 * @param {IterationCallback} callback Function to call. It will be called
	 *                                     with three arguments: the document, a
	 *                                     0-based index, and <em>cursor</em>
	 *                                     itself.
	 * @param {Any} [thisArg] An object which will be the value of `this` inside
	 *                        `callback`.
	 */
	map(callback, thisArg) {
		const result = []

		this.forEach((doc, i) => {
			result.push(callback.call(thisArg, doc, i, this))
		})

		return result
	}

	// options to contain:
	//  * callbacks for observe():
	//    - addedAt (document, atIndex)
	//    - added (document)
	//    - changedAt (newDocument, oldDocument, atIndex)
	//    - changed (newDocument, oldDocument)
	//    - removedAt (document, atIndex)
	//    - removed (document)
	//    - movedTo (document, oldIndex, newIndex)
	//
	// attributes available on returned query handle:
	//  * stop(): end updates
	//  * collection: the collection this query is querying
	//
	// iff x is a returned query handle, (x instanceof
	// LocalCollection.ObserveHandle) is true
	//
	// initial results delivered through added callback
	// XXX maybe callbacks should take a list of objects, to expose transactions?
	// XXX maybe support field limiting (to limit what you're notified on)

	/**
	 * @summary Watch a query.  Receive callbacks as the result set changes.
	 * @locus Anywhere
	 * @memberOf Mongo.Cursor
	 * @instance
	 * @param {Object} callbacks Functions to call to deliver the result set as it
	 *                           changes
	 */
	observe(options) {
		return LocalCollection._observeFromObserveChanges(this, options)
	}

	/**
	 * @summary Watch a query. Receive callbacks as the result set changes. Only
	 *          the differences between the old and new documents are passed to
	 *          the callbacks.
	 * @locus Anywhere
	 * @memberOf Mongo.Cursor
	 * @instance
	 * @param {Object} callbacks Functions to call to deliver the result set as it
	 *                           changes
	 */
	observeChanges(options) {
		const ordered = LocalCollection._observeChangesCallbacksAreOrdered(options)

		// there are several places that assume you aren't combining skip/limit with
		// unordered observe.  eg, update's EJSON.clone, and the "there are several"
		// comment in _modifyAndNotify
		// XXX allow skip/limit with unordered observe
		if (!options._allow_unordered && !ordered && (this.skip || this.limit)) {
			throw new Error(
				"Must use an ordered observe with skip or limit (i.e. 'addedBefore' " +
					"for observeChanges or 'addedAt' for observe, instead of 'added')."
			)
		}

		if (this.fields && (this.fields._id === 0 || this.fields._id === false)) {
			throw Error('You may not observe a cursor with {fields: {_id: 0}}')
		}

		const distances = this.matcher.hasGeoQuery() && ordered && new LocalCollection._IdMap()

		const query = {
			cursor: this,
			dirty: false,
			distances,
			matcher: this.matcher, // not fast pathed
			ordered,
			projectionFn: this._projectionFn,
			resultsSnapshot: null,
			sorter: ordered && this.sorter,
		}

		let qid

		// Non-reactive queries call added[Before] and then never call anything
		// else.
		if (this.reactive) {
			qid = this.collection.next_qid++
			this.collection.queries[qid] = query
		}

		query.results = this._getRawObjects({ ordered, distances: query.distances })

		if (this.collection.paused) {
			query.resultsSnapshot = ordered ? [] : new LocalCollection._IdMap()
		}

		// wrap callbacks we were passed. callbacks only fire when not paused and
		// are never undefined
		// Filters out blacklisted fields according to cursor's projection.
		// XXX wrong place for this?

		// furthermore, callbacks enqueue until the operation we're working on is
		// done.
		const wrapCallback = (fn) => {
			if (!fn) {
				return () => {}
			}

			const self = this
			return function (/* args*/) {
				if (self.collection.paused) {
					return
				}

				const args = arguments

				self.collection._observeQueue.queueTask(() => {
					fn.apply(this, args)
				})
			}
		}

		query.added = wrapCallback(options.added)
		query.changed = wrapCallback(options.changed)
		query.removed = wrapCallback(options.removed)

		if (ordered) {
			query.addedBefore = wrapCallback(options.addedBefore)
			query.movedBefore = wrapCallback(options.movedBefore)
		}

		if (!options._suppress_initial && !this.collection.paused) {
			query.results.forEach((doc) => {
				const fields = EJSON.clone(doc)

				delete fields._id

				if (ordered) {
					query.addedBefore(doc._id, this._projectionFn(fields), null)
				}

				query.added(doc._id, this._projectionFn(fields))
			})
		}

		const handle = Object.assign(new LocalCollection.ObserveHandle(), {
			collection: this.collection,
			stop: () => {
				if (this.reactive) {
					delete this.collection.queries[qid]
				}
			},
		})

		if (this.reactive && Tracker.active) {
			// XXX in many cases, the same observe will be recreated when
			// the current autorun is rerun.  we could save work by
			// letting it linger across rerun and potentially get
			// repurposed if the same observe is performed, using logic
			// similar to that of Meteor.subscribe.
			Tracker.onInvalidate(() => {
				handle.stop()
			})
		}

		// run the observe callbacks resulting from the initial contents
		// before we leave the observe.
		this.collection._observeQueue.drain()

		return handle
	}

	// XXX Maybe we need a version of observe that just calls a callback if
	// anything changed.
	_depend(changers, _allow_unordered) {
		if (Tracker.active) {
			const dependency = new Tracker.Dependency()
			const notify = dependency.changed.bind(dependency)

			dependency.depend()

			const options = { _allow_unordered, _suppress_initial: true }

			;['added', 'addedBefore', 'changed', 'movedBefore', 'removed'].forEach((fn) => {
				if (changers[fn]) {
					options[fn] = notify
				}
			})

			// observeChanges will stop() when this computation is invalidated
			this.observeChanges(options)
		}
	}

	_getCollectionName() {
		return this.collection.name
	}

	// Returns a collection of matching objects, but doesn't deep copy them.
	//
	// If ordered is set, returns a sorted array, respecting sorter, skip, and
	// limit properties of the query provided that options.applySkipLimit is
	// not set to false (#1201). If sorter is falsey, no sort -- you get the
	// natural order.
	//
	// If ordered is not set, returns an object mapping from ID to doc (sorter,
	// skip and limit should not be set).
	//
	// If ordered is set and this cursor is a $near geoquery, then this function
	// will use an _IdMap to track each distance from the $near argument point in
	// order to use it as a sort key. If an _IdMap is passed in the 'distances'
	// argument, this function will clear it and use it for this purpose
	// (otherwise it will just create its own _IdMap). The observeChanges
	// implementation uses this to remember the distances after this function
	// returns.
	_getRawObjects(options = {}) {
		// By default this method will respect skip and limit because .fetch(),
		// .forEach() etc... expect this behaviour. It can be forced to ignore
		// skip and limit by setting applySkipLimit to false (.count() does this,
		// for example)
		const applySkipLimit = options.applySkipLimit !== false

		// XXX use OrderedDict instead of array, and make IdMap and OrderedDict
		// compatible
		const results = options.ordered ? [] : new LocalCollection._IdMap()

		// fast path for single ID value
		if (this._selectorId !== undefined) {
			// If you have non-zero skip and ask for a single id, you get nothing.
			// This is so it matches the behavior of the '{_id: foo}' path.
			if (applySkipLimit && this.skip) {
				return results
			}

			const selectedDoc = this.collection._docs.get(this._selectorId)

			if (selectedDoc) {
				if (options.ordered) {
					results.push(selectedDoc)
				} else {
					results.set(this._selectorId, selectedDoc)
				}
			}

			return results
		}

		// slow path for arbitrary selector, sort, skip, limit

		// in the observeChanges case, distances is actually part of the "query"
		// (ie, live results set) object.  in other cases, distances is only used
		// inside this function.
		let distances
		if (this.matcher.hasGeoQuery() && options.ordered) {
			if (options.distances) {
				distances = options.distances
				distances.clear()
			} else {
				distances = new LocalCollection._IdMap()
			}
		}

		this.collection._docs.forEach((doc, id) => {
			const matchResult = this.matcher.documentMatches(doc)

			if (matchResult.result) {
				if (options.ordered) {
					results.push(doc)

					if (distances && matchResult.distance !== undefined) {
						distances.set(id, matchResult.distance)
					}
				} else {
					results.set(id, doc)
				}
			}

			// Override to ensure all docs are matched if ignoring skip & limit
			if (!applySkipLimit) {
				return true
			}

			// Fast path for limited unsorted queries.
			// XXX 'length' check here seems wrong for ordered
			return !this.limit || this.skip || this.sorter || results.length !== this.limit
		})

		if (!options.ordered) {
			return results
		}

		if (this.sorter) {
			results.sort(this.sorter.getComparator({ distances }))
		}

		// Return the full set of results if there is no skip or limit or if we're
		// ignoring them
		if (!applySkipLimit || (!this.limit && !this.skip)) {
			return results
		}

		return results.slice(this.skip, this.limit ? this.limit + this.skip : results.length)
	}
}
