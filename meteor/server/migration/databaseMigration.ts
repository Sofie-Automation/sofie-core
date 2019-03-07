import {
	parseVersion,
	getCoreSystem,
	compareVersions,
	setCoreSystemVersion,
	Version
} from '../../lib/collections/CoreSystem'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import {
	MigrationMethods,
	RunMigrationResult,
	MigrationChunk,
	MigrationStepType,
	GetMigrationStatusResult
} from '../../lib/api/migration'
import {
	MigrationStepInput,
	MigrationStepInputResult,
	MigrationStepInputFilteredResult,
	MigrationStep,
	MigrationStepBase,
	ValidateFunctionCore,
	MigrateFunctionCore,
	ValidateFunctionStudio,
	ValidateFunctionShowStyle,
	MigrateFunctionStudio,
	MigrateFunctionShowStyle,
	InputFunctionCore,
	InputFunctionStudio,
	InputFunctionShowStyle,
	MigrationContextStudio as IMigrationContextStudio,
	MigrationContextShowStyle as IMigrationContextShowStyle
} from 'tv-automation-sofie-blueprints-integration'
import { setMeteorMethods } from '../methods'
import { logger } from '../../lib/logging'
import { storeSystemSnapshot } from '../api/snapshot'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { Blueprints } from '../../lib/collections/Blueprints'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import { evalBlueprints, MigrationContextStudio, MigrationContextShowStyle } from '../api/blueprints'
import { getHash } from '../../lib/lib'

/** The current database version, x.y.z
 * 0.16.0: Release 3   (2018-10-26)
 * 0.17.0: Release 3.1 (2018-11-14)
 * 0.18.0: Release 4   (2018-11-26)
 * 0.19.0: Release 5   (2019-01-11)
 * 0.20.0: Release 5.1 (2019-02-05)
 * 0.21.0: Release 6   (TBD, in testing)
 * 0.22.0: Release 7   (TBD)
 * 0.23.0: Release 8   (TBD)
 */
export const CURRENT_SYSTEM_VERSION = '0.23.0'

/** In the beginning, there was the database, and the database was with Sofie, and the database was Sofie.
 * And Sofie said: The version of the database is to be GENESIS_SYSTEM_VERSION so that the migration scripts will run.
 */
export const GENESIS_SYSTEM_VERSION = '0.0.0'

/**
 * These versions are not supported anymore (breaking changes occurred after these version)
 */
export const UNSUPPORTED_VERSIONS = [
	// 0.18.0 to 0.19.0: Major refactoring, (ShowStyles was split into ShowStyleBase &
	//    ShowStyleVariant, configs & layers wheremoved from studio to ShowStyles)
	'0.18.0'
]

export function isVersionSupported (version: Version) {
	let isSupported: boolean = true
	_.each(UNSUPPORTED_VERSIONS, (uv) => {
		if (compareVersions(version, parseVersion(uv)) <= 0) {
			isSupported = false
		}
	})
	return isSupported
}

interface MigrationStepInternal extends MigrationStep {
	chunk: MigrationChunk
	_rank: number
	_version: Version // step version
	_validateResult: string | boolean
}

const coreMigrationSteps: Array<MigrationStep> = []

/**
 * Add new system Migration step
 * @param step
 */
export function addMigrationStep (step: MigrationStep) {
	coreMigrationSteps.push(step)
}
/**
 * Convenience method to add multiple steps of the same version
 * @param version
 * @param steps
 */
export function addMigrationSteps (version: string, steps: Array<MigrationStepBase>) {
	_.each(steps, (step) => {
		addMigrationStep(_.extend(step, {
			version: version
		}))
	})
}

