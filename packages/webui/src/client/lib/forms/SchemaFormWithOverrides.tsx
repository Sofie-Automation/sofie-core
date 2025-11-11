import { joinObjectPathFragments, literal } from '@sofie-automation/corelib/dist/lib'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
	WrappedOverridableItemNormal,
	OverrideOpHelperForItemContents,
} from '../../ui/Settings/util/OverrideOpHelper.js'
import { CheckboxControl } from '../Components/Checkbox.js'
import { DropdownInputOption, DropdownInputControl } from '../Components/DropdownInput.js'
import { FloatInputControl } from '../Components/FloatInput.js'
import { IntInputControl } from '../Components/IntInput.js'
import { JsonTextInputControl } from '../Components/JsonTextInput.js'
import {
	LabelAndOverrides,
	LabelAndOverridesForBase64Image,
	LabelAndOverridesForCheckbox,
	LabelAndOverridesForDropdown,
	LabelAndOverridesForInt,
} from '../Components/LabelAndOverrides.js'
import { MultiLineTextInputControl } from '../Components/MultiLineTextInput.js'
import { TextInputControl } from '../Components/TextInput.js'
import { JSONSchema, TypeName } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { SchemaFormArrayTable } from './SchemaFormTable/ArrayTable.js'
import {
	SchemaFormCommonProps,
	SchemaFormSofieEnumDefinition,
	translateStringIfHasNamespaces,
} from './schemaFormUtil.js'
import { MultiSelectInputControl } from '../Components/MultiSelectInput.js'
import { SchemaFormObjectTable } from './SchemaFormTable/ObjectTable.js'
import { getSchemaUIField, SchemaFormUIField } from '@sofie-automation/blueprints-integration'
import { SchemaFormSectionHeader } from './SchemaFormSectionHeader.js'
import { Base64ImageInputControl } from '../Components/Base64ImageInput.js'
import { MultiLineIntInputControl } from '../Components/MultiLineIntInput.js'
import { ToggleSwitchControl } from '../Components/ToggleSwitch.js'
import { BreadCrumbTextInput } from '../Components/BreadCrumbTextInput.js'

interface SchemaFormWithOverridesProps extends SchemaFormCommonProps {
	/** Base path of the schema within the document */
	attr: string

	/** The wrapped item to be edited, with its overrides */
	item: WrappedOverridableItemNormal<any>
	/** Helper to generate and save overrides for the item */
	overrideHelper: OverrideOpHelperForItemContents
}

interface FormComponentProps {
	schema: JSONSchema
	translationNamespaces: string[]
	commonAttrs: {
		label: string
		hint: string | undefined

		item: WrappedOverridableItemNormal<any>
		overrideHelper: OverrideOpHelperForItemContents
		itemKey: string

		/** Whether a clear button should be showed for fields not marked as "required" */
		showClearButton: boolean
	}

	/** Whether this field has been marked as "required" */
	isRequired: boolean
}

function useChildPropsForFormComponent(props: Readonly<SchemaFormWithOverridesProps>): FormComponentProps {
	return useMemo(() => {
		const title = getSchemaUIField(props.schema, SchemaFormUIField.Title) || props.schema.title || props.attr
		const description = getSchemaUIField(props.schema, SchemaFormUIField.Description)

		return {
			schema: props.schema,
			translationNamespaces: props.translationNamespaces,
			commonAttrs: {
				label: translateStringIfHasNamespaces(title, props.translationNamespaces),
				hint: description ? translateStringIfHasNamespaces(description, props.translationNamespaces) : undefined,
				item: props.item,
				itemKey: props.attr,
				overrideHelper: props.overrideHelper,

				showClearButton: !!props.showClearButtonForNonRequiredFields && !props.isRequired,
			},
			isRequired: props.isRequired,
		}
	}, [
		props.schema,
		props.translationNamespaces,
		props.attr,
		props.item,
		props.overrideHelper,
		props.isRequired,
		props.showClearButtonForNonRequiredFields,
	])
}

