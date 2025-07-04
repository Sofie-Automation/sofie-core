// options.connection, if given, is a LivedataClient or LivedataServer
// XXX presently there is no way to destroy/clean up a Collection

import { normalizeProjection } from "./mongo_utils";
import { Meteor } from '../meteor'
import { LocalCollection } from "../minimongo";
import { MongoID } from '../mongo-id'
import EJSON from 'ejson'
import { DDP } from '../ddp'
import { LocalCollectionDriver } from './local_collection_driver.js'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'

/**
 * @summary Namespace for MongoDB-related items
 * @namespace
 */
const Mongo = {};

LocalCollection.Mongo = Mongo;

/**
 * @summary Constructor for a Collection
 * @locus Anywhere
 * @instancename collection
 * @class
 * @param {String} name The name of the collection.  If null, creates an unmanaged (unsynchronized) local collection.
 * @param {Object} [options]
 * @param {Object} options.connection The server connection that will manage this collection. Uses the default connection if not specified.  Pass the return value of calling [`DDP.connect`](#ddp_connect) to specify a different server. Pass `null` to specify no connection. Unmanaged (`name` is null) collections cannot specify a connection.
 */
Mongo.Collection = function Collection(name, options) {
  if (!name && name !== null) {
    Meteor._debug(
      'Warning: creating anonymous collection. It will not be ' +
        'saved or synchronized over the network. (Pass null for ' +
        'the collection name to turn off this warning.)'
    );
    name = null;
  }

  if (name !== null && typeof name !== 'string') {
    throw new Error(
      'First argument to new Mongo.Collection must be a string or null'
    );
  }

  if (options && options.methods) {
    // Backwards compatibility hack with original signature (which passed
    // "connection" directly instead of in options. (Connections must have a "methods"
    // method.)
    // XXX remove before 1.0
    options = { connection: options };
  }
  // Backwards compatibility: "connection" used to be called "manager".
  if (options && options.manager && !options.connection) {
    options.connection = options.manager;
  }

  options = {
    connection: undefined,
    _driver: undefined,
    _preventAutopublish: false,
    ...options,
  };

  this._makeNewID = function() {
    return getRandomString();
  };

  if (!name || options.connection === null)
    // note: nameless collections never have a connection
    this._connection = null;
  else if (options.connection) this._connection = options.connection;
  else this._connection = Meteor.connection;

  if (!options._driver) {
    options._driver = LocalCollectionDriver;
  }

  this._collection = options._driver.open(name, this._connection);
  this._name = name;
  this._driver = options._driver;

  this._maybeSetUpReplication(name, options);
};

