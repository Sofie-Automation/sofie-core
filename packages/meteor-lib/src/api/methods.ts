import * as _ from 'underscore'
import { NewBlueprintAPI, BlueprintAPIMethods } from './blueprint'
import { NewClientAPI, ClientAPIMethods } from './client'
import { NewExternalMessageQueueAPI, ExternalMessageQueueAPIMethods } from './ExternalMessageQueue'
import { NewMigrationAPI, MigrationAPIMethods } from './migration'
import { NewPlayoutAPI, PlayoutAPIMethods } from './playout'
import { NewRundownAPI, RundownAPIMethods } from './rundown'
import { NewRundownLayoutsAPI, RundownLayoutsAPIMethods } from './rundownLayouts'
import { NewShowStylesAPI, ShowStylesAPIMethods } from './showStyles'
import { NewSnapshotAPI, SnapshotAPIMethods } from './shapshot'
import { NewSystemStatusAPI, SystemStatusAPIMethods } from './systemStatus'
import { NewUserActionAPI, UserActionAPIMethods } from './userActions'
import { StudiosAPIMethods, NewStudiosAPI } from './studios'
import { NewOrganizationAPI, OrganizationAPIMethods } from './organization'
import { NewUserAPI, UserAPIMethods } from './user'
import { SystemAPIMethods, SystemAPI } from './system'
import { NewTriggeredActionsAPI, TriggeredActionsAPIMethods } from './triggeredActions'
import {
	NewPeripheralDeviceAPI,
	PeripheralDeviceAPIMethods,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'

/** All methods typings are defined here, the actual implementation is defined in other places */
export interface IMeteorCall {
	blueprint: NewBlueprintAPI
	client: NewClientAPI
	externalMessages: NewExternalMessageQueueAPI
	migration: NewMigrationAPI
	peripheralDevice: NewPeripheralDeviceAPI
	playout: NewPlayoutAPI
	rundown: NewRundownAPI
	rundownLayout: NewRundownLayoutsAPI
	snapshot: NewSnapshotAPI
	showstyles: NewShowStylesAPI
	triggeredActions: NewTriggeredActionsAPI
	studio: NewStudiosAPI
	systemStatus: NewSystemStatusAPI
	user: NewUserAPI
	userAction: NewUserActionAPI
	organization: NewOrganizationAPI
	system: SystemAPI
}

export type MakeMeteorMethodCall = (name: string, args: any[], options?: { noRetry?: boolean }) => Promise<any>

export function MakeMeteorCall(makeMethodCall: MakeMeteorMethodCall): IMeteorCall {
	function makeMethods<Enum extends { [key: string]: string }>(
		methods: Enum,
		/** (Optional) An array of methodnames. Calls to these methods won't be retried in the case of a loss-of-connection for the client. */
		listOfMethodsThatShouldNotRetry?: (keyof Enum)[]
	): any {
		const resultingMethods: Record<string, (...args: any[]) => any> = {}
		_.each(methods, (serverMethodName: any, methodName: string) => {
			if (listOfMethodsThatShouldNotRetry?.includes(methodName)) {
				resultingMethods[methodName] = async (...args: any[]) =>
					makeMethodCall(serverMethodName, args, {
						noRetry: true,
					})
			} else {
				resultingMethods[methodName] = async (...args: any[]) => makeMethodCall(serverMethodName, args)
			}
		})
		return resultingMethods
	}

	return {
		blueprint: makeMethods(BlueprintAPIMethods),
		client: makeMethods(ClientAPIMethods),
		externalMessages: makeMethods(ExternalMessageQueueAPIMethods),
		migration: makeMethods(MigrationAPIMethods),
		peripheralDevice: makeMethods(PeripheralDeviceAPIMethods),
		playout: makeMethods(PlayoutAPIMethods),
		rundown: makeMethods(RundownAPIMethods),
		rundownLayout: makeMethods(RundownLayoutsAPIMethods),
		snapshot: makeMethods(SnapshotAPIMethods),
		showstyles: makeMethods(ShowStylesAPIMethods),
		triggeredActions: makeMethods(TriggeredActionsAPIMethods),
		studio: makeMethods(StudiosAPIMethods),
		systemStatus: makeMethods(SystemStatusAPIMethods),
		user: makeMethods(UserAPIMethods),
		userAction: makeMethods(UserActionAPIMethods, ['storeRundownSnapshot']),
		organization: makeMethods(OrganizationAPIMethods),
		system: makeMethods(SystemAPIMethods),
	}
}
