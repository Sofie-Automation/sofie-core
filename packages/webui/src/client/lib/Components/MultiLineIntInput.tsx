import { IntInputControl } from './IntInput'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { useMemo } from 'react'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'

interface IMultiLineIntInputControlProps {
	disabled?: boolean
	placeholder?: number[]

	/** Call handleUpdate on every change, before focus is lost */
	updateOnKey?: boolean

	zeroBased?: boolean
	values: number[]
	handleUpdate: (values: number[]) => void

	min?: number
	max?: number
	step?: number
}
export function MultiLineIntInputControl({
	values,
	disabled,
	placeholder,
	handleUpdate,
	updateOnKey,
	zeroBased,
	min,
	max,
	step,
}: Readonly<IMultiLineIntInputControlProps>): JSX.Element {
	const handleUpdateArrayItem = (value: number, index: number) => {
		const clonedArray = Array.from(values)
		clonedArray[index] = value
		handleUpdate(clonedArray)
	}

	const handleDelete = (index: number) => {
		const clonedArray = Array.from(values)
		clonedArray.splice(index, 1)
		handleUpdate(clonedArray)
	}

	const handleAdd = () => {
		const clonedArray = Array.from(values)
		let defaultValue = 0
		if (placeholder?.length)
			defaultValue = placeholder[placeholder.length > values.length ? values.length : placeholder.length - 1]
		clonedArray.push(defaultValue)
		handleUpdate(clonedArray)
	}

	const keys: string[] = useMemo(() => values.map(() => getRandomString()), [values.length])

	return (
		<div>
			{values.map((value, index) => {
				return (
					<div key={keys[index]} style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
						<IntInputControl
							value={value}
							disabled={disabled}
							updateOnKey={updateOnKey}
							zeroBased={zeroBased}
							handleUpdate={(value) => {
								handleUpdateArrayItem(value, index)
							}}
							step={step}
							min={min}
							max={max}
						/>
						<button
							className="action-btn"
							onClick={() => handleDelete(index)}
							style={{ marginLeft: '10px' }}
							disabled={disabled}
						>
							<FontAwesomeIcon icon={faTrash} />
						</button>
					</div>
				)
			})}
			<button className="btn btn-primary" onClick={handleAdd} disabled={disabled}>
				<FontAwesomeIcon icon={faPlus} />
			</button>
		</div>
	)
}
