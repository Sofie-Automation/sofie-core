import { BlueprintId } from './dataModel/Ids.js'
import { generateTranslation } from './lib.js'
import { ITranslatableMessage, wrapTranslatableMessageFromBlueprints } from './TranslatableMessage.js'
import { SystemErrorCode } from '@sofie-automation/shared-lib/dist/systemErrorMessages'
import type { DeviceErrorContext, DeviceErrorMessageFunction } from '@sofie-automation/blueprints-integration'

// Re-export for consumers of corelib
export type { DeviceErrorContext, DeviceErrorMessageFunction }

/**
 * Default error messages for system errors
 */
const DEFAULT_SYSTEM_ERROR_MESSAGES: Record<SystemErrorCode, ITranslatableMessage> = {
	[SystemErrorCode.DATABASE_CONNECTION_LOST]: generateTranslation('Database connection to {{database}} lost'),
	[SystemErrorCode.INSUFFICIENT_RESOURCES]: generateTranslation(
		'Insufficient {{resource}}: {{available}} available, {{required}} required'
	),
	[SystemErrorCode.SERVICE_UNAVAILABLE]: generateTranslation('Service {{service}} unavailable: {{reason}}'),
}

/**
 * Device error messages map - can contain string templates or functions.
 * Functions are evaluated at runtime, strings use {{variable}} interpolation.
 */
export type DeviceErrorMessages = Record<string, string | DeviceErrorMessageFunction | undefined>

/**
 * System error messages map - string templates only.
 * Uses {{variable}} interpolation.
 */
export type SystemErrorMessages = Partial<Record<SystemErrorCode | string, string | undefined>>

/**
 * Resolves error messages with blueprint customizations.
 * Works with runtime blueprint manifests (evaluated at setStatus time).
 *
 * For device errors, the default message templates come from TSR devices.
 * Studio blueprints can override these by providing custom templates or functions in deviceErrorMessages.
 *
 * For system errors, System blueprints can override the defaults in systemErrorMessages.
 *
 * @example
 * ```typescript
 * import { AtemErrorCode, AtemErrorMessages } from 'timeline-state-resolver-types'
 *
 * // Get blueprint manifest at runtime (from evalBlueprint or similar)
 * const studioManifest = await getBlueprintManifest(studioBlueprintId)
 *
 * // Create resolver for device errors
 * const resolver = new ErrorMessageResolver(
 *   studioBlueprintId,
 *   studioManifest.deviceErrorMessages
 * )
 *
 * // Resolve device error - pass default message from TSR
 * const message = resolver.getDeviceErrorMessage(
 *   AtemErrorCode.DISCONNECTED,
 *   { deviceName: 'Vision Mixer', host: '192.168.1.10' },
 *   AtemErrorMessages[AtemErrorCode.DISCONNECTED]
 * )
 * ```
 */
export class ErrorMessageResolver {
	readonly #blueprintId: BlueprintId | undefined
	readonly #deviceErrorMessages: DeviceErrorMessages | undefined
	readonly #systemErrorMessages: SystemErrorMessages | undefined

	constructor(
		blueprintId: BlueprintId | undefined,
		deviceErrorMessages?: DeviceErrorMessages | undefined,
		systemErrorMessages?: SystemErrorMessages | undefined
	) {
		this.#blueprintId = blueprintId
		this.#deviceErrorMessages = deviceErrorMessages
		this.#systemErrorMessages = systemErrorMessages
	}

	/**
	 * Get a translatable message for a device error.
	 *
	 * @param errorCode - The error code string from TSR (e.g., 'DEVICE_ATEM_DISCONNECTED')
	 * @param context - Context values for message interpolation (deviceName, deviceId, and TSR error context)
	 * @param defaultMessage - The default message template from TSR (e.g., 'ATEM disconnected from {{host}}')
	 * @returns ITranslatableMessage with the resolved message, or null if suppressed
	 */
	getDeviceErrorMessage(
		errorCode: string,
		context: DeviceErrorContext,
		defaultMessage: string
	): ITranslatableMessage | null {
		// Check blueprint messages from Studio blueprint manifest
		if (this.#deviceErrorMessages) {
			const blueprintMessage = this.#deviceErrorMessages[errorCode]

			if (blueprintMessage === '') {
				// Empty string means suppress the message
				return null
			}

			if (typeof blueprintMessage === 'function') {
				// Function: evaluate at runtime with full context
				const result = blueprintMessage(context)
				if (result === '') return null // Function can also suppress

				return this.#blueprintId
					? wrapTranslatableMessageFromBlueprints({ key: result, args: context }, [this.#blueprintId])
					: { key: result, args: context }
			}

			if (blueprintMessage) {
				// String template: use as-is with interpolation
				return this.#blueprintId
					? wrapTranslatableMessageFromBlueprints({ key: blueprintMessage, args: context }, [this.#blueprintId])
					: { key: blueprintMessage, args: context }
			}
		}

		// Use default message from TSR
		return {
			key: defaultMessage,
			args: context,
		}
	}

	/**
	 * Get a translatable message for a system error.
	 * Uses customizations from the System blueprint if available.
	 */
	getSystemErrorMessage(
		errorCode: SystemErrorCode | string,
		args: { [k: string]: unknown }
	): ITranslatableMessage | null {
		// Check blueprint messages from System blueprint manifest
		if (this.#systemErrorMessages) {
			const blueprintMessage = this.#systemErrorMessages[errorCode]

			if (blueprintMessage === '') {
				// Empty string means suppress the message
				return null
			}

			if (blueprintMessage) {
				return this.#blueprintId
					? wrapTranslatableMessageFromBlueprints({ key: blueprintMessage, args }, [this.#blueprintId])
					: { key: blueprintMessage, args }
			}
		}

		// Use default message
		return {
			key: DEFAULT_SYSTEM_ERROR_MESSAGES[errorCode as SystemErrorCode]?.key ?? errorCode,
			args,
		}
	}
}
