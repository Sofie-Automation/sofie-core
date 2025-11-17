import { check } from '../lib/check'
import { registerClassToMeteorMethods } from '../methods'
import {
	CreateAdlibTestingRundownOption,
	NewShowStylesAPI,
	ShowStylesAPIMethods,
} from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { Meteor } from 'meteor/meteor'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { getRandomId, omit } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { MethodContextAPI, MethodContext } from './methodContext'
import deepmerge from 'deepmerge'
import {
	applyAndValidateOverrides,
	ObjectWithOverrides,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { ShowStyleBaseId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownLayouts, ShowStyleBases, ShowStyleVariants, Studios } from '../collections'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { assertConnectionHasOneOfPermissions } from '../security/auth'

const PERMISSIONS_FOR_MANAGE_SHOWSTYLES: Array<keyof UserPermissions> = ['configure']

export interface ShowStyleCompound extends Omit<DBShowStyleBase, 'blueprintConfigWithOverrides'> {
	showStyleVariantId: ShowStyleVariantId
	_rundownVersionHashVariant: string
	combinedBlueprintConfig: IBlueprintConfig
}

export async function getShowStyleCompound(
	showStyleVariantId: ShowStyleVariantId
): Promise<ShowStyleCompound | undefined> {
	const showStyleVariant = await ShowStyleVariants.findOneAsync(showStyleVariantId)
	if (!showStyleVariant) return undefined
	const showStyleBase = await ShowStyleBases.findOneAsync(showStyleVariant.showStyleBaseId)
	if (!showStyleBase) return undefined

	return createShowStyleCompound(showStyleBase, showStyleVariant)
}

export function createBlueprintConfigCompound(
	baseConfig: ObjectWithOverrides<IBlueprintConfig>,
	variantConfig: ObjectWithOverrides<IBlueprintConfig>
): IBlueprintConfig {
	const baseConfig2 = applyAndValidateOverrides(baseConfig).obj
	const variantConfig2 = applyAndValidateOverrides(variantConfig).obj

	return deepmerge<IBlueprintConfig>(baseConfig2, variantConfig2, {
		arrayMerge: (_destinationArray, sourceArray, _options) => sourceArray,
	})
}

export function createShowStyleCompound(
	showStyleBase: DBShowStyleBase,
	showStyleVariant: DBShowStyleVariant
): ShowStyleCompound | undefined {
	if (showStyleBase._id !== showStyleVariant.showStyleBaseId) return undefined

	const configs = createBlueprintConfigCompound(
		showStyleBase.blueprintConfigWithOverrides,
		showStyleVariant.blueprintConfigWithOverrides
	)

	return {
		...omit(showStyleBase, 'blueprintConfigWithOverrides'),
		showStyleVariantId: showStyleVariant._id,
		name: `${showStyleBase.name}-${showStyleVariant.name}`,
		combinedBlueprintConfig: configs,
		_rundownVersionHash: showStyleBase._rundownVersionHash,
		_rundownVersionHashVariant: showStyleVariant._rundownVersionHash,
	}
}

export async function insertShowStyleBase(context: MethodContext): Promise<ShowStyleBaseId> {
	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_MANAGE_SHOWSTYLES)

	return insertShowStyleBaseInner()
}

export async function insertShowStyleBaseInner(): Promise<ShowStyleBaseId> {
	const showStyleBase: DBShowStyleBase = {
		_id: getRandomId(),
		name: 'New Show Style',
		blueprintId: protectString(''),
		outputLayersWithOverrides: wrapDefaultObject({}),
		sourceLayersWithOverrides: wrapDefaultObject({}),
		blueprintConfigWithOverrides: wrapDefaultObject({}),
		_rundownVersionHash: '',
		lastBlueprintConfig: undefined,
		lastBlueprintFixUpHash: undefined,
	}
	await ShowStyleBases.insertAsync(showStyleBase)

	await insertShowStyleVariantInner(showStyleBase._id, 'Default')
	return showStyleBase._id
}

export async function insertShowStyleVariant(
	context: MethodContext,
	showStyleBaseId: ShowStyleBaseId,
	name?: string
): Promise<ShowStyleVariantId> {
	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_MANAGE_SHOWSTYLES)

	return insertShowStyleVariantInner(showStyleBaseId, name)
}

async function insertShowStyleVariantInner(
	showStyleBaseId: ShowStyleBaseId,
	name?: string
): Promise<ShowStyleVariantId> {
	const highestRank =
		(
			await ShowStyleVariants.findOneAsync(
				{
					showStyleBaseId,
				},
				{
					projection: {
						_rank: 1,
					},
					sort: {
						_rank: -1,
					},
					limit: 1,
				}
			)
		)?._rank ?? -1
	const rank = highestRank + 1

	const showStyleVariant: DBShowStyleVariant = {
		_id: getRandomId(),
		name: name || 'New Variant',
		blueprintConfigWithOverrides: wrapDefaultObject({}),
		_rundownVersionHash: '',
		_rank: rank,
		showStyleBaseId: showStyleBaseId,
	}

	return ShowStyleVariants.insertAsync(showStyleVariant)
}

export async function importShowStyleVariant(
	context: MethodContext,
	showStyleVariant: DBShowStyleVariant
): Promise<ShowStyleVariantId> {
	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_MANAGE_SHOWSTYLES)

	return ShowStyleVariants.insertAsync(showStyleVariant)
}

