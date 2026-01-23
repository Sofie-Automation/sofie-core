import _ from 'underscore'
import { setupEmptyEnvironment, setupMockStudio } from '../../../__mocks__/helpers/database'
import { ICoreSystem, GENESIS_SYSTEM_VERSION } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { clearMigrationSteps, addMigrationSteps, prepareMigration, PreparedMigration } from '../databaseMigration'
import { CURRENT_SYSTEM_VERSION } from '../currentSystemVersion'
import { RunMigrationResult, GetMigrationStatusResult } from '@sofie-automation/meteor-lib/dist/api/migration'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { MigrationStepCore, MigrationStepInputResult } from '@sofie-automation/blueprints-integration'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { MeteorCall } from '../../api/methods'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleBases, ShowStyleVariants, Studios } from '../../collections'
import { getCoreSystemAsync } from '../../coreSystem/collection'
import fs from 'fs'

require('../../api/peripheralDevice.ts') // include in order to create the Meteor methods needed
require('../api') // include in order to create the Meteor methods needed
require('../../api/blueprints/api.ts') // include in order to create the Meteor methods needed

require('../migrations') // include in order to create the migration steps

// Include all migration scripts:
const normalizedPath = require('path').join(__dirname, '../')
fs.readdirSync(normalizedPath).forEach((fileName) => {
	if (fileName.match(/\d+_\d+_\d+\.ts/)) {
		// x_y_z.ts
		require('../' + fileName)
	}
})

