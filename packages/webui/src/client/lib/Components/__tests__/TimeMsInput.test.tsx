import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimeMsInputControl } from '../TimeMsInput.js'

function renderInput(props: Partial<React.ComponentProps<typeof TimeMsInputControl>> = {}) {
	const handleUpdate = jest.fn()
	render(<TimeMsInputControl value={3661500} handleUpdate={handleUpdate} {...props} />)
	return { handleUpdate, input: screen.getByRole('textbox') as HTMLInputElement }
}

describe('TimeMsInputControl', () => {
	test('keeps the existing display as the default', () => {
		const { input } = renderInput({ value: 630000 })

		expect(input).toHaveValue('10:30')
	})

	test('keeps milliseconds and hours in the existing display', () => {
		const { input } = renderInput({ value: 3661234 })

		expect(input).toHaveValue('01:01:01.234')
	})

	test.each([29.97, 23.976])('round-trips frame timecode at %s fps', (frameRate) => {
		const { input, handleUpdate } = renderInput({ inputFormat: 'timecodeFrames', frameRate, value: 0 })

		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '00:00:00:01' } })
		fireEvent.blur(input)

		expect(handleUpdate).toHaveBeenCalledWith(frameRate === 29.97 ? 33 : 42)
	})

	test('keeps the existing flexible timeMs parser as the default', () => {
		const { input, handleUpdate } = renderInput({ value: 0 })

		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '1:02.345' } })
		fireEvent.blur(input)

		expect(handleUpdate).toHaveBeenCalledWith(62345)
	})

	test('does not commit invalid flexible time values', () => {
		const { input, handleUpdate } = renderInput({ value: 0 })

		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '1:2:3:4' } })
		fireEvent.blur(input)
		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '-1' } })
		fireEvent.blur(input)

		expect(handleUpdate).not.toHaveBeenCalled()
	})

	test('formats timecode values as a fixed time', () => {
		const { input } = renderInput({ inputFormat: 'timecode' })

		expect(input).toHaveValue('01:01:01')
	})

	test('clamps overflowing timecode fields', () => {
		const { input, handleUpdate } = renderInput({ inputFormat: 'timecode', value: 0 })

		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '99:99:99' } })
		fireEvent.blur(input)

		expect(handleUpdate).toHaveBeenCalledWith(359999000)
	})

	test('formats frame-based timecode using the supplied frame rate', () => {
		const { input, handleUpdate } = renderInput({ inputFormat: 'timecodeFrames', frameRate: 25, value: 1480 })

		expect(input).toHaveValue('00:00:01:12')
		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '00:00:01:12' } })
		fireEvent.blur(input)

		expect(handleUpdate).not.toHaveBeenCalled()
	})

	test('commits an edited frame-based timecode', () => {
		const { input, handleUpdate } = renderInput({ inputFormat: 'timecodeFrames', frameRate: 25, value: 1480 })

		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '00:00:01:13' } })
		fireEvent.blur(input)

		expect(handleUpdate).toHaveBeenCalledWith(1520)
	})

	test('keeps the final frame within the timecode maximum', () => {
		const { input } = renderInput({ inputFormat: 'timecodeFrames', frameRate: 25, value: 359999960 })

		expect(input).toHaveValue('99:59:59:24')
	})

	test('clamps a frame outside the supplied frame rate', () => {
		const { input, handleUpdate } = renderInput({ inputFormat: 'timecodeFrames', frameRate: 25, value: 0 })

		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '00:00:00:25' } })
		fireEvent.blur(input)

		expect(handleUpdate).toHaveBeenCalledWith(960)
	})

	test('formats time of day values and clamps values beyond 24 hours', () => {
		const { input, handleUpdate } = renderInput({ inputFormat: 'tod', value: 86399500 })

		expect(input).toHaveValue('23:59:59')
		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '24:00:00' } })
		fireEvent.blur(input)

		expect(handleUpdate).toHaveBeenCalledWith(23 * 60 * 60 * 1000)
	})

	test('overwrites timecode digits and commits on blur', async () => {
		const { input, handleUpdate } = renderInput({ inputFormat: 'timecode', value: 0 })

		const user = userEvent.setup()
		await user.click(input)
		await user.keyboard('123456')
		expect(input).toHaveValue('12:34:56')
		fireEvent.blur(input)

		expect(handleUpdate).toHaveBeenCalledWith(45296000)
	})

	test('supports digit entry for frame-based timecode', async () => {
		const { input, handleUpdate } = renderInput({ inputFormat: 'timecodeFrames', frameRate: 25, value: 0 })

		const user = userEvent.setup()
		await user.click(input)
		await user.keyboard('12345624')

		expect(input).toHaveValue('12:34:56:24')
		fireEvent.blur(input)
		expect(handleUpdate).toHaveBeenCalledWith(45296960)
	})

	test('treats a short frame digit as frames', () => {
		const { input } = renderInput({ inputFormat: 'timecodeFrames', value: 0 })

		fireEvent.focus(input)
		fireEvent.keyDown(input, { key: '1' })

		expect(input).toHaveValue('00:00:00:01')
	})

	test('updates on each valid digit when updateOnKey is enabled', async () => {
		const { input, handleUpdate } = renderInput({ inputFormat: 'timecode', value: 0, updateOnKey: true })

		const user = userEvent.setup()
		await user.click(input)
		await user.keyboard('12')

		expect(handleUpdate).toHaveBeenCalledTimes(2)
		expect(handleUpdate).toHaveBeenLastCalledWith(12000)
	})

	test('cancels an opt-in edit with Escape', () => {
		const { input, handleUpdate } = renderInput({ inputFormat: 'timecode', value: 0 })

		fireEvent.focus(input)
		fireEvent.keyDown(input, { key: '1' })
		fireEvent.keyDown(input, { key: 'Escape' })

		expect(input).toHaveValue('00:00:00')
		expect(handleUpdate).not.toHaveBeenCalled()
	})

	test('cancels a flexible edit with Escape on key up', () => {
		const { input, handleUpdate } = renderInput({ value: 0 })

		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '12' } })
		fireEvent.keyUp(input, { key: 'Escape' })

		expect(input).toHaveValue('00:00')
		expect(handleUpdate).not.toHaveBeenCalled()
	})

	test('commits a valid edit with Enter', () => {
		const { input, handleUpdate } = renderInput({ inputFormat: 'timecode', value: 0 })

		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '00:00:12' } })
		fireEvent.keyUp(input, { key: 'Enter' })

		expect(handleUpdate).toHaveBeenCalledWith(12000)
	})

	test('blocks unsupported keyboard input', () => {
		const { input } = renderInput({ inputFormat: 'timecode', value: 0 })

		fireEvent.focus(input)
		const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })
		input.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
	})

	test('accepts pasted formatted time values', () => {
		const { input, handleUpdate } = renderInput({ inputFormat: 'timecode', value: 0 })

		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '12:34:56' } })
		fireEvent.blur(input)

		expect(handleUpdate).toHaveBeenCalledWith(45296000)
	})

	test('ignores malformed fixed-format values', () => {
		const { input, handleUpdate } = renderInput({ inputFormat: 'timecodeFrames', value: 0 })

		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '12:34:56' } })
		fireEvent.blur(input)

		expect(handleUpdate).not.toHaveBeenCalled()
	})

	test('parses hours in the legacy format and updates on change', () => {
		const { input, handleUpdate } = renderInput({ value: 0, updateOnKey: true })

		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '1:02:03' } })

		expect(handleUpdate).toHaveBeenCalledWith(3723000)
	})

	test('honours value constraints', () => {
		const { input, handleUpdate } = renderInput({
			inputFormat: 'timecode',
			value: 0,
			min: 10000,
			max: 20000,
			multipleOf: 1000,
		})

		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '00:00:09' } })
		fireEvent.blur(input)
		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '00:00:15' } })
		fireEvent.blur(input)
		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '00:00:21' } })
		fireEvent.blur(input)

		expect(handleUpdate).toHaveBeenCalledTimes(1)
		expect(handleUpdate).toHaveBeenCalledWith(15000)
	})

	test('does not enter or update a read-only input', () => {
		const { input, handleUpdate } = renderInput({ inputFormat: 'timecode', readOnly: true, value: 0 })

		fireEvent.focus(input)
		fireEvent.change(input, { target: { value: '12:34:56' } })
		fireEvent.blur(input)

		expect(input).toHaveValue('00:00:00')
		expect(handleUpdate).not.toHaveBeenCalled()
	})

	test('does not process digit keys on a read-only formatted input', () => {
		const { input, handleUpdate } = renderInput({ inputFormat: 'timecode', readOnly: true, value: 0 })

		fireEvent.keyDown(input, { key: '1' })

		expect(input).toHaveValue('00:00:00')
		expect(handleUpdate).not.toHaveBeenCalled()
	})

	test('falls back to 25 fps for an invalid frame rate', () => {
		const { input } = renderInput({ inputFormat: 'timecodeFrames', frameRate: 0, value: 1000 })

		expect(input).toHaveValue('00:00:01:00')
	})
})