Object.assign(Mongo.Collection.prototype, {
  _maybeSetUpReplication(name, { _suppressSameNameError = false }) {
    const self = this;
    if (!(self._connection && self._connection.registerStore)) {
      return;
    }

    // OK, we're going to be a slave, replicating some remote
    // database, except possibly with some temporary divergence while
    // we have unacknowledged RPC's.
    const ok = self._connection.registerStore(name, {
      // Called at the beginning of a batch of updates. batchSize is the number
      // of update calls to expect.
      //
      // XXX This interface is pretty janky. reset probably ought to go back to
      // being its own function, and callers shouldn't have to calculate
      // batchSize. The optimization of not calling pause/remove should be
      // delayed until later: the first call to update() should buffer its
      // message, and then we can either directly apply it at endUpdate time if
      // it was the only update, or do pauseObservers/apply/apply at the next
      // update() if there's another one.
      beginUpdate(batchSize, reset) {
        // pause observers so users don't see flicker when updating several
        // objects at once (including the post-reconnect reset-and-reapply
        // stage), and so that a re-sorting of a query can take advantage of the
        // full _diffQuery moved calculation instead of applying change one at a
        // time.
        if (batchSize > 1 || reset) self._collection.pauseObservers();

        if (reset) self._collection.remove({});
      },

      // Apply an update.
      // XXX better specify this interface (not in terms of a wire message)?
      update(msg) {
        var mongoId = MongoID.idParse(msg.id);
        var doc = self._collection._docs.get(mongoId);

        //When the server's mergebox is disabled for a collection, the client must gracefully handle it when:
        // *We receive an added message for a document that is already there. Instead, it will be changed
        // *We reeive a change message for a document that is not there. Instead, it will be added
        // *We receive a removed messsage for a document that is not there. Instead, noting wil happen.

        //Code is derived from client-side code originally in peerlibrary:control-mergebox
        //https://github.com/peerlibrary/meteor-control-mergebox/blob/master/client.coffee

        //For more information, refer to discussion "Initial support for publication strategies in livedata server":
        //https://github.com/meteor/meteor/pull/11151
        if (msg.msg === 'added' && doc) {
          msg.msg = 'changed';
        } else if (msg.msg === 'removed' && !doc) {
          return;
        } else if (msg.msg === 'changed' && !doc) {
          msg.msg = 'added';
          let _ref = msg.fields;
          for (let field in _ref) {
            let value = _ref[field];
            if (value === void 0) {
              delete msg.fields[field];
            }
          }
        }

        // Is this a "replace the whole doc" message coming from the quiescence
        // of method writes to an object? (Note that 'undefined' is a valid
        // value meaning "remove it".)
        if (msg.msg === 'replace') {
          var replace = msg.replace;
          if (!replace) {
            if (doc) self._collection.remove(mongoId);
          } else if (!doc) {
            self._collection.insert(replace);
          } else {
            // XXX check that replace has no $ ops
            self._collection.update(mongoId, replace);
          }
          return;
        } else if (msg.msg === 'added') {
          if (doc) {
            throw new Error(
              'Expected not to find a document already present for an add'
            );
          }
          self._collection.insert({ _id: mongoId, ...msg.fields });
        } else if (msg.msg === 'removed') {
          if (!doc)
            throw new Error(
              'Expected to find a document already present for removed'
            );
          self._collection.remove(mongoId);
        } else if (msg.msg === 'changed') {
          if (!doc) throw new Error('Expected to find a document to change');
          const keys = Object.keys(msg.fields);
          if (keys.length > 0) {
            var modifier = {};
            keys.forEach(key => {
              const value = msg.fields[key];
              if (EJSON.equals(doc[key], value)) {
                return;
              }
              if (typeof value === 'undefined') {
                if (!modifier.$unset) {
                  modifier.$unset = {};
                }
                modifier.$unset[key] = 1;
              } else {
                if (!modifier.$set) {
                  modifier.$set = {};
                }
                modifier.$set[key] = value;
              }
            });
            if (Object.keys(modifier).length > 0) {
              self._collection.update(mongoId, modifier);
            }
          }
        } else {
          throw new Error("I don't know how to deal with this message");
        }
      },

      // Called at the end of a batch of updates.
      endUpdate() {
        self._collection.resumeObservers();
      },

      // Called around method stub invocations to capture the original versions
      // of modified documents.
      saveOriginals() {
        self._collection.saveOriginals();
      },
      retrieveOriginals() {
        return self._collection.retrieveOriginals();
      },

      // Used to preserve current versions of documents across a store reset.
      getDoc(id) {
        return self.findOne(id);
      },

      // To be able to get back to the collection from the store.
      _getCollection() {
        return self;
      },
    });

    if (!ok) {
      const message = `There is already a collection named "${name}"`;
      if (_suppressSameNameError === true) {
        // XXX In theory we do not have to throw when `ok` is falsy. The
        // store is already defined for this collection name, but this
        // will simply be another reference to it and everything should
        // work. However, we have historically thrown an error here, so
        // for now we will skip the error only when _suppressSameNameError
        // is `true`, allowing people to opt in and give this some real
        // world testing.
        console.warn ? console.warn(message) : console.log(message);
      } else {
        throw new Error(message);
      }
    }
  },

  ///
  /// Main collection API
  ///

  _getFindSelector(args) {
    if (args.length == 0) return {};
    else return args[0];
  },

  _getFindOptions(args) {
    const [, options] = args || [];
    const newOptions = normalizeProjection(options);

    var self = this;
    if (args.length < 2) {
      return { };
    } else {
      // check(
      //   newOptions,
      //   Match.Optional(
      //     Match.ObjectIncluding({
      //       projection: Match.Optional(Match.OneOf(Object, undefined)),
      //       sort: Match.Optional(
      //         Match.OneOf(Object, Array, Function, undefined)
      //       ),
      //       limit: Match.Optional(Match.OneOf(Number, undefined)),
      //       skip: Match.Optional(Match.OneOf(Number, undefined)),
      //     })
      //   )
      // );


      return {
        ...newOptions,
      };
    }
  },

  /**
   * @summary Find the documents in a collection that match the selector.
   * @locus Anywhere
   * @method find
   * @memberof Mongo.Collection
   * @instance
   * @param {MongoSelector} [selector] A query describing the documents to find
   * @param {Object} [options]
   * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)
   * @param {Number} options.skip Number of results to skip at the beginning
   * @param {Number} options.limit Maximum number of results to return
   * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
   * @param {Boolean} options.reactive (Client only) Default `true`; pass `false` to disable reactivity
   * @param {Boolean} options.disableOplog (Server only) Pass true to disable oplog-tailing on this query. This affects the way server processes calls to `observe` on this query. Disabling the oplog can be useful when working with data that updates in large batches.
   * @param {Number} options.pollingIntervalMs (Server only) When oplog is disabled (through the use of `disableOplog` or when otherwise not available), the frequency (in milliseconds) of how often to poll this query when observing on the server. Defaults to 10000ms (10 seconds).
   * @param {Number} options.pollingThrottleMs (Server only) When oplog is disabled (through the use of `disableOplog` or when otherwise not available), the minimum time (in milliseconds) to allow between re-polling when observing on the server. Increasing this will save CPU and mongo load at the expense of slower updates to users. Decreasing this is not recommended. Defaults to 50ms.
   * @param {Number} options.maxTimeMs (Server only) If set, instructs MongoDB to set a time limit for this cursor's operations. If the operation reaches the specified time limit (in milliseconds) without the having been completed, an exception will be thrown. Useful to prevent an (accidental or malicious) unoptimized query from causing a full collection scan that would disrupt other database users, at the expense of needing to handle the resulting error.
   * @param {String|Object} options.hint (Server only) Overrides MongoDB's default index selection and query optimization process. Specify an index to force its use, either by its name or index specification. You can also specify `{ $natural : 1 }` to force a forwards collection scan, or `{ $natural : -1 }` for a reverse collection scan. Setting this is only recommended for advanced users.
   * @param {String} options.readPreference (Server only) Specifies a custom MongoDB [`readPreference`](https://docs.mongodb.com/manual/core/read-preference) for this particular cursor. Possible values are `primary`, `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
   * @returns {Mongo.Cursor}
   */
  find(...args) {
    // Collection.find() (return all docs) behaves differently
    // from Collection.find(undefined) (return 0 docs).  so be
    // careful about the length of arguments.
    return this._collection.find(
      this._getFindSelector(args),
      this._getFindOptions(args)
    );
  },

  /**
   * @summary Finds the first document that matches the selector, as ordered by sort and skip options. Returns `undefined` if no matching document is found.
   * @locus Anywhere
   * @method findOne
   * @memberof Mongo.Collection
   * @instance
   * @param {MongoSelector} [selector] A query describing the documents to find
   * @param {Object} [options]
   * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)
   * @param {Number} options.skip Number of results to skip at the beginning
   * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
   * @param {Boolean} options.reactive (Client only) Default true; pass false to disable reactivity
   * @param {String} options.readPreference (Server only) Specifies a custom MongoDB [`readPreference`](https://docs.mongodb.com/manual/core/read-preference) for fetching the document. Possible values are `primary`, `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
   * @returns {Object}
   */
  findOne(...args) {
    return this._collection.findOne(
      this._getFindSelector(args),
      this._getFindOptions(args)
    );
  },
});

