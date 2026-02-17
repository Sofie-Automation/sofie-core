import { Meteor } from 'meteor/meteor'
import * as semver from 'semver'
import {
	MigrateFunctionCore,
	MigrationStep,
	ValidateFunctionCore,
	ValidateFunction,
	MigrateFunction,
	MigrationStepCore,
} from '@sofie-automation/meteor-lib/dist/migrations'
import _ from 'underscore'
import {
	GetMigrationStatusResult,
	MigrationChunk,
	MigrationStepType,
	RunMigrationResult,
} from '@sofie-automation/meteor-lib/dist/api/migration'
import { logger } from '../logging'
import { internalStoreSystemSnapshot } from '../api/snapshot'
import { parseVersion, Version } from '../systemStatus/semverUtils'
import { GENESIS_SYSTEM_VERSION } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { getHash, omit } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { SnapshotId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Blueprints } from '../collections'
import { getSystemStorePath } from '../coreSystem'
import { getCoreSystemAsync, setCoreSystemVersion } from '../coreSystem/collection'

/**
 * These versions are not supported anymore (breaking changes occurred after these versions)
 * This means that things like snaphots from older versions cannot be restored from
 */
export const UNSUPPORTED_VERSIONS = [
	// 0.18.0 to 0.19.0: Major refactoring, (ShowStyles was split into ShowStyleBase &
	//    ShowStyleVariant, configs & layers wher emoved from studio to ShowStyles)
	'<=0.18',
	// 0.24.0 to 0.25.0: Major refactoring, Renaming of RunningOrders, segmentLines & segmentLineItems to Rundowns, parts & pieces. And a lot more
	'<=0.24',
	// Only support versions from the last 12 months:
	'<0.39',
]

export function isVersionSupported(version: Version): boolean {
	let isSupported = true
	for (const uv of UNSUPPORTED_VERSIONS) {
		if (semver.satisfies(version, uv)) {
			isSupported = false
		}
	}
	return isSupported
}

interface MigrationStepInternal extends MigrationStep<ValidateFunction, MigrateFunction> {
	chunk: MigrationChunk
	_rank: number
	_version: Version // step version
	_validateResult: string | boolean
}

const coreMigrationSteps: Array<MigrationStepCore> = []

/**
 * Convenience method to add multiple steps of the same version
 * @param version
 * @param steps
 */
export function addMigrationSteps(version: string, steps: Array<Omit<MigrationStepCore, 'version'>>) {
	return (): void => {
		for (const step of steps) {
			;(step as MigrationStepCore).version = version
			coreMigrationSteps.push(step as MigrationStepCore)
		}
	}
}
/** Removes all migration steps (used in tests) */
export function clearMigrationSteps(): void {
	coreMigrationSteps.splice(0, 99999)
}

