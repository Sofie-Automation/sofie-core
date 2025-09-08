import * as React from 'react'
import { DBStudio, StudioPackageContainer } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { EditAttribute } from '../../../../lib/EditAttribute.js'
import { useTranslation } from 'react-i18next'
import { Accessor } from '@sofie-automation/blueprints-integration'
import { Studios } from '../../../../collections/index.js'
import { DropdownInputOption } from '../../../../lib/Components/DropdownInput.js'
import { WrappedOverridableItem } from '../../util/OverrideOpHelper.js'
import { LabelActual } from '../../../../lib/Components/LabelAndOverrides.js'

interface PackageContainersPickersProps {
	studio: DBStudio
	packageContainersFromOverrides: WrappedOverridableItem<StudioPackageContainer>[]
}

export function PackageContainersPickers({
	studio,
	packageContainersFromOverrides,
}: PackageContainersPickersProps): JSX.Element {
	const { t } = useTranslation()

	const availablePackageContainerOptions = React.useMemo(() => {
		const arr: DropdownInputOption<string>[] = []

		packageContainersFromOverrides.forEach((packageContainer) => {
			let hasHttpAccessor = false
			if (packageContainer.computed) {
				for (const accessor of Object.values<Accessor.Any>(packageContainer.computed.container.accessors)) {
					if (accessor.type === Accessor.AccessType.HTTP_PROXY) {
						hasHttpAccessor = true
						break
					}
				}
				if (hasHttpAccessor) {
					arr.push({
						name: packageContainer.computed.container.label,
						value: packageContainer.id,
						i: arr.length,
					})
				}
			}
		})
		return arr
	}, [packageContainersFromOverrides])

	return (
		<div className="properties-grid">
			<div className="field">
				<LabelActual label={t('Package Containers to use for previews')} />
				<div className="field-content">
					<EditAttribute
						attribute="previewContainerIds"
						obj={studio}
						options={availablePackageContainerOptions}
						label={t('Click to show available Package Containers')}
						type="multiselect"
						collection={Studios}
					/>
				</div>
			</div>
			<div className="field">
				<LabelActual label={t('Package Containers to use for thumbnails')} />
				<div className="field-content">
					<EditAttribute
						attribute="thumbnailContainerIds"
						obj={studio}
						options={availablePackageContainerOptions}
						label={t('Click to show available Package Containers')}
						type="multiselect"
						collection={Studios}
					/>
				</div>
			</div>
		</div>
	)
}
