import { faPencilAlt, faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { objectPathGet } from '@sofie-automation/corelib/dist/lib'
import classNames from 'classnames'
import { useCallback } from 'react'
import { SchemaSummaryField } from './schemaFormUtil.js'
import { WrappedOverridableItemNormal } from '../../ui/Settings/util/OverrideOpHelper.js'
import { useTranslation } from 'react-i18next'

interface SchemaTableSummaryRowProps<T extends string | number> {
	summaryFields: SchemaSummaryField[]
	showRowId: boolean
	rowId: T
	rowItem: WrappedOverridableItemNormal<any>
	isEdited: boolean
	editItem: (rowId: T) => void
	removeItem: (rowId: T) => void
	resetItem?: (rowId: T) => void
}
export function SchemaTableSummaryRow<T extends string | number>({
	summaryFields,
	showRowId,
	rowId,
	rowItem,
	isEdited,
	editItem,
	removeItem,
	resetItem,
}: Readonly<SchemaTableSummaryRowProps<T>>): JSX.Element {
	const { t } = useTranslation()

	const editItem2 = useCallback(() => editItem(rowId), [editItem, rowId])
	const removeItem2 = useCallback(() => removeItem(rowId), [removeItem, rowId])
	const resetItem2 = useCallback(() => resetItem?.(rowId), [resetItem, rowId])

	return (
		<tr
			className={classNames({
				hl: isEdited,
			})}
		>
			{showRowId && <th className="settings-studio-device__name c2">{rowId}</th>}

			{summaryFields.map((field) => {
				const rawValue = objectPathGet(rowItem.computed, field.attr)
				let value = field.transform ? field.transform(rawValue) : rawValue
				if (Array.isArray(value)) value = value.join(', ')

				return (
					<td className="settings-studio-device__primary_id c4" key={field.attr}>
						{value ?? ''}
					</td>
				)
			})}

			<td className="settings-studio-device__actions table-item-actions c1" key="action">
				{!!resetItem && !rowItem.defaults && (
					<button className="action-btn" disabled>
						<FontAwesomeIcon icon={faSync} title={t('Row cannot be reset as it has no default values')} />
					</button>
				)}
				{!!resetItem && rowItem.defaults && rowItem.overrideOps.length > 0 && (
					<button className="action-btn" onClick={resetItem2} title={t('Reset row to default values')}>
						<FontAwesomeIcon icon={faSync} />
					</button>
				)}
				<button className="action-btn" onClick={editItem2}>
					<FontAwesomeIcon icon={faPencilAlt} />
				</button>
				<button className="action-btn" onClick={removeItem2}>
					<FontAwesomeIcon icon={faTrash} />
				</button>
			</td>
		</tr>
	)
}
