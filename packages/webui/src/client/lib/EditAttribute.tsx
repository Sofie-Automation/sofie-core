import * as React from 'react'
import _ from 'underscore'
import { useTracker } from './ReactMeteorData/react-meteor-data.js'
import { MultiSelect, MultiSelectEvent, MultiSelectOptions } from './multiSelect.js'
import ClassNames from 'classnames'
import { ColorPickerEvent, ColorPicker } from './colorPicker.js'
import { IconPicker, IconPickerEvent } from './iconPicker.js'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { MongoCollection } from '../collections/lib.js'
import { CheckboxControl } from './Components/Checkbox.js'
import { TextInputControl } from './Components/TextInput.js'
import { IntInputControl } from './Components/IntInput.js'
import { DropdownInputControl, getDropdownInputOptions } from './Components/DropdownInput.js'
import { FloatInputControl } from './Components/FloatInput.js'
import { joinLines, MultiLineTextInputControl, splitValueIntoLines } from './Components/MultiLineTextInput.js'
import { JsonTextInputControl, tryParseJson } from './Components/JsonTextInput.js'
import { ToggleSwitchControl } from './Components/ToggleSwitch.js'
import { useCallback, useMemo, useState } from 'react'

interface IEditAttribute extends IEditAttributeBaseProps {
	type: EditAttributeType
}
export type EditAttributeType =
	| 'text'
	| 'multiline'
	| 'int'
	| 'float'
	| 'checkbox'
	| 'toggle'
	| 'dropdown'
	| 'dropdowntext'
	| 'multiselect'
	| 'json'
	| 'colorpicker'
	| 'iconpicker'
export class EditAttribute extends React.Component<IEditAttribute> {
	render(): JSX.Element {
		if (this.props.type === 'text') {
			return <EditAttributeText {...this.props} />
		} else if (this.props.type === 'multiline') {
			return <EditAttributeMultilineText {...this.props} />
		} else if (this.props.type === 'int') {
			return <EditAttributeInt {...this.props} />
		} else if (this.props.type === 'float') {
			return <EditAttributeFloat {...this.props} />
		} else if (this.props.type === 'checkbox') {
			return <EditAttributeCheckbox {...this.props} />
		} else if (this.props.type === 'toggle') {
			return <EditAttributeToggle {...this.props} />
		} else if (this.props.type === 'dropdown') {
			return <EditAttributeDropdown {...this.props} />
		} else if (this.props.type === 'dropdowntext') {
			return <EditAttributeDropdownText {...this.props} />
		} else if (this.props.type === 'multiselect') {
			return <EditAttributeMultiSelect {...this.props} />
		} else if (this.props.type === 'json') {
			return <EditAttributeJson {...this.props} />
		} else if (this.props.type === 'colorpicker') {
			return <EditAttributeColorPicker {...this.props} />
		} else if (this.props.type === 'iconpicker') {
			return <EditAttributeIconPicker {...this.props} />
		} else {
			assertNever(this.props.type)
		}

		return <div>Unknown edit type {this.props.type}</div>
	}
}

export interface IEditAttributeBaseProps {
	updateOnKey?: boolean
	attribute?: string
	collection?: MongoCollection<any>
	obj?: any
	options?: any
	optionsAreNumbers?: boolean
	className?: string
	modifiedClassName?: string
	invalidClassName?: string
	updateFunction?: (editProps: IEditAttributeBaseProps, newValue: any) => void
	overrideDisplayValue?: any
	label?: string
	mutateDisplayValue?: (v: any) => any
	mutateUpdateValue?: (v: any) => any
	disabled?: boolean
	storeJsonAsObject?: boolean
	/** Defaults to string */
	arrayType?: 'boolean' | 'int' | 'float' | 'string'
}

