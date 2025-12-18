import React, { useCallback, useMemo, useState } from 'react'
import ClassNames from 'classnames'
import { DropdownInputOption } from './DropdownInput.js'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import Form from 'react-bootstrap/Form'

export type TextInputSuggestion = DropdownInputOption<string>
export interface TextInputSuggestionGroup {
	name: string
	options: TextInputSuggestion[]
}
interface ITextInputControlProps {
	classNames?: string
	modifiedClassName?: string
	disabled?: boolean
	placeholder?: string
	spellCheck?: boolean

	suggestions?: Array<TextInputSuggestionGroup | TextInputSuggestion>

	/** Call handleUpdate on every change, before focus is lost */
	updateOnKey?: boolean

	value: string
	handleUpdate: (value: string) => void
}
export function TextInputControl({
	classNames,
	modifiedClassName,
	value,
	disabled,
	placeholder,
	spellCheck,
	suggestions,
	handleUpdate,
	updateOnKey,
}: Readonly<ITextInputControlProps>): JSX.Element {
	const [editingValue, setEditingValue] = useState<string | null>(null)

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setEditingValue(event.target.value)

			if (updateOnKey) {
				handleUpdate(event.target.value)
			}
		},
		[handleUpdate, updateOnKey]
	)
	const handleBlur = useCallback(
		(event: React.FocusEvent<HTMLInputElement>) => {
			let value: string = event.target.value
			if (value) {
				value = value.trim()
			}
			handleUpdate(value)

			setEditingValue(null)
		},
		[handleUpdate]
	)
	const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
		setEditingValue(event.currentTarget.value)
	}, [])
	const handleKeyUp = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Escape') {
				setEditingValue(null)
			} else if (event.key === 'Enter') {
				handleUpdate(event.currentTarget.value)
			}
		},
		[handleUpdate]
	)

	const fieldId = useMemo(() => getRandomString(), [])

	const textInput = (
		<Form.Control
			type="text"
			className={ClassNames(classNames, editingValue !== null && modifiedClassName)}
			placeholder={placeholder}
			value={editingValue ?? value ?? ''}
			onChange={handleChange}
			onBlur={handleBlur}
			onFocus={handleFocus}
			onKeyUp={handleKeyUp}
			disabled={disabled}
			spellCheck={spellCheck}
			list={suggestions ? fieldId : undefined}
		/>
	)

	if (!suggestions) {
		return textInput
	} else {
		return (
			<div className="input-dropdowntext">
				{textInput}

				<datalist id={fieldId}>
					{suggestions.map((o, j) =>
						'options' in o ? (
							<optgroup key={j} label={o.name}>
								{o.options.map((v, i) => (
									<option key={i} value={v.value + ''}>
										{v.value !== v.name ? v.name : null}
									</option>
								))}
							</optgroup>
						) : (
							<option key={o.i} value={o.value + ''}>
								{o.value !== o.name ? o.name : null}
							</option>
						)
					)}
				</datalist>
			</div>
		)
	}
}
