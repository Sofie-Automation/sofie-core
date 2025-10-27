import { faPlus, faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { clone, objectPathGet } from '@sofie-automation/corelib/dist/lib'
import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
	WrappedOverridableItemNormal,
	OverrideOpHelperForItemContents,
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
import { hasOpWithPath } from '../../Components/util.js'
import { ArrayTableRow } from './ArrayTableRow.js'
import { OverrideOpHelperArrayTable } from './ArrayTableOpHelper.js'
import { SchemaFormSectionHeader } from '../SchemaFormSectionHeader.js'

interface SchemaFormArrayTableProps {
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
 * An array based table using JSONSchema. This only allows editing the table as a single 'value', not for granular overrides.
 * This should not be used directly, and should instead be used via SchemaFormWithOverrides or one of the alternative wrappers
 */
export const SchemaFormArrayTable = ({
	schema,
	translationNamespaces,
	sofieEnumDefinitons,
	attr,
	item,
	overrideHelper,
}: Readonly<SchemaFormArrayTableProps>): JSX.Element => {
	const { t } = useTranslation()

	const rowsArray: any[] = useMemo(
		() => (attr ? objectPathGet(item.computed, attr) : item.computed) || [],
		[attr, item.computed]
	)
	const rows: Record<string | number, any> = useMemo(() => Object.assign({}, rowsArray), [rowsArray])

	const addNewItem = useCallback(() => {
		// Build the new object
		const newObj = clone(rowsArray)
		newObj.push(getSchemaDefaultValues(schema.items))

		// Send it onwards
		overrideHelper().setItemValue(item.id, attr, newObj).commit()
	}, [schema.items, overrideHelper, rowsArray, item.id, attr])

	const resyncTable = useCallback(
		() => overrideHelper().clearItemOverrides(item.id, attr).commit(),
		[overrideHelper, item.id, attr]
	)

	const tableOverrideHelper = useCallback(
		() => new OverrideOpHelperArrayTable(overrideHelper(), item.id, rowsArray, attr),
		[overrideHelper, item.id, rows, attr]
	)

	const isOverridden = hasOpWithPath(item.overrideOps, item.id, attr)

	const columns = useMemo(() => schema?.items?.properties ?? {}, [schema])
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

	const title = getSchemaUIField(schema, SchemaFormUIField.Title)
	const description = getSchemaUIField(schema, SchemaFormUIField.Description)

	const titleElement = title && (
		<SchemaFormSectionHeader title={title} description={description} translationNamespaces={translationNamespaces} />
	)

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
					{Object.entries<any>(rows).map(([i0, obj]) => {
						const i = Number(i0)

						return (
							<ArrayTableRow
								key={i}
								columns={columns}
								requiredColumns={schema.items?.required}
								summaryFields={summaryFields}
								translationNamespaces={translationNamespaces}
								sofieEnumDefinitons={sofieEnumDefinitons}
								overrideHelper={tableOverrideHelper}
								rowId={i}
								rowObject={obj}
								isExpanded={isExpanded(i)}
								toggleExpanded={toggleExpanded}
								confirmRemove={confirmRemove}
							/>
						)
					})}
				</tbody>
			</table>

			<div className="my-1 mx-2">
				<button className="btn btn-primary" onClick={addNewItem}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
				&nbsp;
				{item.defaults && (
					<button className="btn btn-primary" onClick={resyncTable} title="Reset to default" disabled={!isOverridden}>
						<span>{t('Reset')}</span>
						<FontAwesomeIcon icon={faSync} />
					</button>
				)}
			</div>
		</div>
	)
}
