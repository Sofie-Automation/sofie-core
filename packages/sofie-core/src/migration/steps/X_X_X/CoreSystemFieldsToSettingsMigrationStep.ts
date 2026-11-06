import { MigrationStepCore } from '@sofie-automation/meteor-lib/dist/migrations'
import type { ICoreSystem } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import type { SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import type { ICoreSystemSettings } from '@sofie-automation/shared-lib/dist/core/model/CoreSystemSettings'
import { CoreSystem } from '../../../collections'

/** Fields which used to live directly on ICoreSystem, and are now part of ICoreSystemSettings */
const MOVED_FIELDS = ['name', 'logo', 'logLevel', 'systemInfo', 'apm', 'enableMonitorBlockedThread'] as const
type MovedField = (typeof MOVED_FIELDS)[number]

/** Fields which are objects, and are moved as overrides of each of their properties */
const NESTED_FIELDS: ReadonlyArray<MovedField> = ['systemInfo', 'apm']

/**
 * Settings objects that must exist in the defaults, as overrides can only be applied to properties of objects that exist
 */
const REQUIRED_DEFAULT_OBJECTS: Pick<ICoreSystemSettings, 'systemInfo' | 'apm'> = {
	systemInfo: {
		message: '',
		enabled: false,
	},
	apm: {
		enabled: false,
		transactionSampleRate: -1,
	},
}

type LegacyCoreSystem = ICoreSystem & Partial<Record<MovedField, unknown>>

/**
 * Move `name`, `logo`, `logLevel`, `systemInfo`, `apm` and `enableMonitorBlockedThread` from the root of the
 * CoreSystem document into `settingsWithOverrides`.
 * The values were user-defined, so they are preserved as overrides, so that they survive the blueprint `applyConfig`
 * replacing the defaults.
 */
export class CoreSystemFieldsToSettingsMigrationStep implements Omit<MigrationStepCore, 'version'> {
	public readonly id = `CoreSystem move fields into settingsWithOverrides`
	public readonly canBeRunAutomatically = true

	public async validate(): Promise<boolean | string> {
		const systems = (await CoreSystem.findFetchAsync({})) as LegacyCoreSystem[]
		const count = systems.filter((system) => needsMigration(system)).length
		if (count > 0)
			return `${count} CoreSystem documents have settings which must be moved into settingsWithOverrides`
		return false
	}

	public async migrate(): Promise<void> {
		const systems = (await CoreSystem.findFetchAsync({})) as LegacyCoreSystem[]
		for (const system of systems) {
			if (!needsMigration(system)) continue

			const defaults: Partial<ICoreSystemSettings> = { ...system.settingsWithOverrides?.defaults }
			for (const key of Object.keys(REQUIRED_DEFAULT_OBJECTS) as Array<keyof typeof REQUIRED_DEFAULT_OBJECTS>) {
				if (!isObject(defaults[key])) defaults[key] = { ...REQUIRED_DEFAULT_OBJECTS[key] } as any
			}

			const overrides: SomeObjectOverrideOp[] = [...(system.settingsWithOverrides?.overrides ?? [])]
			const addOverride = (path: string, value: unknown, defaultValue: unknown) => {
				if (value === undefined || value === null) return
				// Don't replace an override the user has already defined for this path
				if (overrides.some((op) => op.path === path)) return
				// No need for an override if it matches the default
				if (value === defaultValue) return

				overrides.push({ op: 'set', path, value })
			}

			for (const field of MOVED_FIELDS) {
				const value = system[field]
				if (NESTED_FIELDS.includes(field)) {
					if (!isObject(value)) continue
					const defaultObject = (defaults as Record<string, Record<string, unknown>>)[field]
					for (const [key, subValue] of Object.entries<unknown>(value)) {
						addOverride(`${field}.${key}`, subValue, defaultObject[key])
					}
				} else {
					addOverride(field, value, (defaults as Record<string, unknown>)[field])
				}
			}

			const unset: Record<string, 1> = {}
			for (const field of MOVED_FIELDS) unset[field] = 1

			await CoreSystem.mutableCollection.updateAsync(system._id, {
				$set: {
					settingsWithOverrides: {
						defaults: defaults as ICoreSystemSettings,
						overrides,
					},
				},
				$unset: unset,
			})
		}
	}
}

function needsMigration(system: LegacyCoreSystem): boolean {
	if (MOVED_FIELDS.some((field) => field in system)) return true

	const defaults = system.settingsWithOverrides?.defaults as Partial<ICoreSystemSettings> | undefined
	return !isObject(defaults?.systemInfo) || !isObject(defaults?.apm)
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
