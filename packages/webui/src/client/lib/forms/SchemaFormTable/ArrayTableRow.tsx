import React, { useMemo } from 'react'
import { WrappedOverridableItemNormal } from '../../../ui/Settings/util/OverrideOpHelper.js'
import { SchemaFormTableEditRow } from './TableEditRow.js'
import { SchemaTableSummaryRow } from '../SchemaTableSummaryRow.js'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { JSONSchema } from '@sofie-automation/blueprints-integration'
import { SchemaSummaryField, SchemaFormSofieEnumDefinition } from '../schemaFormUtil.js'
import { OverrideOpHelperArrayTable } from './ArrayTableOpHelper.js'
import { ReadonlyDeep } from 'type-fest'

interface ArrayTableRowProps {
	columns: Record<string, JSONSchema | undefined>
	requiredColumns: ReadonlyDeep<string[]> | undefined
	summaryFields: SchemaSummaryField[]
	translationNamespaces: string[]
	sofieEnumDefinitons: Record<string, SchemaFormSofieEnumDefinition> | undefined

	overrideHelper: () => OverrideOpHelperArrayTable

	rowId: number
	rowObject: any

	isExpanded: boolean
	toggleExpanded: (rowId: number | string, forceState?: boolean) => void
	confirmRemove: (rowId: number | string) => void
}

export function ArrayTableRow({
	columns,
	requiredColumns,
	summaryFields,
	translationNamespaces,
	sofieEnumDefinitons,
	overrideHelper,
	rowId,
	rowObject,
	isExpanded,
	toggleExpanded,
	confirmRemove,
}: Readonly<ArrayTableRowProps>): JSX.Element {
	const rowItem = useMemo(
		() =>
			literal<WrappedOverridableItemNormal<any>>({
				type: 'normal',
				id: rowId + '',
				computed: rowObject,
				defaults: undefined,
				overrideOps: [],
			}),
		[rowObject, rowId]
	)

	return (
		<React.Fragment key={rowId}>
			<SchemaTableSummaryRow
				summaryFields={summaryFields}
				rowId={rowId}
				showRowId={false}
				rowItem={rowItem}
				isEdited={isExpanded}
				editItem={toggleExpanded}
				removeItem={confirmRemove}
			/>
			{isExpanded && (
				<SchemaFormTableEditRow
					translationNamespaces={translationNamespaces}
					sofieEnumDefinitons={sofieEnumDefinitons}
					rowId={rowId}
					columns={columns}
					requiredColumns={requiredColumns}
					rowItem={rowItem}
					editItem={toggleExpanded}
					overrideHelper={overrideHelper}
				/>
			)}
		</React.Fragment>
	)
}
