import { MigrationStepCore } from '@sofie-automation/meteor-lib/dist/migrations'
import type { ICoreSystem } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import type { SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { CoreSystem } from '../../../collections'

const OLD_KEY = 'message'
const NEW_KEY = 'panelHtml'
const OLD_PATH = `support.${OLD_KEY}`
const NEW_PATH = `support.${NEW_KEY}`

type LegacySupport = Record<string, unknown> | undefined

/**
 * Rename CoreSystem `settingsWithOverrides` `support.message` to `support.panelHtml`,
 * in both the defaults and any user overrides.
 */
export class SupportMessageToPanelHtmlMigrationStep implements Omit<MigrationStepCore, 'version'> {
	public readonly id = `CoreSystem rename support.message to support.panelHtml`
	public readonly canBeRunAutomatically = true

	public async validate(): Promise<boolean | string> {
		const systems = await CoreSystem.findFetchAsync({})
		const count = systems.filter((system) => needsMigration(system)).length
		if (count > 0) return `${count} CoreSystem documents have support.message which must be renamed to support.panelHtml`
		return false
	}

	public async migrate(): Promise<void> {
		const systems = await CoreSystem.findFetchAsync({})
		for (const system of systems) {
			if (!needsMigration(system)) continue

			const settings = system.settingsWithOverrides
			const defaults = settings.defaults as unknown as { support?: LegacySupport }

			await CoreSystem.updateAsync(system._id, {
				$set: {
					'settingsWithOverrides.defaults.support': renameSupportKey(defaults.support) as any,
					'settingsWithOverrides.overrides': (settings.overrides ?? []).map(migrateOverrideOp),
				},
			})
		}
	}
}

function needsMigration(system: ICoreSystem): boolean {
	const settings = system.settingsWithOverrides
	if (!settings) return false

	const defaultSupport = (settings.defaults as unknown as { support?: LegacySupport } | undefined)?.support
	if (defaultSupport && OLD_KEY in defaultSupport) return true

	return (settings.overrides ?? []).some(
		(op) =>
			op.path === OLD_PATH ||
			(op.path === 'support' && op.op === 'set' && isObject(op.value) && OLD_KEY in op.value)
	)
}

function migrateOverrideOp(op: SomeObjectOverrideOp): SomeObjectOverrideOp {
	if (op.path === OLD_PATH) return { ...op, path: NEW_PATH }
	if (op.path === 'support' && op.op === 'set' && isObject(op.value)) {
		return { ...op, value: renameSupportKey(op.value) }
	}
	return op
}

function renameSupportKey(support: LegacySupport): Record<string, unknown> {
	if (!support) return { [NEW_KEY]: '' }
	if (!(OLD_KEY in support)) return support

	const { [OLD_KEY]: oldValue, ...rest } = support
	return {
		...rest,
		// Don't clobber a value that has already been written in the new location
		[NEW_KEY]: rest[NEW_KEY] ?? oldValue ?? '',
	}
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