export function prepareMigration (returnAllChunks?: boolean) {

	let databaseSystem = getCoreSystem()
	if (!databaseSystem) throw new Meteor.Error(500, 'System version not set up')

	// Discover applicable migration steps:
	let allMigrationSteps: Array<MigrationStepInternal> = []
	let migrationChunks: Array<MigrationChunk> = []
	let rank: number = 0

	// Collect migration steps from core system:
	let chunk: MigrationChunk = {
		sourceType:				MigrationStepType.CORE,
		sourceName:				'system',
		_dbVersion: 			parseVersion(databaseSystem.version).toString(),
		_targetVersion: 		parseVersion(CURRENT_SYSTEM_VERSION).toString(),
		_steps:					[]
	}
	migrationChunks.push(chunk)

	_.each(coreMigrationSteps, (step) => {
		allMigrationSteps.push({
			id:						step.id,
			overrideSteps:			step.overrideSteps,
			validate:				step.validate,
			canBeRunAutomatically:	step.canBeRunAutomatically,
			migrate:				step.migrate,
			input:					step.input,
			dependOnResultFrom:		step.dependOnResultFrom,
			version: 				step.version,
			_version: 				parseVersion(step.version),
			_validateResult: 		false, // to be set later
			_rank: 					rank++,
			chunk: 					chunk
		})
	})
	// Collect migration steps from blueprints:

	Blueprints.find({}).forEach((blueprint) => {
		if (blueprint.code) {
			let bp = evalBlueprints(blueprint)

			console.log('Blueprint: ' + blueprint.name)

			// @ts-ignore
			if (!blueprint.databaseVersion || _.isString(blueprint.databaseVersion)) blueprint.databaseVersion = {}
			if (!blueprint.databaseVersion.showStyle) blueprint.databaseVersion.showStyle = {}
			if (!blueprint.databaseVersion.studio) blueprint.databaseVersion.studio = {}

			// Find all showStyles that uses this blueprint:
			let showStyleBaseIds: {[showStyleBaseId: string]: true} = {}
			let studioIds: {[studioId: string]: true} = {}
			ShowStyleBases.find({
				blueprintId: blueprint._id
			}).forEach((showStyleBase) => {
				showStyleBaseIds[showStyleBase._id] = true

				let chunk: MigrationChunk = {
					sourceType:				MigrationStepType.SHOWSTYLE,
					sourceName:				'Blueprint ' + blueprint.name + ' for showStyle ' + showStyleBase.name,
					blueprintId: 			blueprint._id,
					sourceId: 				showStyleBase._id,
					_dbVersion: 			parseVersion(blueprint.databaseVersion.showStyle[showStyleBase._id] || '0.0.0').toString(),
					_targetVersion: 		parseVersion(bp.blueprintVersion).toString(),
					_steps:					[]
				}
				migrationChunks.push(chunk)
				// Add show-style migration steps from blueprint:
				_.each(bp.showStyleMigrations, (step) => {
					allMigrationSteps.push(prefixIdsOnStep('blueprint_' + blueprint._id + '_showStyle_' + showStyleBase._id + '_', {
						id:						step.id,
						overrideSteps:			step.overrideSteps,
						validate:				step.validate,
						canBeRunAutomatically:	step.canBeRunAutomatically,
						migrate:				step.migrate,
						input:					step.input,
						dependOnResultFrom:		step.dependOnResultFrom,
						version: 				step.version,
						_version: 				parseVersion(step.version),
						_validateResult: 		false, // to be set later
						_rank: 					rank++,
						chunk: 					chunk
					}))
				})

				// Find all studios that supports this showStyle
				StudioInstallations.find({
					supportedShowStyleBase: showStyleBase._id
				}).forEach((studio) => {
					if (!studioIds[studio._id]) { // only run once per blueprint and studio
						studioIds[studio._id] = true

						let chunk: MigrationChunk = {
							sourceType:				MigrationStepType.STUDIO,
							sourceName:				'Blueprint ' + blueprint.name + ' for studio ' + studio.name,
							blueprintId: 			blueprint._id,
							sourceId: 				studio._id,
							_dbVersion: 			parseVersion(blueprint.databaseVersion.studio[studio._id] || '0.0.0').toString(),
							_targetVersion: 		parseVersion(bp.blueprintVersion).toString(),
							_steps:					[]
						}
						migrationChunks.push(chunk)
						// Add studio migration steps from blueprint:
						_.each(bp.studioMigrations, (step) => {
							allMigrationSteps.push(prefixIdsOnStep('blueprint_' + blueprint._id + '_studio_' + studio._id + '_', {
								id:						step.id,
								overrideSteps:			step.overrideSteps,
								validate:				step.validate,
								canBeRunAutomatically:	step.canBeRunAutomatically,
								migrate:				step.migrate,
								input:					step.input,
								dependOnResultFrom:		step.dependOnResultFrom,
								version: 				step.version,
								_version: 				parseVersion(step.version),
								_validateResult: 		false, // to be set later
								_rank: 					rank++,
								chunk: 					chunk
							}))
						})
					}
				})
			})
		}
	})

	// Sort, smallest version first:
	allMigrationSteps.sort((a, b) => {
		let i = compareVersions(a._version, b._version)
		if (i !== 0) return i
		// Keep ranking within version:
		if (a._rank > b._rank) return 1
		if (a._rank < b._rank) return -1
		return 0
	})

	// console.log('allMigrationSteps', allMigrationSteps)

	let automaticStepCount: number = 0
	let manualStepCount: number = 0
	let ignoredStepCount: number = 0

	let partialMigration: boolean = false

	// Filter steps:
	let overrideIds: {[id: string]: true} = {}
	let migrationSteps: {[id: string]: MigrationStepInternal} = {}
	let ignoredSteps: {[id: string]: true} = {}
	_.each(allMigrationSteps, (step: MigrationStepInternal) => {
		if (!step.canBeRunAutomatically && (!step.input || (_.isArray(step.input) && !step.input.length))) throw new Meteor.Error(500, `MigrationStep "${step.id}" is manual, but no input is provided`)

		if (partialMigration) return
		if (
			compareVersions(step._version, parseVersion(step.chunk._dbVersion)) > 0 && // step version is larger than database version
			compareVersions(step._version, parseVersion(step.chunk._targetVersion)) <= 0 // // step version is less than (or equal) to system version
		) {
			// Step is in play

			if (step.overrideSteps) {
				// Override / delete other steps
				_.each(step.overrideSteps, (overrideId: string) => {
					delete migrationSteps[overrideId]
					if (ignoredSteps[overrideId]) {
						delete ignoredSteps[overrideId]
						ignoredStepCount--
					}
				})
			}

			if (migrationSteps[step.id] || ignoredSteps[step.id]) throw new Meteor.Error(500, `Error: MigrationStep.id must be unique: "${step.id}"`)

			if (step.dependOnResultFrom) {
				if (ignoredSteps[step.dependOnResultFrom]) {
					// dependent step was ignored, continue then
				} else if (migrationSteps[step.dependOnResultFrom]) {
					// we gotta pause here
					partialMigration = true
					return
				}
			}

			// Check if the step can be applied:
			if (step.chunk.sourceType === MigrationStepType.CORE) {
				let validate = step.validate as ValidateFunctionCore
				step._validateResult = validate(false)
			} else if (step.chunk.sourceType === MigrationStepType.STUDIO) {
				let validate = step.validate as ValidateFunctionStudio
				step._validateResult = validate(getMigrationStudioContext(step.chunk), false)
			} else if (step.chunk.sourceType === MigrationStepType.SHOWSTYLE) {
				let validate = step.validate as ValidateFunctionShowStyle
				step._validateResult = validate(getMigrationShowStyleContext(step.chunk),false)
			} else throw new Meteor.Error(500, `Unknown step.chunk.sourceType "${step.chunk.sourceType}"`)

			if (step._validateResult) {
				migrationSteps[step.id] = step
			} else {
				// No need to run step
				ignoredSteps[step.id] = true
				ignoredStepCount++
			}
		} else {
			// Step is not applicable
		}
	})

	// console.log('migrationSteps', migrationSteps)

	// check if there are any manual steps:
	// (this makes an automatic migration impossible)

	let manualInputs: Array<MigrationStepInput> = []
	let stepsHash: Array<string> = []
	_.each(migrationSteps, (step: MigrationStepInternal, id: string) => {
		stepsHash.push(step.id)
		step.chunk._steps.push(step.id)
		if (!step.canBeRunAutomatically) {
			manualStepCount++

			if (step.input) {
				let input: Array<MigrationStepInput> = []
				if (_.isArray(step.input)) {
					input = []
					_.each(step.input, (i) => {
						input.push(_.clone(i))
					})
				} else if (_.isFunction(step.input)) {

					if (step.chunk.sourceType === MigrationStepType.CORE) {
						let inputFunction = step.input as InputFunctionCore
						input = inputFunction()
					} else if (step.chunk.sourceType === MigrationStepType.STUDIO) {
						let inputFunction = step.input as InputFunctionStudio
						input = inputFunction(getMigrationStudioContext(step.chunk))
					} else if (step.chunk.sourceType === MigrationStepType.SHOWSTYLE) {
						let inputFunction = step.input as InputFunctionShowStyle
						input = inputFunction(getMigrationShowStyleContext(step.chunk))
					} else throw new Meteor.Error(500, `Unknown step.chunk.sourceType "${step.chunk.sourceType}"`)
				}
				if (input.length) {
					_.each(input, (i) => {

						if (i.label && _.isString(step._validateResult)) {
							i.label = (i.label + '').replace(/\$validation/g, step._validateResult)
						}
						if (i.description && _.isString(step._validateResult)) {
							i.description = (i.description + '').replace(/\$validation/g, step._validateResult)
						}
						manualInputs.push(_.extend({}, i, {
							stepId: step.id
						}))
					})
				}
			}
		} else {
			automaticStepCount++
		}
	})

	// Only return the chunks which has steps in them:
	let activeChunks = (
		returnAllChunks ?
		migrationChunks :
		_.filter(migrationChunks, (chunk) => {
			return chunk._steps.length > 0
		})
	)

	let hash = getHash(stepsHash.join(','))

	return {
		hash:				hash,
		chunks: 			activeChunks,
		steps: 				_.values(migrationSteps),
		automaticStepCount: automaticStepCount,
		manualStepCount: 	manualStepCount,
		ignoredStepCount: 	ignoredStepCount,
		manualInputs: 		manualInputs,
		partialMigration: 	partialMigration
	}
}
function prefixIdsOnStep (prefix: string, step: MigrationStepInternal): MigrationStepInternal {
	step.id = prefix + step.id
	if (step.overrideSteps) {
		step.overrideSteps = _.map(step.overrideSteps, (override) => {
			return prefix + override
		})
	}
	if (step.dependOnResultFrom) {
		step.dependOnResultFrom = prefix + step.dependOnResultFrom
	}
	return step
}

