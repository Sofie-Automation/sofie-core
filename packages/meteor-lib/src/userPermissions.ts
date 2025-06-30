/**
 * The header to use for user permissions
 * This is currently limited to a small set that sockjs supports: https://github.com/sockjs/sockjs-node/blob/46d2f846653a91822a02794b852886c7f137378c/lib/session.js#L137-L150
 * Any other headers are not exposed in a way we can access, no matter how deep we look into meteor internals.
 */
export const USER_PERMISSIONS_HEADER = 'dnt'

export interface UserPermissions {
	studio: boolean
	configure: boolean
	developer: boolean
	testing: boolean
	service: boolean
	gateway: boolean
}
const allowedPermissions = new Set<keyof UserPermissions>([
	'studio',
	'configure',
	'developer',
	'testing',
	'service',
	'gateway',
])

export function parseUserPermissions(encodedPermissions: string | undefined): UserPermissions {
	if (encodedPermissions === 'admin') {
		return {
			studio: true,
			configure: true,
			developer: true,
			testing: true,
			service: true,
			gateway: true,
		}
	}

	const result: UserPermissions = {
		studio: false,
		configure: false,
		developer: false,
		testing: false,
		service: false,
		gateway: false,
	}

	if (encodedPermissions && typeof encodedPermissions === 'string') {
		const parts = encodedPermissions.split(',')

		for (const part of parts) {
			const part2 = part.trim() as keyof UserPermissions
			if (allowedPermissions.has(part2)) {
				result[part2] = true
			}
		}
	}

	return result
}
