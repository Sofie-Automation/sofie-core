const MongoID = {}

MongoID.idStringify = (id) => {
	if (typeof id === 'string') {
		var firstChar = id.charAt(0)
		if (id === '') {
			return id
		} else if (
			firstChar === '-' || // escape previously dashed strings
			firstChar === '~' || // escape escaped numbers, true, false
			firstChar === '{'
		) {
			// escape object-form strings, for maybe implementing later
			return `-${id}`
		} else {
			return id // other strings go through unchanged.
		}
	} else if (id === undefined) {
		return '-'
	} else if (typeof id === 'object' && id !== null) {
		throw new Error('Meteor does not currently support objects other than ObjectID as ids')
	} else {
		// Numbers, true, false, null
		return `~${JSON.stringify(id)}`
	}
}

MongoID.idParse = (id) => {
	var firstChar = id.charAt(0)
	if (id === '') {
		return id
	} else if (id === '-') {
		return undefined
	} else if (firstChar === '-') {
		return id.substr(1)
	} else if (firstChar === '~') {
		return JSON.parse(id.substr(1))
	} else {
		return id
	}
}

export { MongoID }
