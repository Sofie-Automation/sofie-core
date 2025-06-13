import { ShowStyleVariantId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import {
	BlueprintConfigCoreConfig,
	ConfigItemValue,
	ShowStyleBlueprintManifest,
	StudioBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { getSofieHostUrl, objectPathGet } from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import _ from 'underscore'
import { logger } from '../logging.js'
import { CommonContext } from './context/index.js'
import { IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { JobStudio, ProcessedShowStyleCompound, StudioCacheContext } from '../jobs/index.js'

/**
 * Parse a string containing BlueprintConfigRefs (`${studio.studio0.myConfigField}`) to replace the refs with the current values
 * @param context The studio context this is being run in
 * @param stringWithReferences String to resolve
 * @param modifier Modify the value before performing the replacement
 * @param bailOnError If true, errors will be thrown. If false, replacements will be skipped instead of throwing an error
 * @returns string with BlueprintConfigRefs replaced with values
 */
export async function retrieveBlueprintConfigRefs(
	context: StudioCacheContext,
	stringWithReferences: string,
	modifier?: (str: string) => string,
	bailOnError?: boolean
): Promise<string> {
	if (!stringWithReferences) return stringWithReferences

	const refs = stringWithReferences.match(/\$\{[^}]+\}/g) || []
	for (const ref of refs) {
		if (ref) {
			// eslint-disable-next-line @typescript-eslint/no-base-to-string
			let value = (await retrieveBlueprintConfigRef(context, ref, bailOnError)) + ''
			if (value) {
				if (modifier) value = modifier(value)
				stringWithReferences = stringWithReferences.replace(ref, value)
			}
		}
	}
	return stringWithReferences
}
async function retrieveBlueprintConfigRef(
	context: StudioCacheContext,
	reference: string,
	bailOnError?: boolean
): Promise<ConfigItemValue | undefined> {
	if (!reference) return undefined

	const m = reference.match(/\$\{([^.}]+)\.([^.}]+)\.([^}]+)\}/)
	if (m) {
		if (m[1] === 'studio' && _.isString(m[2]) && _.isString(m[3])) {
			const studioId: StudioId = protectString(m[2])
			if (studioId === context.studioId) {
				const configId = m[3]
				const studioConfig = context.getStudioBlueprintConfig()
				return objectPathGet(studioConfig, configId)
			} else if (bailOnError) throw new Error(`Ref "${reference}": Studio "${studioId}" not valid`)
		} else if (m[1] === 'showStyle' && _.isString(m[2]) && _.isString(m[3])) {
			const showStyleVariantId = protectString<ShowStyleVariantId>(m[2])
			const configId = m[3]

			const showStyleCompound = await context.getShowStyleCompound(showStyleVariantId).catch(() => undefined)
			if (showStyleCompound) {
				const showStyleConfig = context.getShowStyleBlueprintConfig(showStyleCompound)
				return objectPathGet(showStyleConfig, configId)
			} else if (bailOnError) {
				throw new Error(`Ref "${reference}": Showstyle variant "${showStyleVariantId}" not found`)
			}
		}
	}
	return undefined
}

export interface ProcessedShowStyleConfig {
	_showStyleConfig: never
}

export interface ProcessedStudioConfig {
	_studioConfig: never
}

/**
 * Get the `BlueprintConfigCoreConfig`
 * This is a set of values provided to the blueprints about the environment, such as the url to access sofie ui
 */
export function compileCoreConfigValues(studioSettings: ReadonlyDeep<IStudioSettings>): BlueprintConfigCoreConfig {
	return {
		hostUrl: getSofieHostUrl(),
		frameRate: studioSettings.frameRate,
	}
}

/**
 * Compile the complete Studio config
 * Resolves any overrides defined by the user, and run the result through the `preprocessConfig` blueprint method
 */
export function preprocessStudioConfig(
	studio: ReadonlyDeep<JobStudio>,
	blueprint: ReadonlyDeep<StudioBlueprintManifest>
): ProcessedStudioConfig {
	let res: any = studio.blueprintConfig

	try {
		if (blueprint.preprocessConfig) {
			const context = new CommonContext({
				name: `preprocessStudioConfig`,
				identifier: `studioId=${studio._id}`,
			})
			res = blueprint.preprocessConfig(context, res, compileCoreConfigValues(studio.settings))
		}
	} catch (err) {
		logger.error(`Error in studioBlueprint.preprocessConfig: ${stringifyError(err)}`)
	}

	return res
}

/**
 * Compile the complete ShowStyle config
 * Resolves any overrides defined by the user, and run the result through the `preprocessConfig` blueprint method
 */
export function preprocessShowStyleConfig(
	showStyle: Pick<ReadonlyDeep<ProcessedShowStyleCompound>, '_id' | 'combinedBlueprintConfig' | 'showStyleVariantId'>,
	blueprint: ReadonlyDeep<ShowStyleBlueprintManifest>,
	studioSettings: ReadonlyDeep<IStudioSettings>
): ProcessedShowStyleConfig {
	let res: any = showStyle.combinedBlueprintConfig

	try {
		if (blueprint.preprocessConfig) {
			const context = new CommonContext({
				name: `preprocessShowStyleConfig`,
				identifier: `showStyleBaseId=${showStyle._id},showStyleVariantId=${showStyle.showStyleVariantId}`,
			})
			res = blueprint.preprocessConfig(context, res, compileCoreConfigValues(studioSettings))
		}
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.preprocessConfig: ${stringifyError(err)}`)
	}

	return res
}
