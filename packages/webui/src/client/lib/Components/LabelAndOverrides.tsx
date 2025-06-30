import { faQuestionCircle, faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { objectPathGet } from '@sofie-automation/corelib/dist/lib'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ReadonlyDeep } from 'type-fest'
import {
	OverrideOpHelperForItemContents,
	WrappedOverridableItemNormal,
} from '../../ui/Settings/util/OverrideOpHelper.js'
import { DropdownInputOption, findOptionByValue } from './DropdownInput.js'
import { hasOpWithPath } from './util.js'
import Button from 'react-bootstrap/Button'
import classNames from 'classnames'

export interface LabelAndOverridesProps<T extends object, TValue> {
	label: string
	hint?: string
	item: WrappedOverridableItemNormal<T>
	itemKey: keyof ReadonlyDeep<T>
	overrideHelper: OverrideOpHelperForItemContents

	showClearButton?: boolean
	formatDefaultValue?: (value: any) => JSX.Element | string | null

	children: (value: TValue, setValue: (value: TValue) => void) => React.ReactNode
}

export interface LabelActualProps {
	label: string
}

export function LabelAndOverrides<T extends object, TValue = any>({
	children,
	label,
	hint,
	item,
	itemKey,
	overrideHelper,
	showClearButton,
	formatDefaultValue,
}: Readonly<LabelAndOverridesProps<T, TValue>>): JSX.Element {
	const { t } = useTranslation()

	const clearOverride = useCallback(() => {
		overrideHelper().clearItemOverrides(item.id, String(itemKey)).commit()
	}, [overrideHelper, item.id, itemKey])
	const setValue = useCallback(
		(newValue: any) => {
			overrideHelper().setItemValue(item.id, String(itemKey), newValue).commit()
		},
		[overrideHelper, item.id, itemKey]
	)

	const isOverridden = hasOpWithPath(item.overrideOps, item.id, String(itemKey))

	let displayValue: JSX.Element | string | null = '""'
	if (item.defaults) {
		const defaultValue: any = objectPathGet(item.defaults, String(itemKey))
		// Special cases for formatting of the default
		if (formatDefaultValue) {
			displayValue = formatDefaultValue(defaultValue)
		} else if (defaultValue === false) {
			displayValue = 'false'
		} else if (defaultValue === true) {
			displayValue = 'true'
		} else if (!defaultValue) {
			displayValue = ''
		} else if (Array.isArray(defaultValue) || typeof defaultValue === 'object') {
			displayValue = JSON.stringify(defaultValue) || ''
		} else {
			// Display it as a string
			displayValue = `${defaultValue}`
		}
	}

	const value = objectPathGet(item.computed, String(itemKey))

	return (
		<label className="field">
			<LabelActual label={label} />

			<div
				className={classNames('field-content', {
					'checkbox-enable-before': showClearButton,
				})}
			>
				{showClearButton && (
					<Button
						variant="primary"
						className="field-clear"
						onClick={() => setValue(undefined)}
						title={t('Clear value')}
					>
						<FontAwesomeIcon icon={faSync} />
					</Button>
				)}

				{children(value, setValue)}
			</div>

			{item.defaults && (
				<>
					<span className="field-default">
						{displayValue === null ? (
							<FontAwesomeIcon icon={faQuestionCircle} title={`${t('Default')}: null`} />
						) : typeof displayValue === 'object' ? (
							displayValue
						) : (
							<FontAwesomeIcon icon={faQuestionCircle} title={`${t('Default')}: ${displayValue}`} />
						)}
					</span>
					<Button variant="primary" onClick={clearOverride} title="Reset to default" disabled={!isOverridden}>
						<span>{t('Reset')}</span>
						<FontAwesomeIcon icon={faSync} />
					</Button>
				</>
			)}

			{hint && <span className="text-s dimmed field-hint">{hint}</span>}
		</label>
	)
}

export function LabelAndOverridesForCheckbox<T extends object>(
	props: Readonly<Omit<LabelAndOverridesProps<T, boolean>, 'formatDefaultValue'>>
): JSX.Element {
	return <LabelAndOverrides<T, boolean> {...props} />
}