export async function importShowStyleVariantAsNew(
	context: MethodContext,
	showStyleVariant: Omit<DBShowStyleVariant, '_id'>
): Promise<ShowStyleVariantId> {
	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_MANAGE_SHOWSTYLES)

	const newShowStyleVariant: DBShowStyleVariant = {
		...showStyleVariant,
		_id: getRandomId(),
	}

	return ShowStyleVariants.insertAsync(newShowStyleVariant)
}

export async function removeShowStyleBase(context: MethodContext, showStyleBaseId: ShowStyleBaseId): Promise<void> {
	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_MANAGE_SHOWSTYLES)

	await Promise.allSettled([
		ShowStyleBases.removeAsync(showStyleBaseId),
		ShowStyleVariants.removeAsync({
			showStyleBaseId,
		}),
		RundownLayouts.removeAsync({
			showStyleBaseId,
		}),
	])
}

export async function removeShowStyleVariant(
	context: MethodContext,
	showStyleVariantId: ShowStyleVariantId
): Promise<void> {
	check(showStyleVariantId, String)

	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_MANAGE_SHOWSTYLES)

	const showStyleVariant = await ShowStyleVariants.findOneAsync(showStyleVariantId)
	if (!showStyleVariant) throw new Meteor.Error(404, `showStyleVariant "${showStyleVariantId}" not found`)

	await ShowStyleVariants.removeAsync(showStyleVariant._id)
}

export async function reorderShowStyleVariant(
	context: MethodContext,
	showStyleVariantId: ShowStyleVariantId,
	rank: number
): Promise<void> {
	check(showStyleVariantId, String)
	check(rank, Number)

	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_MANAGE_SHOWSTYLES)

	const showStyleVariant = await ShowStyleVariants.findOneAsync(showStyleVariantId)
	if (!showStyleVariant) throw new Meteor.Error(404, `showStyleVariant "${showStyleVariantId}" not found`)

	await ShowStyleVariants.updateAsync(showStyleVariantId, {
		$set: {
			_rank: rank,
		},
	})
}

async function getCreateAdlibTestingRundownOptions(context: MethodContext): Promise<CreateAdlibTestingRundownOption[]> {
	assertConnectionHasOneOfPermissions(context.connection, 'studio')

	const [studios, showStyleBases, showStyleVariants] = await Promise.all([
		Studios.findFetchAsync(
			{},
			{
				projection: {
					_id: 1,
					name: 1,
					supportedShowStyleBase: 1,
				},
			}
		) as Promise<Pick<DBStudio, '_id' | 'name' | 'supportedShowStyleBase'>[]>,
		ShowStyleBases.findFetchAsync(
			{},
			{
				projection: {
					_id: 1,
					name: 1,
				},
			}
		) as Promise<Pick<DBShowStyleBase, '_id' | 'name'>[]>,
		ShowStyleVariants.findFetchAsync(
			{},
			{
				projection: {
					_id: 1,
					showStyleBaseId: 1,
					name: 1,
					canGenerateAdlibTestingRundown: 1,
				},
				sort: {
					_rank: 1,
				},
			}
		) as Promise<Pick<DBShowStyleVariant, '_id' | 'showStyleBaseId' | 'name' | 'canGenerateAdlibTestingRundown'>[]>,
	])

	const options: CreateAdlibTestingRundownOption[] = []

	for (const studio of studios) {
		for (const showStyleBase of showStyleBases) {
			if (!studio.supportedShowStyleBase.includes(showStyleBase._id)) continue

			for (const showStyleVariant of showStyleVariants) {
				if (!showStyleVariant.canGenerateAdlibTestingRundown) continue
				if (showStyleVariant.showStyleBaseId !== showStyleBase._id) continue

				// Generate a descriptive label, but as minimal as possible
				let label = showStyleVariant.name
				if (showStyleBases.length > 1) label = `${showStyleBase.name} - ${label}`
				if (studios.length > 1) label = `${label} (${studio.name})`

				options.push({
					studioId: studio._id,
					showStyleVariantId: showStyleVariant._id,
					label,
				})
			}
		}
	}

	return options
}

class ServerShowStylesAPI extends MethodContextAPI implements NewShowStylesAPI {
	async insertShowStyleBase() {
		return insertShowStyleBase(this)
	}
	async insertShowStyleVariant(showStyleBaseId: ShowStyleBaseId) {
		return insertShowStyleVariant(this, showStyleBaseId)
	}
	async importShowStyleVariant(showStyleVariant: DBShowStyleVariant) {
		return importShowStyleVariant(this, showStyleVariant)
	}
	async importShowStyleVariantAsNew(showStyleVariant: Omit<DBShowStyleVariant, '_id'>) {
		return importShowStyleVariantAsNew(this, showStyleVariant)
	}
	async removeShowStyleBase(showStyleBaseId: ShowStyleBaseId) {
		return removeShowStyleBase(this, showStyleBaseId)
	}
	async removeShowStyleVariant(showStyleVariantId: ShowStyleVariantId) {
		return removeShowStyleVariant(this, showStyleVariantId)
	}
	async reorderShowStyleVariant(showStyleVariantId: ShowStyleVariantId, newRank: number) {
		return reorderShowStyleVariant(this, showStyleVariantId, newRank)
	}

	async getCreateAdlibTestingRundownOptions() {
		return getCreateAdlibTestingRundownOptions(this)
	}
}
registerClassToMeteorMethods(ShowStylesAPIMethods, ServerShowStylesAPI, false)
