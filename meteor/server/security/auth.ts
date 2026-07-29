import { parseUserPermissions, UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { Meteor } from 'meteor/meteor'
import Koa from 'koa'
import { triggerWriteAccess } from './securityVerify'
import { logger } from '../logging'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

/**
 * The header to use for user permissions
 * This is currently limited to a small set that sockjs supports: https://github.com/sockjs/sockjs-node/blob/46d2f846653a91822a02794b852886c7f137378c/lib/session.js#L137-L150
 * Any other headers are not exposed in a way we can access, no matter how deep we look into meteor internals.
 */
export const USER_PERMISSIONS_HEADER = (process.env.SOFIE_PERMISSIONS_HEADER || 'dnt').toLowerCase() // Future: swap this to 'x-sofie-permissions or something

export type RequestCredentials = Meteor.Connection | Koa.ParameterizedContext

/**
 * Whether http-header based security measures are enabled.
 * Configured via the `SOFIE_ENABLE_HEADER_AUTH` environment variable (`1` or `true` to enable).
 */
export const ENABLE_HEADER_AUTH =
	process.env.SOFIE_ENABLE_HEADER_AUTH === '1' || process.env.SOFIE_ENABLE_HEADER_AUTH?.toLowerCase() === 'true'

export function parseConnectionPermissions(conn: RequestCredentials): UserPermissions {
	if (!ENABLE_HEADER_AUTH) {
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
	if (!ENABLE_HEADER_AUTH) return

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
	if (!ENABLE_HEADER_AUTH) return true

	if (!permissions) throw new Meteor.Error(403, 'Permissions is null')

	for (const permission of allowedPermissions) {
		if (permissions[permission]) return true
	}

	// Nothing matched
	logger.warn(`Not allowed access to ${collectionName}`)
	return false
}
