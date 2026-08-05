import { MethodContextAPI } from './methodContext'
import { NewUserAPI } from '@sofie-automation/meteor-lib/dist/api/user'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import {
	parseUserPermissions,
	USER_PERMISSIONS_HEADER,
	UserPermissions,
} from '@sofie-automation/meteor-lib/dist/userPermissions'

export class ServerUserAPI extends MethodContextAPI implements NewUserAPI {
	async getUserPermissions(): Promise<UserPermissions> {
		triggerWriteAccessBecauseNoCheckNecessary()
		return parseUserPermissions(this.connection?.httpHeaders?.[USER_PERMISSIONS_HEADER])
	}
}
