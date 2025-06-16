import { ITranslatableMessage } from '@sofie-automation/blueprints-integration'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { interpollateTranslation, translateMessage } from './TranslatableMessage.js'

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
}

export interface UserErrorObj {
	readonly errorCode: number

	/** The raw Error that was thrown */
	readonly rawError: Error
	/** The UserErrorMessage key (for matching certain error) */
	readonly key: UserErrorMessage
	/** The translatable string for the key */
	readonly userMessage: ITranslatableMessage
}

export class UserError extends Error implements UserErrorObj {
	public readonly errorCode: number

	private constructor(
		/** The raw Error that was thrown */
		public readonly rawError: Error,
		/** The UserErrorMessage key (for matching certain error) */
		public readonly key: UserErrorMessage,
		/** The translatable string for the key */
		public readonly userMessage: ITranslatableMessage,
		/** Appropriate HTTP status code. Defaults to 500 for generic internal error. */
		errorCode: number | undefined
	) {
		super()
		this.errorCode = errorCode ?? 500
	}

	public toString(): string {
		return UserError.toJSON(this)
	}

	/** Create a UserError with a custom error for the log */
	static from(err: Error, key: UserErrorMessage, args?: { [k: string]: any }, errCode?: number): UserError {
		return new UserError(err, key, { key: UserErrorMessagesTranslations[key], args }, errCode)
	}
	/** Create a UserError from an unknown possibly error input */
	static fromUnknown(err: unknown, errorCode?: number): UserError {
		if (err instanceof UserError) return err
		if (this.isUserError(err))
			return new UserError(new Error(err.rawError.toString()), err.key, err.userMessage, err.errorCode)

		const err2 = err instanceof Error ? err : new Error(stringifyError(err))
		return new UserError(
			err2,
			UserErrorMessage.InternalError,
			{ key: UserErrorMessagesTranslations[UserErrorMessage.InternalError] },
			errorCode
		)
	}

	/** Create a UserError duplicating the same error for the log */
	static create(key: UserErrorMessage, args?: { [k: string]: any }, errorCode?: number): UserError {
		return UserError.from(new Error(UserErrorMessagesTranslations[key]), key, args, errorCode)
	}

	static tryFromJSON(str: string): UserError | undefined {
		try {
			const p = JSON.parse(str)
			if (UserError.isUserError(p)) {
				return new UserError(new Error(p.rawError.toString()), p.key, p.userMessage, p.errorCode)
			} else {
				return undefined
			}
		} catch (_e: any) {
			return undefined
		}
	}

	static toJSON(e: UserErrorObj): string {
		return JSON.stringify({
			rawError: stringifyError(e.rawError),
			userMessage: e.userMessage,
			key: e.key,
			errorCode: e.errorCode,
		})
	}

	static isUserError(e: unknown): e is UserErrorObj {
		return !!e && typeof e === 'object' && 'rawError' in e && 'userMessage' in e && 'key' in e
	}

	toErrorString(): string {
		return `${translateMessage(this.userMessage, interpollateTranslation)}\n${stringifyError(this.rawError)}`
	}
}
