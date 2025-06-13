import { UserPermissions } from '../userPermissions.js'

export interface NewUserAPI {
	getUserPermissions(): Promise<UserPermissions | null>
}
export enum UserAPIMethods {
	'getUserPermissions' = 'user.getUserPermissions',
}
