import { StatusMessageResolver } from '../StatusMessageResolver.js'
import { SystemErrorCode } from '@sofie-automation/shared-lib/dist/systemErrorMessages'
import { protectString } from '../protectedString.js'

// Mock device status codes (these would come from TSR in production)
const MockDeviceStatusCode = {
	HTTP_TIMEOUT: 'DEVICE_HTTP_TIMEOUT',
	CASPARCG_DISCONNECTED: 'DEVICE_CASPARCG_DISCONNECTED',
	CASPARCG_FILE_NOT_FOUND: 'DEVICE_CASPARCG_FILE_NOT_FOUND',
} as const

// Mock default messages (these would come from TSR in production)
const MockDeviceStatusMessages = {
	[MockDeviceStatusCode.HTTP_TIMEOUT]: '{{deviceName}}: HTTP request to {{url}} timed out after {{timeout}}ms',
	[MockDeviceStatusCode.CASPARCG_DISCONNECTED]: '{{deviceName}}: CasparCG server at {{host}}:{{port}} disconnected',
	[MockDeviceStatusCode.CASPARCG_FILE_NOT_FOUND]: '{{deviceName}}: File "{{fileName}}" not found on CasparCG server',
}

describe('StatusMessageResolver', () => {
	describe('Device statuses', () => {
		it('returns default message from TSR when no blueprint provided', () => {
			const resolver = new StatusMessageResolver(undefined, undefined, undefined)
			const message = resolver.getDeviceStatusMessage(
				MockDeviceStatusCode.HTTP_TIMEOUT,
				{
					deviceName: 'Graphics Server',
					url: 'http://graphics/api',
					timeout: 5000,
				},
				MockDeviceStatusMessages[MockDeviceStatusCode.HTTP_TIMEOUT]
			)

			expect(message).toBeTruthy()
			expect(message?.key).toBe('{{deviceName}}: HTTP request to {{url}} timed out after {{timeout}}ms')
			expect(message?.args).toMatchObject({
				deviceName: 'Graphics Server',
				url: 'http://graphics/api',
				timeout: 5000,
			})
		})

		it('returns blueprint custom message when provided', () => {
			const resolver = new StatusMessageResolver(
				protectString('studioBlueprint123'),
				{
					[MockDeviceStatusCode.HTTP_TIMEOUT]: 'Graphics system {{deviceName}} not responding',
				},
				undefined
			)

			const message = resolver.getDeviceStatusMessage(
				MockDeviceStatusCode.HTTP_TIMEOUT,
				{
					deviceName: 'Graphics Server',
					url: 'http://graphics/api',
					timeout: 5000,
				},
				MockDeviceStatusMessages[MockDeviceStatusCode.HTTP_TIMEOUT]
			)

			expect(message).toBeTruthy()
			expect(message?.key).toBe('Graphics system {{deviceName}} not responding')
			expect(message?.args?.deviceName).toBe('Graphics Server')
		})

		it('returns null when blueprint provides empty string (suppression)', () => {
			const resolver = new StatusMessageResolver(
				protectString('studioBlueprint123'),
				{
					[MockDeviceStatusCode.HTTP_TIMEOUT]: '',
				},
				undefined
			)

			const message = resolver.getDeviceStatusMessage(
				MockDeviceStatusCode.HTTP_TIMEOUT,
				{
					deviceName: 'Graphics Server',
				},
				MockDeviceStatusMessages[MockDeviceStatusCode.HTTP_TIMEOUT]
			)

			expect(message).toBeNull()
		})

		it('evaluates function-based status messages', () => {
			const resolver = new StatusMessageResolver(
				protectString('studioBlueprint123'),
				{
					[MockDeviceStatusCode.HTTP_TIMEOUT]: (context) => {
						const timeout = context.timeout as number
						if (timeout > 10000) {
							return `${context.deviceName}: Critical timeout (${timeout}ms) - check network`
						}
						return `${context.deviceName}: Request timeout`
					},
				},
				undefined
			)

			// Test with small timeout
			const shortMessage = resolver.getDeviceStatusMessage(
				MockDeviceStatusCode.HTTP_TIMEOUT,
				{
					deviceName: 'Graphics Server',
					timeout: 5000,
				},
				MockDeviceStatusMessages[MockDeviceStatusCode.HTTP_TIMEOUT]
			)

			expect(shortMessage?.key).toBe('Graphics Server: Request timeout')

			// Test with long timeout
			const longMessage = resolver.getDeviceStatusMessage(
				MockDeviceStatusCode.HTTP_TIMEOUT,
				{
					deviceName: 'Graphics Server',
					timeout: 15000,
				},
				MockDeviceStatusMessages[MockDeviceStatusCode.HTTP_TIMEOUT]
			)

			expect(longMessage?.key).toBe('Graphics Server: Critical timeout (15000ms) - check network')
		})

		it('suppresses message when function returns empty string', () => {
			const resolver = new StatusMessageResolver(
				protectString('studioBlueprint123'),
				{
					[MockDeviceStatusCode.HTTP_TIMEOUT]: () => '', // Always suppress
				},
				undefined
			)

			const message = resolver.getDeviceStatusMessage(
				MockDeviceStatusCode.HTTP_TIMEOUT,
				{
					deviceName: 'Graphics Server',
				},
				MockDeviceStatusMessages[MockDeviceStatusCode.HTTP_TIMEOUT]
			)

			expect(message).toBeNull()
		})

		it('returns default for CasparCG errors', () => {
			const resolver = new StatusMessageResolver(undefined, undefined, undefined)
			const message = resolver.getDeviceStatusMessage(
				MockDeviceStatusCode.CASPARCG_FILE_NOT_FOUND,
				{
					deviceName: 'CasparCG1',
					fileName: 'video.mp4',
				},
				MockDeviceStatusMessages[MockDeviceStatusCode.CASPARCG_FILE_NOT_FOUND]
			)

			expect(message).toBeTruthy()
			expect(message?.key).toContain('File')
			expect(message?.key).toContain('not found')
		})

		it('falls back to TSR default when blueprint has no customization for that status code', () => {
			const resolver = new StatusMessageResolver(
				protectString('studioBlueprint123'),
				{
					[MockDeviceStatusCode.HTTP_TIMEOUT]: 'Custom timeout message',
				},
				undefined
			)

			// Ask for a different error that has no customization
			const message = resolver.getDeviceStatusMessage(
				MockDeviceStatusCode.CASPARCG_DISCONNECTED,
				{
					deviceName: 'CasparCG1',
					host: 'localhost',
				},
				MockDeviceStatusMessages[MockDeviceStatusCode.CASPARCG_DISCONNECTED]
			)

			expect(message).toBeTruthy()
			expect(message?.key).toContain('CasparCG')
		})
	})

	describe('System errors', () => {
		it('returns default message when no blueprint provided', () => {
			const resolver = new StatusMessageResolver(undefined, undefined, undefined)
			const message = resolver.getSystemErrorMessage(SystemErrorCode.DATABASE_CONNECTION_LOST, {
				database: 'MongoDB',
			})

			expect(message).toBeTruthy()
			expect(message?.key).toContain('Database')
			expect(message?.args?.database).toBe('MongoDB')
		})

		it('returns blueprint custom message', () => {
			const resolver = new StatusMessageResolver(protectString('systemBlueprint123'), undefined, {
				[SystemErrorCode.DATABASE_CONNECTION_LOST]: 'System database offline - please wait',
			})

			const message = resolver.getSystemErrorMessage(SystemErrorCode.DATABASE_CONNECTION_LOST, {
				database: 'MongoDB',
			})

			expect(message?.key).toBe('System database offline - please wait')
		})

		it('suppresses message with empty string', () => {
			const resolver = new StatusMessageResolver(protectString('systemBlueprint123'), undefined, {
				[SystemErrorCode.INSUFFICIENT_RESOURCES]: '',
			})

			const message = resolver.getSystemErrorMessage(SystemErrorCode.INSUFFICIENT_RESOURCES, {
				resource: 'memory',
			})

			expect(message).toBeNull()
		})
	})

	describe('Combined blueprints', () => {
		it('resolves device statuses and system errors with same blueprint ID', () => {
			// Note: In practice, device statuses use Studio blueprint ID and system errors use System blueprint ID
			// But the resolver doesn't enforce this - it just associates the ID with any messages it generates
			const resolver = new StatusMessageResolver(
				protectString('blueprint123'),
				{
					[MockDeviceStatusCode.HTTP_TIMEOUT]: 'Custom device status',
				},
				{
					[SystemErrorCode.DATABASE_CONNECTION_LOST]: 'Custom system error',
				}
			)

			const deviceMessage = resolver.getDeviceStatusMessage(
				MockDeviceStatusCode.HTTP_TIMEOUT,
				{ deviceName: 'Server' },
				MockDeviceStatusMessages[MockDeviceStatusCode.HTTP_TIMEOUT]
			)

			const systemMessage = resolver.getSystemErrorMessage(SystemErrorCode.DATABASE_CONNECTION_LOST, {
				database: 'MongoDB',
			})

			expect(deviceMessage?.key).toBe('Custom device status')
			expect(systemMessage?.key).toBe('Custom system error')
		})

		it('includes correct blueprint namespace for messages', () => {
			const resolver = new StatusMessageResolver(
				protectString('blueprint123'),
				{
					[MockDeviceStatusCode.HTTP_TIMEOUT]: 'Custom device status',
				},
				{
					[SystemErrorCode.DATABASE_CONNECTION_LOST]: 'Custom system error',
				}
			)

			const deviceMessage = resolver.getDeviceStatusMessage(
				MockDeviceStatusCode.HTTP_TIMEOUT,
				{ deviceName: 'Server' },
				MockDeviceStatusMessages[MockDeviceStatusCode.HTTP_TIMEOUT]
			)

			const systemMessage = resolver.getSystemErrorMessage(SystemErrorCode.DATABASE_CONNECTION_LOST, {
				database: 'MongoDB',
			})

			// Both messages should have the same blueprint namespace
			expect(deviceMessage?.namespaces).toContain('blueprint_blueprint123')
			expect(systemMessage?.namespaces).toContain('blueprint_blueprint123')
		})

		it('does not add namespace when no blueprint ID provided', () => {
			const resolver = new StatusMessageResolver(
				undefined,
				{
					[MockDeviceStatusCode.HTTP_TIMEOUT]: 'Custom device status',
				},
				undefined
			)

			const message = resolver.getDeviceStatusMessage(
				MockDeviceStatusCode.HTTP_TIMEOUT,
				{ deviceName: 'Server' },
				MockDeviceStatusMessages[MockDeviceStatusCode.HTTP_TIMEOUT]
			)

			// No namespace when no blueprint ID
			expect(message?.namespaces).toBeUndefined()
		})
	})
})
