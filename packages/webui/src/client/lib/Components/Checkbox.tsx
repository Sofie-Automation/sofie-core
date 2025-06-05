import { faCheckSquare, faSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback } from 'react'
import ClassNames from 'classnames'

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
		<span className={ClassNames('checkbox', classNames)}>
			<input
				type="checkbox"
				className="form-control"
				checked={value}
				onChange={handleChange}
				disabled={disabled}
				title={title}
			/>
			<span className="checkbox-checked" title={title}>
				<FontAwesomeIcon icon={faCheckSquare} />
			</span>
			<span className="checkbox-unchecked" title={title}>
				<FontAwesomeIcon icon={faSquare} />
			</span>
		</span>
	)
}
