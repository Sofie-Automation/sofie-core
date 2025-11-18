import { ITranslatableMessage } from '@sofie-automation/blueprints-integration'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { interpollateTranslation, isTranslatableMessage, translateMessage } from './TranslatableMessage.js'

// Mock 't' function for i18next to find the keys
function t(key: string): string {
	return key
}

/**
 * List of all possible UserErrorMessages.
 * This is an enum to allow for the strings to be defined in one central location.
 * Note: The Values for these items should never be changed once set. The UI will use these to match certain errors, and the values can be persisted in the database
 */
export enum UserErrorMessage {
	InternalError = 0,
	InactiveRundown = 1,
	DuringHold = 2,
	NoCurrentPart = 3,
	NoCurrentOrNextPart = 4,
	AdlibCurrentPart = 5,
	AdlibNotFound = 6,
	AdlibUnplayable = 7,
	PieceAsAdlibNotFound = 8,
	PieceAsAdlibNotDirectPlayable = 9,
	PieceAsAdlibCurrentlyLive = 10,
	SourceLayerNotSticky = 11,
	SourceLayerStickyNothingFound = 12,
	BucketAdlibIncompatible = 13,
	TakeDuringTransition = 14,
	TakeCloseToAutonext = 15,
	HoldNotCancelable = 16,
	HoldNeedsNextPart = 17,
	HoldAlreadyActive = 18,
	HoldIncompatibleParts = 19,
	HoldAfterAdlib = 20,
	RundownAlreadyActive = 21,
	RundownAlreadyActiveNames = 22,
	RundownResetWhileActive = 23,
	RundownRegenerateWhileActive = 24,
	PartNotFound = 25,
	PartNotPlayable = 26,
	ActionsNotSupported = 27,
	TakeNoNextPart = 28,
	TakeRateLimit = 29,
	DisableNoPieceFound = 30,
	TakeBlockedDuration = 31,
	TakeFromIncorrectPart = 32,
	RundownRemoveWhileActive = 33,
	RundownPlaylistNotFound = 34,
	PeripheralDeviceNotFound = 35,
	BlueprintNotFound = 36,
	StudioNotFound = 37,
	DeviceAlreadyAttachedToStudio = 38,
	ShowStyleBaseNotFound = 39,
	NoMigrationsToApply = 40,
	ValidationFailed = 41,
	AdlibTestingNotAllowed = 42,
	AdlibTestingAlreadyActive = 43,
	BucketNotFound = 44,
	AdlibTestingRundownsNotSupported = 45,
	AdlibTestingRundownsGenerationFailed = 46,
	IdempotencyKeyMissing = 47,
	IdempotencyKeyAlreadyUsed = 48,
	RateLimitExceeded = 49,
	SystemSingleStudio = 50,
}

