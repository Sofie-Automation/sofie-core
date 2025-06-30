import { check as MeteorCheck, Match as orgMatch } from 'meteor/check'

/* tslint:disable variable-name */

export function check(value: unknown, pattern: Match.Pattern): void {
	// This is a wrapper for Meteor.check, since that asserts the returned type too strictly
	if (checkDisabled) {
		return
	}

	const passed = MeteorCheck(value, pattern)

	return passed
}
// todo: checkTOBEMOVED
export namespace Match {
	export const Any = orgMatch.Any
	// export const String = orgMatch.String
	export const Integer = orgMatch.Integer
	// export const Boolean = orgMatch.Boolean
	// export const undefined = orgMatch.undefined
	// export const Object = orgMatch.Object

	export type Pattern = orgMatch.Pattern
	export type PatternMatch<T extends Pattern> = orgMatch.PatternMatch<T>

	export function Maybe<T extends Pattern>(
		pattern: T
	): orgMatch.Matcher<PatternMatch<T> | undefined | null> | undefined {
		if (checkDisabled) return
		return orgMatch.Maybe(pattern)
	}
	export function Optional<T extends Pattern>(pattern: T): orgMatch.Matcher<PatternMatch<T> | undefined> | undefined {
		if (checkDisabled) return
		return orgMatch.Optional(pattern)
	}
	export function ObjectIncluding<T extends { [key: string]: Pattern }>(
		dico: T
	): orgMatch.Matcher<PatternMatch<T>> | undefined {
		if (checkDisabled) return
		return orgMatch.ObjectIncluding(dico)
	}
	export function OneOf<T extends Pattern[]>(...patterns: T): orgMatch.Matcher<PatternMatch<T[number]>> | undefined {
		if (checkDisabled) return
		return orgMatch.OneOf(...patterns)
	}
	export function Where<T>(condition: (val: any) => val is T): orgMatch.Matcher<T> | undefined {
		if (checkDisabled) return
		return orgMatch.Where(condition)
	}
	export function test<T extends Pattern>(value: unknown, pattern: T): value is PatternMatch<T> {
		if (checkDisabled) return true
		return orgMatch.test(value, pattern)
	}
}
let checkDisabled = false
export function disableChecks(): void {
	checkDisabled = true
}
export function enableChecks(): void {
	checkDisabled = false
}
