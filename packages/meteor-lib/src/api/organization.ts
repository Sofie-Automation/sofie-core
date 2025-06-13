import { OrganizationId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export interface NewOrganizationAPI {
	removeOrganization(organizationId: OrganizationId): Promise<void>
}

export enum OrganizationAPIMethods {
	'removeOrganization' = 'organization.removeOrganization',
}