const UserErrorMessagesTranslations: { [key in UserErrorMessage]: string } = {
	[UserErrorMessage.InternalError]: t(`An internal error occured!`),
	[UserErrorMessage.InactiveRundown]: t(`Rundown must be active!`),
	[UserErrorMessage.DuringHold]: t(`Can not be used during a hold!`),
	[UserErrorMessage.NoCurrentPart]: t(`Rundown must be playing!`),
	[UserErrorMessage.NoCurrentOrNextPart]: t(`Rundown must be playing or have a next!`),
	[UserErrorMessage.AdlibCurrentPart]: t(`AdLibs can be only placed in a currently playing part!`),
	[UserErrorMessage.AdlibNotFound]: t(`AdLib could not be found!`),
	[UserErrorMessage.AdlibUnplayable]: t(`Cannot take unplayable AdLib`),
	[UserErrorMessage.PieceAsAdlibNotFound]: t(`Piece to take was not found!`),
	[UserErrorMessage.PieceAsAdlibNotDirectPlayable]: t(`Piece to take is not directly playable!`),
	[UserErrorMessage.PieceAsAdlibCurrentlyLive]: t(`Piece to take is already live!`),
	[UserErrorMessage.SourceLayerNotSticky]: t(`Layer does not allow sticky pieces!`),
	[UserErrorMessage.SourceLayerStickyNothingFound]: t(`Nothing was found on layer!`),
	[UserErrorMessage.BucketAdlibIncompatible]: t(`Bucket AdLib is not compatible with this Rundown!`),
	[UserErrorMessage.TakeDuringTransition]: t(`Cannot take during a transition`),
	[UserErrorMessage.TakeCloseToAutonext]: t(`Cannot take close to an AUTO`),
	[UserErrorMessage.HoldNotCancelable]: t(`Cannot cancel HOLD once it has been taken`),
	[UserErrorMessage.HoldNeedsNextPart]: t(`Cannot activate HOLD before a part has been taken!`),
	[UserErrorMessage.HoldAlreadyActive]: t(`Rundown is already doing a HOLD!`),
	[UserErrorMessage.HoldIncompatibleParts]: t(`Cannot activate HOLD between the current and next parts`),
	[UserErrorMessage.HoldAfterAdlib]: t(`Cannot activate HOLD once an adlib has been used`),
	[UserErrorMessage.RundownAlreadyActive]: t(
		`Rundown Playlist is active, please deactivate before preparing it for broadcast`
	),
	[UserErrorMessage.RundownAlreadyActiveNames]: t(
		`Only one rundown can be active at the same time. Currently active rundowns: {{names}}`
	),
	[UserErrorMessage.RundownResetWhileActive]: t(
		`RundownPlaylist is active but not in rehearsal, please deactivate it or set in in rehearsal to be able to reset it.`
	),
	[UserErrorMessage.RundownRegenerateWhileActive]: t(
		`Rundown Playlist is active, please deactivate it before regenerating it.`
	),
	[UserErrorMessage.PartNotFound]: t(`The selected part does not exist`),
	[UserErrorMessage.PartNotPlayable]: t(`The selected part cannot be played`),
	[UserErrorMessage.ActionsNotSupported]: t(`AdLib Actions are not supported in the current Rundown`),
	[UserErrorMessage.TakeNoNextPart]: t(`No Next point found, please set a part as Next before doing a TAKE.`),
	[UserErrorMessage.TakeRateLimit]: t(`Ignoring TAKES that are too quick after eachother ({{duration}} ms)`),
	[UserErrorMessage.DisableNoPieceFound]: t(`Found no future pieces`),
	[UserErrorMessage.TakeBlockedDuration]: t(`Cannot perform take for {{duration}}ms`),
	[UserErrorMessage.TakeFromIncorrectPart]: t(`Ignoring take as playing part has changed since TAKE was requested.`),
	[UserErrorMessage.RundownRemoveWhileActive]: t(`Cannot remove the rundown "{{name}}" while it is on-air.`),
	[UserErrorMessage.RundownPlaylistNotFound]: t(`Rundown Playlist not found!`),
	[UserErrorMessage.PeripheralDeviceNotFound]: t(`Peripheral Device not found!`),
	[UserErrorMessage.BlueprintNotFound]: t(`Blueprint not found!`),
	[UserErrorMessage.StudioNotFound]: t(`Studio not found!`),
	[UserErrorMessage.DeviceAlreadyAttachedToStudio]: t(`Device is already attached to another studio.`),
	[UserErrorMessage.ShowStyleBaseNotFound]: t(`ShowStyleBase not found!`),
	[UserErrorMessage.NoMigrationsToApply]: t(`No migrations to apply`),
	[UserErrorMessage.ValidationFailed]: t('Validation failed!'),
	[UserErrorMessage.AdlibTestingNotAllowed]: t(`Rehearsal mode is not allowed`),
	[UserErrorMessage.AdlibTestingAlreadyActive]: t(`Rehearsal mode is already active`),
	[UserErrorMessage.BucketNotFound]: t(`Bucket not found!`),
	[UserErrorMessage.AdlibTestingRundownsNotSupported]: t(`Adlib rundowns are not supported for this ShowStyle!`),
	[UserErrorMessage.AdlibTestingRundownsGenerationFailed]: t(`Failed to generate adlib rundown! {{message}}`),
	[UserErrorMessage.IdempotencyKeyMissing]: t(`Idempotency-Key is missing`),
	[UserErrorMessage.IdempotencyKeyAlreadyUsed]: t(`Idempotency-Key is already used`),
	[UserErrorMessage.RateLimitExceeded]: t(`Rate limit exceeded`),
	[UserErrorMessage.SystemSingleStudio]: t(`System must have exactly one studio`),
}

