import { DeviceStatusContext, TSR } from '@sofie-automation/blueprints-integration'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Blueprints, PeripheralDevices, Studios } from '../../collections'
import { evalBlueprint } from '../blueprints/cache'
import { resolveActionResult } from '../peripheralDevice'

jest.mock('../deviceTriggers/observer')
jest.mock('../blueprints/cache')

const mockEvalBlueprint = evalBlueprint as jest.MockedFunction<typeof evalBlueprint>

const ACTION_ERROR_CODE = 'ACTION_HTTP_REQUEST_FAILED'
const deviceId = protectString<PeripheralDeviceId>('device0')
const studioId = protectString<StudioId>('studio0')

function makeErrorResult(overrides: Partial<TSR.ActionExecutionResult> = {}): TSR.ActionExecutionResult {
	return {
		result: TSR.ActionExecutionResultCode.Error,
		response: { key: 'HTTP request to {{url}} failed: {{errorMessage}}' },
		code: ACTION_ERROR_CODE,
		context: {
			url: 'http://graphics/api',
			errorMessage: 'connection refused',
		},
		...overrides,
	}
}

describe('resolveActionResult', () => {
	beforeEach(() => {
		jest.spyOn(PeripheralDevices, 'findOneAsync').mockReset()
		jest.spyOn(Studios, 'findOneAsync').mockReset()
		jest.spyOn(Blueprints, 'findOneAsync').mockReset()
		mockEvalBlueprint.mockReset()
	})

	afterEach(() => {
		jest.restoreAllMocks()
	})

	it('returns Ok results unchanged', async () => {
		const result: TSR.ActionExecutionResult = {
			result: TSR.ActionExecutionResultCode.Ok,
			response: { key: 'Action completed' },
		}

		const resolved = await resolveActionResult(deviceId, result)

		expect(resolved).toBe(result)
		expect(PeripheralDevices.findOneAsync).not.toHaveBeenCalled()
	})

	it('returns non-Ok results without a code unchanged', async () => {
		const result = makeErrorResult({ code: undefined })

		const resolved = await resolveActionResult(deviceId, result)

		expect(resolved).toBe(result)
		expect(PeripheralDevices.findOneAsync).not.toHaveBeenCalled()
	})

	it('interpolates a matching string template from deviceActionMessages', async () => {
		jest.spyOn(PeripheralDevices, 'findOneAsync').mockResolvedValue({
			name: 'Playout Gateway',
			studioAndConfigId: { studioId, configId: 'config0' },
		} as any)
		jest.spyOn(Studios, 'findOneAsync').mockResolvedValue({ blueprintId: 'blueprint0' } as any)
		jest.spyOn(Blueprints, 'findOneAsync').mockResolvedValue({
			_id: 'blueprint0',
			name: 'test',
			code: '',
		} as any)
		mockEvalBlueprint.mockReturnValue({
			deviceActionMessages: {
				[ACTION_ERROR_CODE]: 'Failed to trigger graphics at {{url}}: {{errorMessage}}',
			},
		} as any)

		const resolved = await resolveActionResult(deviceId, makeErrorResult())

		expect(resolved.response).toEqual({
			key: 'Failed to trigger graphics at http://graphics/api: connection refused',
		})
	})

	it('uses a DeviceStatusMessageFunction from deviceActionMessages', async () => {
		jest.spyOn(PeripheralDevices, 'findOneAsync').mockResolvedValue({
			name: 'Playout Gateway',
			studioAndConfigId: { studioId, configId: 'config0' },
		} as any)
		jest.spyOn(Studios, 'findOneAsync').mockResolvedValue({ blueprintId: 'blueprint0' } as any)
		jest.spyOn(Blueprints, 'findOneAsync').mockResolvedValue({
			_id: 'blueprint0',
			name: 'test',
			code: '',
		} as any)
		mockEvalBlueprint.mockReturnValue({
			deviceActionMessages: {
				[ACTION_ERROR_CODE]: (context: DeviceStatusContext) =>
					`${context.deviceName} could not reach ${context.url as string}`,
			},
		} as any)

		const resolved = await resolveActionResult(deviceId, makeErrorResult())

		expect(resolved.response).toEqual({
			key: 'Playout Gateway could not reach http://graphics/api',
		})
	})

	it('clears the response when the blueprint suppresses the message', async () => {
		jest.spyOn(PeripheralDevices, 'findOneAsync').mockResolvedValue({
			name: 'Playout Gateway',
			studioAndConfigId: { studioId, configId: 'config0' },
		} as any)
		jest.spyOn(Studios, 'findOneAsync').mockResolvedValue({ blueprintId: 'blueprint0' } as any)
		jest.spyOn(Blueprints, 'findOneAsync').mockResolvedValue({
			_id: 'blueprint0',
			name: 'test',
			code: '',
		} as any)
		mockEvalBlueprint.mockReturnValue({
			deviceActionMessages: {
				[ACTION_ERROR_CODE]: '',
			},
		} as any)

		const original = makeErrorResult()
		const resolved = await resolveActionResult(deviceId, original)

		expect(resolved).toMatchObject({
			result: TSR.ActionExecutionResultCode.Error,
			code: ACTION_ERROR_CODE,
			context: original.context,
			response: { key: '' },
		})
	})

	it('returns the original result when there is no matching deviceActionMessages entry', async () => {
		jest.spyOn(PeripheralDevices, 'findOneAsync').mockResolvedValue({
			name: 'Playout Gateway',
			studioAndConfigId: { studioId, configId: 'config0' },
		} as any)
		jest.spyOn(Studios, 'findOneAsync').mockResolvedValue({ blueprintId: 'blueprint0' } as any)
		jest.spyOn(Blueprints, 'findOneAsync').mockResolvedValue({
			_id: 'blueprint0',
			name: 'test',
			code: '',
		} as any)
		mockEvalBlueprint.mockReturnValue({
			deviceActionMessages: {},
		} as any)

		const result = makeErrorResult()
		const resolved = await resolveActionResult(deviceId, result)

		expect(resolved).toBe(result)
	})

	it('resolves messages for child devices via the parent studio', async () => {
		const parentDeviceId = protectString<PeripheralDeviceId>('parent0')
		jest.spyOn(PeripheralDevices, 'findOneAsync').mockImplementation(async (id) => {
			if (id === deviceId) {
				return {
					name: 'casparcg0',
					parentDeviceId,
				} as any
			}
			if (id === parentDeviceId) {
				return {
					studioAndConfigId: { studioId, configId: 'config0' },
				} as any
			}
			return undefined
		})
		jest.spyOn(Studios, 'findOneAsync').mockResolvedValue({ blueprintId: 'blueprint0' } as any)
		jest.spyOn(Blueprints, 'findOneAsync').mockResolvedValue({
			_id: 'blueprint0',
			name: 'test',
			code: '',
		} as any)
		mockEvalBlueprint.mockReturnValue({
			deviceActionMessages: {
				[ACTION_ERROR_CODE]: 'Failed to trigger graphics at {{url}}: {{errorMessage}}',
			},
		} as any)

		const resolved = await resolveActionResult(deviceId, makeErrorResult())

		expect(resolved.response).toEqual({
			key: 'Failed to trigger graphics at http://graphics/api: connection refused',
		})
	})

	it('returns the original result when the device has no studio', async () => {
		jest.spyOn(PeripheralDevices, 'findOneAsync').mockResolvedValue({
			name: 'Playout Gateway',
		} as any)

		const result = makeErrorResult()
		const resolved = await resolveActionResult(deviceId, result)

		expect(resolved).toBe(result)
		expect(Studios.findOneAsync).not.toHaveBeenCalled()
	})

	it('returns the original result when blueprint lookup fails', async () => {
		jest.spyOn(PeripheralDevices, 'findOneAsync').mockResolvedValue({
			name: 'Playout Gateway',
			studioAndConfigId: { studioId, configId: 'config0' },
		} as any)
		jest.spyOn(Studios, 'findOneAsync').mockResolvedValue(undefined)

		const result = makeErrorResult()
		const resolved = await resolveActionResult(deviceId, result)

		expect(resolved).toBe(result)
	})
})