Object.assign(Mongo.Collection, {
  // protect against dangerous selectors.  falsey and {_id: falsey} are both
  // likely programmer error, and not what you want, particularly for destructive
  // operations. If a falsey _id is sent in, a new string _id will be
  // generated and returned; if a fallbackId is provided, it will be returned
  // instead.
  _rewriteSelector(selector, { fallbackId } = {}) {
    // shorthand -- scalars match _id
    if (LocalCollection._selectorIsId(selector)) selector = { _id: selector };

    if (Array.isArray(selector)) {
      // This is consistent with the Mongo console itself; if we don't do this
      // check passing an empty array ends up selecting all items
      throw new Error("Mongo selector can't be an array.");
    }

    if (!selector || ('_id' in selector && !selector._id)) {
      // can't match anything
      return { _id: fallbackId || getRandomString() };
    }

    return selector;
  },
});

Object.assign(Mongo.Collection.prototype, {
  // 'insert' immediately returns the inserted document's new _id.
  // The others return values immediately if you are in a stub, an in-memory
  // unmanaged collection, or a mongo-backed collection and you don't pass a
  // callback. 'update' and 'remove' return the number of affected
  // documents. 'upsert' returns an object with keys 'numberAffected' and, if an
  // insert happened, 'insertedId'.
  //
  // Otherwise, the semantics are exactly like other methods: they take
  // a callback as an optional last argument; if no callback is
  // provided, they block until the operation is complete, and throw an
  // exception if it fails; if a callback is provided, then they don't
  // necessarily block, and they call the callback when they finish with error and
  // result arguments.  (The insert method provides the document ID as its result;
  // update and remove provide the number of affected docs as the result; upsert
  // provides an object with numberAffected and maybe insertedId.)
  //
  // On the client, blocking is impossible, so if a callback
  // isn't provided, they just return immediately and any error
  // information is lost.
  //
  // There's one more tweak. On the client, if you don't provide a
  // callback, then if there is an error, a message will be logged with
  // Meteor._debug.
  //
  // The intent (though this is actually determined by the underlying
  // drivers) is that the operations should be done synchronously, not
  // generating their result until the database has acknowledged
  // them. In the future maybe we should provide a flag to turn this
  // off.

  /**
   * @summary Insert a document in the collection.  Returns its unique _id.
   * @locus Anywhere
   * @method  insert
   * @memberof Mongo.Collection
   * @instance
   * @param {Object} doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
   * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the _id as the second.
   */
  insert(doc, callback) {
    // Make sure we were passed a document to insert
    if (!doc) {
      throw new Error('insert requires an argument');
    }

    // Make a shallow clone of the document, preserving its prototype.
    doc = Object.create(
      Object.getPrototypeOf(doc),
      Object.getOwnPropertyDescriptors(doc)
    );

    if ('_id' in doc) {
      if (
        !doc._id ||
        !(typeof doc._id === 'string')
      ) {
        throw new Error(
          'Meteor requires document _id fields to be non-empty strings or ObjectIDs'
        );
      }
    } else {
      let generateId = true;

      // Don't generate the id if we're the client and the 'outermost' call
      // This optimization saves us passing both the randomSeed and the id
      // Passing both is redundant.
      if (this._isRemoteCollection()) {
        const enclosing = DDP._CurrentMethodInvocation.get();
        if (!enclosing) {
          generateId = false;
        }
      }

      if (generateId) {
        doc._id = this._makeNewID();
      }
    }

    // On inserts, always return the id that we generated; on all other
    // operations, just return the result from the collection.
    var chooseReturnValueFromCollectionResult = function(result) {
      if (doc._id) {
        return doc._id;
      }

      // XXX what is this for??
      // It's some iteraction between the callback to _callMutatorMethod and
      // the return value conversion
      doc._id = result;

      return result;
    };

    const wrappedCallback = wrapCallback(
      callback,
      chooseReturnValueFromCollectionResult
    );

    if (this._isRemoteCollection()) {
      const result = this._callMutatorMethod('insert', [doc], wrappedCallback);
      return chooseReturnValueFromCollectionResult(result);
    }

    // it's my collection.  descend into the collection object
    // and propagate any exception.
    try {
      // If the user provided a callback and the collection implements this
      // operation asynchronously, then queryRet will be undefined, and the
      // result will be returned through the callback instead.
      const result = this._collection.insert(doc, wrappedCallback);
      return chooseReturnValueFromCollectionResult(result);
    } catch (e) {
      if (callback) {
        callback(e);
        return null;
      }
      throw e;
    }
  },

  /**
   * @summary Modify one or more documents in the collection. Returns the number of matched documents.
   * @locus Anywhere
   * @method update
   * @memberof Mongo.Collection
   * @instance
   * @param {MongoSelector} selector Specifies which documents to modify
   * @param {MongoModifier} modifier Specifies how to modify the documents
   * @param {Object} [options]
   * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
   * @param {Boolean} options.upsert True to insert a document if no matching documents are found.
   * @param {Array} options.arrayFilters Optional. Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to modify in an array field.
   * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
   */
  update(selector, modifier, ...optionsAndCallback) {
    const callback = popCallbackFromArgs(optionsAndCallback);

    // We've already popped off the callback, so we are left with an array
    // of one or zero items
    const options = { ...(optionsAndCallback[0] || null) };
    let insertedId;
    if (options && options.upsert) {
      // set `insertedId` if absent.  `insertedId` is a Meteor extension.
      if (options.insertedId) {
        if (
          !(
            typeof options.insertedId === 'string'
          )
        )
          throw new Error('insertedId must be string or ObjectID');
        insertedId = options.insertedId;
      } else if (!selector || !selector._id) {
        insertedId = this._makeNewID();
        options.generatedId = true;
        options.insertedId = insertedId;
      }
    }

    selector = Mongo.Collection._rewriteSelector(selector, {
      fallbackId: insertedId,
    });

    const wrappedCallback = wrapCallback(callback);

    if (this._isRemoteCollection()) {
      const args = [selector, modifier, options];

      return this._callMutatorMethod('update', args, wrappedCallback);
    }

    // it's my collection.  descend into the collection object
    // and propagate any exception.
    try {
      // If the user provided a callback and the collection implements this
      // operation asynchronously, then queryRet will be undefined, and the
      // result will be returned through the callback instead.
      return this._collection.update(
        selector,
        modifier,
        options,
        wrappedCallback
      );
    } catch (e) {
      if (callback) {
        callback(e);
        return null;
      }
      throw e;
    }
  },

  /**
   * @summary Remove documents from the collection
   * @locus Anywhere
   * @method remove
   * @memberof Mongo.Collection
   * @instance
   * @param {MongoSelector} selector Specifies which documents to remove
   * @param {Function} [callback] Optional.  If present, called with an error object as its argument.
   */
  remove(selector, callback) {
    selector = Mongo.Collection._rewriteSelector(selector);

    const wrappedCallback = wrapCallback(callback);

    if (this._isRemoteCollection()) {
      return this._callMutatorMethod('remove', [selector], wrappedCallback);
    }

    // it's my collection.  descend into the collection object
    // and propagate any exception.
    try {
      // If the user provided a callback and the collection implements this
      // operation asynchronously, then queryRet will be undefined, and the
      // result will be returned through the callback instead.
      return this._collection.remove(selector, wrappedCallback);
    } catch (e) {
      if (callback) {
        callback(e);
        return null;
      }
      throw e;
    }
  },

  // Determine if this collection is simply a minimongo representation of a real
  // database on another server
  _isRemoteCollection() {
    // XXX see #MeteorServerNull
    return !!this._connection;
  },

  /**
   * @summary Modify one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified)  and `insertedId` (the unique _id of the document that was inserted, if any).
   * @locus Anywhere
   * @method upsert
   * @memberof Mongo.Collection
   * @instance
   * @param {MongoSelector} selector Specifies which documents to modify
   * @param {MongoModifier} modifier Specifies how to modify the documents
   * @param {Object} [options]
   * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
   * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
   */
  upsert(selector, modifier, options, callback) {
    if (!callback && typeof options === 'function') {
      callback = options;
      options = {};
    }

    return this.update(
      selector,
      modifier,
      {
        ...options,
        _returnObject: true,
        upsert: true,
      },
      callback
    );
  },

 
});