export function SchemaFormWithOverrides(props: Readonly<SchemaFormWithOverridesProps>): JSX.Element {
	const { t } = useTranslation()

	const childProps = useChildPropsForFormComponent(props)

	switch (props.schema.type) {
		case TypeName.Array:
			if (
				getSchemaUIField(props.schema, SchemaFormUIField.DisplayType) === 'bread-crumbs' ||
				props.schema.items?.type === TypeName.String
			) {
				return <BreadCrumbsFormWithOverrides {...childProps} />
			} else {
				return <ArrayFormWithOverrides {...props} />
			}
		case TypeName.Object:
			if (getSchemaUIField(props.schema, SchemaFormUIField.DisplayType) === 'json') {
				return <JsonFormWithOverrides {...childProps} />
			} else if (props.schema.patternProperties) {
				if (props.allowTables) {
					return <SchemaFormObjectTable {...props} />
				} else {
					return <>{t('Tables are not supported here')}</>
				}
			} else {
				return <ObjectFormWithOverrides {...props} />
			}
		case TypeName.Integer:
			if (props.schema.enum) {
				return <EnumFormWithOverrides {...childProps} multiple={false} />
			} else {
				return <IntegerFormWithOverrides {...childProps} />
			}
		case TypeName.Number:
			return <NumberFormWithOverrides {...childProps} />
		case TypeName.Boolean:
			if (getSchemaUIField(props.schema, SchemaFormUIField.DisplayType) === 'switch') {
				return <SwitchFormWithOverrides {...childProps} />
			} else {
				return <BooleanFormWithOverrides {...childProps} />
			}
		case TypeName.String:
			if (getSchemaUIField(props.schema, SchemaFormUIField.DisplayType) === 'base64-image') {
				return <Base64ImagePickerWithOverrides {...childProps} />
			} else if (getSchemaUIField(props.schema, SchemaFormUIField.SofieEnum)) {
				return (
					<SofieEnumFormWithOverrides
						{...childProps}
						sofieEnumDefinitions={props.sofieEnumDefinitons}
						multiple={false}
					/>
				)
			} else if (props.schema.enum) {
				return <EnumFormWithOverrides {...childProps} multiple={false} />
			} else {
				return <StringFormWithOverrides {...childProps} />
			}
		default:
			return <>{t('Unsupported field type "{{ type }}"', { type: props.schema.type })}</>
	}
}

const ArrayFormWithOverrides = (props: Readonly<SchemaFormWithOverridesProps>) => {
	const { t } = useTranslation()

	const childProps = useChildPropsForFormComponent(props)

	switch (props.schema.items?.type) {
		case TypeName.String:
			if (getSchemaUIField(props.schema, SchemaFormUIField.SofieEnum)) {
				return (
					<SofieEnumFormWithOverrides
						{...childProps}
						sofieEnumDefinitions={props.sofieEnumDefinitons}
						multiple={true}
					/>
				)
			} else if (props.schema.items.enum) {
				return <EnumFormWithOverrides {...childProps} schema={props.schema.items} multiple={true} />
			} else {
				return <StringArrayFormWithOverrides {...childProps} />
			}
		case TypeName.Number:
		case TypeName.Integer:
			return <IntArrayFormWithOverrides {...childProps} />
		case TypeName.Object:
			if (props.allowTables) {
				return <SchemaFormArrayTable {...props} />
			} else {
				return <>{t('Tables are not supported here')}</>
			}
		default:
			return <>{t('Unsupported array type "{{ type }}"', { type: props.schema.items?.type })}</>
	}
}

