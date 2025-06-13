import { OrganizationId, UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'

/** An organization is the entity that owns data (studios, rundowns, etc..) in Sofie */
export interface DBOrganizationBase {
	/** Name of the organization  */
	name: string
	applications: string[]
	broadcastMediums: string[]
}
export interface DBOrganization extends DBOrganizationBase {
	_id: OrganizationId

	userRoles: { [userId: string]: UserRoles }

	notes?: string

	created: number
	modified: number
}
export interface UserAdmin {
	userId: UserId
	// permissions: // add later
}
export interface UserRoles {
	/** Can play out things in a studio */
	studio?: boolean
	/** Can access and modify the settings */
	configurator?: boolean
	/** Can enable developer features including test tools */
	developer?: boolean
	/** Is Organization admin */
	admin?: boolean
}
