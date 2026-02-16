import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react'
import ClassNames from 'classnames'
import Form from 'react-bootstrap/esm/Form'
import Button from 'react-bootstrap/esm/Button'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'

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

import './BreadCrumbTextInput.scss'
import { getAllAncestors } from '../lib'

interface IBreadCrumbTextInputControlProps {
	classNames?: string
	modifiedClassName?: string
	disabled?: boolean

	/** Call handleUpdate on every change, before focus is lost */
	updateOnKey?: boolean

	value: string[]
	handleUpdate: (value: string[]) => void
}

type ReducerActions =
	| {
			type: 'setValue'
			value: string[]
	  }
	| {
			type: 'insert'
			index?: number
	  }
	| {
			type: 'remove'
			index: number
			selectPrevious?: boolean
	  }
	| {
			type: 'set'
			index: number
			value: string
	  }
	| {
			type: 'focus'
			index: number
			position: 'begin' | 'end'
	  }
	| {
			type: 'clearEdit'
	  }

type InputState = {
	value: string[]
	editingValue: string[] | null
	selectIndex: number | null
	selectIndexPosition: 'begin' | 'end' | null
}

export function BreadCrumbTextInput({
	classNames,
	modifiedClassName,
	value,
	disabled,
	handleUpdate,
	updateOnKey,
}: Readonly<IBreadCrumbTextInputControlProps>): JSX.Element {
	const { t } = useTranslation()

	const [inputState, dispatch] = useReducer(
		(state: InputState, action: ReducerActions) => {
			const newState = {
				...state,
			}
			switch (action.type) {
				case 'setValue': {
					newState.value = value
					break
				}
				case 'insert': {
					newState.editingValue ??= newState.value ?? []
					if (action.index === undefined) {
						newState.selectIndex = newState.editingValue.push('') - 1
						newState.selectIndexPosition = 'end'
					} else {
						newState.editingValue.splice(action.index, 0, '')
						newState.selectIndex = action.index
						newState.selectIndexPosition = 'end'
					}
					break
				}
				case 'remove': {
					newState.editingValue ??= newState.value ?? []
					newState.editingValue.splice(action.index, 1)
					if (action.selectPrevious) {
						newState.selectIndex = Math.max(0, action.index - 1)
						newState.selectIndexPosition = 'end'
					} else {
						newState.selectIndex = null
						newState.selectIndexPosition = 'end'
					}
					break
				}
				case 'set': {
					newState.editingValue ??= newState.value ?? []
					newState.editingValue[action.index] = action.value
					break
				}
				case 'clearEdit': {
					newState.editingValue = null
					break
				}
				case 'focus': {
					newState.selectIndex = action.index
					newState.selectIndexPosition = action.position
				}
			}

			return newState
		},
		{
			editingValue: null,
			selectIndex: null,
			selectIndexPosition: null,
			value,
		}
	)

	useEffect(() => {
		dispatch({
			type: 'setValue',
			value,
		})
	}, [dispatch, value])

	const volatileValue = inputState.editingValue ?? inputState.value

	const inputRef = useRef<HTMLDivElement>(null)

	const doCommit = useCallback(() => {
		if (inputState.editingValue === null) return

		handleUpdate(inputState.editingValue.slice())
		dispatch({
			type: 'clearEdit',
		})
	}, [inputState])

	const handleSegmentDelete = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			const index = parseInt(event.currentTarget.dataset['index'] ?? '')

			if (!Number.isFinite(index)) return

			dispatch({
				type: 'remove',
				index,
			})
		},
		[dispatch]
	)

	const handleSegmentValueChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const index = parseInt(event.target.dataset['index'] ?? '')

			if (!Number.isFinite(index)) return

			dispatch({
				type: 'set',
				index,
				value: event.target.value,
			})
		},
		[dispatch]
	)

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			const index = parseInt(event.currentTarget.dataset['index'] ?? '')

			if (!Number.isFinite(index)) return

			if (event.key === 'Enter') {
				dispatch({
					type: 'insert',
					index: index + 1,
				})
				event.stopPropagation()

				delete event.currentTarget.dataset['backspace']
			} else if (event.key === 'Backspace') {
				if (!event.currentTarget.value) {
					if (!event.currentTarget.dataset['backspace']) {
						event.currentTarget.dataset['backspace'] = '1'
					} else {
						const backspaceCount = parseInt(event.currentTarget.dataset['backspace']) || 1
						if (backspaceCount > 3) {
							dispatch({
								type: 'remove',
								index,
								selectPrevious: true,
							})
						} else {
							event.currentTarget.dataset['backspace'] = `${backspaceCount + 1}`
						}
					}
				}
			} else if (event.key === 'ArrowLeft' && event.currentTarget.selectionStart === 0) {
				dispatch({
					type: 'focus',
					index: index - 1,
					position: 'end',
				})
				event.preventDefault()
				delete event.currentTarget.dataset['backspace']
			} else if (event.key === 'ArrowRight' && event.currentTarget.selectionEnd === event.currentTarget.value.length) {
				dispatch({
					type: 'focus',
					index: index + 1,
					position: 'begin',
				})
				event.preventDefault()
				delete event.currentTarget.dataset['backspace']
			} else {
				delete event.currentTarget.dataset['backspace']
			}

			if (updateOnKey) {
				doCommit()
			}
		},
		[dispatch, doCommit, updateOnKey]
	)

	const handleSegmentBlur = useCallback(
		(event: React.FocusEvent<HTMLInputElement>) => {
			delete event.currentTarget.dataset['backspace']
		},
		[dispatch]
	)

	const handleBlur = useCallback(
		(event: React.FocusEvent<HTMLInputElement>) => {
			if (
				!event.relatedTarget ||
				!(event.relatedTarget instanceof HTMLElement) ||
				(inputRef.current && !getAllAncestors(event.relatedTarget).includes(inputRef.current))
			) {
				doCommit()
			}
		},
		[doCommit]
	)

	const handleAddSegment = useCallback(() => {
		dispatch({
			type: 'insert',
		})
	}, [dispatch])

	useLayoutEffect(() => {
		if (!inputRef.current) return
		if (inputState.selectIndex === null) return

		const inputToFocus = inputRef.current.querySelector(
			`.input-breadcrumbtext-input[data-index="${inputState.selectIndex}"]`
		)

		if (!inputToFocus || !(inputToFocus instanceof HTMLInputElement)) return

		inputToFocus.focus()

		if (inputState.selectIndexPosition === null) return
		if (inputState.selectIndexPosition === 'end') {
			inputToFocus.selectionStart = inputToFocus.value.length
			inputToFocus.selectionEnd = inputToFocus.selectionStart
		} else if (inputState.selectIndexPosition === 'begin') {
			inputToFocus.selectionStart = 0
			inputToFocus.selectionEnd = 0
		}
	}, [inputState.selectIndex, inputState.selectIndexPosition])

	return (
		<div className="input-breadcrumbtext" ref={inputRef} tabIndex={0} onBlur={handleBlur}>
			{volatileValue.map((value, index, array) => (
				<React.Fragment key={`${index}`}>
					<div className="input-breadcrumbtext-sizer" data-value={value ?? ''}>
						<Form.Control
							type="text"
							className={ClassNames(
								classNames,
								inputState.editingValue !== null && modifiedClassName,
								'input-breadcrumbtext-input',
								{
									'is-invalid': value.trim() === '' && index < array.length - 1,
								}
							)}
							value={value}
							data-index={`${index}`}
							onKeyDown={handleKeyDown}
							onBlur={handleSegmentBlur}
							onChange={handleSegmentValueChange}
							disabled={disabled}
						/>
					</div>
					<Button data-index={`${index}`} variant="outline-secondary" onClick={handleSegmentDelete} disabled={disabled}>
						<FontAwesomeIcon icon={faXmark} />
					</Button>
				</React.Fragment>
			))}
			<Button onClick={handleAddSegment} variant="outline-secondary" title={t('Add')} disabled={disabled}>
				<FontAwesomeIcon icon={faPlus} />
			</Button>
		</div>
	)
}

interface ICombinedMultiLineTextInputControlProps extends Omit<
	IBreadCrumbTextInputControlProps,
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

	return <BreadCrumbTextInput {...props} value={valueArray} handleUpdate={handleUpdateArray} />
}
