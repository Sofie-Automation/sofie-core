import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { Meteor } from 'meteor/meteor'

/* *************************************************************************
This file contains types and interfaces that are used by the REST API.
When making changes to these types, you should be aware of any breaking changes
and update packages/openapi accordingly if needed.
************************************************************************* */

export interface SystemRestAPI {
	/*
	 * Assigns a specified Blueprint to the system.
	 *
	 * Throws if the specified Blueprint does not exist.
	 * Throws if the specified Blueprint is not a 'system' Blueprint.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param blueprintId Blueprint to assign
	 */
	assignSystemBlueprint(
		connection: Meteor.Connection,
		event: string,
		blueprintId: BlueprintId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Unassigns the assigned system Blueprint, if any Blueprint is currently assigned.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 */
	unassignSystemBlueprint(connection: Meteor.Connection, event: string): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Get the pending migration steps at the system level.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 */
	getPendingMigrations(
		connection: Meteor.Connection,
		event: string
	): Promise<ClientAPI.ClientResponse<{ inputs: PendingMigrations }>>
	/**
	 * Apply system-level migrations.
	 *
	 * Throws if any of the specified migrations have already been applied.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param inputs Migration data to apply
	 */
	applyPendingMigrations(connection: Meteor.Connection, event: string): Promise<ClientAPI.ClientResponse<void>>
}

export interface PendingMigrationStep {
	stepId: string
	attributeId: string
}

export type PendingMigrations = Array<PendingMigrationStep>

export interface MigrationStepData {
	stepId: string
	attributeId: string
	migrationValue: string | number | boolean
}

export type MigrationData = Array<MigrationStepData>