export function runMigration (
	chunks: Array<MigrationChunk>,
	hash: string,
	inputResults: Array<MigrationStepInputResult>,
	isFirstOfPartialMigrations = true
): RunMigrationResult {

	logger.info(`Migration: Starting`)
	// logger.info(`Migration: Starting, from "${baseVersion.toString()}" to "${targetVersion.toString()}".`)

	// Verify the input:
	let migration = prepareMigration(true)

	let manualInputsWithUserPrompt = _.filter(migration.manualInputs, (manualInput) => {
		return !!(manualInput.stepId && manualInput.attribute)
	})
	if (migration.hash !== hash) throw new Meteor.Error(500, `Migration input hash differ from expected: "${hash}", "${migration.hash}"`)
	if (manualInputsWithUserPrompt.length !== inputResults.length ) throw new Meteor.Error(500, `Migration manualInput lengths differ from expected: "${inputResults.length}", "${migration.manualInputs.length}"`)

	console.log('migration.chunks', migration.chunks)
	console.log('chunks', chunks)
	// Check that chunks match:
	let unmatchedChunk = _.find(migration.chunks, (migrationChunk) => {
		return !_.find(chunks, (chunk) => {
			return _.isEqual(_.omit(chunk, ['_steps']), _.omit(migrationChunk, ['_steps']))
		})
	})
	if (unmatchedChunk) throw new Meteor.Error(500, `Migration input chunks differ from expected, chunk "${JSON.stringify(unmatchedChunk)}" not found in input`)
	unmatchedChunk = _.find(chunks, (chunk) => {
		return !_.find(migration.chunks, (migrationChunk) => {
			return _.isEqual(_.omit(chunk, ['_steps']), _.omit(migrationChunk, ['_steps']))
		})
	})
	if (unmatchedChunk) throw new Meteor.Error(500, `Migration input chunks differ from expected, chunk in input "${JSON.stringify(unmatchedChunk)}" not found in migration.chunks`)
	if (migration.chunks.length !== chunks.length) throw new Meteor.Error(500, `Migration input chunk lengths differ`)

	_.each(migration.chunks, (chunk) => {
		logger.info(`Migration: Chunk: ${chunk.sourceType}, ${chunk.sourceName}, from ${chunk._dbVersion} to ${chunk._targetVersion}`)
	})

	let warningMessages: Array<string> = []
	let snapshotId: string = ''
	if (isFirstOfPartialMigrations) { // First, take a system snapshot:
		let system = getCoreSystem()
		if (system && system.storePath) {
			try {
				snapshotId = storeSystemSnapshot(null, `Automatic, taken before migration`)
			} catch (e) {
				warningMessages.push(`Error when taking snapshot:${e.toString()}`)
				logger.error(e)
			}
		}
	}

	logger.info(`Migration: ${migration.automaticStepCount} automatic and ${migration.manualStepCount} manual steps (${migration.ignoredStepCount} ignored).`)

	logger.debug(inputResults)

	_.each(migration.steps, (step: MigrationStepInternal) => {

		try {
			// Prepare input from user
			let stepInput: MigrationStepInputFilteredResult = {}
			_.each(inputResults, (ir) => {
				if (ir.stepId === step.id) {
					stepInput[ir.attribute] = ir.value
				}
			})

			// Run the migration script

			if (step.migrate !== undefined) {
				if (step.chunk.sourceType === MigrationStepType.CORE) {
					let migration = step.migrate as MigrateFunctionCore
					migration(stepInput)
				} else if (step.chunk.sourceType === MigrationStepType.STUDIO) {
					let migration = step.migrate as MigrateFunctionStudio
					migration(getMigrationStudioContext(step.chunk), stepInput)
				} else if (step.chunk.sourceType === MigrationStepType.SHOWSTYLE) {
					let migration = step.migrate as MigrateFunctionShowStyle
					migration(getMigrationShowStyleContext(step.chunk), stepInput)
				} else throw new Meteor.Error(500, `Unknown step.chunk.sourceType "${step.chunk.sourceType}"`)
			}

			// After migration, run the validation again
			// Since the migration should be done by now, the validate should return true

			let validateMessage: string | boolean = false

			if (step.chunk.sourceType === MigrationStepType.CORE) {
				let validate = step.validate as ValidateFunctionCore
				validateMessage = validate(true)
			} else if (step.chunk.sourceType === MigrationStepType.STUDIO) {
				let validate = step.validate as ValidateFunctionStudio
				validateMessage = validate(getMigrationStudioContext(step.chunk), true)
			} else if (step.chunk.sourceType === MigrationStepType.SHOWSTYLE) {
				let validate = step.validate as ValidateFunctionShowStyle
				validateMessage = validate(getMigrationShowStyleContext(step.chunk),true)
			} else throw new Meteor.Error(500, `Unknown step.chunk.sourceType "${step.chunk.sourceType}"`)

			// let validate = step.validate as ValidateFunctionCore
			// let validateMessage: string | boolean = validate(true)
			if (validateMessage) {
				// Something's not right
				let msg = `Step "${step.id}": Something went wrong, validation didn't approve of the changes. The changes have been applied, but might need to be confirmed.`
				if (validateMessage !== true && _.isString(validateMessage)) {
					msg += ` (Validation error: ${validateMessage})`
				}
				warningMessages.push(msg)
			}
		} catch (e) {
			logger.error(`Error in Migration step ${step.id}: ${e}`)
			logger.error(e.stack ? e.stack : e.toString())
			warningMessages.push(`Internal server error in step ${step.id}`)
		}
	})

	let migrationCompleted: boolean = false

	if (migration.manualStepCount === 0 && !warningMessages.length) { // continue automatically with the next batch
		migration.partialMigration = false
		const s = getMigrationStatus()
		const res = runMigration(s.migration.chunks, s.migration.hash, inputResults, false)
		if (res.migrationCompleted) {
			return res
		}

	}
	if (!migration.partialMigration && !warningMessages.length) {
		// if there are no warning messages, we can complete the migration right away:
		logger.info(`Migration: Completing...`)
		completeMigration(migration.chunks)
		migrationCompleted = true
	}

	_.each(warningMessages, (str) => {
		logger.warn(`Migration: ${str}`)
	})
	logger.info(`Migration: End`)
	return {
		migrationCompleted: migrationCompleted,
		partialMigration: migration.partialMigration,
		warnings: warningMessages,
		snapshot: snapshotId
	}
}
function completeMigration (chunks: Array<MigrationChunk>) {
	_.each(chunks, (chunk) => {
		if (chunk.sourceType === MigrationStepType.CORE) {
			setCoreSystemVersion(chunk._targetVersion.toString())
		} else if (
			chunk.sourceType === MigrationStepType.STUDIO ||
			chunk.sourceType === MigrationStepType.SHOWSTYLE
		) {

			if (!chunk.blueprintId) throw new Meteor.Error(500, `chunk.blueprintId missing!`)
			if (!chunk.sourceId) throw new Meteor.Error(500, `chunk.sourceId missing!`)

			let blueprint = Blueprints.findOne(chunk.blueprintId)
			if (!blueprint) throw new Meteor.Error(404, `Blueprint "${chunk.blueprintId}" not found!`)

			let m: any = {}
			if (chunk.sourceType === MigrationStepType.STUDIO) {
				logger.info(`Updating Blueprint "${chunk.sourceName}" version, from "${blueprint.databaseVersion.studio[chunk.sourceId]}" to "${chunk._targetVersion.toString()}".`)
				m[`databaseVersion.studio.${chunk.sourceId}`] = chunk._targetVersion.toString()

			} else if (chunk.sourceType === MigrationStepType.SHOWSTYLE) {
				logger.info(`Updating Blueprint "${chunk.sourceName}" version, from "${blueprint.databaseVersion.showStyle[chunk.sourceId]}" to "${chunk._targetVersion.toString()}".`)
				m[`databaseVersion.showStyle.${chunk.sourceId}`] = chunk._targetVersion.toString()

			} else throw new Meteor.Error(500, `Bad chunk.sourcetype: "${chunk.sourceType}"`)

			Blueprints.update(chunk.blueprintId, {$set: m})
		} else throw new Meteor.Error(500, `Unknown chunk.sourcetype: "${chunk.sourceType}"`)
	})
}
export function updateDatabaseVersion (targetVersionStr: string) {
	let targetVersion = parseVersion(targetVersionStr)
	setCoreSystemVersion(targetVersion.toString())
}

