import { ExtendedIngestRundown } from '@sofie-automation/blueprints-integration'
import { ShowStyleBaseId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { logger } from '../logging.js'
import { createShowStyleCompound } from '../showStyles.js'
import { StudioUserContext } from '../blueprints/context/index.js'
import {
	ProcessedShowStyleBase,
	ProcessedShowStyleVariant,
	JobContext,
	ProcessedShowStyleCompound,
} from '../jobs/index.js'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { ReadonlyDeep } from 'type-fest'
import { convertShowStyleBaseToBlueprints, convertShowStyleVariantToBlueprints } from '../blueprints/context/lib.js'
import { RundownSource, RundownSourceTesting } from '@sofie-automation/corelib/dist/dataModel/Rundown'

export interface SelectedShowStyleVariant {
	variant: ReadonlyDeep<ProcessedShowStyleVariant>
	base: ReadonlyDeep<ProcessedShowStyleBase>
	compound: ReadonlyDeep<ProcessedShowStyleCompound>
}

/**
 * Using the appropriate Blueprints, select the ShowStyleVariant and ShowStyleBase for a rundown
 * @param context Context of the job being run
 * @param blueprintContext Blueprint Context to use for Blueprint methods
 * @param ingestRundown Rundown being ingested
 * @returns The selected ShowStyleVariant, or null if none was selected and the Rundown should be rejected
 */
export async function selectShowStyleVariant(
	context: JobContext,
	blueprintContext: StudioUserContext,
	ingestRundown: ExtendedIngestRundown,
	rundownSource: RundownSource
): Promise<SelectedShowStyleVariant | null> {
	const studio = context.studio
	if (!studio.supportedShowStyleBase.length) {
		logger.debug(`Studio "${studio._id}" does not have any supportedShowStyleBase`)
		return null
	}

	if (rundownSource.type === 'testing') {
		return selectShowStyleVariantFromRundownSource(context, rundownSource)
	}

	return selectShowStyleVariantWithBlueprints(context, blueprintContext, ingestRundown)
}

async function selectShowStyleVariantFromRundownSource(
	context: JobContext,
	rundownSource: RundownSourceTesting
): Promise<SelectedShowStyleVariant | null> {
	const showStyleVariant = await context.getShowStyleVariant(rundownSource.showStyleVariantId).catch(() => null)
	if (!showStyleVariant) {
		logger.debug(`ShowStyleVariant "${rundownSource.showStyleVariantId}" not found`)
		return null
	}

	const showStyleBase = await context.getShowStyleBase(showStyleVariant.showStyleBaseId).catch(() => null)
	if (!showStyleBase) {
		logger.debug(`ShowStyleBase "${showStyleVariant.showStyleBaseId}" not found`)
		return null
	}

	const compound = createShowStyleCompound(showStyleBase, showStyleVariant)
	if (!compound) throw new Error(`no showStyleCompound for "${showStyleVariant._id}"`)

	return {
		variant: showStyleVariant,
		base: showStyleBase,
		compound,
	}
}

async function selectShowStyleVariantWithBlueprints(
	context: JobContext,
	blueprintContext: StudioUserContext,
	ingestRundown: ExtendedIngestRundown
): Promise<SelectedShowStyleVariant | null> {
	const studio = context.studio

	const showStyleBases = await context.getShowStyleBases()
	let showStyleBase: ReadonlyDeep<ProcessedShowStyleBase> | undefined = showStyleBases[0]
	if (!showStyleBase) {
		logger.debug(
			`No showStyleBases matching with supportedShowStyleBase [${studio.supportedShowStyleBase}] from studio "${studio._id}"`
		)
		return null
	}

	const studioBlueprint = context.studioBlueprint
	if (!studioBlueprint) throw new Error(`Studio "${studio._id}" does not have a blueprint`)

	let showStyleId: ShowStyleBaseId | null = null
	try {
		showStyleId = protectString(
			studioBlueprint.blueprint.getShowStyleId(
				blueprintContext,
				showStyleBases.map(convertShowStyleBaseToBlueprints),
				ingestRundown
			)
		)
	} catch (err) {
		logger.error(`Error in studioBlueprint.getShowStyleId: ${stringifyError(err)}`)
		showStyleId = null
	}

	if (showStyleId === null) {
		logger.debug(`StudioBlueprint for studio "${studio._id}" returned showStyleId = null`)
		return null
	}
	showStyleBase = showStyleBases.find((s) => s._id === showStyleId)
	if (!showStyleBase) {
		logger.debug(
			`No ShowStyleBase found matching showStyleId "${showStyleId}", from studio "${studio._id}" blueprint`
		)
		return null
	}

	const showStyleVariants = await context.getShowStyleVariants(showStyleBase._id)
	if (!showStyleVariants.length) throw new Error(`ShowStyleBase "${showStyleBase._id}" has no variants`)

	const showStyleBlueprint = await context.getShowStyleBlueprint(showStyleBase._id)
	if (!showStyleBlueprint) throw new Error(`ShowStyleBase "${showStyleBase._id}" does not have a valid blueprint`)

	let variantId: ShowStyleVariantId | null = null
	try {
		variantId = protectString(
			showStyleBlueprint.blueprint.getShowStyleVariantId(
				blueprintContext,
				showStyleVariants.map(convertShowStyleVariantToBlueprints),
				ingestRundown
			)
		)
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.getShowStyleVariantId: ${stringifyError(err)}`)
		variantId = null
	}

	if (variantId === null) {
		logger.debug(`StudioBlueprint for studio "${studio._id}" returned variantId = null in .getShowStyleVariantId`)
		return null
	} else {
		const showStyleVariant = showStyleVariants.find((s) => s._id === variantId)
		if (!showStyleVariant) {
			logger.debug(
				`No ShowStyleVariant found matching showStyleId "${variantId}", from studio "${studio._id}" blueprint`
			)
			return null
		}

		const compound = createShowStyleCompound(showStyleBase, showStyleVariant)
		if (!compound) throw new Error(`no showStyleCompound for "${showStyleVariant._id}"`)

		return {
			variant: showStyleVariant,
			base: showStyleBase,
			compound,
		}
	}
}
