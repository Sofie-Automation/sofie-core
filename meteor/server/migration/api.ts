import { check, Match } from '../lib/check'
import {
	MigrationChunk,
	NewMigrationAPI,
	BlueprintFixUpConfigMessage,
	GetMigrationStatusResult,
	RunMigrationResult,
} from '@sofie-automation/meteor-lib/dist/api/migration'
import * as Migrations from './databaseMigration'
import { MethodContextAPI } from '../api/methodContext'
import {
	fixupConfigForShowStyleBase,
	fixupConfigForStudio,
	ignoreFixupConfigForShowStyleBase,
	ignoreFixupConfigForStudio,
	runUpgradeForShowStyleBase,
	runUpgradeForStudio,
	validateConfigForShowStyleBase,
	validateConfigForStudio,
} from './upgrades'
import { CoreSystemId, ShowStyleBaseId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { BlueprintValidateConfigForStudioResult } from '@sofie-automation/corelib/dist/worker/studio'
import { runUpgradeForCoreSystem } from './upgrades/system'
import { assertConnectionHasOneOfPermissions } from '../security/auth'

export class ServerMigrationAPI extends MethodContextAPI implements NewMigrationAPI {
	async getMigrationStatus(): Promise<GetMigrationStatusResult> {
		return Migrations.getMigrationStatus(this)
	}

	async runMigration(
		chunks: Array<MigrationChunk>,
		hash: string,
		isFirstOfPartialMigrations?: boolean | null
	): Promise<RunMigrationResult> {
		check(chunks, Array)
		check(hash, String)
		check(isFirstOfPartialMigrations, Match.Maybe(Boolean))

		return Migrations.runMigration(this, chunks, hash, isFirstOfPartialMigrations || false)
	}

	async forceMigration(chunks: Array<MigrationChunk>): Promise<void> {
		check(chunks, Array)

		return Migrations.forceMigration(this, chunks)
	}

	async resetDatabaseVersions(): Promise<void> {
		return Migrations.resetDatabaseVersions(this)
	}

	async fixupConfigForStudio(studioId: StudioId): Promise<BlueprintFixUpConfigMessage[]> {
		check(studioId, String)

		assertConnectionHasOneOfPermissions(this.connection, ...Migrations.PERMISSIONS_FOR_MIGRATIONS)

		return fixupConfigForStudio(studioId)
	}

	async ignoreFixupConfigForStudio(studioId: StudioId): Promise<void> {
		check(studioId, String)

		assertConnectionHasOneOfPermissions(this.connection, ...Migrations.PERMISSIONS_FOR_MIGRATIONS)

		return ignoreFixupConfigForStudio(studioId)
	}

	async validateConfigForStudio(studioId: StudioId): Promise<BlueprintValidateConfigForStudioResult> {
		check(studioId, String)

		assertConnectionHasOneOfPermissions(this.connection, ...Migrations.PERMISSIONS_FOR_MIGRATIONS)

		return validateConfigForStudio(studioId)
	}

	async runUpgradeForStudio(studioId: StudioId): Promise<void> {
		check(studioId, String)

		assertConnectionHasOneOfPermissions(this.connection, ...Migrations.PERMISSIONS_FOR_MIGRATIONS)

		return runUpgradeForStudio(studioId)
	}

	async fixupConfigForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<BlueprintFixUpConfigMessage[]> {
		check(showStyleBaseId, String)

		assertConnectionHasOneOfPermissions(this.connection, ...Migrations.PERMISSIONS_FOR_MIGRATIONS)

		return fixupConfigForShowStyleBase(showStyleBaseId)
	}

	async ignoreFixupConfigForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void> {
		check(showStyleBaseId, String)

		assertConnectionHasOneOfPermissions(this.connection, ...Migrations.PERMISSIONS_FOR_MIGRATIONS)

		return ignoreFixupConfigForShowStyleBase(showStyleBaseId)
	}

	async validateConfigForShowStyleBase(
		showStyleBaseId: ShowStyleBaseId
	): Promise<BlueprintValidateConfigForStudioResult> {
		check(showStyleBaseId, String)

		assertConnectionHasOneOfPermissions(this.connection, ...Migrations.PERMISSIONS_FOR_MIGRATIONS)

		return validateConfigForShowStyleBase(showStyleBaseId)
	}

	async runUpgradeForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void> {
		check(showStyleBaseId, String)

		assertConnectionHasOneOfPermissions(this.connection, ...Migrations.PERMISSIONS_FOR_MIGRATIONS)

		return runUpgradeForShowStyleBase(showStyleBaseId)
	}

	async runUpgradeForCoreSystem(coreSystemId: CoreSystemId): Promise<void> {
		check(coreSystemId, String)

		assertConnectionHasOneOfPermissions(this.connection, ...Migrations.PERMISSIONS_FOR_MIGRATIONS)

		return runUpgradeForCoreSystem(coreSystemId)
	}
}
