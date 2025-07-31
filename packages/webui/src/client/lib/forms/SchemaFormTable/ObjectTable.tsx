import { faDownload, faPlus, faUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getRandomString, joinObjectPathFragments, literal, objectPathGet } from '@sofie-automation/corelib/dist/lib'
import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
	WrappedOverridableItemNormal,
	OverrideOpHelperForItemContents,
	getAllCurrentAndDeletedItemsFromOverrides,
	WrappedOverridableItem,
} from '../../../ui/Settings/util/OverrideOpHelper.js'
import { useToggleExpandHelper } from '../../../ui/util/useToggleExpandHelper.js'
import { doModalDialog } from '../../ModalDialog.js'
import {
	getSchemaSummaryFieldsForObject,
	SchemaFormSofieEnumDefinition,
	translateStringIfHasNamespaces,
} from '../schemaFormUtil.js'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import {
	getSchemaDefaultValues,
	getSchemaUIField,
	SchemaFormUIField,
} from '@sofie-automation/shared-lib/dist/lib/JSONSchemaUtil'
import { SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { SchemaFormTableEditRow } from './TableEditRow.js'
import { SchemaTableSummaryRow } from '../SchemaTableSummaryRow.js'
import { OverrideOpHelperObjectTable } from './ObjectTableOpHelper.js'
import { ObjectTableDeletedRow } from './ObjectTableDeletedRow.js'
import { SchemaFormSectionHeader } from '../SchemaFormSectionHeader.js'
import { UploadButton } from '../../uploadButton.js'
import Tooltip from 'rc-tooltip'
import { NoticeLevel, Notification, NotificationCenter } from '../../notifications/notifications.js'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

interface SchemaFormObjectTableProps {
	/** Schema for each row in the table */
	schema: JSONSchema
	/** Translation namespaces for the schama */
	translationNamespaces: string[]
	/** Allow special 'built-in' enum types to be used with the 'ui:sofie-enum' property in the schema */
	sofieEnumDefinitons?: Record<string, SchemaFormSofieEnumDefinition>

	/** The base item, containing the rows represented in the table */
	item: WrappedOverridableItemNormal<any>
	/** Base property path for the rows inside the item */
	attr: string
	/** Helper to create/update the OverrideOps for the table rows */
	overrideHelper: OverrideOpHelperForItemContents
}

/**
 * An object based table using JSONSchema. This allows for granular overrides, as well as adding and removing rows.
 * This should not be used directly, and should instead be used via SchemaFormWithOverrides or one of the alternative wrappers
 */
export const SchemaFormObjectTable = ({
	schema,
	translationNamespaces,
	sofieEnumDefinitons,
	attr,
	item,
	overrideHelper,
}: Readonly<SchemaFormObjectTableProps>): JSX.Element => {
	const { t } = useTranslation()

	const wrappedRows = useMemo(() => {
		if (item.defaults) {
			// Table can be overriden with granularity

			const rawRows = (attr ? objectPathGet(item.defaults, attr) : item.defaults) || {}

			const prefix = joinObjectPathFragments(item.id, attr) + '.'

			// Filter and strip the ops to be local to the row object
			const ops: SomeObjectOverrideOp[] = []
			for (const op of item.overrideOps) {
				if (op.path.startsWith(prefix)) {
					ops.push({
						...op,
						path: op.path.slice(prefix.length),
					})
				}
			}

			const wrappedRows = getAllCurrentAndDeletedItemsFromOverrides(
				{
					defaults: rawRows,
					overrides: ops,
				},
				(a, b) => a[0].localeCompare(b[0]) // TODO - better comparitor?
			)

			return wrappedRows
		} else {
			// Table is formed of purely of an override, so ignore any defaults

			const rawRows = (attr ? objectPathGet(item.computed, attr) : item.computed) || {}

			// Convert the items into an array
			const validItems: Array<[id: string, obj: object]> = []
			for (const [id, obj] of Object.entries<object | undefined>(rawRows)) {
				if (obj) validItems.push([id, obj])
			}

			validItems.sort((a, b) => a[0].localeCompare(b[0])) // TODO - better comparitor?

			// Sort and wrap in the return type
			return validItems.map(([id, obj]) =>
				literal<WrappedOverridableItemNormal<object>>({
					type: 'normal',
					id: id,
					computed: obj,
					defaults: undefined,
					overrideOps: [],
				})
			)
		}
	}, [attr, item])

	const rowSchema = schema.patternProperties?.['']

	const addNewItem = useCallback(() => {
		const newRowId = getRandomString()
		overrideHelper().setItemValue(item.id, `${attr}.${newRowId}`, getSchemaDefaultValues(rowSchema)).commit()
		toggleExpanded(newRowId, true)
	}, [rowSchema, overrideHelper, item.id, attr])

	const doUndeleteRow = useCallback(
		(rowId: string) => {
			overrideHelper().clearItemOverrides(item.id, joinObjectPathFragments(attr, rowId)).commit()
		},
		[overrideHelper, item.id, attr]
	)

	const tableOverrideHelper = useCallback(
		() => new OverrideOpHelperObjectTable(overrideHelper(), item, wrappedRows, attr),
		[overrideHelper, item.id, wrappedRows, attr]
	)

	const columns = useMemo(() => rowSchema?.properties ?? {}, [rowSchema])
	const summaryFields = useMemo(() => getSchemaSummaryFieldsForObject(columns), [columns])

	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const confirmRemove = useCallback(
		(rowId: number | string) => {
			doModalDialog({
				title: t('Remove this item?'),
				no: t('Cancel'),
				yes: t('Remove'),
				onAccept: () => {
					tableOverrideHelper()
						.deleteRow(rowId + '')
						.commit()
				},
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to remove {{type}} "{{deviceId}}"?', {
								type: 'item',
								deviceId: rowId,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		},
		[t, tableOverrideHelper]
	)

	const confirmReset = useCallback(
		(rowId: number | string) => {
			doModalDialog({
				title: t('Reset this item?'),
				yes: t('Reset'),
				no: t('Cancel'),
				onAccept: () => {
					tableOverrideHelper()
						.clearItemOverrides(rowId + '', '')
						.commit()
				},
				message: (
					<React.Fragment>
						<p>{t('Are you sure you want to reset all overrides for the selected row?')}</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		},
		[t, tableOverrideHelper]
	)

	const title = getSchemaUIField(schema, SchemaFormUIField.Title)
	const description = getSchemaUIField(schema, SchemaFormUIField.Description)
	const titleElement = title && (
		<SchemaFormSectionHeader title={title} description={description} translationNamespaces={translationNamespaces} />
	)

	if (Object.keys(schema.properties || {}).length > 0) {
		return (
			<>
				{titleElement}
				{t('Table is not allowed to have `properties` defined')}{' '}
			</>
		)
	} else if (
		schema.patternProperties?.['']?.type !== 'object' ||
		Object.keys(schema.patternProperties || {}).length > 1
	) {
		return (
			<>
				{titleElement}
				{t('Table is only allowed the wildcard `patternProperties`')}{' '}
			</>
		)
	} else {
		return (
			<div className="settings-config-table">
				{titleElement}
				<table className={'expando table'}>
					<thead>
						<tr className="hl">
							{summaryFields.map((col) => {
								return <th key={col.attr}>{translateStringIfHasNamespaces(col.name, translationNamespaces)}</th>
							})}
							<th key="action">&nbsp;</th>
						</tr>
					</thead>
					<tbody>
						{wrappedRows.map((rowItem) =>
							rowItem.type === 'deleted' ? (
								<ObjectTableDeletedRow
									key={rowItem.id}
									summaryFields={summaryFields}
									id={rowItem.id}
									obj={rowItem.defaults}
									doUndelete={doUndeleteRow}
								/>
							) : (
								<React.Fragment key={rowItem.id}>
									<SchemaTableSummaryRow
										summaryFields={summaryFields}
										rowId={rowItem.id}
										showRowId={false}
										rowItem={rowItem}
										isEdited={isExpanded(rowItem.id)}
										editItem={toggleExpanded}
										removeItem={confirmRemove}
										resetItem={confirmReset}
									/>
									{isExpanded(rowItem.id) && (
										<SchemaFormTableEditRow
											translationNamespaces={translationNamespaces}
											sofieEnumDefinitons={sofieEnumDefinitons}
											rowId={rowItem.id}
											columns={columns}
											requiredColumns={rowSchema?.required}
											rowItem={rowItem}
											editItem={toggleExpanded}
											overrideHelper={tableOverrideHelper}
										/>
									)}
								</React.Fragment>
							)
						)}
					</tbody>
				</table>

				<div className="my-1 mx-2">
					<button className="btn btn-primary" onClick={addNewItem}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
					{getSchemaUIField(schema, SchemaFormUIField.SupportsImportExport) ? (
						<ImportExportButtons
							schema={schema.patternProperties['']}
							overrideHelper={tableOverrideHelper}
							wrappedRows={wrappedRows}
						/>
					) : (
						''
					)}
				</div>
			</div>
		)
	}
}

interface ImportExportButtonsProps {
	schema: JSONSchema
	overrideHelper: () => OverrideOpHelperObjectTable
	wrappedRows: WrappedOverridableItem<object>[]
}

function ImportExportButtons({ schema, overrideHelper, wrappedRows }: Readonly<ImportExportButtonsProps>) {
	const { t } = useTranslation()

	const exportTable = () => {
		const exportObject: Record<string, any> = {}
		for (const obj of wrappedRows) {
			exportObject[obj.id] = obj.computed
		}

		const exportContents = JSON.stringify(exportObject, undefined, 2)

		const file = new File([exportContents], `${encodeURIComponent(`${schema.title}`)}.json`, {
			type: 'application/json',
		})

		const link = document.createElement('a')
		const url = URL.createObjectURL(file)

		link.href = url
		link.download = file.name
		document.body.appendChild(link)
		link.click()

		document.body.removeChild(link)
		URL.revokeObjectURL(url)
	}

	const importTable = (uploadFileContents: string, file: File) => {
		const newRows = JSON.parse(uploadFileContents)
		if (!newRows || typeof newRows !== 'object') return

		doModalDialog({
			title: t('Import file?'),
			yes: t('Replace rows'),
			no: t('Cancel'),
			message: (
				<p>
					{t('Are you sure you want to import the contents of the file "{{fileName}}"?', {
						fileName: file.name,
					})}
				</p>
			),
			onAccept: () => {
				const batch = overrideHelper()

				for (const row of wrappedRows) {
					batch.deleteRow(row.id)
				}

				for (const [rowId, row] of Object.entries<unknown>(newRows)) {
					batch.insertRow(rowId, row)
				}

				batch.commit()
			},
			actions: [
				{
					label: t('Append rows'),
					on: () => {
						const batch = overrideHelper()

						for (const [rowId, row] of Object.entries<unknown>(newRows)) {
							batch.insertRow(rowId, row)
						}

						batch.commit()
					},
					classNames: 'btn-secondary',
				},
			],
		})
	}
	const importError = useCallback(
		(err: Error) => {
			NotificationCenter.push(
				new Notification(
					undefined,
					NoticeLevel.WARNING,
					t('Import error: {{errorMessage}}', { errorMessage: stringifyError(err) }),
					'ConfigManifestSettings'
				)
			)
		},
		[t]
	)

	return (
		<>
			<Tooltip overlay={t('Import')} placement="top">
				<div className="d-inline-block">
					<UploadButton
						className="btn btn-secondary"
						onUploadContents={importTable}
						onUploadError={importError}
						accept="application/json,.json"
					>
						<FontAwesomeIcon icon={faUpload} />
					</UploadButton>
				</div>
			</Tooltip>

			<Tooltip overlay={t('Export')} placement="top">
				<button className="btn btn-secondary" onClick={exportTable}>
					<FontAwesomeIcon icon={faDownload} />
				</button>
			</Tooltip>
		</>
	)
}