export function LabelAndOverridesForDropdown<T extends object, TValue = any>(
	props: Omit<LabelAndOverridesProps<T, TValue>, 'formatDefaultValue' | 'children'> & {
		options: DropdownInputOption<TValue>[]
		children: (
			value: TValue,
			setValue: (value: TValue) => void,
			options: DropdownInputOption<TValue>[]
		) => React.ReactNode
	}
): JSX.Element {
	const formatSingle = useCallback(
		(value: any) => {
			const matchedOption = findOptionByValue(props.options, value)
			if (matchedOption) {
				return `"${matchedOption.name}"`
			} else {
				return `Value: "${value}"`
			}
		},
		[props.options]
	)
	const formatter = useCallback(
		(defaultValue: any) => {
			if (defaultValue === undefined || defaultValue.length === 0) return '""'

			if (Array.isArray(defaultValue)) {
				return defaultValue.map(formatSingle).join(', ')
			} else {
				return formatSingle(defaultValue)
			}
		},
		[formatSingle]
	)

	return (
		<LabelAndOverrides<T, TValue> {...props} formatDefaultValue={formatter}>
			{(value, setValue) => props.children(value, setValue, props.options)}
		</LabelAndOverrides>
	)
}

function formatDefaultMultilineTextValue(value: any) {
	return JSON.stringify(value) || ''
}

export function LabelAndOverridesForMultiLineText<T extends object>(
	props: Readonly<Omit<LabelAndOverridesProps<T, string[]>, 'formatDefaultValue'>>
): JSX.Element {
	return <LabelAndOverrides<T, string[]> {...props} formatDefaultValue={formatDefaultMultilineTextValue} />
}

export function LabelAndOverridesForInt<T extends object>(
	props: Omit<LabelAndOverridesProps<T, number>, 'formatDefaultValue'> & {
		zeroBased?: boolean
	}
): JSX.Element {
	const formatter = useCallback(
		(defaultValue: any) => {
			if (typeof defaultValue === 'number' && props.zeroBased) {
				return defaultValue + 1
			} else {
				return defaultValue
			}
		},
		[props.zeroBased]
	)

	return <LabelAndOverrides<T, number> {...props} formatDefaultValue={formatter} />
}

export function LabelActual(props: Readonly<LabelActualProps>): JSX.Element {
	return <div className="label-actual">{props.label}</div>
}

export function LabelAndOverridesForBase64Image<T extends object>(
	props: Readonly<Omit<LabelAndOverridesProps<T, string>, 'formatDefaultValue'>>
): JSX.Element {
	const formatter = useCallback((defaultValue: any) => {
		if (defaultValue && defaultValue.startsWith('data:image/')) {
			return <img className="form-image-preview" src={defaultValue} />
		} else {
			return '-'
		}
	}, [])

	return <LabelAndOverrides<T, string> {...props} formatDefaultValue={formatter} />
}

export function LabelAndOverridesForMultiSelect<T extends object, TValue = any>(
	props: Omit<LabelAndOverridesProps<T, TValue>, 'formatDefaultValue' | 'children'> & {
		options: DropdownInputOption<TValue>[]
		children: (
			value: TValue[],
			setValue: (value: TValue[]) => void,
			options: DropdownInputOption<TValue>[]
		) => React.ReactNode
	}
): JSX.Element {
	const formatMultiLine = useCallback(
		(value: any) => {
			const matchedOption = findOptionByValue(props.options, value)
			if (matchedOption) {
				return `"${matchedOption.name}"`
			} else {
				return `Value: "${value}"`
			}
		},
		[props.options]
	)
	const formatter = useCallback(
		(defaultValue: any) => {
			if (defaultValue === undefined || defaultValue.length === 0) return '""'

			if (Array.isArray(defaultValue)) {
				return defaultValue.map(formatMultiLine).join('/n')
			} else {
				return formatMultiLine(defaultValue)
			}
		},
		[formatMultiLine]
	)

	return (
		<LabelAndOverrides<T, TValue[]> {...props} formatDefaultValue={formatter}>
			{(value, setValue) => props.children(value, setValue, props.options)}
		</LabelAndOverrides>
	)
}
