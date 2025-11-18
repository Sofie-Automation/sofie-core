import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { generateTranslation } from '@sofie-automation/corelib/dist/lib'
import {
	ITranslatableMessage,
	wrapTranslatableMessageFromBlueprints,
} from '@sofie-automation/corelib/dist/TranslatableMessage'
import { PackageStatusMessage } from '@sofie-automation/shared-lib/dist/packageStatusMessages'

const DEFAULT_MESSAGES: Record<PackageStatusMessage, ITranslatableMessage> = {
	// Media Manager
	[PackageStatusMessage.MISSING_FILE_PATH]: generateTranslation('{{sourceLayer}} is missing a file path'),
	[PackageStatusMessage.FILE_NOT_YET_READY_ON_PLAYOUT_SYSTEM]: generateTranslation(
		'{{sourceLayer}} is not yet ready on the playout system'
	),
	[PackageStatusMessage.FILE_IS_BEING_INGESTED]: generateTranslation('{{sourceLayer}} is being ingested'),
	[PackageStatusMessage.FILE_IS_MISSING]: generateTranslation('{{sourceLayer}} is missing'),

	// Package manager
	[PackageStatusMessage.FILE_MISSING_SOURCE_CONTAINERS]: generateTranslation(
		'{{sourceLayer}} has unsupported source: {{containerLabels}}'
	),
	[PackageStatusMessage.FILE_CANT_BE_FOUND_ON_PLAYOUT_SYSTEM]: generateTranslation(
		`{{sourceLayer}} can't be found on the playout system`
	),
	[PackageStatusMessage.FILE_EXISTS_BUT_IS_NOT_READY_ON_PLAYOUT_SYSTEM]: generateTranslation(
		'{{reason}} {{sourceLayer}} exists, but is not yet ready on the playout system'
	),
	[PackageStatusMessage.FILE_IS_IN_PLACEHOLDER_STATE]: generateTranslation(
		'{{sourceLayer}} is in a placeholder state for an unknown workflow-defined reason'
	),
	[PackageStatusMessage.FILE_IS_TRANSFERRING_TO_PLAYOUT_SYSTEM]: generateTranslation(
		'{{sourceLayer}} is transferring to the playout system'
	),
	[PackageStatusMessage.FILE_IS_TRANSFERRING_TO_PLAYOUT_SYSTEM_NOT_READY]: generateTranslation(
		'{{sourceLayer}} is transferring to the playout system but cannot be played yet'
	),
	[PackageStatusMessage.FILE_IS_IN_UNKNOWN_STATE]: generateTranslation(
		'{{sourceLayer}} is in an unknown state: "{{status}}"'
	),

	// Common?
	[PackageStatusMessage.FILE_DOESNT_HAVE_BOTH_VIDEO_AND_AUDIO]: generateTranslation(
		"{{sourceLayer}} doesn't have both audio & video"
	),
	[PackageStatusMessage.FILE_HAS_WRONG_FORMAT]: generateTranslation(
		'{{sourceLayer}} has the wrong format: {{format}}'
	),
	[PackageStatusMessage.FILE_HAS_WRONG_AUDIO_STREAMS]: generateTranslation(
		'{{sourceLayer}} has {{audioStreams}} audio streams'
	),

	[PackageStatusMessage.CLIP_STARTS_WITH_BLACK_FRAMES]: generateTranslation(
		'Clip starts with {{frames}} black frames'
	),
	[PackageStatusMessage.CLIP_ENDS_WITH_BLACK_FRAMES]: generateTranslation(
		'This clip ends with black frames after {{seconds}} seconds'
	),
	[PackageStatusMessage.CLIP_HAS_SINGLE_BLACK_FRAMES_REGION]: generateTranslation(
		'{{frames}} black frames detected within the clip'
	),
	[PackageStatusMessage.CLIP_HAS_MULTIPLE_BLACK_FRAMES_REGIONS]: generateTranslation(
		'{{frames}} black frames detected in the clip'
	),

	[PackageStatusMessage.CLIP_STARTS_WITH_FREEZE_FRAMES]: generateTranslation(
		'Clip starts with {{frames}} freeze frames'
	),
	[PackageStatusMessage.CLIP_ENDS_WITH_FREEZE_FRAMES]: generateTranslation(
		'This clip ends with freeze frames after {{seconds}} seconds'
	),
	[PackageStatusMessage.CLIP_HAS_SINGLE_FREEZE_FRAMES_REGION]: generateTranslation(
		'{{frames}} freeze frames detected within the clip'
	),
	[PackageStatusMessage.CLIP_HAS_MULTIPLE_FREEZE_FRAMES_REGIONS]: generateTranslation(
		'{{frames}} freeze frames detected in the clip'
	),
}

export interface PieceContentStatusMessageRequiredArgs {
	sourceLayer: string
	pieceName: string
	fileName: string
	containerLabels: string
}

export type BlueprintForStatusMessage = Pick<Blueprint, '_id' | 'packageStatusMessages'>

export class PieceContentStatusMessageFactory {
	readonly #blueprint: BlueprintForStatusMessage | undefined

	constructor(blueprint: BlueprintForStatusMessage | undefined) {
		this.#blueprint = blueprint
	}

	getTranslation(
		messageKey: PackageStatusMessage,
		args: PieceContentStatusMessageRequiredArgs & { [k: string]: any }
	): ITranslatableMessage | null {
		if (this.#blueprint) {
			const blueprintMessage = this.#blueprint.packageStatusMessages?.[messageKey]

			if (blueprintMessage === '') {
				// If the blueprint gave an empty string, it means it wants to suppress the message
				return null
			}

			if (blueprintMessage) {
				return wrapTranslatableMessageFromBlueprints(
					{
						key: blueprintMessage,
						args,
					},
					[this.#blueprint._id]
				)
			}
		}

		// Otherwise, use the default message
		return {
			key: DEFAULT_MESSAGES[messageKey]?.key ?? messageKey,
			args,
		}
	}
}