const ObjectFormWithOverrides = (props: Readonly<SchemaFormWithOverridesProps>) => {
	const title = getSchemaUIField(props.schema, SchemaFormUIField.Title)
	const description = getSchemaUIField(props.schema, SchemaFormUIField.Description)

	return (
		<>
			<SchemaFormSectionHeader
				title={title}
				description={description}
				translationNamespaces={props.translationNamespaces}
			/>{' '}
			{Object.entries<JSONSchema>(props.schema.properties ?? {}).map(([index, schema]) => {
				const path = joinObjectPathFragments(props.attr, index)
				return (
					<SchemaFormWithOverrides
						key={index}
						attr={path}
						schema={schema}
						item={props.item}
						overrideHelper={props.overrideHelper}
						translationNamespaces={props.translationNamespaces}
						sofieEnumDefinitons={props.sofieEnumDefinitons}
						allowTables={props.allowTables}
						isRequired={props.schema.required?.includes(index) ?? false}
						showClearButtonForNonRequiredFields={props.showClearButtonForNonRequiredFields}
					/>
				)
			})}
		</>
	)
}

interface SofieEnumFormComponentProps extends FormComponentProps {
	sofieEnumDefinitions: Record<string, SchemaFormSofieEnumDefinition> | undefined

	multiple: boolean
}

const SofieEnumFormWithOverrides = ({ sofieEnumDefinitions, ...props }: SofieEnumFormComponentProps) => {
	const sofieEnum = getSchemaUIField(props.schema, SchemaFormUIField.SofieEnum)
	const sofieEnumFilter = getSchemaUIField(props.schema, SchemaFormUIField.SofieEnumFilter)
	const sofieEnumDefinition = sofieEnum && sofieEnumDefinitions ? sofieEnumDefinitions[sofieEnum] : undefined

	const options: DropdownInputOption<any>[] = useMemo(() => {
		if (sofieEnumDefinition && Array.isArray(sofieEnumFilter) && sofieEnumFilter.length) {
			// Filter and convert options
			const validFilter = new Set(sofieEnumFilter)
			return sofieEnumDefinition.options.filter((opt) => validFilter.has(opt.filter)).map((opt, i) => ({ ...opt, i }))
		} else if (sofieEnumDefinition) {
			// Show all the options
			return sofieEnumDefinition.options.map((opt, i) => ({ ...opt, i }))
		} else {
			// Not a valid enum
			return []
		}
	}, [sofieEnumDefinition, sofieEnumFilter])

	return <EnumFormControlWrapper {...props} options={options} />
}

interface EnumFormComponentProps extends FormComponentProps {
	multiple: boolean
}

const EnumFormWithOverrides = (props: EnumFormComponentProps) => {
	const tsEnumNames = (getSchemaUIField(props.schema, SchemaFormUIField.TsEnumNames) || []) as string[]
	const options = useMemo(() => {
		return (props.schema.enum ?? []).map((value: any, i: number) =>
			literal<DropdownInputOption<any>>({
				value,
				name: tsEnumNames[i] || value,
				i,
			})
		)
	}, [props.schema.enum, tsEnumNames])

	return <EnumFormControlWrapper {...props} options={options} />
}

interface EnumFormControlWrapperProps extends FormComponentProps {
	multiple: boolean

	options: DropdownInputOption<any>[]
}
const EnumFormControlWrapper = ({
	commonAttrs,
	multiple,
	options,
	isRequired,
}: Readonly<EnumFormControlWrapperProps>) => {
	const { t } = useTranslation()

	const optionsWithNoneField = useMemo(() => {
		if (isRequired && !multiple) {
			return [
				{
					i: -1,
					name: t('None'),
					value: undefined,
				},
				...options,
			]
		} else {
			return options
		}
	}, [t, options, isRequired, multiple])

	return (
		<LabelAndOverridesForDropdown {...commonAttrs} options={optionsWithNoneField}>
			{(value, handleUpdate, options) => {
				if (multiple) {
					return (
						<MultiSelectInputControl
							classNames="dropdown"
							options={options}
							value={value}
							handleUpdate={handleUpdate}
						/>
					)
				} else {
					return <DropdownInputControl options={options} value={value} handleUpdate={handleUpdate} />
				}
			}}
		</LabelAndOverridesForDropdown>
	)
}