describe('Migrations', () => {
	beforeAll(async () => {
		await setupEmptyEnvironment()
	})
	async function getSystem() {
		return (await getCoreSystemAsync()) as ICoreSystem
	}
	function userInput(
		migrationStatus: GetMigrationStatusResult,
		userValues?: { [key: string]: any }
	): MigrationStepInputResult[] {
		return _.compact(
			_.map(migrationStatus.migration.manualInputs, (manualInput) => {
				if (manualInput.stepId && manualInput.attribute) {
					return literal<MigrationStepInputResult>({
						stepId: manualInput.stepId,
						attribute: manualInput.attribute,
						value: userValues && userValues[manualInput.stepId],
					})
				}
			})
		)
	}
	test('System migrations, initial setup', async () => {
		expect((await getSystem()).version).toEqual(GENESIS_SYSTEM_VERSION)

		const migrationStatus0: GetMigrationStatusResult = await MeteorCall.migration.getMigrationStatus()

		expect(migrationStatus0.migration.automaticStepCount).toBeGreaterThanOrEqual(1)

		expect(migrationStatus0).toMatchObject({
			migrationNeeded: true,

			migration: {
				canDoAutomaticMigration: true,
				// manualInputs: [],
				hash: expect.stringContaining(''),
				automaticStepCount: expect.any(Number),
				manualStepCount: expect.any(Number),
				ignoredStepCount: expect.any(Number),
				partialMigration: true,
				// chunks: expect.any(Array)
			},
		})

		const migrationResult0: RunMigrationResult = await MeteorCall.migration.runMigration(
			migrationStatus0.migration.chunks,
			migrationStatus0.migration.hash,
			userInput(migrationStatus0)
		)

		expect(migrationResult0).toMatchObject({
			migrationCompleted: true,
			partialMigration: false,
			warnings: [],
			snapshot: expect.any(String),
		})

		expect((await getSystem()).version).toEqual(CURRENT_SYSTEM_VERSION)
	})

	test('Ensure migrations run in correct order', async () => {
		await MeteorCall.migration.resetDatabaseVersions()

		expect((await getSystem()).version).toEqual(GENESIS_SYSTEM_VERSION)

		clearMigrationSteps()

		const addSteps0_2_0 = addMigrationSteps('0.2.0', [
			{
				id: 'myCoreMockStep2',
				canBeRunAutomatically: true,
				validate: async () => {
					if (!(await Studios.findOneAsync(protectString('studioMock2')))) return 'No Studio found'
					return false
				},
				migrate: async () => {
					await setupMockStudio({
						_id: protectString('studioMock2'),
					})
				},
			},
		])
		const addSteps0_3_0 = addMigrationSteps('0.3.0', [
			{
				id: 'myCoreMockStep3',
				canBeRunAutomatically: true,
				validate: async () => {
					if (!(await Studios.findOneAsync(protectString('studioMock3')))) return 'No Studio found'
					return false
				},
				migrate: async () => {
					await setupMockStudio({
						_id: protectString('studioMock3'),
					})
				},
			},
		])
		const addSteps0_1_0 = addMigrationSteps('0.1.0', [
			{
				id: 'myCoreMockStep1',
				canBeRunAutomatically: true,
				validate: async () => {
					if (!(await Studios.findOneAsync(protectString('studioMock1')))) return 'No Studio found'
					return false
				},
				migrate: async () => {
					await setupMockStudio({
						_id: protectString('studioMock1'),
					})
				},
			},
		])
		addSteps0_2_0()
		addSteps0_3_0()
		addSteps0_1_0()

		let migration: PreparedMigration

		migration = await prepareMigration(true)
		expect(migration.migrationNeeded).toEqual(true)
		expect(migration.automaticStepCount).toEqual(3)

		expect(_.find(migration.steps, (s) => !!s.id.match(/myCoreMockStep1/))).toBeTruthy()
		expect(_.find(migration.steps, (s) => !!s.id.match(/myCoreMockStep2/))).toBeTruthy()
		expect(_.find(migration.steps, (s) => !!s.id.match(/myCoreMockStep3/))).toBeTruthy()

		const studio = (await Studios.findOneAsync({})) as DBStudio
		expect(studio).toBeTruthy()

		await ShowStyleBases.insertAsync({
			_id: protectString('showStyle0'),
			name: '',
			blueprintId: protectString('showStyle0'),
			outputLayersWithOverrides: wrapDefaultObject({}),
			sourceLayersWithOverrides: wrapDefaultObject({}),
			hotkeyLegend: [],
			blueprintConfigWithOverrides: wrapDefaultObject({}),
			_rundownVersionHash: '',
			lastBlueprintConfig: undefined,
			lastBlueprintFixUpHash: undefined,
		})

		await ShowStyleVariants.insertAsync({
			_id: protectString('variant0'),
			name: '',
			showStyleBaseId: protectString('showStyle0'),
			blueprintConfigWithOverrides: wrapDefaultObject({}),
			_rundownVersionHash: '',
			_rank: 0,
		})

		await Studios.updateAsync(studio._id, {
			$set: {
				blueprintId: protectString('studio0'),
			},
		})

		// migrationStatus = Meteor.call(MigrationMethods.getMigrationStatus)
		migration = await prepareMigration(true)

		expect(migration.migrationNeeded).toEqual(true)

		// const _steps = migration.steps as MigrationStep[]

		// Note: This test is temporarily disabled, pending discussion regarding migrations
		// /@nytamin 2020-08-27
		/*

		expect(migration.automaticStepCount).toEqual(3 + 6)

		const myCoreMockStep1 = _.find(steps, (s) => s.id.match(/myCoreMockStep1/)) as MigrationStep
		const myCoreMockStep2 = _.find(steps, (s) => s.id.match(/myCoreMockStep2/)) as MigrationStep
		const myCoreMockStep3 = _.find(steps, (s) => s.id.match(/myCoreMockStep3/)) as MigrationStep
		const myStudioMockStep1 = _.find(steps, (s) => s.id.match(/myStudioMockStep1/)) as MigrationStep
		const myStudioMockStep2 = _.find(steps, (s) => s.id.match(/myStudioMockStep2/)) as MigrationStep
		const myStudioMockStep3 = _.find(steps, (s) => s.id.match(/myStudioMockStep3/)) as MigrationStep
		const myShowStyleMockStep1 = _.find(steps, (s) => s.id.match(/myShowStyleMockStep1/)) as MigrationStep
		const myShowStyleMockStep2 = _.find(steps, (s) => s.id.match(/myShowStyleMockStep2/)) as MigrationStep
		const myShowStyleMockStep3 = _.find(steps, (s) => s.id.match(/myShowStyleMockStep3/)) as MigrationStep

		expect(myCoreMockStep1).toBeTruthy()
		expect(myCoreMockStep2).toBeTruthy()
		expect(myCoreMockStep3).toBeTruthy()
		expect(myStudioMockStep1).toBeTruthy()
		expect(myStudioMockStep2).toBeTruthy()
		expect(myStudioMockStep3).toBeTruthy()
		expect(myShowStyleMockStep1).toBeTruthy()
		expect(myShowStyleMockStep2).toBeTruthy()
		expect(myShowStyleMockStep3).toBeTruthy()

		// Check that the steps are in the correct order:

		// First, the Core migration steps:
		expect(steps.indexOf(myCoreMockStep1)).toEqual(0)
		expect(steps.indexOf(myCoreMockStep2)).toEqual(1)
		expect(steps.indexOf(myCoreMockStep3)).toEqual(2)
		// Then, the System-blueprints migration steps:
		to-be-implemented..

		// Then, the Studio-blueprints migration steps:
		expect(steps.indexOf(myStudioMockStep1)).toEqual(3)
		expect(steps.indexOf(myStudioMockStep2)).toEqual(4)
		expect(steps.indexOf(myStudioMockStep3)).toEqual(5)

		// Then, the ShowStyle-blueprints migration steps:
		expect(steps.indexOf(myShowStyleMockStep1)).toEqual(6)
		expect(steps.indexOf(myShowStyleMockStep2)).toEqual(7)
		expect(steps.indexOf(myShowStyleMockStep3)).toEqual(8)
		*/
	})

	test('Class-based migration steps work with proper binding', async () => {
		await MeteorCall.migration.resetDatabaseVersions()
		clearMigrationSteps()

		// Create a migration step class that uses instance properties
		class TestClassMigrationStep implements Omit<MigrationStepCore, 'version'> {
			public readonly id = 'classBasedMigrationTest'
			public readonly canBeRunAutomatically = true
			public testValue = 'initialized'

			public async validate(): Promise<boolean | string> {
				// If 'this' is not bound, testValue will be undefined
				return this.testValue === 'initialized' ? 'Migration needed' : false
			}

			public async migrate(): Promise<void> {
				// If 'this' is not bound, this will throw or fail to update the correct instance
				this.testValue = 'migrated'
			}
		}

		// Instantiate the step so we can check it later
		const step = new TestClassMigrationStep()
		addMigrationSteps('1.0.0', [step])()

		// Prepare migration to ensure it's detected
		const migration = await prepareMigration(true)
		expect(migration.migrationNeeded).toEqual(true)
		expect(_.find(migration.steps, (s) => s.id === 'classBasedMigrationTest')).toBeTruthy()

		// Run the migration to verify that methods are properly bound
		const migrationStatus: GetMigrationStatusResult = await MeteorCall.migration.getMigrationStatus()
		const migrationResult: RunMigrationResult = await MeteorCall.migration.runMigration(
			migrationStatus.migration.chunks,
			migrationStatus.migration.hash,
			userInput(migrationStatus)
		)

		expect(migrationResult.migrationCompleted).toEqual(true)

		// Verify that migrate() was called and 'this' was correctly bound
		expect(step.testValue).toEqual('migrated')
	})
})
