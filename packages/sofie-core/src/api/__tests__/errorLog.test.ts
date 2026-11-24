import '../../collections' // include this in order to get all of the collection set up
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { DBErrorLogItem } from '@sofie-automation/corelib/dist/dataModel/ErrorLog'
import { DEFAULT_ERROR_LOG_MAX_ITEMS } from '@sofie-automation/shared-lib/dist/core/constants'
import { ICoreSystemSettings } from '@sofie-automation/shared-lib/dist/core/model/CoreSystemSettings'
import { setupMockCore } from '../../__mocks__/helpers/database'
import { waitUntil } from '../../__mocks__/helpers/jest'
import { CoreSystem, ErrorLog } from '../../collections'
import { SYSTEM_ID } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { getErrorLogMaxItems, recordError } from '../errorLog'

function makeSettings(errorLogMaxItems: unknown) {
	return wrapDefaultObject<ICoreSystemSettings>({
		cron: { casparCGRestart: { enabled: false } },
		support: { message: '' },
		evaluationsMessage: { enabled: false, heading: '', message: '' },
		errorLogMaxItems: errorLogMaxItems as number,
	})
}

/** Note: This resets the whole (mock) database */
async function setupCoreWithErrorLogMaxItems(errorLogMaxItems: unknown) {
	await setupMockCore({ settingsWithOverrides: makeSettings(errorLogMaxItems) })
}

/** Change the setting, without touching any other data */
async function changeErrorLogMaxItems(errorLogMaxItems: unknown) {
	await CoreSystem.updateAsync(SYSTEM_ID, { $set: { settingsWithOverrides: makeSettings(errorLogMaxItems) } })
}

/** Fill the ErrorLog with old errors */
async function insertOldErrors(count: number) {
	for (let i = 0; i < count; i++) {
		await ErrorLog.insertAsync(
			literalError({
				_id: protectString(`old${i}`),
				timestamp: i + 1,
			})
		)
	}
}

function literalError(doc: Pick<DBErrorLogItem, '_id' | 'timestamp'>): DBErrorLogItem {
	return {
		...doc,
		studioId: null,
		operation: 'test',
		userId: null,
		errorCode: 500,
		error: { key: UserErrorMessage.InternalError, message: { key: '' } },
	}
}

describe('ErrorLog', () => {
	beforeEach(async () => {
		await ErrorLog.removeAsync({})
	})

	describe('getErrorLogMaxItems', () => {
		test('uses the configured value', async () => {
			await setupCoreWithErrorLogMaxItems(5)
			expect(await getErrorLogMaxItems()).toBe(5)
		})

		test('uses the default when not configured', async () => {
			await setupCoreWithErrorLogMaxItems(undefined)
			expect(await getErrorLogMaxItems()).toBe(DEFAULT_ERROR_LOG_MAX_ITEMS)
		})

		test.each([0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY, '10'])(
			'uses the default for the invalid value %p',
			async (value) => {
				await setupCoreWithErrorLogMaxItems(value)
				expect(await getErrorLogMaxItems()).toBe(DEFAULT_ERROR_LOG_MAX_ITEMS)
			}
		)
	})

	describe('recordError', () => {
		test('keeps only the configured number of the newest errors', async () => {
			await setupCoreWithErrorLogMaxItems(3)
			await insertOldErrors(5)

			const id = recordError(UserError.create(UserErrorMessage.TakeRateLimit, { duration: 1000 }), {
				operation: 'worker.takeNextPart',
			})

			await waitUntil(async () => {
				expect(await ErrorLog.countDocuments({})).toBe(3)
			}, 1000)

			const remaining = await ErrorLog.findFetchAsync({}, { sort: { timestamp: -1 } })
			expect(remaining.map((doc) => doc._id)).toEqual([id, protectString('old4'), protectString('old3')])
		})

		test('trims to the new size after the setting is lowered', async () => {
			await setupCoreWithErrorLogMaxItems(10)
			await insertOldErrors(8)

			await changeErrorLogMaxItems(2)
			recordError(new Error('boom'), { operation: 'ingest.updateRundown' })

			await waitUntil(async () => {
				expect(await ErrorLog.countDocuments({})).toBe(2)
			}, 1000)
		})
	})
})
