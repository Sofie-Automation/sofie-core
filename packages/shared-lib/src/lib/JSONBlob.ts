/***************************************************************************************
 * JSONBlob is intended to be used instead of JSON.parse/JSON.stringify,
 * in order to share stricter typings between the stringifying (sending) and the
 * parsing (receiving) side.
 *
 * Usage:
 * interface A {
 *   a: number
 * }
 * const aBlob: JSONBlob<A> = JSONBlobStringify({ a: 1 })
 * const a: A = JSONBlobParse(aBlob)
 *
 ************************************************************************************** /

/**
 * Data type for stringified data using JSONBlobStringify().
 * To parse the data, use JSONBlobParse()
 */
// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
export interface JSONBlob<T> extends String {
	__internal: T
}

/** Equivalent to JSON.stringify, but returns a JSONBlob instead, which could only be parsed by JSONBlobParse */
export function JSONBlobStringify<T>(o: T, pretty = false): JSONBlob<T> {
	return JSON.stringify(o, undefined, pretty ? 2 : undefined) as any as JSONBlob<T>
}

export function JSONBlobParse<T>(blob: JSONBlob<T>): T {
	return JSON.parse(blob as any)
}