export interface SerializedUserError {
	readonly errorCode: number

	/** The raw Error that was thrown */
	rawError: Pick<Error, 'name' | 'message' | 'stack'>
	/** The UserErrorMessage key (for matching certain error) */
	readonly key: UserErrorMessage
	/** The translatable string for the key */
	readonly userMessage: ITranslatableMessage
}

export class UserError extends Error {
	public readonly errorCode: number

	private constructor(
		/** The raw Error that was thrown */
		rawError: SerializedUserError['rawError'],
		/** The UserErrorMessage key (for matching certain error) */
		public readonly key: UserErrorMessage,
		/** The translatable string for the key */
		public readonly userMessage: ITranslatableMessage,
		/** Appropriate HTTP status code. Defaults to 500 for generic internal error. */
		errorCode: number | undefined
	) {
		super()

		// Populate the error properties:
		this.message = rawError.message
		this.stack = rawError.stack
		this.name = 'UserError'

		this.errorCode = errorCode ?? 500
	}

	/** Create a UserError with a custom error for the log */
	static from(err: Error, key: UserErrorMessage, args?: { [k: string]: any }, errCode?: number): UserError {
		return new UserError(err, key, { key: UserErrorMessagesTranslations[key], args }, errCode)
	}
	/** Create a UserError duplicating the same error for the log */
	static create(key: UserErrorMessage, args?: { [k: string]: any }, errorCode?: number): UserError {
		return UserError.from(
			new Error(translateMessage({ key: UserErrorMessagesTranslations[key], args }, interpollateTranslation)),
			key,
			args,
			errorCode
		)
	}
	static fromSerialized(o: SerializedUserError): UserError {
		return new UserError(o.rawError, o.key, o.userMessage, o.errorCode)
	}
	/** Create a UserError from an unknown possibly error input */
	static fromUnknown(err: unknown, errorCode?: number): UserError {
		if (err instanceof UserError) return err

		if (this.isSerializedUserErrorObject(err)) {
			return new UserError(err.rawError, err.key, err.userMessage, err.errorCode)
		} else if (typeof err === 'string') {
			const errorFromJson = this.tryFromJSON(err)
			if (errorFromJson) {
				return errorFromJson
			}
		}
		const err2 = err instanceof Error ? err : new Error(stringifyError(err))
		return new UserError(
			err2,
			UserErrorMessage.InternalError,
			{ key: UserErrorMessagesTranslations[UserErrorMessage.InternalError] },
			errorCode
		)
	}

	static tryFromJSON(str: string): UserError | undefined {
		let p: SerializedUserError | undefined
		try {
			p = UserError.fromJSON(str)
			if (!p) return undefined
		} catch (_e: any) {
			// Ignore JSON parsing error
			return undefined
		}

		if (this.isSerializedUserErrorObject(p)) {
			return new UserError(p.rawError, p.key, p.userMessage, p.errorCode)
		} else {
			return undefined
		}
	}

	static serialize(e: UserError): SerializedUserError {
		const o: SerializedUserError = {
			rawError: {
				name: e.name,
				message: e.message,
				stack: e.stack,
			},
			userMessage: e.userMessage,
			key: e.key,
			errorCode: e.errorCode,
		}
		return o
	}
	static toJSON(e: UserError): string {
		return JSON.stringify(this.serialize(e))
	}
	static fromJSON(str: string): SerializedUserError | undefined {
		const o = JSON.parse(str)
		if (this.isSerializedUserErrorObject(o)) return o
		return undefined
	}
	static isSerializedUserErrorObject(o: unknown): o is SerializedUserError {
		if (!o || typeof o !== 'object') return false
		const errorObject = o as SerializedUserError

		return (
			'rawError' in errorObject &&
			!!errorObject.rawError &&
			typeof errorObject.rawError === 'object' &&
			errorObject.rawError &&
			typeof errorObject.rawError.message === 'string' &&
			isTranslatableMessage(errorObject.userMessage) &&
			typeof errorObject.errorCode === 'number' &&
			typeof errorObject.key === 'number'
		)
	}

	toErrorString(): string {
		return `${translateMessage(this.userMessage, interpollateTranslation)}\n${stringifyError(this)}`
	}

	toString(): string {
		return UserError.toJSON(this)
	}
}