function EditAttributeText(props: IEditAttributeBaseProps) {
	const stateHelper = useEditAttributeStateHelper(props)

	return (
		<TextInputControl
			classNames={`${props.className || ''} ${stateHelper.valueError ? 'error ' : ''}`}
			modifiedClassName={props.modifiedClassName}
			disabled={props.disabled}
			placeholder={props.label}
			updateOnKey={props.updateOnKey}
			value={stateHelper.getAttributeValue() ?? ''}
			handleUpdate={stateHelper.handleUpdate}
		/>
	)
}
function EditAttributeMultilineText(props: IEditAttributeBaseProps) {
	const stateHelper = useEditAttributeStateHelper(props)

	const handleChange = useCallback(
		(value: string[]) => {
			stateHelper.handleUpdate(joinLines(value)) // as single string
		},
		[stateHelper.handleUpdate]
	)

	return (
		<MultiLineTextInputControl
			classNames={`${props.className || ''} ${stateHelper.valueError ? 'error ' : ''}`}
			modifiedClassName={props.modifiedClassName}
			disabled={props.disabled}
			placeholder={props.label}
			updateOnKey={props.updateOnKey}
			value={splitValueIntoLines(stateHelper.getAttributeValue())}
			handleUpdate={handleChange}
		/>
	)
}
function EditAttributeInt(props: IEditAttributeBaseProps) {
	const stateHelper = useEditAttributeStateHelper(props)

	return (
		<IntInputControl
			classNames={props.className || ''}
			modifiedClassName={props.modifiedClassName}
			disabled={props.disabled}
			placeholder={props.label}
			updateOnKey={props.updateOnKey}
			value={stateHelper.getAttributeValue() ?? ''}
			handleUpdate={stateHelper.handleUpdate}
		/>
	)
}
function EditAttributeFloat(props: IEditAttributeBaseProps) {
	const stateHelper = useEditAttributeStateHelper(props)

	return (
		<FloatInputControl
			classNames={props.className || ''}
			modifiedClassName={props.modifiedClassName}
			disabled={props.disabled}
			placeholder={props.label}
			updateOnKey={props.updateOnKey}
			value={stateHelper.getAttributeValue() ?? ''}
			handleUpdate={stateHelper.handleUpdate}
		/>
	)
}
function EditAttributeCheckbox(props: IEditAttributeBaseProps) {
	const stateHelper = useEditAttributeStateHelper(props)

	return (
		<label>
			<CheckboxControl
				classNames={props.className}
				value={!!stateHelper.getAttributeValue()}
				handleUpdate={stateHelper.handleUpdate}
				disabled={props.disabled}
			/>
		</label>
	)
}
function EditAttributeToggle(props: IEditAttributeBaseProps) {
	const stateHelper = useEditAttributeStateHelper(props)

	return (
		<ToggleSwitchControl
			classNames={props.className}
			value={!!stateHelper.getAttributeValue()}
			disabled={props.disabled}
			label={props.label}
			handleUpdate={stateHelper.handleUpdate}
		/>
	)
}
function EditAttributeDropdown(props: IEditAttributeBaseProps) {
	const stateHelper = useEditAttributeStateHelper(props)

	const options = useMemo(() => getDropdownInputOptions<string>(props.options), [props.options])

	const handleChange = useCallback(
		(value: string) => {
			stateHelper.handleUpdate(props.optionsAreNumbers ? parseInt(value, 10) : value)
		},
		[stateHelper.handleUpdate, props.optionsAreNumbers]
	)

	return (
		<DropdownInputControl
			classNames={props.className}
			disabled={props.disabled}
			value={stateHelper.getAttributeValue()}
			options={options}
			handleUpdate={handleChange}
		/>
	)
}
function EditAttributeDropdownText(props: IEditAttributeBaseProps) {
	const stateHelper = useEditAttributeStateHelper(props)

	const options = useMemo(() => getDropdownInputOptions<string>(props.options), [props.options])

	return (
		<TextInputControl
			classNames={`${props.className || ''} ${stateHelper.valueError ? 'error ' : ''}`}
			modifiedClassName={props.modifiedClassName}
			disabled={props.disabled}
			placeholder={props.label}
			updateOnKey={props.updateOnKey}
			value={stateHelper.getAttributeValue() ?? ''}
			handleUpdate={stateHelper.handleUpdate}
			spellCheck={false}
			suggestions={options}
		/>
	)
}

interface EditAttributeMultiSelectOptionsResult {
	options: MultiSelectOptions
	currentOptionMissing: boolean
}

function EditAttributeMultiSelect(props: IEditAttributeBaseProps) {
	const stateHelper = useEditAttributeStateHelper(props)

	const currentValue = stateHelper.getAttributeValue()
	const options = getMultiselectOptions(props.options, currentValue, true)

	const handleChange = useCallback(
		(event: MultiSelectEvent) => stateHelper.handleUpdate(event.selectedValues),
		[stateHelper.handleUpdate]
	)

	return (
		<MultiSelect
			className={ClassNames(props.className, options.currentOptionMissing && 'option-missing')}
			availableOptions={options.options}
			value={currentValue}
			placeholder={props.label}
			onChange={handleChange}
		/>
	)
}

function getMultiselectOptions(
	rawOptions: any,
	currentValue: any,
	addOptionsForCurrentValue?: boolean
): EditAttributeMultiSelectOptionsResult {
	const options: MultiSelectOptions = {}

	if (Array.isArray(rawOptions)) {
		// is it an enum?
		for (const val of rawOptions) {
			if (typeof val === 'object') {
				options[val.value] = { value: val.name }
			} else {
				options[val] = { value: val }
			}
		}
	} else if (typeof rawOptions === 'object') {
		// Is options an enum?
		const keys = Object.keys(rawOptions)
		const first = rawOptions[keys[0]]
		if (rawOptions[first] + '' === keys[0] + '') {
			// is an enum, only pick
			for (const key in rawOptions) {
				if (!_.isNaN(parseInt(key, 10))) {
					// key is a number (the key)
					const enumValue = rawOptions[key]
					const enumKey = rawOptions[enumValue]
					options[enumKey] = { value: enumValue }
				}
			}
		} else {
			for (const key in rawOptions) {
				const val = rawOptions[key]
				if (Array.isArray(val)) {
					options[key] = { value: val }
				} else {
					options[val] = { value: key + ': ' + val }
				}
			}
		}
	}

	const missingOptions = Array.isArray(currentValue) ? currentValue.filter((v) => !(v in options)) : []

	if (addOptionsForCurrentValue) {
		missingOptions.forEach((option) => {
			options[option] = { value: `${option}`, className: 'option-missing' }
		})
	}

	return { options, currentOptionMissing: !!missingOptions.length }
}

