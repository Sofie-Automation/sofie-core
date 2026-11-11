export type { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
export { DatastorePersistenceMode } from '@sofie-automation/shared-lib/dist/core/model/TimelineDatastore'

export interface IBlueprintConfig {
	[key: string]: ConfigItemValue
}

export type ConfigItemValue = BasicConfigItemValue | TableConfigItemValue | IBlueprintConfig
export type TableConfigItemValue = {
	_id: string
	[key: string]: BasicConfigItemValue
}[]
export type BasicConfigItemValue = string | number | boolean | string[] | object
