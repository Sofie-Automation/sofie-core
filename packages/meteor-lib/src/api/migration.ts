import {
	BlueprintId,
	CoreSystemId,
	ShowStyleBaseId,
	SnapshotId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { BlueprintValidateConfigForStudioResult } from '@sofie-automation/corelib/dist/worker/studio'

export interface BlueprintFixUpConfigMessage {
	message: ITranslatableMessage
	path: string
}

export interface NewMigrationAPI {
	getMigrationStatus(): Promise<GetMigrationStatusResult>
	runMigration(
		chunks: Array<MigrationChunk>,
		hash: string,
		isFirstOfPartialMigrations?: boolean
	): Promise<RunMigrationResult>
	forceMigration(chunks: Array<MigrationChunk>): Promise<void>
	resetDatabaseVersions(): Promise<void>

	/**
	 * Run `fixupConfig` on the blueprint for a Studio
	 * @param studioId Id of the Studio
	 */
	fixupConfigForStudio(studioId: StudioId): Promise<BlueprintFixUpConfigMessage[]>

	/**
	 * Ignore that `fixupConfig` needs to be run for a Studio
	 * @param studioId Id of the Studio
	 */
	ignoreFixupConfigForStudio(studioId: StudioId): Promise<void>

	/**
	 * Run `validateConfig` on the blueprint for a Studio
	 * @param studioId Id of the Studio
	 * @returns List of messages to display to the user
	 */
	validateConfigForStudio(studioId: StudioId): Promise<BlueprintValidateConfigForStudioResult>

	/**
	 * Run `applyConfig` on the blueprint for a Studio, and store the results into the db
	 * @param studioId Id of the Studio
	 */
	runUpgradeForStudio(studioId: StudioId): Promise<void>

	/**
	 * Run `fixupConfig` on the blueprint for a ShowStyleBase
	 * @param showStyleBaseId Id of the ShowStyleBase
	 */
	fixupConfigForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<BlueprintFixUpConfigMessage[]>

	/**
	 * Ignore that `fixupConfig` needs to be run for a ShowStyleBase
	 * @param showStyleBaseId Id of the ShowStyleBase
	 */
	ignoreFixupConfigForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void>

	/**
	 * Run `validateConfig` on the blueprint for a ShowStyleBase
	 * @param showStyleBaseId Id of the ShowStyleBase
	 * @returns List of messages to display to the user
	 */
	validateConfigForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<BlueprintValidateConfigForStudioResult>

	/**
	 * Run `applyConfig` on the blueprint for a ShowStyleBase, and store the results into the db
	 * @param showStyleBaseId Id of the ShowStyleBase
	 */
	runUpgradeForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void>

	/**
	 * Run `applyConfig` on the blueprint for the CoreSystem, and store the results into the db
	 */
	runUpgradeForCoreSystem(coreSystemId: CoreSystemId): Promise<void>
}

export enum MigrationAPIMethods {
	'getMigrationStatus' = 'migration.getMigrationStatus',
	'runMigration' = 'migration.runMigration',
	'forceMigration' = 'migration.forceMigration',
	'resetDatabaseVersions' = 'migration.resetDatabaseVersions',

	'getUpgradeStatus' = 'migration.getUpgradeStatus',
	'fixupConfigForStudio' = 'migration.fixupConfigForStudio',
	'ignoreFixupConfigForStudio' = 'migration.ignoreFixupConfigForStudio',
	'validateConfigForStudio' = 'migration.validateConfigForStudio',
	'runUpgradeForStudio' = 'migration.runUpgradeForStudio',
	'fixupConfigForShowStyleBase' = 'migration.fixupConfigForShowStyleBase',
	'ignoreFixupConfigForShowStyleBase' = 'migration.ignoreFixupConfigForShowStyleBase',
	'validateConfigForShowStyleBase' = 'migration.validateConfigForShowStyleBase',
	'runUpgradeForShowStyleBase' = 'migration.runUpgradeForShowStyleBase',
	'runUpgradeForCoreSystem' = 'migration.runUpgradeForCoreSystem',
}

export interface GetMigrationStatusResult {
	migrationNeeded: boolean

	migration: {
		canDoAutomaticMigration: boolean
		hash: string
		automaticStepCount: number
		manualStepCount: number
		ignoredStepCount: number
		partialMigration: boolean
		chunks: Array<MigrationChunk>
	}
}
export interface RunMigrationResult {
	migrationCompleted: boolean
	partialMigration: boolean
	warnings: Array<string>
	snapshot: SnapshotId
}
export enum MigrationStepType {
	CORE = 'core',
}
export interface MigrationChunk {
	sourceType: MigrationStepType
	sourceName: string
	blueprintId?: BlueprintId // blueprint id
	sourceId?: ShowStyleBaseId | StudioId | 'system' // id in blueprint databaseVersions
	_dbVersion: string // database version
	_targetVersion: string // target version
	_steps: Array<string> // ref to step that use it
}
