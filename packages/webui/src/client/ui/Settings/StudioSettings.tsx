import { useMemo } from 'react'
import { useTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'
import { Spinner } from '../../lib/Spinner.js'
import { PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { StudioRoutings } from './Studio/Routings/index.js'
import { StudioDevices } from './Studio/Devices/index.js'
import { MappingsSettingsManifest, MappingsSettingsManifests, StudioMappings } from './Studio/Mappings.js'
import { StudioPackageManagerSettings } from './Studio/PackageManager/index.js'
import { StudioGenericProperties } from './Studio/Generic.js'
import { Redirect, Route, Switch, useRouteMatch } from 'react-router-dom'
import { ErrorBoundary } from '../../lib/ErrorBoundary.js'
import { PeripheralDevices, Studios } from '../../collections/index.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { translateStringIfHasNamespaces } from '../../lib/forms/schemaFormUtil.js'
import { JSONBlob, JSONBlobParse } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { StudioBlueprintConfigurationSettings } from './Studio/BlueprintConfiguration/index.js'
import { SubdeviceManifest } from '@sofie-automation/corelib/dist/deviceConfig'
import { JSONSchema } from '@sofie-automation/blueprints-integration'

export default function StudioSettings(): JSX.Element {
	const match = useRouteMatch<{ studioId: string }>()
	const studioId = protectString(match.params.studioId)

	const studio = useTracker(() => Studios.findOne(studioId), [studioId])

	const firstPlayoutDevice = useTracker(
		() =>
			PeripheralDevices.findOne(
				{
					'studioAndConfigId.studioId': {
						$eq: studioId,
					},
					parentDeviceId: {
						$exists: false,
					},
					type: {
						$eq: PeripheralDeviceType.PLAYOUT,
					},
				},
				{
					sort: {
						lastConnected: -1,
					},
				}
			),

		[studioId]
	)

	const { translationNamespaces, layerMappingsSchema } = useMemo(() => {
		const translationNamespaces = [`peripheralDevice_${firstPlayoutDevice?._id}`]
		const layerMappingsSchema: MappingsSettingsManifests = Object.fromEntries(
			Object.entries<SubdeviceManifest[0]>(firstPlayoutDevice?.configManifest?.subdeviceManifest || {}).map(
				([id, val]) => {
					const mappingsSchema = val.playoutMappings
						? Object.fromEntries(
								Object.entries<JSONBlob<JSONSchema>>(val.playoutMappings).map(([id, schema]) => [
									id,
									JSONBlobParse(schema),
								])
							)
						: undefined

					return [
						id,
						literal<MappingsSettingsManifest>({
							displayName: translateStringIfHasNamespaces(val.displayName, translationNamespaces),
							mappingsSchema,
						}),
					]
				}
			)
		)

		return { translationNamespaces, layerMappingsSchema }
	}, [firstPlayoutDevice])

	return studio ? (
		<div className="studio-edit mx-4">
			<ErrorBoundary>
				<Switch>
					<Route path={`${match.path}/generic`}>
						<StudioGenericProperties studio={studio} />
					</Route>
					<Route path={`${match.path}/devices`}>
						<StudioDevices studioId={studio._id} />
					</Route>
					<Route path={`${match.path}/blueprint-config`}>
						<StudioBlueprintConfigurationSettings studio={studio} />
					</Route>
					<Route path={`${match.path}/mappings`}>
						<StudioMappings
							translationNamespaces={translationNamespaces}
							studio={studio}
							manifest={layerMappingsSchema}
						/>
					</Route>
					<Route path={`${match.path}/route-sets`}>
						<StudioRoutings
							translationNamespaces={translationNamespaces}
							studio={studio}
							manifest={layerMappingsSchema}
						/>
					</Route>
					<Route path={`${match.path}/package-manager`}>
						<StudioPackageManagerSettings studio={studio} />
					</Route>
					<Redirect to={`${match.path}/generic`} />
				</Switch>
			</ErrorBoundary>
		</div>
	) : (
		<Spinner />
	)
}

export function findHighestRank(array: Array<{ _rank: number } | undefined>): { _rank: number } | null {
	if (!array) return null
	let max: { _rank: number } | null = null

	array.forEach((value) => {
		if (value && (max === null || max._rank < value._rank)) {
			max = value
		}
	})

	return max
}
