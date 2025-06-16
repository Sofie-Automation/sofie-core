import React, { useCallback } from 'react'
import Form from 'react-bootstrap/Form'

interface ICheckboxControlProps {
	classNames?: string
	disabled?: boolean
	title?: string

	value: boolean
	handleUpdate: (value: boolean) => void
}
export function CheckboxControl({
	classNames,
	value,
	disabled,
	handleUpdate,
	title,
}: Readonly<ICheckboxControlProps>): JSX.Element {
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			handleUpdate(!!e.currentTarget.checked)
		},
		[handleUpdate]
	)

	return (
		<Form.Check
			type="checkbox"
			className={classNames}
			checked={value}
			onChange={handleChange}
			disabled={disabled}
			title={title}
		/>
	)
}
