import * as React from 'react'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { useTranslation } from 'react-i18next'
import { MappingsSettingsManifests } from '../Mappings.js'
import { getAllCurrentAndDeletedItemsFromOverrides } from '../../util/OverrideOpHelper.js'
import { ExclusivityGroupsTable } from './ExclusivityGroups.js'
import { RouteSetsTable } from './RouteSets.js'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useMemo } from 'react'

interface IStudioRoutingsProps {
	translationNamespaces: string[]
	studio: DBStudio
	manifest: MappingsSettingsManifests | undefined
}

export function StudioRoutings({
	translationNamespaces,
	studio,
	manifest,
}: Readonly<IStudioRoutingsProps>): React.JSX.Element {
	const { t } = useTranslation()

	const studioMappings = useMemo(
		() => (studio ? applyAndValidateOverrides(studio.mappingsWithOverrides).obj : {}),
		[studio?.mappingsWithOverrides]
	)

	const routeSetsFromOverrides = React.useMemo(
		() => getAllCurrentAndDeletedItemsFromOverrides(studio.routeSetsWithOverrides, null),
		[studio.routeSetsWithOverrides]
	)

	const exclusivityGroupsFromOverrides = React.useMemo(
		() =>
			getAllCurrentAndDeletedItemsFromOverrides(studio.routeSetExclusivityGroupsWithOverrides, (a, b) =>
				a[0].localeCompare(b[0])
			),
		[studio.routeSetExclusivityGroupsWithOverrides]
	)

	return (
		<div>
			<h2 className="mb-4">{t('Route Sets')}</h2>
			{!manifest && <span>{t('Add a playout device to the studio in order to configure the route sets')}</span>}
			{manifest && (
				<>
					<p className="my-2 text-s dimmed field-hint">
						{t(
							'Controls for exposed Route Sets will be displayed to the producer within the Rundown View in the Switchboard.'
						)}
					</p>
					<h3 className="mb-2">{t('Exclusivity Groups')}</h3>
					<ExclusivityGroupsTable
						studio={studio}
						routeSetsFromOverrides={routeSetsFromOverrides}
						exclusivityGroupsFromOverrides={exclusivityGroupsFromOverrides}
					/>
					<h3 className="mb-2 mt-4">{t('Route Sets')}</h3>
					<RouteSetsTable
						studio={studio}
						routeSetsFromOverrides={routeSetsFromOverrides}
						exclusivityGroupsFromOverrides={exclusivityGroupsFromOverrides}
						studioMappings={studioMappings}
						manifest={manifest}
						translationNamespaces={translationNamespaces}
					/>
				</>
			)}
		</div>
	)
}
