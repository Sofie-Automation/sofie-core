import React, { useCallback, useMemo, useState } from 'react'
import ClassNames from 'classnames'

export function splitValueIntoLines(v: string | undefined): string[] {
	if (v === undefined || v.length === 0) {
		return []
	} else {
		return v.split('\n').map((i) => i.trimStart())
	}
}
export function joinLines(v: string[] | undefined): string {
	if (v === undefined || v.length === 0) {
		return ''
	} else {
		return v.join('\n')
	}
}

interface IMultiLineTextInputControlProps {
	classNames?: string
	modifiedClassName?: string
	disabled?: boolean
	placeholder?: string

	/** Call handleUpdate on every change, before focus is lost */
	updateOnKey?: boolean

	value: string[]
	handleUpdate: (value: string[]) => void
}
export function MultiLineTextInputControl({
	classNames,
	modifiedClassName,
	value,
	disabled,
	placeholder,
	handleUpdate,
	updateOnKey,
}: Readonly<IMultiLineTextInputControlProps>): JSX.Element {
	const [editingValue, setEditingValue] = useState<string | null>(null)

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLTextAreaElement>) => {
			setEditingValue(event.target.value)

			if (updateOnKey) {
				handleUpdate(splitValueIntoLines(event.target.value))
			}
		},
		[handleUpdate, updateOnKey]
	)
	const handleBlur = useCallback(
		(event: React.FocusEvent<HTMLTextAreaElement>) => {
			handleUpdate(splitValueIntoLines(event.target.value))
			setEditingValue(null)
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
			className={ClassNames('form-control', classNames, editingValue !== null && modifiedClassName)}
			placeholder={placeholder}
			value={editingValue ?? joinLines(value) ?? ''}
			onChange={handleChange}
			onBlur={handleBlur}
			onFocus={handleFocus}
			onKeyUp={handleKeyUp}
			onKeyPress={handleKeyPress}
			disabled={disabled}
		/>
	)
}

interface ICombinedMultiLineTextInputControlProps extends Omit<
	IMultiLineTextInputControlProps,
	'value' | 'handleUpdate'
> {
	value: string
	handleUpdate: (value: string) => void
}
export function CombinedMultiLineTextInputControl({
	value,
	handleUpdate,
	...props
}: Readonly<ICombinedMultiLineTextInputControlProps>): JSX.Element {
	const valueArray = useMemo(() => splitValueIntoLines(value), [value])
	const handleUpdateArray = useCallback((value: string[]) => handleUpdate(joinLines(value)), [handleUpdate])

	return <MultiLineTextInputControl {...props} value={valueArray} handleUpdate={handleUpdateArray} />
}