export function updateDatabaseVersionToSystem () {
	updateDatabaseVersion(CURRENT_SYSTEM_VERSION)
}

function getMigrationStatus (): GetMigrationStatusResult {

	let migration = prepareMigration(true)

	return {
		// databaseVersion:	 		databaseVersion.toString(),
		// databasePreviousVersion:	system.previousVersion,
		// systemVersion:		 		systemVersion.toString(),
		migrationNeeded:	 			migration.steps.length > 0,

		migration: {
			canDoAutomaticMigration:	migration.manualStepCount === 0,

			manualInputs:				migration.manualInputs,
			hash:						migration.hash,
			chunks:						migration.chunks,

			automaticStepCount: 		migration.automaticStepCount,
			manualStepCount: 			migration.manualStepCount,
			ignoredStepCount: 			migration.ignoredStepCount,
			partialMigration: 			migration.partialMigration
		}
	}

}
function forceMigration (chunks: Array<MigrationChunk>) {
	logger.info(`Force migration`)

	_.each(chunks, (chunk) => {
		logger.info(`Force migration: Chunk: ${chunk.sourceType}, ${chunk.sourceName}, from ${chunk._dbVersion} to ${chunk._targetVersion}`)
	})

	return completeMigration(chunks)
}
function resetDatabaseVersions () {
	updateDatabaseVersion(GENESIS_SYSTEM_VERSION)

	Blueprints.find().forEach((blueprint) => {
		Blueprints.update(blueprint._id, {$set: {
			databaseVersion: {
				studio: {},
				showStyle: {}
			}
		}})
	})
}

