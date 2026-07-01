import { MethodContextAPI } from './methodContext'
import { NewUserAPI } from '@sofie-automation/meteor-lib/dist/api/user'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import { parseUserPermissions, UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { USER_PERMISSIONS_HEADER } from '../security/auth'

export class ServerUserAPI extends MethodContextAPI implements NewUserAPI {
	async getUserPermissions(): Promise<UserPermissions> {
		triggerWriteAccessBecauseNoCheckNecessary()
		return parseUserPermissions(this.connection?.httpHeaders?.[USER_PERMISSIONS_HEADER])
	}
}
