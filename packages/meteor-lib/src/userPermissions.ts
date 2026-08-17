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