function getMigrationStudioContext (chunk: MigrationChunk): IMigrationContextStudio {

	if (chunk.sourceType !== MigrationStepType.STUDIO) throw new Meteor.Error(500, `wrong chunk.sourceType "${chunk.sourceType}", expected STUDIO`)
	if (!chunk.sourceId) throw new Meteor.Error(500, `chunk.sourceId missing` )

	let studio = StudioInstallations.findOne(chunk.sourceId)
	if (!studio) throw new Meteor.Error(404, `Studio "${chunk.sourceId}" not found`)

	return new MigrationContextStudio(studio)
}
function getMigrationShowStyleContext (chunk: MigrationChunk): IMigrationContextShowStyle {
	if (chunk.sourceType !== MigrationStepType.SHOWSTYLE) throw new Meteor.Error(500, `wrong chunk.sourceType "${chunk.sourceType}", expected SHOWSTYLE`)
	if (!chunk.sourceId) throw new Meteor.Error(500, `chunk.sourceId missing` )

	let showStyleBase = ShowStyleBases.findOne(chunk.sourceId)
	if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase "${chunk.sourceId}" not found`)

	return new MigrationContextShowStyle(showStyleBase)
}

let methods = {}
methods[MigrationMethods.getMigrationStatus] = getMigrationStatus
methods[MigrationMethods.runMigration] = runMigration
methods[MigrationMethods.forceMigration] = forceMigration
methods[MigrationMethods.resetDatabaseVersions] = resetDatabaseVersions
methods['debug_setVersion'] = (version: string) => {
	return updateDatabaseVersion (version)
}

setMeteorMethods(methods)
