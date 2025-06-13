import { IBlueprintTriggeredActions } from './triggers.js'

export interface MigrationStepInput {
	stepId?: string // automatically filled in later
	label: string
	description?: string
	inputType: 'text' | 'multiline' | 'int' | 'checkbox' | 'dropdown' | 'toggle' | null // EditAttribute types, null = dont display edit field
	attribute: string | null
	defaultValue?: any
	dropdownOptions?: string[]
}
export interface MigrationStepInputResult {
	stepId: string
	attribute: string
	value: any
}
export interface MigrationStepInputFilteredResult {
	[attribute: string]: any
}

export type ValidateFunctionCore = (afterMigration: boolean) => Promise<boolean | string>
export type ValidateFunctionSystem = (
	context: MigrationContextSystem,
	afterMigration: boolean
) => Promise<boolean | string>
export type ValidateFunction = ValidateFunctionSystem | ValidateFunctionCore

export type MigrateFunctionCore = (input: MigrationStepInputFilteredResult) => Promise<void>
export type MigrateFunctionSystem = (
	context: MigrationContextSystem,
	input: MigrationStepInputFilteredResult
) => Promise<void>
export type MigrateFunction = MigrateFunctionSystem | MigrateFunctionCore

export type InputFunctionCore = () => MigrationStepInput[]
export type InputFunctionSystem = (context: MigrationContextSystem) => MigrationStepInput[]
export type InputFunction = InputFunctionSystem | InputFunctionCore

interface MigrationContextWithTriggeredActions {
	getAllTriggeredActions: () => Promise<IBlueprintTriggeredActions[]>
	getTriggeredAction: (triggeredActionId: string) => Promise<IBlueprintTriggeredActions | undefined>
	getTriggeredActionId: (triggeredActionId: string) => string
	setTriggeredAction: (triggeredActions: IBlueprintTriggeredActions) => Promise<void>
	removeTriggeredAction: (triggeredActionId: string) => Promise<void>
}

export type MigrationContextSystem = MigrationContextWithTriggeredActions

export interface MigrationStepBase<
	TValidate extends ValidateFunction,
	TMigrate extends MigrateFunction,
	TInput extends InputFunction,
> {
	/** Unique id for this step */
	id: string
	/** If this step overrides another step. Note: It's only possible to override steps in previous versions */
	overrideSteps?: string[]

	/**
	 * The validate function determines whether the step is to be applied
	 * (it can for example check that some value in the database is present)
	 * The function should return falsy if step is fullfilled (ie truthy if migrate function should be applied, return value could then be a string describing why)
	 * The function is also run after the migration-script has been applied (and should therefore return false if all is good)
	 */
	validate: TValidate

	/** If true, this step can be run automatically, without prompting for user input */
	canBeRunAutomatically: boolean
	/**
	 * The migration script. This is the script that performs the updates.
	 * Input to the function is the result from the user prompt (for manual steps)
	 * The miggration script is optional, and may be omitted if the user is expected to perform the update manually
	 * @param result Input from the user query
	 */
	migrate?: TMigrate
	/** Query user for input, used in manual steps */
	input?: MigrationStepInput[] | TInput

	/** If this step depend on the result of another step. Will pause the migration before this step in that case. */
	dependOnResultFrom?: string
}
export interface MigrationStep<
	TValidate extends ValidateFunction,
	TMigrate extends MigrateFunction,
	TInput extends InputFunction,
> extends MigrationStepBase<TValidate, TMigrate, TInput> {
	/** The version this Step applies to */
	version: string
}

export type MigrationStepCore = MigrationStep<ValidateFunctionCore, MigrateFunctionCore, InputFunctionCore>
export type MigrationStepSystem = MigrationStep<ValidateFunctionSystem, MigrateFunctionSystem, InputFunctionSystem>
