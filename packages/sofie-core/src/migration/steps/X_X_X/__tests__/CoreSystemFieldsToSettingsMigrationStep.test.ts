import { setupMockCore } from '../../../../__mocks__/helpers/database'
import { CoreSystem } from '../../../../collections'
import { SYSTEM_ID } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { CoreSystemFieldsToSettingsMigrationStep } from '../CoreSystemFieldsToSettingsMigrationStep'

/** Settings defaults as they were before systemInfo and apm were added */
function legacyDefaults(): any {
	return {
		cron: { casparCGRestart: { enabled: true } },
		support: { panelHtml: '' },
		evaluationsMessage: { enabled: false, heading: '', message: '' },
	}
}

describe('CoreSystemFieldsToSettingsMigrationStep', () => {
	test('no migration needed for already migrated document', async () => {
		await setupMockCore({})

		const step = new CoreSystemFieldsToSettingsMigrationStep()
		expect(await step.validate()).toBe(false)
	})

	test('moves root fields into overrides and removes them from the root', async () => {
		const legacyDoc: any = {
			settingsWithOverrides: { defaults: legacyDefaults(), overrides: [] },
			name: 'My Sofie',
			logo: 'pride',
			logLevel: 'info',
			systemInfo: { message: 'Hello', enabled: true },
			apm: { enabled: true, transactionSampleRate: 0.5 },
			enableMonitorBlockedThread: true,
		}
		await setupMockCore(legacyDoc)

		const step = new CoreSystemFieldsToSettingsMigrationStep()
		expect(await step.validate()).toBeTruthy()

		await step.migrate()

		const core = (await CoreSystem.findOneAsync(SYSTEM_ID)) as any
		for (const field of ['name', 'logo', 'logLevel', 'systemInfo', 'apm', 'enableMonitorBlockedThread']) {
			expect(core[field]).toBeUndefined()
		}

		expect(core.settingsWithOverrides.defaults).toMatchObject({
			systemInfo: { message: '', enabled: false },
			apm: { enabled: false, transactionSampleRate: -1 },
		})

		const resolved = applyAndValidateOverrides(core.settingsWithOverrides)
		expect(resolved.invalid).toEqual([])
		expect(resolved.obj).toMatchObject({
			name: 'My Sofie',
			logo: 'pride',
			logLevel: 'info',
			systemInfo: { message: 'Hello', enabled: true },
			apm: { enabled: true, transactionSampleRate: 0.5 },
			enableMonitorBlockedThread: true,
		})

		expect(await step.validate()).toBe(false)
	})

	test('keeps existing overrides, and skips values matching the defaults', async () => {
		const legacyDoc: any = {
			settingsWithOverrides: {
				defaults: legacyDefaults(),
				overrides: [{ op: 'set', path: 'name', value: 'Already overridden' }],
			},
			name: 'Old name',
			systemInfo: { message: '', enabled: false },
			apm: { enabled: false, transactionSampleRate: -1 },
		}
		await setupMockCore(legacyDoc)

		const step = new CoreSystemFieldsToSettingsMigrationStep()
		await step.migrate()

		const core = await CoreSystem.findOneAsync(SYSTEM_ID)
		expect(core?.settingsWithOverrides.overrides).toEqual([
			{ op: 'set', path: 'name', value: 'Already overridden' },
		])
	})
})
