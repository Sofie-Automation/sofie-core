import {
	SYSTEM_ID,
	GENESIS_SYSTEM_VERSION,
	ICoreSystem,
} from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { parseVersion } from '../systemStatus/semverUtils'
import { getCurrentTime } from '../lib/lib'
import { processLifetimeSignal } from '../lib/observerLifetime'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import {
	DEFAULT_MAXIMUM_DATA_AGE,
	DEFAULT_CONFIRM_KEY_CODE,
	DEFAULT_POISON_KEY,
} from '@sofie-automation/shared-lib/dist/core/constants'
import { prepareMigration, runMigrationFromTrusted } from '../migration/databaseMigration'
import { Blueprints, CoreSystem } from '../collections'
import { getEnvLogLevel, logger, LogLevel, setLogLevel } from '../logging'
const PackageInfo = require('../../package.json')
import { startAgent } from '../api/profiler/apm'
import { profiler } from '../api/profiler'
import { ICoreSystemSettings, TMP_TSR_VERSION } from '@sofie-automation/blueprints-integration'
import { getAbsolutePath, isInDevelopmentMode, isInTestMode } from '../lib'
import path from 'path'
import { checkDatabaseVersions } from './checkDatabaseVersions'
import PLazy from 'p-lazy'
import { getCoreSystemAsync } from './collection'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { SofieError } from '@sofie-automation/corelib/dist/error'
const mosPkgJson = require('@mos-connection/helper/package.json')
const superTimelinePkgJson = require('superfly-timeline/package.json')

export { PackageInfo }

/** Get the store path used to be used for storing snapshots  */
export function getSystemStorePath(): string {
	if (isInTestMode()) {
		// Override the variable when invoked through Jest
		return '/dev/null'
	}

	const storePath = process.env.SOFIE_STORE_PATH
	if (storePath) return path.resolve(storePath)

	if (isInDevelopmentMode()) {
		// For development, fallback to inside the .meteor folder
		return getAbsolutePath() + '/.meteor/local/sofie-store'
	}

	throw new SofieError(500, 'SOFIE_STORE_PATH must be defined to launch Sofie')
}

export async function initializeCoreSystem(): Promise<ICoreSystem> {
	const system = await getCoreSystemAsync()
	if (!system) {
		// At this point, we probably have a system that is as fresh as it gets

		const version = parseVersion(GENESIS_SYSTEM_VERSION)
		const system: ICoreSystem = {
			_id: SYSTEM_ID,
			created: getCurrentTime(),
			modified: getCurrentTime(),
			version: version,
			previousVersion: null,
			serviceMessages: {},
			apm: {
				enabled: false,
				transactionSampleRate: -1,
			},
			settingsWithOverrides: wrapDefaultObject<ICoreSystemSettings>({
				cron: {
					casparCGRestart: {
						enabled: true,
					},
					storeRundownSnapshots: {
						enabled: false,
					},
				},
				support: {
					message: '',
				},
				evaluationsMessage: {
					enabled: false,
					heading: '',
					message: '',
				},
				maximumDataAge: DEFAULT_MAXIMUM_DATA_AGE,
				confirmKeyCode: DEFAULT_CONFIRM_KEY_CODE,
				poisonKey: DEFAULT_POISON_KEY,
			}),
			lastBlueprintConfig: undefined,
		}
		await CoreSystem.insertAsync(system)

		if (!isInTestMode()) {
			// Check what migration has to provide:
			const migration = await prepareMigration(true)
			if (migration.migrationNeeded && migration.chunks.length <= 1) {
				// Since we've determined that the migration can be done automatically, and we have a fresh system, just do the migration automatically:
				await runMigrationFromTrusted(migration.chunks, migration.hash)
			}
		}

		return system
	}

	return system
}

function onCoreSystemChanged(doc: ICoreSystem): void {
	checkDatabaseVersions()
	try {
		updateLoggerLevel(doc, false)
	} catch (e) {
		logger.error(`Failed to update logger level: ${stringifyError(e)}`)
	}
}

export const RelevantSystemVersions = PLazy.from(async () => {
	const versions: { [name: string]: string } = {}

	versions['@mos-connection/helper'] = mosPkgJson.version
	versions['superfly-timeline'] = superTimelinePkgJson.version
	versions['core'] = PackageInfo.versionExtended || PackageInfo.version // package version
	versions['timeline-state-resolver-types'] = TMP_TSR_VERSION

	return versions
})

export function startApmInstrumenting(system: ICoreSystem): void {
	if (isInTestMode()) {
		return
	}

	// attempt init elastic APM
	const { APM_HOST, APM_SECRET, KIBANA_INDEX, APP_HOST } = process.env

	if (APM_HOST && system && system.apm) {
		logger.info(`APM agent starting up`)
		startAgent({
			serviceName: KIBANA_INDEX || 'tv-automation-server-core',
			hostname: APP_HOST,
			serverUrl: APM_HOST,
			secretToken: APM_SECRET,
			active: system.apm.enabled,
			transactionSampleRate: system.apm.transactionSampleRate,
		})
		profiler.setActive(system.apm.enabled || false)
	} else {
		logger.info(`APM agent inactive`)
		startAgent({
			serviceName: 'tv-automation-server-core',
			active: false,
		})
	}
}
export function updateLoggerLevel(coreSystem: ICoreSystem, startup: boolean): void {
	if (isInTestMode()) return // ignore this when running in tests

	if (coreSystem) {
		setLogLevel(coreSystem.logLevel ?? getEnvLogLevel() ?? LogLevel.SILLY, startup)
	} else {
		logger.error('updateLoggerLevel: CoreSystem not found')
	}
}

export async function setupSystemStatusObservers(): Promise<void> {
	// Monitor database changes:
	await CoreSystem.observe(
		SYSTEM_ID,
		{
			added: onCoreSystemChanged,
			changed: onCoreSystemChanged,
			removed: onCoreSystemChanged,
		},
		{ signal: processLifetimeSignal }
	)

	const observeBlueprintChanges = () => {
		checkDatabaseVersions()
	}

	await Blueprints.observeChanges(
		{},
		{
			added: observeBlueprintChanges,
			changed: observeBlueprintChanges,
			removed: observeBlueprintChanges,
		},
		{ projection: { code: 0 }, signal: processLifetimeSignal }
	)

	checkDatabaseVersions()
}
