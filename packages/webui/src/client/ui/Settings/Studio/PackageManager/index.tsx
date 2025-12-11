import * as React from 'react'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { useTranslation } from 'react-i18next'
import { getAllCurrentAndDeletedItemsFromOverrides } from '../../util/OverrideOpHelper.js'
import { PackageContainersPickers } from './PackageContainerPickers.js'
import { PackageContainersTable } from './PackageContainers.js'

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
		<div className="settings-studio-package-containers">
			<h2 className="mb-4">{t('Package Manager')}</h2>

			<h3 className="my-2">{t('Studio Settings')}</h3>

			<PackageContainersPickers studio={studio} packageContainersFromOverrides={packageContainersFromOverrides} />

			<h3 className="my-2">{t('Package Containers')}</h3>
			<PackageContainersTable studio={studio} packageContainersFromOverrides={packageContainersFromOverrides} />
		</div>
	)
}
