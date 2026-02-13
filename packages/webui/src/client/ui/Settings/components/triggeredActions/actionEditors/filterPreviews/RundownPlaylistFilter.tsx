import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { TFunction } from 'i18next'
import { FilterType, IRundownPlaylistFilterLink } from '@sofie-automation/blueprints-integration'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { EditAttributeType } from '../../../../../../lib/EditAttribute.js'
import { useTracker } from '../../../../../../lib/ReactMeteorData/ReactMeteorData.js'
import { FilterEditor } from './FilterEditor.js'
import { Studios } from '../../../../../../collections/index.js'

interface IProps {
	index: number
	link: IRundownPlaylistFilterLink
	final?: boolean
	readonly?: boolean
	opened: boolean
	onChangeType: (index: number, newType: FilterType) => void
	onChange: (index: number, newVal: IRundownPlaylistFilterLink, oldVal: IRundownPlaylistFilterLink) => void
	onFocus?: (index: number) => void
	onInsertNext?: (index: number) => void
	onRemove?: (index: number) => void
	onClose: (index: number) => void
}

function fieldToType(field: IRundownPlaylistFilterLink['field']): EditAttributeType {
	switch (field) {
		case 'activationId':
			return 'dropdown'
		case 'name':
			return 'text'
		case 'rehearsal':
			return 'dropdown'
		case 'studioId':
			return 'dropdown'
		default:
			assertNever(field)
			return field
	}
}

function fieldToOptions(t: TFunction, field: IRundownPlaylistFilterLink['field']): Record<string, any> {
	switch (field) {
		case 'activationId':
			return {
				[t('Active')]: true,
			}
		case 'name':
			return {}
		case 'rehearsal':
			return {
				[t('In rehearsal')]: true,
				[t('Not in rehearsal')]: false,
			}
		case 'studioId':
			return Studios.find()
				.fetch()
				.map((studio) => ({ name: `${studio.name} (${studio._id})`, value: studio._id }))
		default:
			assertNever(field)
			return field
	}
}

function fieldValueToValueLabel(t: TFunction, link: IRundownPlaylistFilterLink) {
	if (link.value === undefined || (Array.isArray(link.value) && link.value.length === 0)) {
		return ''
	}

	switch (link.field) {
		case 'activationId':
			return link.value === true ? t('Active') : t('Not Active')
		case 'name':
		case 'studioId':
			return String(link.value)
		case 'rehearsal':
			return link.value === true ? t('In rehearsal') : t('Not in rehearsal')
		default:
			assertNever(link)
			//@ts-expect-error fallback
			return String(link.value)
	}
}

function fieldValueMutate(link: IRundownPlaylistFilterLink, newValue: any) {
	switch (link.field) {
		case 'activationId':
		case 'rehearsal':
			return Boolean(newValue)
		case 'name':
		case 'studioId':
			return String(newValue)
		default:
			assertNever(link)
			return String(newValue)
	}
}

function fieldValueToEditorValue(link: IRundownPlaylistFilterLink) {
	if (link.value === undefined || (Array.isArray(link.value) && link.value.length === 0)) {
		return undefined
	}

	switch (link.field) {
		case 'activationId':
		case 'rehearsal':
		case 'name':
		case 'studioId':
			return link.value
		default:
			assertNever(link)
			//@ts-expect-error fallback
			return String(link.value)
	}
}

function getAvailableFields(t: TFunction, fields: IRundownPlaylistFilterLink['field'][]): Record<string, string> {
	const result: Record<string, string> = {}
	fields.forEach((key) => {
		result[fieldToLabel(t, key)] = key
	})

	return result
}

function fieldToLabel(t: TFunction, field: IRundownPlaylistFilterLink['field']): string {
	switch (field) {
		case 'activationId':
			return t('Now Active Rundown')
		case 'name':
			return t('Rundown Name')
		case 'studioId':
			return t('Studio')
		case 'rehearsal':
			return t('Rehearsal State')
		default:
			assertNever(field)
			return t('Rundown filter')
	}
}

export const RundownPlaylistFilter: React.FC<IProps> = function RundownPlaylistFilter({
	index,
	link,
	readonly,
	opened,
	onClose,
	onChange,
	onFocus,
	onInsertNext,
	onRemove,
	onChangeType,
}: IProps) {
	const { t } = useTranslation()

	const fields: IRundownPlaylistFilterLink['field'][] = ['activationId', 'name', 'studioId', 'rehearsal']

	const availableOptions = useTracker<Record<string, any> | string[]>(
		() => {
			return fieldToOptions(t, link.field)
		},
		[link.field],
		fieldToOptions(t, link.field)
	)

	return (
		<FilterEditor
			index={index}
			filterType="rundownPlaylist"
			field={link.field}
			fields={getAvailableFields(t, fields)}
			fieldLabel={fieldToLabel(t, link.field)}
			valueLabel={fieldValueToValueLabel(t, link)}
			value={fieldValueToEditorValue(link)}
			final={false}
			values={availableOptions}
			type={fieldToType(link.field)}
			readonly={readonly}
			opened={opened}
			onChange={(newValue) => {
				onChange(
					index,
					{
						...link,
						value: fieldValueMutate(link, newValue) as any,
					},
					link
				)
			}}
			onChangeField={(newValue) => {
				onChange(
					index,
					{
						...link,
						field: newValue,
						value: '',
					},
					link
				)
			}}
			onFocus={onFocus}
			onClose={onClose}
			onInsertNext={onInsertNext}
			onRemove={onRemove}
			onChangeType={(newType) => onChangeType(index, newType)}
		/>
	)
}
