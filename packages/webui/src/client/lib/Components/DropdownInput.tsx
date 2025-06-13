import React, { useCallback, useMemo } from 'react'
import ClassNames from 'classnames'
import Form from 'react-bootstrap/esm/Form'

export interface DropdownInputOption<TValue> {
	value: TValue
	name: string
	i: number
}

export function getDropdownInputOptions<T>(rawOptions: unknown): DropdownInputOption<T>[] {
	const options: Omit<DropdownInputOption<T>, 'i'>[] = []

	if (Array.isArray(rawOptions)) {
		// is it an enum?
		for (const val of rawOptions) {
			if (typeof val === 'object') {
				options.push({
					name: val.name,
					value: val.value,
				})
			} else {
				options.push({
					name: val,
					value: val,
				})
			}
		}
	} else if (rawOptions && typeof rawOptions === 'object') {
		const rawOptionsAny = rawOptions as any
		// Is options an enum?
		const keys = Object.keys(rawOptionsAny)
		const first = rawOptionsAny[keys[0]]
		if (rawOptionsAny[first] + '' === keys[0] + '') {
			// is an enum, only pick
			for (const key in rawOptions) {
				if (!isNaN(parseInt(key, 10))) {
					// key is a number (the key)
					const enumValue = rawOptionsAny[key]
					const enumKey = rawOptionsAny[enumValue]
					options.push({
						name: enumValue,
						value: enumKey,
					})
				}
			}
		} else {
			for (const key in rawOptionsAny) {
				const val = rawOptionsAny[key]
				if (Array.isArray(val)) {
					options.push({
						name: key,
						value: val as any,
					})
				} else {
					options.push({
						name: key + ': ' + val,
						value: val,
					})
				}
			}
		}
	}

	return options.map((opt, i) => ({
		...opt,
		i,
	}))
}

export function findOptionByValue<T>(options: DropdownInputOption<T>[], value: T): DropdownInputOption<T> | undefined {
	return options.find((o) => {
		if (Array.isArray(o.value)) {
			return o.value.includes(value)
		}
		return o.value === value
	})
}

interface IDropdownInputControlProps<TValue> {
	classNames?: string
	disabled?: boolean

	value: TValue
	options: DropdownInputOption<TValue>[]
	handleUpdate: (value: TValue) => void
}
export function DropdownInputControl<TValue>({
	classNames,
	value,
	disabled,
	options,
	handleUpdate,
}: Readonly<IDropdownInputControlProps<TValue>>): JSX.Element {
	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLSelectElement>) => {
			// because event.target.value is always a string, use the original value instead
			const option = options.find((o) => o.value + '' === event.target.value + '')

			handleUpdate(option ? option.value : (event.target.value as any))
		},
		[handleUpdate, options]
	)

	const {
		optionsWithCurrentValue,
		currentOptionMissing,
	}: { optionsWithCurrentValue: DropdownInputOption<TValue>[]; currentOptionMissing: boolean } = useMemo(() => {
		const currentOption = findOptionByValue(options, value)
		if (!currentOption) {
			// if currentOption not found, then add it to the list:

			const newOptions = [
				...options,
				{
					name: String(value),
					value: value,
					i: options.length,
				},
			]

			return { optionsWithCurrentValue: newOptions, currentOptionMissing: true }
		}

		return { optionsWithCurrentValue: options, currentOptionMissing: false }
	}, [options, value])

	return (
		<div className="select focusable">
			<Form.Select
				className={ClassNames(classNames, {
					'option-missing': currentOptionMissing,
				})}
				value={value + ''}
				onChange={handleChange}
				disabled={disabled}
			>
				{optionsWithCurrentValue.map((o, j) =>
					Array.isArray(o.value) ? (
						<optgroup key={j} label={o.name}>
							{o.value.map((v, i) => (
								<option key={i} value={v + ''}>
									{v}
								</option>
							))}
						</optgroup>
					) : (
						<option key={o.i} value={o.value + ''}>
							{o.name}
						</option>
					)
				)}
			</Form.Select>
		</div>
	)
}
