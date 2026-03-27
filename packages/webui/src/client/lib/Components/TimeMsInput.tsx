import React, { useCallback, useState } from 'react'
import ClassNames from 'classnames'
import Form from 'react-bootstrap/Form'

interface IIntInputControlProps {
	classNames?: string
	modifiedClassName?: string
	disabled?: boolean
	placeholder?: string

	/** Call handleUpdate on every change, before focus is lost */
	updateOnKey?: boolean

	value: number | undefined
	handleUpdate: (value: number) => void

	min?: number
	max?: number
	multipleOf?: number
}

const ALLOWED_KEYS = [
	'0',
	'1',
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
	'.',
	':',
	',',
	'Backspace',
	'Tab',
	'Enter',
	'Escape',
	'ArrowLeft',
	'ArrowRight',
	'Home',
	'End',
]

function formatTime(time: number, opts?: { showZeroHours?: boolean; showZeroFrames?: boolean }): string {
	const frames = time % 1000
	const ms = String(frames).padStart(3, '0')
	const ss = String(Math.floor(time / 1000) % 60).padStart(2, '0')
	const mm = String(Math.floor(time / 60000) % 60).padStart(2, '0')
	const hours = Math.floor(time / 3600000)

	let result = `${mm}:${ss}`
	if (frames > 0 || opts?.showZeroFrames) {
		result += `.${ms}`
	}
	if (hours > 0 || opts?.showZeroHours) {
		const hh = String(hours).padStart(2, '0')
		result = `${hh}:${result}`
	}

	return result
}

function parseTime(time: string): number {
	const parts = time.split(':').map((part) => part.trim())
	const partsCount = parts.length
	if (partsCount > 3) return Number.NaN

	let ms = 0
	for (let i = 0; i < partsCount; i++) {
		const part = parts[partsCount - 1 - i]
		const number = parseInt(part, 10)
		if (i === 0 && part.includes('.')) {
			const number = parseFloat(part)
			if (isNaN(number) || number < 0) return Number.NaN
			ms += number * 1000
		} else if (isNaN(number) || number < 0) return Number.NaN
		else if (i === 0 && partsCount) ms += number * 1000
		else if (i === 1) ms += number * 60000
		else if (i === 2) ms += number * 3600000
	}

	return ms
}

export function TimeMsInputControl({
	classNames,
	modifiedClassName,
	value,
	disabled,
	placeholder,
	handleUpdate,
	updateOnKey,
	min,
	max,
	multipleOf,
}: Readonly<IIntInputControlProps>): JSX.Element {
	const [editingValue, setEditingValue] = useState<string | null>(null)

	const isValidValue = useCallback((value: number): boolean => {
		if (isNaN(value) || value < 0) return false
		if (min !== undefined && value < min) return false
		if (max !== undefined && value > max) return false
		if (multipleOf !== undefined && value % multipleOf !== 0) return false
		return true
	}, [min, max, multipleOf])

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const number = parseTime(event.target.value)
			setEditingValue(event.target.value)

			if (updateOnKey && !isNaN(number) && isValidValue(number)) {
				handleUpdate(number)
			}
		},
		[handleUpdate, updateOnKey, isValidValue]
	)
	const handleBlur = useCallback(
		(event: React.FocusEvent<HTMLInputElement>) => {
			const number = parseTime(event.currentTarget.value)
			if (!isNaN(number) && isValidValue(number)) {
				handleUpdate(number)
			}

			setEditingValue(null)
		},
		[handleUpdate, isValidValue]
	)
	const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
		setEditingValue(event.currentTarget.value)
		event.currentTarget.selectionStart = 0
		event.currentTarget.selectionEnd = event.currentTarget.value.length
	}, [])
	const handleKeyUp = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Escape') {
				setEditingValue(null)
			} else if (event.key === 'Enter') {
				const number = parseTime(event.currentTarget.value)
				if (!isNaN(number) && isValidValue(number)) {
					handleUpdate(number)
				}
			}
		},
		[handleUpdate, isValidValue]
	)
	const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
		// allow ctrl/cmd + any key, to allow for shortcuts like ctrl+a, ctrl+c, ctrl+v, etc.
		if (!ALLOWED_KEYS.includes(event.key) && event.ctrlKey === false && event.metaKey === false) {
			event.preventDefault()
		}
	}, [])

	let showValue: string | number | undefined = editingValue ?? undefined
	if (showValue === undefined && value !== undefined) {
		showValue = formatTime(value)
	}
	if (showValue === undefined) showValue = ''

	return (
		<Form.Control
			type="text"
			className={ClassNames('form-control', classNames, editingValue !== null && modifiedClassName)}
			placeholder={placeholder}
			value={showValue ?? ''}
			onChange={handleChange}
			onBlur={handleBlur}
			onFocus={handleFocus}
			onKeyUp={handleKeyUp}
			onKeyDown={handleKeyDown}
			disabled={disabled}
		/>
	)
}
