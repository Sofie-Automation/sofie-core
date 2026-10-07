import { StatusCode } from '@sofie-automation/blueprints-integration'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { Blueprints } from '../collections'
import {
	parseVersion,
	compareSemverVersions,
	parseRange,
	isPrerelease,
	parseCoreIntegrationCompatabilityRange,
} from '../systemStatus/semverUtils'
import { lazyIgnore } from '../lib/lib'
import { logger } from '../logging'
import { CURRENT_SYSTEM_VERSION } from '../migration/currentSystemVersion'
import { setSystemStatus, removeSystemStatus } from '../systemStatus/systemStatus'
import { getCoreSystemAsync } from './collection'

const PackageInfo = require('../../package.json')
const integrationVersionRange = parseCoreIntegrationCompatabilityRange(PackageInfo.version)
const integrationVersionAllowPrerelease = isPrerelease(PackageInfo.version)

function getBlueprintCompatabilityMessageId(id: BlueprintId) {
	return `blueprintCompability_${id}`
}

const MESSAGE_KEY_DATABASE_VERSION = 'databaseVersion'

let lastDatabaseVersionBlueprintIds = new Set<BlueprintId>()
export function checkDatabaseVersions(): void {
	lazyIgnore(
		'coreSystem.checkDatabaseVersions',
		async () => {
			// Core system
			logger.debug('checkDatabaseVersions...')

			const databaseSystem = await getCoreSystemAsync()
			if (!databaseSystem) {
				setSystemStatus(MESSAGE_KEY_DATABASE_VERSION, {
					statusCode: StatusCode.BAD,
					messages: ['Database not set up'],
				})
			} else {
				const dbVersion = parseVersion(databaseSystem.version)
				const currentVersion = parseVersion(CURRENT_SYSTEM_VERSION)

				setSystemStatus(
					MESSAGE_KEY_DATABASE_VERSION,
					compareSemverVersions(
						currentVersion,
						dbVersion,
						false,
						'to fix, run migration',
						'core',
						'system database'
					)
				)

				// Blueprints:
				const blueprintIds = new Set<BlueprintId>()
				const blueprints = (await Blueprints.findFetchAsync(
					{},
					{
						projection: {
							_id: 1,
							blueprintVersion: 1,
							databaseVersion: 1,
							hasCode: 1,
							disableVersionChecks: 1,
							integrationVersion: 1,
						},
					}
				)) as Array<
					Pick<
						Blueprint,
						| '_id'
						| 'blueprintVersion'
						| 'databaseVersion'
						| 'hasCode'
						| 'disableVersionChecks'
						| 'integrationVersion'
					>
				>

				for (const blueprint of blueprints) {
					if (blueprint.hasCode) {
						blueprintIds.add(blueprint._id)

						if (!blueprint.databaseVersion || typeof blueprint.databaseVersion === 'string')
							blueprint.databaseVersion = { system: undefined }

						checkBlueprintCompability(blueprint)
					}
				}

				// Ensure old blueprints are removed
				for (const id of lastDatabaseVersionBlueprintIds) {
					if (blueprintIds.has(id)) {
						removeSystemStatus(getBlueprintCompatabilityMessageId(id))
					}
				}
				lastDatabaseVersionBlueprintIds = blueprintIds
			}
			logger.debug('checkDatabaseVersions done!')
		},
		100
	)
}

function checkBlueprintCompability(blueprint: Pick<Blueprint, '_id' | 'disableVersionChecks' | 'integrationVersion'>) {
	const systemStatusId = getBlueprintCompatabilityMessageId(blueprint._id)

	if (blueprint.disableVersionChecks) {
		setSystemStatus(systemStatusId, {
			statusCode: StatusCode.GOOD,
			messages: ['Version checks have been disabled'],
		})
	} else {
		const integrationStatus = compareSemverVersions(
			parseVersion(blueprint.integrationVersion),
			parseRange(integrationVersionRange),
			integrationVersionAllowPrerelease,
			'Blueprint has to be updated',
			'blueprint.integrationVersion',
			'@sofie-automation/blueprints-integration'
		)

		if (integrationStatus.statusCode >= StatusCode.WARNING_MAJOR) {
			integrationStatus.messages[0] = 'Integration version: ' + integrationStatus.messages[0]
			setSystemStatus(systemStatusId, integrationStatus)
		} else {
			setSystemStatus(systemStatusId, {
				statusCode: StatusCode.GOOD,
				messages: ['Versions match'],
			})
		}
	}
}
