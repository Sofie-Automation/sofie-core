import React, { useState, useEffect, useLayoutEffect } from 'react'
import classNames from 'classnames'
import { usePopper } from 'react-popper'
import { EditAttribute, EditAttributeType } from '../../../../../../lib/EditAttribute'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAngleRight, faCheck, faTrash } from '@fortawesome/free-solid-svg-icons'
import { sameWidth } from '../../../../../../lib/popperUtils'
import { catchError } from '../../../../../../lib/lib'
import { preventOverflow } from '@popperjs/core'
import { DropdownInputControl, getDropdownInputOptions } from '../../../../../../lib/Components/DropdownInput'

interface IProps {
	fieldLabel: string
	description?: string
	valueLabel?: string
	opened: boolean
	field: string
	fields: string[] | Record<string, string>
	value: any
	final?: boolean
	readonly?: boolean
	type: EditAttributeType
	values?: Record<string, any>
	index: number
	onChangeField: (newField: any) => void
	onChange: (newValue: any) => void
	onFocus?: (index: number) => void
	onInsertNext?: (index: number) => void
	onRemove?: (index: number) => void
	onClose: (index: number) => void
}

export const FilterEditor: React.FC<IProps> = function FilterEditor(props: IProps): React.ReactElement | null {
	const { index, opened, onClose, onFocus } = props
	const [referenceElement, setReferenceElement] = useState<HTMLDListElement | null>(null)
	const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
	const { styles, attributes, update } = usePopper(referenceElement, popperElement, {
		placement: 'bottom',
		modifiers: [
			preventOverflow,
			{
				name: 'offset',
				options: {
					offset: [0, -30],
				},
			},
			sameWidth,
		],
	})

	useEffect(() => {
		function closeHandler(e: MouseEvent) {
			const composedPath = e.composedPath()
			if (
				popperElement &&
				referenceElement &&
				!composedPath.find((item) => item instanceof HTMLElement && item.className === popperElement.className) &&
				!composedPath.includes(referenceElement)
			) {
				onClose(index)
			}
		}

		if (opened) {
			document.body.addEventListener('click', closeHandler)
		}

		return () => {
			document.body.removeEventListener('click', closeHandler)
		}
	}, [popperElement, referenceElement, opened, index])

	useLayoutEffect(() => {
		update && update().catch(catchError('FilterEditor update'))
	}, [props.fieldLabel, props.valueLabel])

	return (
		<>
			<dl
				className={classNames('triggered-action-entry__action__filter', {
					final: props.final,
					focused: opened,
					clickable: !props.readonly,
				})}
				ref={setReferenceElement}
				tabIndex={0}
				role="button"
				onClick={() => !props.readonly && onFocus && onFocus(index)}
			>
				<dt>{props.fieldLabel}</dt>
				<dd>{props.valueLabel}</dd>
			</dl>
			{opened ? (
				<div
					className="expco expco-expanded expco-popper mod pas expco-popper-rounded triggered-action-entry__action__filter-editor"
					ref={setPopperElement}
					style={styles.popper}
					{...attributes.popper}
				>
					{props.description && <p className="man">{props.description}</p>}
					<div>
						<DropdownInputControl
							classNames="input text-input input-m"
							value={props.field}
							options={getDropdownInputOptions(props.fields)}
							// placeholder={props.fieldLabel}
							handleUpdate={(newVal) => props.onChangeField(newVal)}
						/>
					</div>
					<div>
						<EditAttribute
							className={props.type === 'toggle' ? 'form-control' : 'form-control input text-input input-m'}
							modifiedClassName="bghl"
							type={props.type}
							label={props.valueLabel}
							options={props.values}
							overrideDisplayValue={typeof props.value === 'number' ? String(props.value) : props.value}
							attribute={''}
							updateFunction={(_e, newVal) => props.onChange(newVal)}
						/>
					</div>
					<div className="mts">
						{!props.final ? (
							<button
								className="btn right btn-tight btn-primary"
								onClick={() => props.onInsertNext && props.onInsertNext(index)}
							>
								<FontAwesomeIcon icon={faAngleRight} />
							</button>
						) : (
							<button className="btn right btn-tight btn-primary" onClick={() => props.onClose(index)}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
						)}
						<button className="btn btn-tight btn-secondary" onClick={() => props.onRemove && props.onRemove(index)}>
							<FontAwesomeIcon icon={faTrash} />
						</button>
					</div>
				</div>
			) : null}
		</>
	)
}