export interface PreparedMigration {
	hash: string
	chunks: MigrationChunk[]
	steps: MigrationStepInternal[]
	migrationNeeded: boolean
	automaticStepCount: number
	ignoredStepCount: number
	partialMigration: boolean
}
export async function prepareMigration(returnAllChunks?: boolean): Promise<PreparedMigration> {
	const databaseSystem = await getCoreSystemAsync()
	if (!databaseSystem) throw new Meteor.Error(500, 'System version not set up')

	// Discover applicable migration steps:
	let migrationNeeded = false
	const allMigrationSteps: Array<MigrationStepInternal> = []
	const migrationChunks: Array<MigrationChunk> = []
	let rank = 0

	const databaseVersion = parseVersion(databaseSystem.version)
	const targetVersion = parseVersion(CURRENT_SYSTEM_VERSION)

	if (!semver.eq(databaseVersion, targetVersion)) migrationNeeded = true

	// Collect migration steps from core system:
	const chunk: MigrationChunk = {
		sourceType: MigrationStepType.CORE,
		sourceName: 'system',
		_dbVersion: databaseVersion,
		_targetVersion: targetVersion,
		_steps: [],
	}
	migrationChunks.push(chunk)

	// Collect migration steps from system:
	for (const step of coreMigrationSteps) {
		allMigrationSteps.push({
			id: step.id,
			overrideSteps: step.overrideSteps,
			validate: step.validate.bind(step),
			canBeRunAutomatically: step.canBeRunAutomatically,
			migrate: step.migrate?.bind(step),
			dependOnResultFrom: step.dependOnResultFrom,
			version: step.version,
			_version: parseVersion(step.version),
			_validateResult: false, // to be set later
			_rank: rank++,
			chunk: chunk,
		})
	}

	// Sort, smallest version first:
	allMigrationSteps.sort((a, b) => {
		// First, sort by type:
		if (a.chunk.sourceType === MigrationStepType.CORE && b.chunk.sourceType !== MigrationStepType.CORE) return -1
		if (a.chunk.sourceType !== MigrationStepType.CORE && b.chunk.sourceType === MigrationStepType.CORE) return 1

		// Then, sort by version:
		if (semver.gt(a._version, b._version)) return 1
		if (semver.lt(a._version, b._version)) return -1

		// Lastly, keep ranking:
		if (a._rank > b._rank) return 1
		if (a._rank < b._rank) return -1
		return 0
	})

	let automaticStepCount = 0
	let ignoredStepCount = 0

	let partialMigration = false

	// Filter steps:
	const migrationSteps: { [id: string]: MigrationStepInternal } = {}
	const ignoredSteps: { [id: string]: true } = {}
	let includesCoreStep = false
	for (const step of allMigrationSteps) {
		if (step.chunk.sourceType !== MigrationStepType.CORE && includesCoreStep) {
			// stop here as core migrations need to be run before anything else can
			partialMigration = true
			continue
		}

		if (partialMigration) continue
		if (
			semver.gt(step._version, step.chunk._dbVersion) && // step version is larger than database version
			semver.lte(step._version, step.chunk._targetVersion) // // step version is less than (or equal) to system version
		) {
			// Step is in play
			if (step.overrideSteps) {
				// Override / delete other steps
				for (const overrideId of step.overrideSteps) {
					delete migrationSteps[overrideId]
					if (ignoredSteps[overrideId]) {
						delete ignoredSteps[overrideId]
						ignoredStepCount--
					}
				}
			}

			if (migrationSteps[step.id] || ignoredSteps[step.id])
				throw new Meteor.Error(500, `Error: MigrationStep.id must be unique: "${step.id}"`)

			if (step.dependOnResultFrom) {
				if (ignoredSteps[step.dependOnResultFrom]) {
					// dependent step was ignored, continue then
				} else if (migrationSteps[step.dependOnResultFrom]) {
					// we gotta pause here
					partialMigration = true
					continue
				}
			}

			// Check if the step can be applied:
			try {
				if (step.chunk.sourceType === MigrationStepType.CORE) {
					const validate = step.validate as ValidateFunctionCore
					step._validateResult = await validate(false)
				} else throw new Meteor.Error(500, `Unknown step.chunk.sourceType "${step.chunk.sourceType}"`)
			} catch (error) {
				throw new Meteor.Error(500, `Error in migration step "${step.id}": ${stringifyError(error)}`)
			}

			if (step._validateResult) {
				migrationSteps[step.id] = step
				includesCoreStep = includesCoreStep || step.chunk.sourceType === MigrationStepType.CORE
			} else {
				// No need to run step
				ignoredSteps[step.id] = true
				ignoredStepCount++
			}
		} else {
			// Step is not applicable
		}
	}

	// check if there are any manual steps:
	// (this makes an automatic migration impossible)

	const stepsHash: Array<string> = []
	for (const step of Object.values<MigrationStepInternal>(migrationSteps)) {
		stepsHash.push(step.id)
		step.chunk._steps.push(step.id)

		automaticStepCount++
	}

	// Only return the chunks which has steps in them:
	const activeChunks = returnAllChunks
		? migrationChunks
		: migrationChunks.filter((chunk) => {
				return chunk._steps.length > 0
			})
	const hash = getHash(stepsHash.join(','))

	const steps = Object.values<MigrationStepInternal>(migrationSteps)

	if (steps.length > 0) migrationNeeded = true

	return {
		hash: hash,
		chunks: activeChunks,
		steps: steps,
		migrationNeeded: migrationNeeded,
		automaticStepCount: automaticStepCount,
		ignoredStepCount: ignoredStepCount,
		partialMigration: partialMigration,
	}
}

