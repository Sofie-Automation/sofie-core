const Meteor = {
	_debug: (...args) => {
		console.debug(...args)
	},

	_setImmediate: (cb) => {
		return setTimeout(cb, 0)
	},

	makeErrorType: (name, constructor) => {
		var errorClass = function (/*arguments*/) {
			// Ensure we get a proper stack trace in most Javascript environments
			if (Error.captureStackTrace) {
				// V8 environments (Chrome and Node.js)
				Error.captureStackTrace(this, errorClass)
			} else {
				// Borrow the .stack property of a native Error object.
				this.stack = new Error().stack
			}
			// Safari magically works.

			constructor.apply(this, arguments)

			this.errorType = name
		}

		Meteor._inherits(errorClass, Error)

		return errorClass
	},
}

function withoutInvocation(f) {
	var DDP = Meteor.DDP
	if (DDP) {
		var CurrentInvocation = DDP._CurrentMethodInvocation

		return function () {
			CurrentInvocation.withValue(null, f)
		}
	} else {
		return f
	}
}

function bindAndCatch(context, f) {
	return Meteor.bindEnvironment(withoutInvocation(f), context)
}

// Meteor.setTimeout and Meteor.setInterval callbacks scheduled
// inside a server method are not part of the method invocation and
// should clear out the CurrentMethodInvocation environment variable.

/**
 * @memberOf Meteor
 * @summary Call a function in the future after waiting for a specified delay.
 * @locus Anywhere
 * @param {Function} func The function to run
 * @param {Number} delay Number of milliseconds to wait before calling function
 */
Meteor.setTimeout = function (f, duration) {
	return setTimeout(bindAndCatch('setTimeout callback', f), duration)
}

/**
 * @memberOf Meteor
 * @summary Call a function repeatedly, with a time delay between calls.
 * @locus Anywhere
 * @param {Function} func The function to run
 * @param {Number} delay Number of milliseconds to wait between each function call.
 */
Meteor.setInterval = function (f, duration) {
	return setInterval(bindAndCatch('setInterval callback', f), duration)
}

/**
 * @memberOf Meteor
 * @summary Cancel a repeating function call scheduled by `Meteor.setInterval`.
 * @locus Anywhere
 * @param {Object} id The handle returned by `Meteor.setInterval`
 */
Meteor.clearInterval = function (x) {
	return clearInterval(x)
}

/**
 * @memberOf Meteor
 * @summary Cancel a function call scheduled by `Meteor.setTimeout`.
 * @locus Anywhere
 * @param {Object} id The handle returned by `Meteor.setTimeout`
 */
Meteor.clearTimeout = function (x) {
	return clearTimeout(x)
}

// XXX consider making this guarantee ordering of defer'd callbacks, like
// Tracker.afterFlush or Node's nextTick (in practice). Then tests can do:
//    callSomethingThatDefersSomeWork();
//    Meteor.defer(expect(somethingThatValidatesThatTheWorkHappened));

/**
 * @memberOf Meteor
 * @summary Defer execution of a function to run asynchronously in the background (similar to `Meteor.setTimeout(func, 0)`.
 * @locus Anywhere
 * @param {Function} func The function to run
 */
Meteor.defer = function (f) {
	Meteor._setImmediate(bindAndCatch('defer callback', f))
}

// Sets child's prototype to a new object whose prototype is parent's
// prototype. Used as:
//   Meteor._inherits(ClassB, ClassA).
//   _.extend(ClassB.prototype, { ... })
// Inspired by CoffeeScript's `extend` and Google Closure's `goog.inherits`.
var hasOwn = Object.prototype.hasOwnProperty
Meteor._inherits = function (Child, Parent) {
	// copy Parent static properties
	for (var key in Parent) {
		// make sure we only copy hasOwnProperty properties vs. prototype
		// properties
		if (hasOwn.call(Parent, key)) {
			Child[key] = Parent[key]
		}
	}

	// a middle member of prototype chain: takes the prototype from the Parent
	var Middle = function () {
		this.constructor = Child
	}
	Middle.prototype = Parent.prototype
	Child.prototype = new Middle()
	Child.__super__ = Parent.prototype
	return Child
}

{
	// Simple implementation of dynamic scoping, for use in browsers

	var nextSlot = 0
	var currentValues = []

	Meteor.EnvironmentVariable = function () {
		this.slot = nextSlot++
	}

	var EVp = Meteor.EnvironmentVariable.prototype

	EVp.get = function () {
		return currentValues[this.slot]
	}

	EVp.getOrNullIfOutsideFiber = function () {
		return this.get()
	}

	EVp.withValue = function (value, func) {
		var saved = currentValues[this.slot]
		try {
			currentValues[this.slot] = value
			var ret = func()
		} finally {
			currentValues[this.slot] = saved
		}
		return ret
	}

	Meteor.bindEnvironment = function (func, onException, _this) {
		// needed in order to be able to create closures inside func and
		// have the closed variables not change back to their original
		// values
		var boundValues = currentValues.slice()

		if (!onException || typeof onException === 'string') {
			var description = onException || 'callback of async function'
			onException = function (error) {
				Meteor._debug('Exception in ' + description + ':', error)
			}
		}

		return function (/* arguments */) {
			var savedValues = currentValues
			try {
				currentValues = boundValues
				var ret = func.apply(_this, arguments)
			} catch (e) {
				// note: callback-hook currently relies on the fact that if onException
				// throws in the browser, the wrapped call throws.
				onException(e)
			} finally {
				currentValues = savedValues
			}
			return ret
		}
	}
}

Meteor.Error = Meteor.makeErrorType('Meteor.Error', function (error, reason, details) {
	var self = this

	// Newer versions of DDP use this property to signify that an error
	// can be sent back and reconstructed on the calling client.
	self.isClientSafe = true

	// String code uniquely identifying this kind of error.
	self.error = error

	// Optional: A short human-readable summary of the error. Not
	// intended to be shown to end users, just developers. ("Not Found",
	// "Internal Server Error")
	self.reason = reason

	// Optional: Additional information about the error, say for
	// debugging. It might be a (textual) stack trace if the server is
	// willing to provide one. The corresponding thing in HTTP would be
	// the body of a 404 or 500 response. (The difference is that we
	// never expect this to be shown to end users, only developers, so
	// it doesn't need to be pretty.)
	self.details = details

	// This is what gets displayed at the top of a stack trace. Current
	// format is "[404]" (if no reason is set) or "File not found [404]"
	if (self.reason) self.message = self.reason + ' [' + self.error + ']'
	else self.message = '[' + self.error + ']'
})

// Meteor.Error is basically data and is sent over DDP, so you should be able to
// properly EJSON-clone it. This is especially important because if a
// Meteor.Error is thrown through a Future, the error, reason, and details
// properties become non-enumerable so a standard Object clone won't preserve
// them and they will be lost from DDP.
Meteor.Error.prototype.clone = function () {
	var self = this
	return new Meteor.Error(self.error, self.reason, self.details)
}

Meteor._relativeToSiteRootUrl = function (link) {
	if (typeof window.__meteor_runtime_config__ === 'object' && link.substr(0, 1) === '/')
		link = (window.__meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '') + link
	return link
}

export { Meteor }
window.Meteor = Meteor

Meteor.startup = function (cb) {
	cb()
}

Meteor.user = function () {
	return null
}

Meteor.userId = function () {
	return null
}
