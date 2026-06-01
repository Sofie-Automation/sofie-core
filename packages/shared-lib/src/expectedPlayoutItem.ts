import type { RundownId } from './core/model/Ids.js'
import type { ProtectedString } from './lib/protectedString.js'
import type { TSR } from './tsr.js'

/** @deprecated */
export interface ExpectedPlayoutItemGeneric {
	_id: ProtectedString<any> // TODO - type

	/** What type of playout device this item should be handled by */
	deviceSubType: TSR.DeviceType // subset of PeripheralDeviceAPI.DeviceSubType
	/** Which playout device this item should be handled by */
	// deviceId: string // Todo: implement deviceId support (later)
	/** Content of the expectedPlayoutItem */
	content: TSR.ExpectedPlayoutItemContent
}

export interface ExpectedPlayoutItemPeripheralDevice extends ExpectedPlayoutItemGeneric {
	rundownId?: RundownId

	baseline?: 'rundown' | 'studio'
}

export type ExpectedPlayoutItemContent = TSR.ExpectedPlayoutItemContent
