import { useMemo } from 'react'
import { useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { StudioRoutings } from './Studio/Routings'
import { StudioDevices } from './Studio/Devices'
import { MappingsSettingsManifest, MappingsSettingsManifests, StudioMappings } from './Studio/Mappings'
import { StudioPackageManagerSettings } from './Studio/PackageManager'
import { StudioGenericProperties } from './Studio/Generic'
import { Redirect, Route, Switch, useRouteMatch } from 'react-router-dom'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { PeripheralDevices, ShowStyleBases, Studios } from '../../collections'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { translateStringIfHasNamespaces } from '../../lib/forms/schemaFormUtil'
import { JSONBlob, JSONBlobParse } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { StudioBlueprintConfigurationSettings } from './Studio/BlueprintConfiguration'
import { SubdeviceManifest } from '@sofie-automation/corelib/dist/deviceConfig'
import { JSONSchema } from '@sofie-automation/blueprints-integration'

export default function StudioSettings(): JSX.Element {
	const match = useRouteMatch<{ studioId: string }>()
	const studioId = protectString(match.params.studioId)

	const studio = useTracker(() => Studios.findOne(studioId), [studioId])

	const studioMappings = useMemo(
		() => (studio ? applyAndValidateOverrides(studio.mappingsWithOverrides).obj : {}),
		[studio?.mappingsWithOverrides]
	)

	// TODO - move into child-component
	const availableShowStyleBases = useTracker(
		() =>
			ShowStyleBases.find()
				.fetch()
				.map((showStyle) => {
					return {
						name: `${showStyle.name}`,
						value: showStyle._id,
						showStyleBase: showStyle,
					}
				}),
		[],
		[]
	)

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
		<div className="studio-edit mod mhl mvn">
			<div className="row">
				<div className="col c12 r1-c12">
					<ErrorBoundary>
						<Switch>
							<Route path={`${match.path}/generic`}>
								<StudioGenericProperties studio={studio} availableShowStyleBases={availableShowStyleBases} />
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
									studioMappings={studioMappings}
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
			</div>
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
