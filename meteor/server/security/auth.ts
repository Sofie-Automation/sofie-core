import {
	parseUserPermissions,
	USER_PERMISSIONS_HEADER,
	UserPermissions,
} from '@sofie-automation/meteor-lib/dist/userPermissions'
import { Settings } from '../Settings'
import { Meteor } from 'meteor/meteor'
import Koa from 'koa'
import { triggerWriteAccess } from './securityVerify'
import { logger } from '../logging'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

export type RequestCredentials = Meteor.Connection | Koa.ParameterizedContext

export function parseConnectionPermissions(conn: RequestCredentials): UserPermissions {
	if (!Settings.enableHeaderAuth) {
		// If auth is disabled, return all permissions
		return {
			studio: true,
			configure: true,
			developer: true,
			testing: true,
			service: true,
			gateway: true,
		}
	}

	let header: string | string[] | undefined
	if ('httpHeaders' in conn) {
		header = conn.httpHeaders[USER_PERMISSIONS_HEADER]
	} else {
		header = conn.request.headers[USER_PERMISSIONS_HEADER]
	}

	// This shouldn't happen, but take the first header if it does
	if (Array.isArray(header)) header = header[0]

	return parseUserPermissions(header)
}

export function assertConnectionHasOneOfPermissions(
	conn: RequestCredentials | null,
	...allowedPermissions: Array<keyof UserPermissions>
): void {
	if (allowedPermissions.length === 0) throw new Meteor.Error(403, 'No permissions specified')

	triggerWriteAccess()

	if (!conn) throw new Meteor.Error(403, 'Can only be invoked by clients')

	// Skip if auth is disabled
	if (!Settings.enableHeaderAuth) return

	const permissions = parseConnectionPermissions(conn)
	for (const permission of allowedPermissions) {
		if (permissions[permission]) return
	}

	// Nothing matched
	throw new Meteor.Error(403, 'Not authorized')
}

export function checkHasOneOfPermissions(
	permissions: UserPermissions,
	collectionName: CollectionName,
	...allowedPermissions: Array<keyof UserPermissions>
): boolean {
	if (allowedPermissions.length === 0) throw new Meteor.Error(403, 'No permissions specified')

	triggerWriteAccess()

	// Skip if auth is disabled
	if (!Settings.enableHeaderAuth) return true

	if (!permissions) throw new Meteor.Error(403, 'Permissions is null')

	for (const permission of allowedPermissions) {
		if (permissions[permission]) return true
	}

	// Nothing matched
	logger.warn(`Not allowed access to ${collectionName}`)
	return false
}
