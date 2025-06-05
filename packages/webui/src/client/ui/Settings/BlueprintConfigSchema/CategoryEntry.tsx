import { useCallback } from 'react'
import ClassNames from 'classnames'
import { useTranslation } from 'react-i18next'
import { SchemaFormWithOverrides } from '../../../lib/forms/SchemaFormWithOverrides.js'
import { faPencilAlt, faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { SchemaFormSofieEnumDefinition } from '../../../lib/forms/schemaFormUtil.js'
import { WrappedOverridableItemNormal, OverrideOpHelperForItemContents } from '../util/OverrideOpHelper.js'

interface ConfigCategoryEntryProps {
	translationNamespaces: string[]
	wrappedItem: WrappedOverridableItemNormal<IBlueprintConfig>
	categoryName: string | null
	categorySchema: JSONSchema
	isExpanded: boolean
	toggleExpanded: (itemId: string | null, force?: boolean) => void
	overrideHelper: OverrideOpHelperForItemContents
	sofieEnumDefinitons: Record<string, SchemaFormSofieEnumDefinition>
}

export function ConfigCategoryEntry({
	translationNamespaces,
	wrappedItem,
	categoryName,
	categorySchema,
	isExpanded,
	toggleExpanded,
	overrideHelper,
	sofieEnumDefinitons,
}: Readonly<ConfigCategoryEntryProps>): JSX.Element {
	const { t } = useTranslation()

	const toggleEditItem = useCallback(() => toggleExpanded(categoryName), [toggleExpanded, categoryName])

	return (
		<>
			<tr
				className={ClassNames({
					hl: isExpanded,
				})}
			>
				<th className="settings-studio-source-table__name c2">{categoryName ?? t('Other')}</th>
				<td className="settings-studio-source-table__actions table-item-actions c3">
					<button className="action-btn" onClick={toggleEditItem} title={t('Edit')}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
				</td>
			</tr>
			{isExpanded && (
				<tr className="expando-details hl">
					<td colSpan={4}>
						<div className="properties-grid">
							<SchemaFormWithOverrides
								schema={categorySchema}
								translationNamespaces={translationNamespaces}
								allowTables
								attr={''}
								item={wrappedItem}
								overrideHelper={overrideHelper}
								sofieEnumDefinitons={sofieEnumDefinitons}
								isRequired
							/>
						</div>
						<div className="m-1 me-2 text-end">
							<button className="btn btn-primary" onClick={toggleEditItem}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
						</div>
					</td>
				</tr>
			)}
		</>
	)
}
