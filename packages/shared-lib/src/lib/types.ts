/**
 * Make all optional properties be required and `| undefined`
 * This is useful to ensure that no property is missed, when manually converting between types, but allowing fields to be undefined
 */
export type Complete<T> = {
	[P in keyof Required<T>]: Pick<T, P> extends Required<Pick<T, P>> ? T[P] : T[P] | undefined
}

export type ArrayElement<A> = A extends readonly (infer T)[] ? T : never

export type Subtract<T extends T1, T1 extends object> = Pick<T, Exclude<keyof T, keyof T1>>

export type PromisifyCallbacks<T> = {
	[K in keyof T]: PromisifyFunction<T[K]>
}
type PromisifyFunction<T> = T extends (...args: any) => any
	? (...args: Parameters<T>) => Promise<ReturnType<T>> | ReturnType<T>
	: T

export type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T

/**
 * Thanks to https://github.com/Microsoft/TypeScript/issues/23126#issuecomment-395929162
 */
export type OptionalPropertyNames<T> = {
	[K in keyof T]-?: undefined extends T[K] ? K : never
}[keyof T]
export type RequiredPropertyNames<T> = {
	[K in keyof T]-?: undefined extends T[K] ? never : K
}[keyof T]
export type OptionalProperties<T> = Pick<T, OptionalPropertyNames<T>>
export type RequiredProperties<T> = Pick<T, RequiredPropertyNames<T>>

export type Diff<T, U> = T extends U ? never : T // Remove types from T that are assignable to U
export type KeysByType<TObj, TVal> = Diff<
	{
		[K in keyof TObj]: TObj[K] extends TVal ? K : never
	}[keyof TObj],
	undefined
>
