export type ValidateFunctionCore = (afterMigration: boolean) => Promise<boolean | string>
export type ValidateFunction = ValidateFunctionCore

export type MigrateFunctionCore = () => Promise<void>
export type MigrateFunction = MigrateFunctionCore

export interface MigrationStepBase<TValidate extends ValidateFunction, TMigrate extends MigrateFunction> {
	/** Unique id for this step */
	id: string
	/** If this step overrides another step. Note: It's only possible to override steps in previous versions */
	overrideSteps?: string[]

	/**
	 * The validate function determines whether the step is to be applied
	 * (it can for example check that some value in the database is present)
	 * The function should return falsy if step is fulfilled (ie truthy if migrate function should be applied, return value could then be a string describing why)
	 * The function is also run after the migration-script has been applied (and should therefore return false if all is good)
	 */
	validate: TValidate

	/** If true, this step can be run automatically */
	canBeRunAutomatically: true
	/**
	 * The migration script. This is the script that performs the updates.
	 * The migration script is optional, and may be omitted if the user is expected to perform the update manually
	 */
	migrate?: TMigrate

	/** If this step depend on the result of another step. Will pause the migration before this step in that case. */
	dependOnResultFrom?: string
}
export interface MigrationStep<
	TValidate extends ValidateFunction,
	TMigrate extends MigrateFunction,
> extends MigrationStepBase<TValidate, TMigrate> {
	/** The version this Step applies to */
	version: string
}

export type MigrationStepCore = MigrationStep<ValidateFunctionCore, MigrateFunctionCore>
