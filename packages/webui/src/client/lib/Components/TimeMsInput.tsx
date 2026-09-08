import { useCallback, useState } from 'react'
import ClassNames from 'classnames'
import Form from 'react-bootstrap/Form'
import { formatDurationAsTimecode } from '@sofie-automation/corelib/dist/lib'

export type TimeMsInputFormat = 'timecode' | 'timecodeFrames' | 'tod'

/**
 * Time input supporting a flexible format and optional fixed timecode formats.
 * `timecode` and `tod` accept `HH:MM:SS`; `timecodeFrames` accepts `HH:MM:SS:FF`.
 * Fixed formats clamp overflowing fields and omit milliseconds from their display.
 */
interface ITimeMsInputControlProps {
	classNames?: string
	modifiedClassName?: string
	disabled?: boolean
	readOnly?: boolean
	placeholder?: string

	/** Call handleUpdate on every change, before focus is lost */
	updateOnKey?: boolean

	inputFormat?: TimeMsInputFormat
	/** Frame rate used by `timecodeFrames`, in frames per second. */
	frameRate?: number

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

const TIME_DIGIT_COUNT = 6
const MAX_TIMECODE_MS = (99 * 60 * 60 + 59 * 60 + 59) * 1000 + 999
const MAX_TOD_MS = (23 * 60 * 60 + 59 * 60 + 59) * 1000 + 999

// Frame timecode cannot represent the partial milliseconds allowed by timecode.
function getMaxTimecodeFrames(frameRate: number): number {
	return (99 * 60 * 60 + 59 * 60 + 59) * frameRate + Math.ceil(frameRate) - 1
}

function getMaxTimecodeMs(frameRate: number): number {
	return getMaxTimecodeFrames(frameRate) * (1000 / frameRate)
}

function formatFrameTime(time: number, frameRate: number): string {
	const maxTime = getMaxTimecodeMs(frameRate)
	const clampedTime = Math.min(Math.max(0, time), maxTime)
	const hours = Math.floor(clampedTime / 3600000)
	const remainder = clampedTime - hours * 3600000
	const formattedRemainder = formatDurationAsTimecode({ frameRate }, remainder)

	return `${String(hours).padStart(2, '0')}:${formattedRemainder.slice(3)}`
}

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

function formatInputTime(time: number, inputFormat: TimeMsInputFormat, frameRate: number): string {
	if (inputFormat === 'timecodeFrames') {
		return formatFrameTime(time, frameRate)
	}

	const max = inputFormat === 'tod' ? MAX_TOD_MS : MAX_TIMECODE_MS
	const displayTime = Math.min(Math.max(0, time), max)
	const roundedTime = Math.floor(displayTime / 1000) * 1000
	const hours = Math.floor(roundedTime / 3600000)
	const minutes = Math.floor(roundedTime / 60000) % 60
	const seconds = Math.floor(roundedTime / 1000) % 60
	const result = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

	return result
}

function parseInputTime(time: string, inputFormat: TimeMsInputFormat, frameRate: number): number {
	if (inputFormat === 'timecodeFrames') {
		const match = /^(\d{2}):(\d{2}):(\d{2}):(\d{2})$/.exec(time.trim())
		if (!match) return Number.NaN

		const hours = Number(match[1])
		const minutes = Math.min(Number(match[2]), 59)
		const seconds = Math.min(Number(match[3]), 59)
		const frames = Math.min(Number(match[4]), Math.ceil(frameRate) - 1)

		return Math.round(
			Math.min(
				getMaxTimecodeMs(frameRate),
				(((hours * 60 + minutes) * 60 + seconds) * frameRate + frames) * (1000 / frameRate)
			)
		)
	}

	const pattern = /^(\d{2}):(\d{2}):(\d{2})$/
	const match = pattern.exec(time.trim())
	if (!match) return Number.NaN

	const maxHours = inputFormat === 'tod' ? 23 : 99
	const hours = Math.min(Number(match[1]), maxHours)
	const minutes = Math.min(Number(match[2]), 59)
	const seconds = Math.min(Number(match[3]), 59)
	const result = ((hours * 60 + minutes) * 60 + seconds) * 1000
	const max = inputFormat === 'tod' ? MAX_TOD_MS : MAX_TIMECODE_MS

	// Fixed formats clamp overflowing fields instead of rejecting otherwise valid input.
	return Math.min(result, max)
}

function formatModeDigits(digits: string, inputFormat: TimeMsInputFormat): string {
	const digitCount = inputFormat === 'timecodeFrames' ? TIME_DIGIT_COUNT + 2 : TIME_DIGIT_COUNT
	const paddedDigits = digits.padStart(digitCount, '0')
	const timeDigits = paddedDigits.slice(0, TIME_DIGIT_COUNT)
	const result = `${timeDigits.slice(0, 2)}:${timeDigits.slice(2, 4)}:${timeDigits.slice(4, 6)}`
	if (inputFormat !== 'timecodeFrames') return result

	return `${result}:${paddedDigits.slice(TIME_DIGIT_COUNT)}`
}

export function TimeMsInputControl({
	classNames,
	modifiedClassName,
	value,
	disabled,
	readOnly,
	placeholder,
	handleUpdate,
	updateOnKey,
	min,
	max,
	multipleOf,
	inputFormat,
	frameRate = 25,
}: Readonly<ITimeMsInputControlProps>): JSX.Element {
	const [editingValue, setEditingValue] = useState<string | null>(null)
	const [shouldReset, setShouldReset] = useState(false)
	const isFormattedInput = inputFormat !== undefined
	const validFrameRate = Number.isFinite(frameRate) && frameRate > 0 ? frameRate : 25

	const isValidValue = useCallback(
		(value: number): boolean => {
			if (isNaN(value) || value < 0) return false
			if (inputFormat === 'timecode' && value > MAX_TIMECODE_MS) return false
			if (inputFormat === 'timecodeFrames' && value > getMaxTimecodeMs(validFrameRate)) return false
			if (inputFormat === 'tod' && value > MAX_TOD_MS) return false
			if (min !== undefined && value < min) return false
			if (max !== undefined && value > max) return false
			if (multipleOf !== undefined && value % multipleOf !== 0) return false
			return true
		},
		[min, max, multipleOf, inputFormat, validFrameRate]
	)

	const getParsedValue = useCallback(
		(text: string) => (inputFormat ? parseInputTime(text, inputFormat, validFrameRate) : parseTime(text)),
		[inputFormat, validFrameRate]
	)

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			if (readOnly) return

			const number = getParsedValue(event.target.value)
			setEditingValue(event.target.value)

			if (updateOnKey && !isNaN(number) && isValidValue(number)) {
				handleUpdate(number)
			}
		},
		[handleUpdate, updateOnKey, isValidValue, readOnly, getParsedValue]
	)
	const handleBlur = useCallback(
		(event: React.FocusEvent<HTMLInputElement>) => {
			if (readOnly) {
				setEditingValue(null)
				return
			}
			const editedValue = editingValue ?? event.currentTarget.value
			const formattedValue =
				value !== undefined
					? inputFormat
						? formatInputTime(value, inputFormat, validFrameRate)
						: formatTime(value)
					: undefined
			const number = getParsedValue(editedValue)
			if (editedValue !== formattedValue && !isNaN(number) && isValidValue(number)) {
				handleUpdate(number)
			}

			setEditingValue(null)
		},
		[handleUpdate, isValidValue, readOnly, getParsedValue, editingValue]
	)
	const handleFocus = useCallback(
		(event: React.FocusEvent<HTMLInputElement>) => {
			if (readOnly) return
			setEditingValue(event.currentTarget.value)
			setShouldReset(isFormattedInput)
			event.currentTarget.selectionStart = 0
			event.currentTarget.selectionEnd = event.currentTarget.value.length
		},
		[isFormattedInput, readOnly]
	)
	const handleKeyUp = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (readOnly) return

			if (event.key === 'Escape') {
				setEditingValue(null)
			} else if (event.key === 'Enter') {
				const number = getParsedValue(editingValue ?? event.currentTarget.value)
				if (!isNaN(number) && isValidValue(number)) {
					handleUpdate(number)
					setEditingValue(null)
				}
			}
		},
		[handleUpdate, isValidValue, readOnly, getParsedValue, editingValue]
	)
	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (readOnly) return

			if (isFormattedInput && /^\d$/.test(event.key)) {
				event.preventDefault()
				const currentDigits = (editingValue ?? '').replace(/\D/g, '')
				const digitCount = inputFormat === 'timecodeFrames' ? TIME_DIGIT_COUNT + 2 : TIME_DIGIT_COUNT
				const nextDigits = shouldReset
					? event.key.padStart(digitCount, '0')
					: `${currentDigits}${event.key}`.slice(-digitCount)
				const nextValue = formatModeDigits(nextDigits, inputFormat!)
				setShouldReset(false)
				setEditingValue(nextValue)

				if (updateOnKey) {
					const number = getParsedValue(nextValue)
					if (!isNaN(number) && isValidValue(number)) handleUpdate(number)
				}
				return
			}

			if (isFormattedInput && event.key === 'Escape') {
				setEditingValue(null)
				setShouldReset(false)
				return
			}

			// allow ctrl/cmd + any key, to allow for shortcuts like ctrl+a, ctrl+c, ctrl+v, etc.
			if (!ALLOWED_KEYS.includes(event.key) && event.ctrlKey === false && event.metaKey === false) {
				event.preventDefault()
			}
		},
		[editingValue, getParsedValue, handleUpdate, isFormattedInput, isValidValue, readOnly, shouldReset, updateOnKey]
	)

	let showValue: string | number | undefined = editingValue ?? undefined
	if (showValue === undefined && value !== undefined) {
		showValue = inputFormat ? formatInputTime(value, inputFormat, validFrameRate) : formatTime(value)
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
			readOnly={readOnly}
			disabled={disabled}
		/>
	)
}
