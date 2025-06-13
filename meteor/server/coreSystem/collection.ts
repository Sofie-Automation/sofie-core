import { Meteor } from 'meteor/meteor'
import semver from 'semver'
import { ICoreSystem, SYSTEM_ID } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { parseVersion } from '../systemStatus/semverUtils'
import { logger } from '../logging'
import { CoreSystem } from '../collections'

// The CoreSystem collection will contain one (exactly 1) object.
// This represents the "system"

export async function getCoreSystemAsync(): Promise<ICoreSystem | undefined> {
	return CoreSystem.findOneAsync(SYSTEM_ID)
}
export async function setCoreSystemVersion(versionStr: string): Promise<string> {
	const system = await getCoreSystemAsync()
	if (!system) throw new Meteor.Error(500, 'CoreSystem not found')

	if (!Meteor.isServer) throw new Meteor.Error(500, 'This function can only be run server-side')

	const version = parseVersion(versionStr)

	if (version === versionStr) {
		logger.info(`Updating database version, from "${system.version}" to "${version}".`)

		let previousVersion: string | null = null

		if (system.version && semver.gt(version, system.version)) {
			// the new version is higher than previous version
			previousVersion = system.version
		}

		await CoreSystem.updateAsync(system._id, {
			$set: {
				version: versionStr,
				previousVersion: previousVersion,
			},
		})
		return versionStr
	} else {
		throw new Meteor.Error(
			500,
			`Unable to set version. Parsed version differ from expected: "${versionStr}", "${version}"`
		)
	}
}