const IntegerFormWithOverrides = ({ schema, commonAttrs }: Readonly<FormComponentProps>) => {
	const zeroBased = !!getSchemaUIField(schema, SchemaFormUIField.ZeroBased)

	return (
		<LabelAndOverridesForInt {...commonAttrs} zeroBased={zeroBased}>
			{(value, handleUpdate) => (
				<IntInputControl
					placeholder={schema.default}
					zeroBased={zeroBased}
					value={value}
					handleUpdate={handleUpdate}
					min={schema['minimum']}
					max={schema['maximum']}
				/>
			)}
		</LabelAndOverridesForInt>
	)
}

const NumberFormWithOverrides = ({ schema, commonAttrs }: Readonly<FormComponentProps>) => {
	return (
		<LabelAndOverrides {...commonAttrs}>
			{(value, handleUpdate) => (
				<FloatInputControl
					placeholder={schema.default}
					value={value}
					handleUpdate={handleUpdate}
					min={schema['minimum']}
					max={schema['maximum']}
				/>
			)}
		</LabelAndOverrides>
	)
}

const BooleanFormWithOverrides = ({ commonAttrs }: Readonly<FormComponentProps>) => {
	return (
		<LabelAndOverridesForCheckbox {...commonAttrs}>
			{(value, handleUpdate) => (
				<CheckboxControl classNames="input" value={value ?? false} handleUpdate={handleUpdate} />
			)}
		</LabelAndOverridesForCheckbox>
	)
}

const SwitchFormWithOverrides = ({ commonAttrs }: Readonly<FormComponentProps>) => {
	return (
		<LabelAndOverridesForCheckbox {...commonAttrs}>
			{(value, handleUpdate) => (
				// <CheckboxControl classNames="input" value={value ?? false} handleUpdate={handleUpdate} />
				<ToggleSwitchControl value={value ?? false} handleUpdate={handleUpdate} />
			)}
		</LabelAndOverridesForCheckbox>
	)
}

const StringFormWithOverrides = ({ schema, commonAttrs }: Readonly<FormComponentProps>) => {
	return (
		<LabelAndOverrides {...commonAttrs}>
			{(value, handleUpdate) => (
				<TextInputControl placeholder={schema.default} value={value} handleUpdate={handleUpdate} />
			)}
		</LabelAndOverrides>
	)
}

const StringArrayFormWithOverrides = ({ schema, commonAttrs }: Readonly<FormComponentProps>) => {
	return (
		<LabelAndOverrides {...commonAttrs}>
			{(value, handleUpdate) => (
				<MultiLineTextInputControl
					placeholder={schema.default?.join('\n')}
					value={value || []}
					handleUpdate={handleUpdate}
				/>
			)}
		</LabelAndOverrides>
	)
}

const IntArrayFormWithOverrides = ({ schema, commonAttrs }: Readonly<FormComponentProps>) => {
	return (
		<LabelAndOverrides {...commonAttrs}>
			{(values, handleUpdate) => (
				<MultiLineIntInputControl
					placeholder={schema.default}
					values={values || []}
					handleUpdate={handleUpdate}
					min={schema.minimum}
					max={schema.maximum}
				/>
			)}
		</LabelAndOverrides>
	)
}

const JsonFormWithOverrides = ({ schema, commonAttrs }: Readonly<FormComponentProps>) => {
	return (
		<LabelAndOverrides {...commonAttrs}>
			{(value, handleUpdate) => (
				<JsonTextInputControl placeholder={JSON.stringify(schema.default)} value={value} handleUpdate={handleUpdate} />
			)}
		</LabelAndOverrides>
	)
}

const Base64ImagePickerWithOverrides = ({ commonAttrs }: FormComponentProps) => {
	return (
		<LabelAndOverridesForBase64Image {...commonAttrs}>
			{(value, handleUpdate) => <Base64ImageInputControl value={value} handleUpdate={handleUpdate} />}
		</LabelAndOverridesForBase64Image>
	)
}

const BreadCrumbsFormWithOverrides = ({ commonAttrs }: Readonly<FormComponentProps>) => {
	return (
		<LabelAndOverrides {...commonAttrs}>
			{(value, handleUpdate) => <BreadCrumbTextInput value={value || []} handleUpdate={handleUpdate} />}
		</LabelAndOverrides>
	)
}
