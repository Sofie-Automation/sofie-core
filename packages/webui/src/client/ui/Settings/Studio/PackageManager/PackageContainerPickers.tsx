import * as React from 'react'
import { DBStudio, StudioPackageContainer } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { useTranslation } from 'react-i18next'
import { Accessor } from '@sofie-automation/blueprints-integration'
import { Studios } from '../../../../collections'
import { DropdownInputOption } from '../../../../lib/Components/DropdownInput'
import { useOverrideOpHelper, WrappedOverridableItem, WrappedOverridableItemNormal } from '../../util/OverrideOpHelper'
import { LabelAndOverridesForMultiSelect } from '../../../../lib/Components/LabelAndOverrides'
import {
	applyAndValidateOverrides,
	ObjectWithOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { MultiSelectInputControl } from '../../../../lib/Components/MultiSelectInput'
import { useMemo } from 'react'
import { StudioPackageContainerIds } from '@sofie-automation/shared-lib/dist/core/model/PackageContainer'

interface PackageContainersPickersProps {
	studio: DBStudio
	packageContainersFromOverrides: WrappedOverridableItem<StudioPackageContainer>[]
}

export function PackageContainersPickers({
	studio,
	packageContainersFromOverrides,
}: PackageContainersPickersProps): JSX.Element {
	const { t } = useTranslation()

	const [wrappedItem, wrappedConfigObject] = useMemo(() => {
		const prefixedOps = studio.packageContainerIdsWithOverrides.overrides.map((op) => ({
			...op,
			// TODO: can we avoid doing this hack?
			path: `0.${op.path}`,
		}))

		const computedValue = applyAndValidateOverrides(studio.packageContainerIdsWithOverrides).obj

		const wrappedItem: WrappedOverridableItemNormal<StudioPackageContainerIds> = {
			type: 'normal',
			id: '0',
			computed: computedValue,
			defaults: studio.packageContainerIdsWithOverrides.defaults,
			overrideOps: prefixedOps,
		}

		const wrappedConfigObject: ObjectWithOverrides<StudioPackageContainerIds> = {
			defaults: studio.packageContainerIdsWithOverrides.defaults,
			overrides: prefixedOps,
		}

		return [wrappedItem, wrappedConfigObject]
	}, [studio.packageContainerIdsWithOverrides])

	const saveOverrides = React.useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			console.log('updating studio', newOps)
			Studios.update(studio._id, {
				$set: {
					'packageContainerIdsWithOverrides.overrides': newOps.map((op) => ({
						...op,
						path: op.path.startsWith('0.') ? op.path.slice(2) : op.path,
					})),
				},
			})
		},
		[studio._id]
	)
	const overrideHelper = useOverrideOpHelper(saveOverrides, wrappedConfigObject)

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
			<LabelAndOverridesForMultiSelect
				label={t('Package Containers to use for previews')}
				hint={t('Click to show available Package Containers')}
				item={wrappedItem}
				itemKey={'previewContainerIds'}
				overrideHelper={overrideHelper}
				options={availablePackageContainerOptions}
			>
				{(value, handleUpdate, options) => (
					<MultiSelectInputControl
						classNames="input input-l"
						options={options}
						value={value}
						handleUpdate={handleUpdate}
					/>
				)}
			</LabelAndOverridesForMultiSelect>
			<LabelAndOverridesForMultiSelect
				label={t('Package Containers to use for thumbnails')}
				hint={t('Click to show available Package Containers')}
				item={wrappedItem}
				itemKey={'thumbnailContainerIds'}
				overrideHelper={overrideHelper}
				options={availablePackageContainerOptions}
			>
				{(value, handleUpdate, options) => (
					<MultiSelectInputControl
						classNames="input input-l"
						options={options}
						value={value}
						handleUpdate={handleUpdate}
					/>
				)}
			</LabelAndOverridesForMultiSelect>
		</div>
	)
}
