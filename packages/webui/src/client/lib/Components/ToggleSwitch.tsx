import { useCallback, useRef } from 'react'
import ClassNames from 'classnames'

interface IToggleSwitchControlProps {
	classNames?: string
	disabled?: boolean

	label?: string

	value: boolean
	handleUpdate: (value: boolean) => void
}
export function ToggleSwitchControl({
	classNames,
	value,
	disabled,
	label,
	handleUpdate,
}: Readonly<IToggleSwitchControlProps>): JSX.Element {
	// Use a ref to avoid binding into the useCallback
	const currentValue = useRef(value)
	currentValue.current = value

	const handleChange = useCallback(() => {
		if (disabled) return
		handleUpdate(!currentValue.current)
	}, [handleUpdate, disabled])

	return (
		<div className="mvs">
			<a
				className={ClassNames('switch-button', 'mrs', classNames, disabled ? 'disabled' : '', {
					'sb-on': value,
				})}
				role="button"
				onClick={handleChange}
				tabIndex={0}
			>
				<div className="sb-content">
					<div className="sb-label">
						<span className="mls">&nbsp;</span>
						<span className="mrs right">&nbsp;</span>
					</div>
					<div className="sb-switch"></div>
				</div>
			</a>
			<span>{label}</span>
		</div>
	)
}
