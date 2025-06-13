import * as React from 'react'
import { DBStudio, MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { useTranslation } from 'react-i18next'
import { ReadonlyDeep } from 'type-fest'
import { MappingsSettingsManifests } from '../Mappings'
import { getAllCurrentAndDeletedItemsFromOverrides } from '../../util/OverrideOpHelper'
import { ExclusivityGroupsTable } from './ExclusivityGroups'
import { RouteSetsTable } from './RouteSets'

interface IStudioRoutingsProps {
	translationNamespaces: string[]
	studio: DBStudio
	studioMappings: ReadonlyDeep<MappingsExt>
	manifest: MappingsSettingsManifests | undefined
}

export function StudioRoutings({
	translationNamespaces,
	studio,
	studioMappings,
	manifest,
}: Readonly<IStudioRoutingsProps>): React.JSX.Element {
	const { t } = useTranslation()

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
			<h2 className="mhn mbs">{t('Route Sets')}</h2>
			{!manifest && <span>{t('Add a playout device to the studio in order to configure the route sets')}</span>}
			{manifest && (
				<>
					<p className="mhn mvs text-s dimmed field-hint">
						{t(
							'Controls for exposed Route Sets will be displayed to the producer within the Rundown View in the Switchboard.'
						)}
					</p>
					<h3 className="mhn">{t('Exclusivity Groups')}</h3>
					<ExclusivityGroupsTable
						studio={studio}
						routeSetsFromOverrides={routeSetsFromOverrides}
						exclusivityGroupsFromOverrides={exclusivityGroupsFromOverrides}
					/>
					<h3 className="mhn">{t('Route Sets')}</h3>
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
