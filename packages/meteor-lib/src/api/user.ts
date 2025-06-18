import { UserPermissions } from '../userPermissions'

export interface NewUserAPI {
	getUserPermissions(): Promise<UserPermissions | null>
}
export enum UserAPIMethods {
	'getUserPermissions' = 'user.getUserPermissions',
}
