import * as React from 'react'
import _ from 'underscore'
import { StudioPackageContainer } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { Accessor } from '@sofie-automation/blueprints-integration'
import { useToggleExpandHelper } from '../../../util/useToggleExpandHelper.js'
import { OverrideOpHelper, WrappedOverridableItemNormal } from '../../util/OverrideOpHelper.js'
import { AccessorTableRow } from './AccessorTableRow.js'

interface AccessorsTableProps {
	packageContainer: WrappedOverridableItemNormal<StudioPackageContainer>
	overrideHelper: OverrideOpHelper
}

export function AccessorsTable({ packageContainer, overrideHelper }: AccessorsTableProps): React.JSX.Element {
	const { t } = useTranslation()
	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const addNewAccessor = React.useCallback(() => {
		const newKeyName = 'local'
		let iter = 0
		if (!packageContainer.id)
			throw new Error(`Can't add an accessor to nonexistant Package Container "${packageContainer.id}"`)

		while (packageContainer.computed?.container.accessors[newKeyName + iter]) {
			iter++
		}
		const accessorId = newKeyName + iter

		const newAccessor: Accessor.LocalFolder = {
			type: Accessor.AccessType.LOCAL_FOLDER,
			label: 'Local folder',
			allowRead: true,
			allowWrite: false,
			folderPath: '',
		}

		overrideHelper().setItemValue(packageContainer.id, `container.accessors.${accessorId}`, newAccessor).commit()

		setTimeout(() => {
			toggleExpanded(accessorId, true)
		}, 1)
	}, [toggleExpanded, overrideHelper])

	const container = packageContainer.computed.container

	return (
		<>
			<table className="expando settings-studio-package-containers-accessors-table">
				{Object.keys(container.accessors || {}).length === 0 ? (
					<tr>
						<td className="dimmed">{t('There are no Accessors set up.')}</td>
					</tr>
				) : (
					_.map(container.accessors || {}, (accessor: Accessor.Any, accessorId: string) => (
						<AccessorTableRow
							key={accessorId}
							accessorId={accessorId}
							accessor={accessor}
							packageContainer={packageContainer}
							overrideHelper={overrideHelper}
							toggleExpanded={toggleExpanded}
							isExpanded={isExpanded(accessorId)}
						/>
					))
				)}
			</table>
			<div className="my-1 mx-2">
				<button className="btn btn-primary" onClick={addNewAccessor}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</>
	)
}