// Convert the callback to not return a result if there is an error
function wrapCallback(callback, convertResult) {
  return (
    callback &&
    function(error, result) {
      if (error) {
        callback(error);
      } else if (typeof convertResult === 'function') {
        callback(error, convertResult(result));
      } else {
        callback(error, result);
      }
    }
  );
}

/**
 * @summary To create a cursor, use find. To access the documents in a cursor, use forEach, map, or fetch.
 * @class
 * @instanceName cursor
 */
Mongo.Cursor = LocalCollection.Cursor;

/**
 * @deprecated in 0.9.1
 */
Mongo.Collection.Cursor = Mongo.Cursor;


/**
 * @deprecated in 0.9.1
 */
Meteor.Collection = Mongo.Collection;

function popCallbackFromArgs(args) {
  // Pull off any callback (or perhaps a 'callback' variable that was passed
  // in undefined, like how 'upsert' does it).
  if (
    args.length &&
    (args[args.length - 1] === undefined ||
      args[args.length - 1] instanceof Function)
  ) {
    return args.pop();
  }
}

export { Mongo }


Mongo.Collection.prototype._callMutatorMethod = function _callMutatorMethod(name, args, callback) {
  if (!callback) {
    // Client can't block, so it can't report errors by exception,
    // only by callback. If they forget the callback, give them a
    // default one that logs the error, so they aren't totally
    // baffled if their writes don't work because their database is
    // down.
    // Don't give a default callback in simulation, because inside stubs we
    // want to return the results from the local collection immediately and
    // not force a callback.
    callback = function (err) {
      if (err)
        Meteor._debug(name + " failed", err);
    };
  }

  // For two out of three mutator methods, the first argument is a selector
  const firstArgIsSelector = name === "update" || name === "remove";
  if (firstArgIsSelector) {
    // If we're about to actually send an RPC, we should throw an error if
    // this is a non-ID selector, because the mutation methods only allow
    // single-ID selectors. (If we don't throw here, we'll see flicker.)
    throwIfSelectorIsNotId(args[0], name);
  }

  const mutatorMethodName = '/' + this._name + '/'+ name;
  return this._connection.apply(
    mutatorMethodName, args, { }, callback);
}

function throwIfSelectorIsNotId(selector, methodName) {
  if (!LocalCollection._selectorIsIdPerhapsAsObject(selector)) {
    throw new Meteor.Error(
      403, "Not permitted. Untrusted code may only " + methodName +
        " documents by ID.");
  }
};
