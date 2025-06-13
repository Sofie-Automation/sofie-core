import React, { useCallback, useState } from 'react'
import ClassNames from 'classnames'

export function tryParseJson(str: string | undefined): { parsed: object } | undefined {
	const str2 = str?.trim() ?? ''

	// Shortcut for empty
	if (str2 === '' || str2 === '{}') return { parsed: {} }

	try {
		const parsed = JSON.parse(str2)
		if (typeof parsed === 'object') return { parsed: parsed }
	} catch (err) {
		// ignore
	}
	return undefined
}

interface IJsonTextInputControlProps {
	classNames?: string
	modifiedClassName?: string
	invalidClassName?: string
	disabled?: boolean
	placeholder?: string

	/** Call handleUpdate on every change, before focus is lost */
	updateOnKey?: boolean

	value: object
	handleUpdate: (value: object) => void
}
export function JsonTextInputControl({
	classNames,
	modifiedClassName,
	invalidClassName,
	value,
	disabled,
	placeholder,
	handleUpdate,
	updateOnKey,
}: Readonly<IJsonTextInputControlProps>): JSX.Element {
	const [editingValue, setEditingValue] = useState<string | null>(null)
	const [valueInvalid, setValueInvalid] = useState(false)

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLTextAreaElement>) => {
			setEditingValue(event.target.value)

			if (updateOnKey) {
				const parsed = tryParseJson(event.target.value)
				if (parsed) {
					handleUpdate(parsed.parsed)
					setValueInvalid(false)
				} else {
					setValueInvalid(true)
				}
			}
		},
		[handleUpdate, updateOnKey]
	)
	const handleBlur = useCallback(
		(event: React.FocusEvent<HTMLTextAreaElement>) => {
			const parsed = tryParseJson(event.target.value)

			if (parsed) {
				handleUpdate(parsed.parsed)
				setEditingValue(null)
				setValueInvalid(false)
			} else {
				setValueInvalid(true)
			}
		},
		[handleUpdate]
	)
	const handleFocus = useCallback((event: React.FocusEvent<HTMLTextAreaElement>) => {
		setEditingValue(event.currentTarget.value)
	}, [])
	const handleKeyUp = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === 'Escape') {
			setEditingValue(null)
		}
	}, [])
	const handleKeyPress = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// Suppress the default behaviour of submitting on enter press
		if (event.key === 'Enter') {
			event.stopPropagation()
		}
	}, [])

	return (
		<textarea
			className={ClassNames(
				'form-control',
				classNames,
				editingValue !== null && modifiedClassName,
				valueInvalid && invalidClassName
			)}
			placeholder={placeholder}
			value={editingValue ?? JSON.stringify(value, undefined, 2) ?? ''}
			onChange={handleChange}
			onBlur={handleBlur}
			onFocus={handleFocus}
			onKeyUp={handleKeyUp}
			onKeyPress={handleKeyPress}
			disabled={disabled}
		/>
	)
}
