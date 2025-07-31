import { Meteor } from 'meteor/meteor'
import * as semver from 'semver'
import { StatusCode } from '@sofie-automation/blueprints-integration'
import _ from 'underscore'

export type Version = string
export type VersionRange = string

function isReferenceOrUndefined(v: string | undefined): boolean {
	return !v || v.startsWith('http') || v.startsWith('git') || v.startsWith('file')
}

export function stripVersion(v: string): string {
	if (isReferenceOrUndefined(v)) {
		return '0.0.0'
	} else {
		const valid = semver.parse(v)
		if (!valid) throw new Meteor.Error(500, `Invalid version: "${v}"`)

		return `${valid.major}.${valid.minor}.${valid.patch}`
	}
}
export function parseRange(r: VersionRange | undefined): VersionRange {
	if (isReferenceOrUndefined(r)) {
		return '^0.0.0' // anything goes..
	}
	const range = semver.validRange(r)
	if (!range) throw new Meteor.Error(500, `Invalid range: "${r}"`)
	return range
}
export function parseVersion(v: Version | undefined): Version {
	if (isReferenceOrUndefined(v)) {
		return '0.0.0' // fallback
	}
	const valid = semver.valid(v)
	if (!valid) throw new Meteor.Error(500, `Invalid version: "${v}"`)
	return valid
}

export function isPrerelease(v: string): boolean {
	if (isReferenceOrUndefined(v)) {
		return true
	} else {
		const valid = semver.parse(v)
		if (!valid) throw new Meteor.Error(500, `Invalid version: "${v}"`)

		return valid.prerelease.length > 0
	}
}
export function parseCoreIntegrationCompatabilityRange(v: string): string {
	if (isReferenceOrUndefined(v)) {
		return '0.0'
	} else {
		const valid = semver.parse(v)
		if (!valid) throw new Meteor.Error(500, `Invalid version: "${v}"`)

		// patch releases shouldn't break things, so we always want to accept an older patch
		valid.patch = 0

		return `~${valid.format()}`
	}
}
/**
 * Compares two versions and returns a system Status
 * @param currentVersion
 * @param targetRange
 */
export function compareSemverVersions(
	currentVersion: Version | null,
	targetRange: VersionRange,
	allowPrerelease: boolean,
	fixMessage: string,
	meName: string,
	theyName: string
): { statusCode: StatusCode; messages: string[] } {
	if (currentVersion) currentVersion = semver.clean(currentVersion)

	if (currentVersion) {
		if (
			semver.satisfies(currentVersion, targetRange, {
				includePrerelease: allowPrerelease,
			})
		) {
			return {
				statusCode: StatusCode.GOOD,
				messages: [`${meName} version: ${currentVersion}`],
			}
		} else {
			try {
				const currentV = new semver.SemVer(currentVersion, { includePrerelease: true })
				const expectV = new semver.SemVer(stripVersion(targetRange), { includePrerelease: true })

				const message =
					`Version mismatch: ${meName} version: "${currentVersion}" does not satisfy expected version of ${theyName}: "${targetRange}"` +
					(fixMessage ? ` (${fixMessage})` : '')

				if (!expectV || !currentV) {
					return {
						statusCode: StatusCode.BAD,
						messages: [message],
					}
				} else if (expectV.major !== currentV.major) {
					return {
						statusCode: StatusCode.BAD,
						messages: [message],
					}
				} else if (expectV.minor !== currentV.minor) {
					return {
						statusCode: StatusCode.WARNING_MAJOR,
						messages: [message],
					}
				} else if (expectV.patch !== currentV.patch) {
					return {
						statusCode: StatusCode.WARNING_MINOR,
						messages: [message],
					}
				} else if (!_.isEqual(expectV.prerelease, currentV.prerelease)) {
					return {
						statusCode: StatusCode.WARNING_MINOR,
						messages: [message],
					}
				} else {
					return {
						statusCode: StatusCode.BAD,
						messages: [message],
					}
				}
				// the expectedVersion may be a proper range, in which case the new semver.SemVer will throw an error, even though the semver.satisfies check would work.
			} catch (_e) {
				const message =
					`Version mismatch: ${meName} version: "${currentVersion}" does not satisfy expected version range of ${theyName}: "${targetRange}"` +
					(fixMessage ? ` (${fixMessage})` : '')

				return {
					statusCode: StatusCode.BAD,
					messages: [message],
				}
			}
		}
	} else {
		return {
			statusCode: StatusCode.FATAL,
			messages: [`Current ${meName} version missing (when comparing with ${theyName})`],
		}
	}
}
