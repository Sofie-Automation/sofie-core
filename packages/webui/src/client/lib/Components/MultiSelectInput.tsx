import { useCallback, useMemo } from 'react'
import { MultiSelect, MultiSelectEvent, MultiSelectOptions } from '../multiSelect.js'
import { DropdownInputOption } from './DropdownInput.js'
import ClassNames from 'classnames'

interface IMultiSelectInputControlProps {
	classNames?: string
	disabled?: boolean
	placeholder?: string

	value: string[]
	options: DropdownInputOption<string>[]
	handleUpdate: (value: string[]) => void
}
export function MultiSelectInputControl({
	classNames,
	value,
	disabled,
	placeholder,
	options,
	handleUpdate,
}: Readonly<IMultiSelectInputControlProps>): JSX.Element {
	const handleChange = useCallback((event: MultiSelectEvent) => handleUpdate(event.selectedValues), [handleUpdate])

	const {
		optionsWithCurrentValue,
		currentOptionMissing,
	}: { optionsWithCurrentValue: MultiSelectOptions; currentOptionMissing: boolean } = useMemo(() => {
		const convertedOptions: MultiSelectOptions = {}

		for (const option of options) {
			convertedOptions[option.value] = { value: option.name }
		}

		let currentOptionMissing = false
		try {
			for (const val of value) {
				if (!convertedOptions[val]) {
					convertedOptions[val] = { value: `${val}`, className: 'option-missing' }
					currentOptionMissing = true
				}
			}
		} catch (_e) {
			// `value` is probably invalid. We can't do much
		}

		return { optionsWithCurrentValue: convertedOptions, currentOptionMissing: currentOptionMissing }
	}, [options, value])

	return (
		<MultiSelect
			availableOptions={optionsWithCurrentValue}
			placeholder={placeholder}
			className={ClassNames(classNames, {
				'option-missing': currentOptionMissing,
			})}
			value={value}
			onChange={handleChange}
			disabled={disabled}
		/>
	)
}