export async function runMigration(
	chunks: Array<MigrationChunk>,
	hash: string,
	isFirstOfPartialMigrations = true,
	chunksLeft = 20
): Promise<RunMigrationResult> {
	if (chunksLeft < 0) {
		logger.error(`Migration: Bailing out, looks like we're in a loop`)
		throw new Meteor.Error(500, 'Infinite loop in migrations')
	}
	logger.info(`Migration: Starting`)
	// logger.info(`Migration: Starting, from "${baseVersion}" to "${targetVersion}".`)

	// Verify the input:
	const migration = await prepareMigration(true)

	if (migration.hash !== hash)
		throw new Meteor.Error(500, `Migration input hash differ from expected: "${hash}", "${migration.hash}"`)

	// Check that chunks match:
	let unmatchedChunk = migration.chunks.find((migrationChunk) => {
		return !chunks.find((chunk) => {
			return _.isEqual(omit(chunk, '_steps'), omit(migrationChunk, '_steps'))
		})
	})
	if (unmatchedChunk)
		throw new Meteor.Error(
			500,
			`Migration input chunks differ from expected, chunk "${JSON.stringify(unmatchedChunk)}" not found in input`
		)
	unmatchedChunk = chunks.find((chunk) => {
		return !migration.chunks.find((migrationChunk) => {
			return _.isEqual(omit(chunk, '_steps'), omit(migrationChunk, '_steps'))
		})
	})
	if (unmatchedChunk)
		throw new Meteor.Error(
			500,
			`Migration input chunks differ from expected, chunk in input "${JSON.stringify(
				unmatchedChunk
			)}" not found in migration.chunks`
		)
	if (migration.chunks.length !== chunks.length) throw new Meteor.Error(500, `Migration input chunk lengths differ`)

	for (const chunk of migration.chunks) {
		logger.info(
			`Migration: Chunk: ${chunk.sourceType}, ${chunk.sourceName}, from ${chunk._dbVersion} to ${chunk._targetVersion}`
		)
	}

	const warningMessages: Array<string> = []
	let snapshotId: SnapshotId = protectString('')
	if (isFirstOfPartialMigrations) {
		// First, take a system snapshot:
		const storePath = getSystemStorePath()
		if (storePath) {
			try {
				snapshotId = await internalStoreSystemSnapshot({}, `Automatic, taken before migration`)
			} catch (e) {
				warningMessages.push(`Error when taking snapshot:${stringifyError(e)}`)
				logger.error(e)
			}
		}
	}

	logger.info(`Migration: ${migration.automaticStepCount} steps (${migration.ignoredStepCount} ignored).`)

	for (const step of migration.steps) {
		try {
			// Run the migration script

			if (step.migrate !== undefined) {
				logger.info(`Running migration step "${step.id}"`)

				if (step.chunk.sourceType === MigrationStepType.CORE) {
					const migration = step.migrate as MigrateFunctionCore
					await migration()
				} else throw new Meteor.Error(500, `Unknown step.chunk.sourceType "${step.chunk.sourceType}"`)
			}

			// After migration, run the validation again
			// Since the migration should be done by now, the validate should return true

			let validateMessage: string | boolean = false

			if (step.chunk.sourceType === MigrationStepType.CORE) {
				const validate = step.validate as ValidateFunctionCore
				validateMessage = await validate(true)
			} else throw new Meteor.Error(500, `Unknown step.chunk.sourceType "${step.chunk.sourceType}"`)

			// let validate = step.validate as ValidateFunctionCore
			// let validateMessage: string | boolean = validate(true)
			if (validateMessage) {
				// Something's not right
				let msg = `Step "${step.id}": Something went wrong, validation didn't approve of the changes. The changes have been applied, but might need to be confirmed.`
				if (validateMessage !== true && typeof validateMessage === 'string') {
					msg += ` (Validation error: ${validateMessage})`
				}
				warningMessages.push(msg)
			}
		} catch (e) {
			logger.error(`Error in Migration step ${step.id}: ${stringifyError(e)}`)
			warningMessages.push(`Internal server error in step ${step.id}`)
		}
	}

	let migrationCompleted = false

	if (!warningMessages.length) {
		// continue automatically with the next batch
		logger.info('Migration: Automatically continuing with next batch..')
		migration.partialMigration = false
		const s = await getMigrationStatus()
		if (s.migration.automaticStepCount > 0) {
			try {
				const res = await runMigration(s.migration.chunks, s.migration.hash, false, chunksLeft - 1)
				if (res.migrationCompleted) {
					return res
				}

				warningMessages.push(...res.warnings)
			} catch (e) {
				warningMessages.push(`When running next chunk: ${e}`)
				migration.partialMigration = true
			}
		}
	}
	if (!migration.partialMigration && !warningMessages.length) {
		// if there are no warning messages, we can complete the migration right away:
		logger.info(`Migration: Completing...`)
		await completeMigration(migration.chunks)
		migrationCompleted = true
	}

	for (const str of warningMessages) {
		logger.warn(`Migration: ${str}`)
	}
	logger.info(`Migration: End`)
	return {
		migrationCompleted: migrationCompleted,
		partialMigration: migration.partialMigration,
		warnings: warningMessages,
		snapshot: snapshotId,
	}
}
async function completeMigration(chunks: Array<MigrationChunk>) {
	for (const chunk of chunks) {
		if (chunk.sourceType === MigrationStepType.CORE) {
			await setCoreSystemVersion(chunk._targetVersion)
		} else throw new Meteor.Error(500, `Unknown chunk.sourcetype: "${chunk.sourceType}"`)
	}
}
export async function updateDatabaseVersion(targetVersionStr: string): Promise<void> {
	const targetVersion = parseVersion(targetVersionStr)
	await setCoreSystemVersion(targetVersion)
}

