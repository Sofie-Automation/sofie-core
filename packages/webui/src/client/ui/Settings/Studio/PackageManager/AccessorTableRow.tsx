import ClassNames from 'classnames'
import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import { StudioPackageContainer } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { doModalDialog } from '../../../../lib/ModalDialog.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPencilAlt, faCheck } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { Accessor } from '@sofie-automation/blueprints-integration'
import {
	LabelActual,
	LabelAndOverrides,
	LabelAndOverridesForCheckbox,
	LabelAndOverridesForDropdown,
} from '../../../../lib/Components/LabelAndOverrides.js'
import { TextInputControl } from '../../../../lib/Components/TextInput.js'
import { DropdownInputControl, getDropdownInputOptions } from '../../../../lib/Components/DropdownInput.js'
import { OverrideOpHelper, WrappedOverridableItemNormal } from '../../util/OverrideOpHelper.js'
import { CheckboxControl } from '../../../../lib/Components/Checkbox.js'
import { IntInputControl } from '../../../../lib/Components/IntInput'
import Button from 'react-bootstrap/Button'

interface AccessorTableRowProps {
	packageContainer: WrappedOverridableItemNormal<StudioPackageContainer>
	accessorId: string
	accessor: Accessor.Any
	overrideHelper: OverrideOpHelper
	toggleExpanded: (exclusivityGroupId: string, force?: boolean) => void
	isExpanded: boolean
}

