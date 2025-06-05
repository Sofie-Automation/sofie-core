import { MethodContextAPI } from './methodContext'
import { NewUserAPI, UserAPIMethods } from '@sofie-automation/meteor-lib/dist/api/user'
import { registerClassToMeteorMethods } from '../methods'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import { parseUserPermissions, USER_PERMISSIONS_HEADER } from '@sofie-automation/meteor-lib/dist/userPermissions'

class ServerUserAPI extends MethodContextAPI implements NewUserAPI {
	async getUserPermissions() {
		triggerWriteAccessBecauseNoCheckNecessary()
		return parseUserPermissions(this.connection?.httpHeaders?.[USER_PERMISSIONS_HEADER])
	}
}

registerClassToMeteorMethods(UserAPIMethods, ServerUserAPI, false)
