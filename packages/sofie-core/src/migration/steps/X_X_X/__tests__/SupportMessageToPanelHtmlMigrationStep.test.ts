import { setupMockCore } from '../../../../__mocks__/helpers/database'
import { CoreSystem } from '../../../../collections'
import { SYSTEM_ID } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { SupportMessageToPanelHtmlMigrationStep } from '../SupportMessageToPanelHtmlMigrationStep'

function legacySettings(support: Record<string, unknown>, overrides: any[] = []): any {
	return {
		defaults: {
			cron: { casparCGRestart: { enabled: true } },
			support,
			evaluationsMessage: { enabled: false, heading: '', message: '' },
		},
		overrides,
	}
}

describe('SupportMessageToPanelHtmlMigrationStep', () => {
	test('no migration needed for already migrated settings', async () => {
		await setupMockCore({})

		const step = new SupportMessageToPanelHtmlMigrationStep()
		expect(await step.validate()).toBe(false)
	})

	test('renames defaults and set/delete override paths', async () => {
		await setupMockCore({
			settingsWithOverrides: legacySettings({ message: '<b>default</b>' }, [
				{ op: 'set', path: 'support.message', value: '<i>override</i>' },
				{ op: 'delete', path: 'support.message' },
				{ op: 'set', path: 'evaluationsMessage.message', value: 'untouched' },
			]),
		})

		const step = new SupportMessageToPanelHtmlMigrationStep()
		expect(await step.validate()).toBeTruthy()

		await step.migrate()

		const core = await CoreSystem.findOneAsync(SYSTEM_ID)
		expect(core?.settingsWithOverrides.defaults.support).toEqual({ panelHtml: '<b>default</b>' })
		expect(core?.settingsWithOverrides.overrides).toEqual([
			{ op: 'set', path: 'support.panelHtml', value: '<i>override</i>' },
			{ op: 'delete', path: 'support.panelHtml' },
			{ op: 'set', path: 'evaluationsMessage.message', value: 'untouched' },
		])

		expect(await step.validate()).toBe(false)
	})

	test('renames key inside a whole-object support override', async () => {
		await setupMockCore({
			settingsWithOverrides: legacySettings({ panelHtml: '' }, [
				{ op: 'set', path: 'support', value: { message: 'whole' } },
			]),
		})

		const step = new SupportMessageToPanelHtmlMigrationStep()
		expect(await step.validate()).toBeTruthy()

		await step.migrate()

		const core = await CoreSystem.findOneAsync(SYSTEM_ID)
		expect(core?.settingsWithOverrides.overrides).toEqual([
			{ op: 'set', path: 'support', value: { panelHtml: 'whole' } },
		])
		expect(await step.validate()).toBe(false)
	})

	test('does not overwrite an existing panelHtml default', async () => {
		await setupMockCore({
			settingsWithOverrides: legacySettings({ message: 'old', panelHtml: 'new' }),
		})

		const step = new SupportMessageToPanelHtmlMigrationStep()
		await step.migrate()

		const core = await CoreSystem.findOneAsync(SYSTEM_ID)
		expect(core?.settingsWithOverrides.defaults.support).toEqual({ panelHtml: 'new' })
	})
})
