import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { objectPathGet } from '@sofie-automation/corelib/dist/lib'
import { useCallback } from 'react'
import { SchemaSummaryField } from '../schemaFormUtil.js'

interface ObjectTableDeletedRowProps {
	summaryFields: SchemaSummaryField[]
	id: string
	obj: any
	doUndelete: (itemId: string) => void
}

export function ObjectTableDeletedRow({
	summaryFields,
	id,
	obj,
	doUndelete,
}: Readonly<ObjectTableDeletedRowProps>): JSX.Element {
	const doUndeleteItem = useCallback(() => doUndelete(id), [doUndelete, id])

	return (
		<tr>
			{summaryFields.map((field) => {
				const rawValue = objectPathGet(obj, field.attr)
				let value = field.transform ? field.transform(rawValue) : rawValue
				if (Array.isArray(value)) value = value.join(', ')

				return (
					<td className="settings-studio-device__primary_id c4 deleted" key={field.attr}>
						{value ?? ''}
					</td>
				)
			})}

			<td className="settings-studio-device__actions table-item-actions c1" key="action">
				<button className="action-btn" onClick={doUndeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faSync} />
				</button>
			</td>
		</tr>
	)
}
