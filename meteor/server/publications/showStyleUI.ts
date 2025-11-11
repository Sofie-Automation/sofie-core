import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { Complete, literal } from '../lib/tempLib'
import {
	meteorCustomPublish,
	SetupObserversResult,
	setUpOptimizedObserverArray,
	TriggerUpdate,
} from '../lib/customPublication'
import { ShowStyleBases } from '../collections'
import { check } from 'meteor/check'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'

interface UIShowStyleBaseArgs {
	readonly showStyleBaseId: ShowStyleBaseId
}

type UIShowStyleBaseState = Record<string, never>

interface UIShowStyleBaseUpdateProps {
	invalidateShowStyle: boolean
}

type ShowStyleBaseFields = '_id' | 'name' | 'outputLayersWithOverrides' | 'sourceLayersWithOverrides' | 'hotkeyLegend'
const fieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBShowStyleBase, ShowStyleBaseFields>>>({
	_id: 1,
	name: 1,
	outputLayersWithOverrides: 1,
	sourceLayersWithOverrides: 1,
	hotkeyLegend: 1,
})

async function setupUIShowStyleBasePublicationObservers(
	args: ReadonlyDeep<UIShowStyleBaseArgs>,
	triggerUpdate: TriggerUpdate<UIShowStyleBaseUpdateProps>
): Promise<SetupObserversResult> {
	// Set up observers:
	return [
		ShowStyleBases.observeChanges(
			args.showStyleBaseId,
			{
				added: () => triggerUpdate({ invalidateShowStyle: true }),
				changed: () => triggerUpdate({ invalidateShowStyle: true }),
				removed: () => triggerUpdate({ invalidateShowStyle: true }),
			},
			{
				projection: fieldSpecifier,
			}
		),
	]
}
async function manipulateUIShowStyleBasePublicationData(
	args: UIShowStyleBaseArgs,
	_state: Partial<UIShowStyleBaseState>,
	_updateProps: Partial<UIShowStyleBaseUpdateProps> | undefined
): Promise<UIShowStyleBase[] | null> {
	// Prepare data for publication:

	// Ignore _updateProps, as we arent caching anything so we have to rerun from scratch no matter what

	const showStyleBase = (await ShowStyleBases.findOneAsync(args.showStyleBaseId, { projection: fieldSpecifier })) as
		| Pick<DBShowStyleBase, ShowStyleBaseFields>
		| undefined
	if (!showStyleBase) return []

	const resolvedOutputLayers = applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj
	const resolvedSourceLayers = applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj

	return [
		literal<Complete<UIShowStyleBase>>({
			_id: showStyleBase._id,
			name: showStyleBase.name,
			sourceLayers: resolvedSourceLayers,
			outputLayers: resolvedOutputLayers,
			hotkeyLegend: showStyleBase.hotkeyLegend,
		}),
	]
}

meteorCustomPublish(
	MeteorPubSub.uiShowStyleBase,
	CustomCollectionName.UIShowStyleBase,
	async function (pub, showStyleBaseId: ShowStyleBaseId) {
		check(showStyleBaseId, String)

		triggerWriteAccessBecauseNoCheckNecessary()

		await setUpOptimizedObserverArray<
			UIShowStyleBase,
			UIShowStyleBaseArgs,
			UIShowStyleBaseState,
			UIShowStyleBaseUpdateProps
		>(
			`pub_${MeteorPubSub.uiShowStyleBase}_${showStyleBaseId}`,
			{ showStyleBaseId },
			setupUIShowStyleBasePublicationObservers,
			manipulateUIShowStyleBasePublicationData,
			pub
		)
	}
)
