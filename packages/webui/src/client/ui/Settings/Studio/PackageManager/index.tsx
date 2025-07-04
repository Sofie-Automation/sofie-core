import * as React from 'react'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { useTranslation } from 'react-i18next'
import { getAllCurrentAndDeletedItemsFromOverrides } from '../../util/OverrideOpHelper'
import { PackageContainersPickers } from './PackageContainerPickers'
import { PackageContainersTable } from './PackageContainers'

interface StudioPackageManagerSettingsProps {
	studio: DBStudio
}

export function StudioPackageManagerSettings({ studio }: StudioPackageManagerSettingsProps): React.JSX.Element {
	const { t } = useTranslation()

	const packageContainersFromOverrides = React.useMemo(
		() =>
			getAllCurrentAndDeletedItemsFromOverrides(studio.packageContainersWithOverrides, (a, b) =>
				a[0].localeCompare(b[0])
			),
		[studio.packageContainersWithOverrides]
	)

	return (
		<div>
			<h2 className="mhn mbs">{t('Package Manager')}</h2>

			<div className="settings-studio-package-containers">
				<h3 className="mhn">{t('Studio Settings')}</h3>

				<PackageContainersPickers studio={studio} packageContainersFromOverrides={packageContainersFromOverrides} />

				<h3 className="mhn">{t('Package Containers')}</h3>
				<PackageContainersTable studio={studio} packageContainersFromOverrides={packageContainersFromOverrides} />
			</div>
		</div>
	)
}