function EditAttributeJson(props: IEditAttributeBaseProps) {
	const stateHelper = useEditAttributeStateHelper(props)

	const handleChange = useCallback(
		(value: object) => {
			const storeValue = props.storeJsonAsObject ? value : JSON.stringify(value, undefined, 2)
			stateHelper.handleUpdate(storeValue)
		},
		[stateHelper.handleUpdate, props.storeJsonAsObject]
	)

	const value = props.storeJsonAsObject
		? stateHelper.getAttributeValue()
		: tryParseJson(stateHelper.getAttributeValue())?.parsed

	return (
		<JsonTextInputControl
			classNames={`${props.className || ''} ${stateHelper.valueError ? `${props.invalidClassName || 'error'} ` : ''}`}
			invalidClassName={props.invalidClassName}
			modifiedClassName={props.modifiedClassName}
			disabled={props.disabled}
			placeholder={props.label}
			updateOnKey={props.updateOnKey}
			value={value}
			handleUpdate={handleChange}
		/>
	)
}
function EditAttributeColorPicker(props: IEditAttributeBaseProps) {
	const stateHelper = useEditAttributeStateHelper(props)

	const handleChange = useCallback(
		(event: ColorPickerEvent) => stateHelper.handleUpdate(event.selectedValue),
		[stateHelper.handleUpdate]
	)

	return (
		<ColorPicker
			className={props.className}
			availableOptions={props.options}
			value={stateHelper.getAttributeValue()}
			placeholder={props.label}
			onChange={handleChange}
		/>
	)
}
function EditAttributeIconPicker(props: IEditAttributeBaseProps) {
	const stateHelper = useEditAttributeStateHelper(props)

	const handleChange = useCallback(
		(event: IconPickerEvent) => stateHelper.handleUpdate(event.selectedValue),
		[stateHelper.handleUpdate]
	)

	return (
		<IconPicker
			className={props.className}
			availableOptions={props.options}
			value={stateHelper.getAttributeValue()}
			placeholder={props.label}
			onChange={handleChange}
		/>
	)
}

interface EditAttributeStateHelper {
	props: Readonly<IEditAttributeBaseProps>
	myObject: any

	valueError: boolean
	setValueError: (value: boolean) => void

	getAttributeValue: () => any
	handleUpdate: (inputValue: any, storeValue?: any) => void
}

function useEditAttributeStateHelper(props: IEditAttributeBaseProps): EditAttributeStateHelper {
	const [valueError, setValueError] = useState(false)

	const myObject = useTracker(
		() => (props.collection ? props.collection.findOne(props.obj._id) : props.obj || {}),
		[props.collection, props.obj]
	)

	const getAttributeValue = useCallback((): any => {
		let v = null
		if (props.overrideDisplayValue !== undefined) {
			v = props.overrideDisplayValue
		} else {
			v = deepAttribute(myObject, props.attribute)
		}
		return props.mutateDisplayValue ? props.mutateDisplayValue(v) : v
	}, [props.overrideDisplayValue, props.mutateDisplayValue, deepAttribute, myObject, props.attribute])

	/** Update and save the value of this field */
	const handleUpdate = useCallback(
		(newValue: any) => {
			if (props.mutateUpdateValue) {
				try {
					newValue = props.mutateUpdateValue(newValue)
					setValueError(false)
				} catch (_e) {
					setValueError(true)

					return
				}
			}

			if (props.updateFunction && typeof props.updateFunction === 'function') {
				props.updateFunction(props, newValue)
			} else {
				if (props.collection && props.attribute) {
					if (newValue === undefined) {
						const m: Record<string, 1> = {}
						m[props.attribute] = 1
						props.collection.update(props.obj._id, { $unset: m })
					} else {
						const m: Record<string, any> = {}
						m[props.attribute] = newValue
						props.collection.update(props.obj._id, { $set: m })
					}
				}
			}
		},
		[props, props.mutateUpdateValue, props.updateFunction, props.collection, props.attribute, props.obj?._id]
	)

	return { props, myObject, valueError, setValueError, getAttributeValue, handleUpdate }
}

function deepAttribute(obj0: any, attr0: string | undefined): any {
	// Returns a value deep inside an object
	// Example: deepAttribute(company,"ceo.address.street");

	const f = (obj: any, attr: string): any => {
		if (obj) {
			const attributes = attr.split('.')

			if (attributes.length > 1) {
				const outerAttr = attributes.shift() as string
				const innerAttrs = attributes.join('.')

				return f(obj[outerAttr], innerAttrs)
			} else {
				return obj[attributes[0]]
			}
		} else {
			return obj
		}
	}
	return f(obj0, attr0 || '')
}