export async function getMigrationStatus(): Promise<GetMigrationStatusResult> {
	const migration = await prepareMigration(true)

	return {
		// databaseVersion:	 		databaseVersion,
		// databasePreviousVersion:	system.previousVersion,
		// systemVersion:		 		systemVersion,
		migrationNeeded: migration.migrationNeeded,

		migration: {
			hash: migration.hash,
			chunks: migration.chunks,

			automaticStepCount: migration.automaticStepCount,
			ignoredStepCount: migration.ignoredStepCount,
			partialMigration: migration.partialMigration,
		},
	}
}
export async function forceMigration(chunks: Array<MigrationChunk>): Promise<void> {
	logger.info(`Force migration`)

	for (const chunk of chunks) {
		logger.info(
			`Force migration: Chunk: ${chunk.sourceType}, ${chunk.sourceName}, from ${chunk._dbVersion} to ${chunk._targetVersion}`
		)
	}

	return completeMigration(chunks)
}
export async function resetDatabaseVersions(): Promise<void> {
	await updateDatabaseVersion(GENESIS_SYSTEM_VERSION)

	await Blueprints.updateAsync(
		{
			// All
		},
		{
			$set: {
				databaseVersion: {
					system: '',
				},
			},
		},
		{ multi: true }
	)
}