export function AccessorTableRow({
	accessor,
	accessorId,
	packageContainer,
	overrideHelper,
	toggleExpanded,
	isExpanded,
}: AccessorTableRowProps): React.JSX.Element {
	const { t } = useTranslation()

	const confirmRemoveAccessor = (accessorId: string) => {
		doModalDialog({
			title: t('Remove this Package Container Accessor?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				overrideHelper().setItemValue(packageContainer.id, `container.accessors.${accessorId}`, undefined).commit()
			},
			message: (
				<React.Fragment>
					<p>
						{t('Are you sure you want to remove the Package Container Accessor "{{accessorId}}"?', {
							accessorId: accessorId,
						})}
					</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}

	const updateAccessorId = React.useCallback(
		(newAccessorId: string) => {
			const oldAccessorId = accessorId
			if (!packageContainer.id) throw new Error(`containerId not set`)
			if (!packageContainer) throw new Error(`Can't edit an accessor to nonexistant Package Container"`)

			const accessor = packageContainer.computed?.container.accessors[oldAccessorId]

			if (packageContainer.computed?.container.accessors[newAccessorId]) {
				throw new Meteor.Error(400, 'Accessor "' + newAccessorId + '" already exists')
			}

			// Add a copy of accessor with the new ID, and remove the old
			overrideHelper()
				.setItemValue(packageContainer.id, `container.accessors.${oldAccessorId}`, undefined)
				.setItemValue(packageContainer.id, `container.accessors.${newAccessorId}`, accessor)
				.commit()

			setTimeout(() => {
				toggleExpanded(oldAccessorId, false)
				toggleExpanded(newAccessorId, true)
			}, 100)
		},
		[overrideHelper, toggleExpanded, packageContainer, accessorId]
	)

	if (Object.keys(packageContainer.computed?.container || {}).length === 0) {
		return (
			<tr>
				<td className="dimmed">{t('There are no Accessors set up.')}</td>
			</tr>
		)
	}

	return (
		<React.Fragment key={accessorId}>
			<tr
				className={ClassNames({
					hl: isExpanded,
				})}
			>
				<th className="settings-studio-accessor__id c2">{accessorId}</th>
				{/* <td className="settings-studio-accessor__name c2">{accessor.name}</td> */}
				<td className="settings-studio-accessor__type c1">{accessor.label}</td>
				{/*<td className="settings-studio-accessor__accessorContent c7">{accessorContent.join(', ')}</td>*/}

				<td className="settings-studio-accessor__actions table-item-actions c3">
					<button className="action-btn" onClick={() => toggleExpanded(accessorId)}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
					<button className="action-btn" onClick={() => confirmRemoveAccessor(accessorId)}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</td>
			</tr>
			{isExpanded && (
				<tr className="expando-details hl">
					<td colSpan={6}>
						<div className="properties-grid">
							<label className="field">
								<LabelActual label={t('Accessor ID')} />
								<TextInputControl
									value={accessorId}
									handleUpdate={updateAccessorId}
									disabled={!!packageContainer.defaults}
								/>
							</label>
							<LabelAndOverrides
								label={t('Label')}
								hint={t('Display name of the Package Container')}
								item={packageContainer}
								//@ts-expect-error can't be 4 levels deep
								itemKey={`container.accessors.${accessorId}.label`}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
							</LabelAndOverrides>
							<LabelAndOverridesForDropdown
								label={t('Accessor Type')}
								item={packageContainer}
								//@ts-expect-error can't be 4 levels deep
								itemKey={`container.accessors.${accessorId}.type`}
								overrideHelper={overrideHelper}
								options={getDropdownInputOptions(Accessor.AccessType)}
							>
								{(value, handleUpdate, options) => {
									return <DropdownInputControl options={options} value={value} handleUpdate={handleUpdate} />
								}}
							</LabelAndOverridesForDropdown>
							{accessor.type === Accessor.AccessType.LOCAL_FOLDER ? (
								<>
									<LabelAndOverrides
										label={t('Folder path')}
										hint={t('File path to the folder of the local folder')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.folderPath`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Resource Id')}
										hint={t('(Optional) This could be the name of the computer on which the local folder is on')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.resourceId`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
								</>
							) : accessor.type === Accessor.AccessType.HTTP ? (
								<>
									<LabelAndOverrides
										label={t('Base URL')}
										hint={t('Base url to the resource (example: http://myserver/folder)')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.baseUrl`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Is Immutable')}
										hint={t('When set, resources are considered immutable, ie they will not change')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.isImmutable`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <CheckboxControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Does NOT support HEAD requests')}
										hint={t(
											"If set, Package Manager assumes that the source doesn't support HEAD requests and will use GET instead. If false, HEAD requests will be sent to check availability."
										)}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.useGETinsteadOfHEAD`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <CheckboxControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>

									<LabelAndOverrides
										label={t('Network Id')}
										hint={t(
											'(Optional) A name/identifier of the local network where the share is located, leave empty if globally accessible'
										)}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.networkId`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
								</>
							) : accessor.type === Accessor.AccessType.HTTP_PROXY ? (
								<>
									<LabelAndOverrides
										label={t('Base URL')}
										hint={t('Base url to the resource (example: http://myserver/folder)')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.baseUrl`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Network Id')}
										hint={t(
											'(Optional) A name/identifier of the local network where the share is located, leave empty if globally accessible'
										)}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.networkId`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
								</>
							) : accessor.type === Accessor.AccessType.FILE_SHARE ? (
								<>
									<LabelAndOverrides
										label={t('Base URL')}
										hint={t('Folder path to shared folder')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.folderPath`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('User Name')}
										hint={t('Username for authentication')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.userName`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Password')}
										hint={t('Password for authentication')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.password`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Network Id')}
										hint={t('(Optional) A name/identifier of the local network where the share is located')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.networkId`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
								</>
							) : accessor.type === Accessor.AccessType.QUANTEL ? (
								<>
									<LabelAndOverrides
										label={t('Quantel gateway URL')}
										hint={t('URL to the Quantel Gateway')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.quantelGatewayUrl`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('ISA URLs')}
										hint={t('URLs to the ISAs, in order of importance (comma separated)')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.ISAUrls`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => {
											// Convert array of strings into comma-separated string for the input:
											const strValue = Array.isArray(value) ? value.join(', ') : value
											return (
												<TextInputControl
													value={strValue}
													handleUpdate={(value: string) => {
														// Convert comma-separated string into array of strings
														handleUpdate(value.split(',').map((s) => s.trim()))
													}}
												/>
											)
										}}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Quantel Zone ID')}
										hint={t('Zone ID')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.zoneId`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Server ID')}
										hint={t(
											'Server ID. For sources, this should generally be omitted (or set to 0) so clip-searches are zone-wide. If set, clip-searches are limited to that server.'
										)}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.serverId`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <IntInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Quantel transformer URL')}
										hint={t('URL to the Quantel HTTP transformer')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.transformerURL`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Quantel FileFlow URL')}
										hint={t('URL to the Quantel FileFlow Manager')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.fileflowURL`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Quantel FileFlow Profile name')}
										hint={t('Profile name to be used by FileFlow when exporting the clips')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.fileflowProfile`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
								</>
							) : accessor.type === Accessor.AccessType.ATEM_MEDIA_STORE ? (
								<>
									<LabelAndOverrides
										label={t('Resource Id')}
										hint={t('(Optional) This could be the name of the compute')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.resourceId`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Network Id')}
										hint={t('(Optional) A name/identifier of the local network where the Atem is located')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.networkId`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>

									<LabelAndOverrides
										label={t('Network address')}
										hint={t('Hostname or IP address of the Atem')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.atemHost`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
									<LabelAndOverrides
										label={t('Bank Index')}
										hint={t(' The index of the Atem media/clip banks')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.bankIndex`}
										overrideHelper={overrideHelper}
									>
										{(value, handleUpdate) => <IntInputControl value={value} handleUpdate={handleUpdate} />}
									</LabelAndOverrides>
									<LabelAndOverridesForDropdown
										label={t('Media Type')}
										hint={t('What type of bank')}
										item={packageContainer}
										//@ts-expect-error can't be 4 levels deep
										itemKey={`container.accessors.${accessorId}.mediaType`}
										overrideHelper={overrideHelper}
										options={getDropdownInputOptions(['clip', 'still'])}
									>
										{(value, handleUpdate, options) => {
											return <DropdownInputControl options={options} value={value} handleUpdate={handleUpdate} />
										}}
									</LabelAndOverridesForDropdown>
								</>
							) : null}

							<LabelAndOverridesForCheckbox
								label={t('Allow Read access')}
								item={packageContainer}
								//@ts-expect-error can't be 4 levels deep
								itemKey={`container.accessors.${accessorId}.allowRead`}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
							<LabelAndOverridesForCheckbox
								label={t('Allow Write access')}
								item={packageContainer}
								//@ts-expect-error can't be 4 levels deep
								itemKey={`container.accessors.${accessorId}.allowWrite`}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
						</div>
						<div className="text-end">
							<Button variant="primary" onClick={() => toggleExpanded(accessorId)}>
								<FontAwesomeIcon icon={faCheck} />
							</Button>
						</div>
					</td>
				</tr>
			)}
		</React.Fragment>
	)
}
