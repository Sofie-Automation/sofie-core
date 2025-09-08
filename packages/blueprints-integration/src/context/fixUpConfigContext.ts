import type { IBlueprintConfig } from '../common.js'
import type { ITranslatableMessage } from '../translations.js'
import type { ICommonContext } from './baseContext.js'

export interface IFixUpConfigContext<TConfig = IBlueprintConfig> extends ICommonContext {
	/**
	 * Get the current config, with any unsaved changes applied
	 */
	getConfig(): TConfig

	/**
	 * List all paths with values
	 */
	listPaths(): string[]

	/**
	 * List all paths with values that don't align with the current config structure
	 */
	listInvalidPaths(): string[]

	/**
	 * Check if there are any values for the specified path
	 * @param path Object path prefix to check
	 */
	hasOperations(path: string): boolean

	/**
	 * Add a new user defined set operation for the specified path
	 * @param path Exact object path to be set
	 * @param value Value to be stored
	 */
	addSetOperation(path: string, value: any): void
	/**
	 * Add a new user defined delete operation for the specified path
	 * @param path Exact object path to be deleted
	 */
	addDeleteOperation(path: string): void

	/**
	 * Remove operations for a path
	 * All nested operations within the path will removed
	 * @param path Object path prefix to be removed (`a` will match `a` and `a.b`)
	 */
	removeOperations(path: string): void

	/**
	 * Rename operations for a path
	 * All nested operations within the path will renamed
	 * eg `a` will match `a` and `a.b`
	 * @param fromPath Object path prefix to be renamed (`a` will match `a` and `a.b`)
	 * @param toPath Object path prefix to be substituted
	 */
	renameOperations(fromPath: string, toPath: string): void

	/*
	 * Future: a way of transforming values would be useful, but more direction is needed on
	 * what kind of transformations are needed and possible to do in this flow
	 */
	/**
	 * Show a warning to the user about a change that they will need to convert/migrate manually
	 * This will be persisted until the next call to `applyConfig`
	 * @param path Object path prefix the message is related to
	 * @param message Message to show to the user
	 */
	warnUnfixable(path: string, message: ITranslatableMessage): void
}
