import _ from 'underscore'
import { type NewBlueprintAPI, BlueprintAPIMethods } from './blueprint.js'
import { type NewClientAPI, ClientAPIMethods } from './client.js'
import { type NewExternalMessageQueueAPI, ExternalMessageQueueAPIMethods } from './ExternalMessageQueue.js'
import { type NewMigrationAPI, MigrationAPIMethods } from './migration.js'
import { type NewPlayoutAPI, PlayoutAPIMethods } from './playout.js'
import { type NewRundownAPI, RundownAPIMethods } from './rundown.js'
import { type NewRundownLayoutsAPI, RundownLayoutsAPIMethods } from './rundownLayouts.js'
import { type NewShowStylesAPI, ShowStylesAPIMethods } from './showStyles.js'
import { type NewSnapshotAPI, SnapshotAPIMethods } from './shapshot.js'
import { type NewSystemStatusAPI, SystemStatusAPIMethods } from './systemStatus.js'
import { type NewUserActionAPI, UserActionAPIMethods } from './userActions.js'
import { StudiosAPIMethods, type NewStudiosAPI } from './studios.js'
import { type NewUserAPI, UserAPIMethods } from './user.js'
import { SystemAPIMethods, type SystemAPI } from './system.js'
import { type NewTriggeredActionsAPI, TriggeredActionsAPIMethods } from './triggeredActions.js'
import {
	type NewPeripheralDeviceAPI,
	PeripheralDeviceAPIMethods,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'
import { type MongoAPI, MongoAPIMethods } from './mongo.js'

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
	system: SystemAPI
	mongo: MongoAPI
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
		system: makeMethods(SystemAPIMethods),
		mongo: makeMethods(MongoAPIMethods),
	}
}
