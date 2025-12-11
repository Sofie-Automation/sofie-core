import React from 'react'
import _ from 'underscore'
import { IAdLibFilterLink, IOutputLayer, ISourceLayer, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { useTranslation } from 'react-i18next'
import { TFunction } from 'i18next'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { FilterEditor } from './FilterEditor.js'
import { OutputLayers, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { EditAttributeType } from '../../../../../../lib/EditAttribute.js'
import { useTracker } from '../../../../../../lib/ReactMeteorData/ReactMeteorData.js'
import {
	AdLibActions,
	AdLibPieces,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
} from '../../../../../../collections/index.js'

interface IProps {
	index: number
	link: IAdLibFilterLink
	sourceLayers: SourceLayers | undefined
	outputLayers: OutputLayers | undefined
	readonly?: boolean
	opened: boolean
	onChange: (index: number, newVal: IAdLibFilterLink, oldVal: IAdLibFilterLink) => void
	onFocus?: (index: number) => void
	onInsertNext?: (index: number) => void
	onRemove?: (index: number) => void
	onClose: (index: number) => void
}

function typeOptionsWithLabels(t: TFunction) {
	return {
		[t('Ad-Lib')]: 'adLib',
		[t('Ad-Lib Action')]: 'adLibAction',
		[t('Clear Source Layer')]: 'clear',
		[t('Sticky Piece')]: 'sticky',
	}
}

function fieldToType(field: IAdLibFilterLink['field']): EditAttributeType {
	switch (field) {
		case 'global':
			return 'dropdown'
		case 'label':
			return 'text'
		case 'tag':
			return 'dropdowntext'
		case 'limit':
		case 'pick':
		case 'pickEnd':
			return 'int'
		case 'outputLayerId':
		case 'sourceLayerId':
		case 'sourceLayerType':
			return 'multiselect'
		case 'part':
		case 'segment':
		case 'type':
			return 'dropdown'
		default:
			assertNever(field)
			return field
	}
}

function fieldToLabel(t: TFunction, field: IAdLibFilterLink['field']): string {
	switch (field) {
		case 'global':
			return t('Global AdLibs')
		case 'label':
			return t('Label')
		case 'limit':
			return t('Limit')
		case 'outputLayerId':
			return t('Output Layer')
		case 'part':
			return t('Part')
		case 'pick':
			return t('Pick')
		case 'pickEnd':
			return t('Pick last')
		case 'segment':
			return t('Segment')
		case 'sourceLayerId':
			return t('Source Layer')
		case 'sourceLayerType':
			return t('Source Layer Type')
		case 'tag':
			return t('Tag')
		case 'type':
			return t('Type')
		default:
			assertNever(field)
			return field
	}
}

function fieldToOptions(
	t: TFunction,
	sourceLayers: SourceLayers | undefined,
	outputLayers: OutputLayers | undefined,
	field: IAdLibFilterLink['field']
): Record<string, any> {
	switch (field) {
		case 'global':
			return {
				[t('Not Global')]: false,
				[t('Only Global')]: true,
			}
		case 'label':
		case 'limit':
		case 'pick':
		case 'pickEnd':
		case 'tag':
			return {}
		case 'outputLayerId':
			return outputLayers
				? Object.values<IOutputLayer | undefined>(outputLayers)
						.filter((v): v is IOutputLayer => !!v)
						.map((layer) => ({ name: `${layer.name} (${layer._id})`, value: layer._id }))
				: []
		case 'part':
			return {
				[t('OnAir')]: 'current',
				[t('Next')]: 'next',
			}
		case 'segment':
			return {
				[t('OnAir')]: 'current',
				[t('Next')]: 'next',
			}
		case 'sourceLayerId':
			return sourceLayers
				? Object.values<ISourceLayer | undefined>(sourceLayers)
						.filter((v): v is ISourceLayer => !!v)
						.map((layer) => ({ name: `${layer.name} (${layer._id})`, value: layer._id }))
				: []
		case 'sourceLayerType':
			return _.pick(SourceLayerType, (key) => Number.isInteger(key))
		case 'type':
			return typeOptionsWithLabels(t)
		default:
			assertNever(field)
			return field
	}
}

function fieldValueToValueLabel(
	t: TFunction,
	sourceLayers: SourceLayers | undefined,
	outputLayers: OutputLayers | undefined,
	link: IAdLibFilterLink
) {
	if (link.value === undefined || (Array.isArray(link.value) && link.value.length === 0)) {
		return ''
	}

	switch (link.field) {
		case 'global':
			return link.value === false ? t('Not Global') : link.value === true ? t('Only Global') : ''
		case 'label':
		case 'limit':
		case 'tag':
			return String(link.value)
		case 'pick':
		case 'pickEnd':
			return String(Number(link.value ?? 0) + 1)
		case 'outputLayerId':
			return Array.isArray(link.value)
				? outputLayers
					? link.value.map((outputLayerId) => outputLayers[outputLayerId]?.name ?? outputLayerId).join(', ')
					: link.value.join(', ')
				: link.value
		case 'part':
			return (
				_.invert({
					[t('OnAir')]: 'current',
					[t('Next')]: 'next',
				})[link.value] ?? String(link.value)
			)
		case 'segment':
			return (
				_.invert({
					[t('OnAir')]: 'current',
					[t('Next')]: 'next',
				})[link.value] ?? String(link.value)
			)
		case 'sourceLayerId':
			return Array.isArray(link.value)
				? sourceLayers
					? link.value.map((sourceLayerId) => sourceLayers[sourceLayerId]?.name ?? sourceLayerId).join(', ')
					: link.value.join(', ')
				: link.value
		case 'sourceLayerType':
			return Array.isArray(link.value) ? link.value.map((type) => SourceLayerType[type]).join(', ') : link.value
		case 'type':
			return _.invert(typeOptionsWithLabels(t))[link.value] ?? String(link.value)
		default:
			assertNever(link)
			//@ts-expect-error fallback
			return String(link.value)
	}
}

function fieldValueMutate(link: IAdLibFilterLink, newValue: any) {
	switch (link.field) {
		case 'global':
			return Boolean(newValue)
		case 'label':
		case 'tag':
			return String(newValue).split(/,\s*/)
		case 'limit':
			return Number(newValue)
		case 'pick':
		case 'pickEnd':
			return Number(newValue - 1)
		case 'outputLayerId':
		case 'sourceLayerId':
			return Array.isArray(newValue) ? newValue.map((layerId) => String(layerId)) : [String(newValue)]
		case 'part':
		case 'segment':
			return String(newValue)
		case 'sourceLayerType':
			return Array.isArray(newValue) ? newValue.map((type) => Number(type)) : [Number(newValue)]
		case 'type':
			return String(newValue)
		default:
			assertNever(link)
			return String(newValue)
	}
}

function fieldValueToEditorValue(link: IAdLibFilterLink) {
	if (link.value === undefined || (Array.isArray(link.value) && link.value.length === 0)) {
		return undefined
	}

	switch (link.field) {
		case 'pick':
		case 'pickEnd':
			return Number(link.value + 1)
		case 'label':
		case 'tag':
			return link.value.join(',')
		case 'limit':
			return Number(link.value ?? 0)
		case 'global':
		case 'outputLayerId':
		case 'sourceLayerId':
		case 'part':
		case 'segment':
		case 'sourceLayerType':
		case 'type':
			return link.value
		default:
			assertNever(link)
			//@ts-expect-error fallback
			return String(link.value)
	}
}

function getAvailableFields(t: TFunction, fields: IAdLibFilterLink['field'][]): Record<string, string> {
	const result: Record<string, string> = {}
	fields.forEach((key) => {
		result[fieldToLabel(t, key)] = key
	})

	return result
}

function isLinkFinal(link: IAdLibFilterLink) {
	return link.field === 'pick' || link.field === 'pickEnd'
}

export const AdLibFilter: React.FC<IProps> = function AdLibFilter({
	index,
	link,
	readonly,
	sourceLayers,
	outputLayers,
	opened,
	onClose,
	onChange,
	onFocus,
	onInsertNext,
	onRemove,
}: IProps) {
	const { t } = useTranslation()

	const fields: IAdLibFilterLink['field'][] = [
		'global',
		'label',
		'limit',
		'pick',
		'pickEnd',
		'tag',
		'outputLayerId',
		'part',
		'segment',
		'sourceLayerId',
		'sourceLayerType',
		'type',
	]

	const availableOptions = useTracker<Record<string, any> | string[]>(
		() => {
			// tags are a special case because we need to search the database for available options
			// we should have the data subscribed already
			if (link.field === 'tag') {
				return _.chain([
					...RundownBaselineAdLibActions.find().map((action) => action.display.tags),
					...AdLibActions.find().map((action) => action.display.tags),
					...RundownBaselineAdLibPieces.find().map((piece) => piece.tags),
					...AdLibPieces.find().map((piece) => piece.tags),
				])
					.flatten()
					.compact()
					.uniq()
					.value() as string[]
			} else {
				return fieldToOptions(t, sourceLayers, outputLayers, link.field)
			}
		},
		[link.field],
		fieldToOptions(t, sourceLayers, outputLayers, link.field)
	)

	return (
		<FilterEditor
			index={index}
			field={link.field}
			fields={getAvailableFields(t, fields)}
			fieldLabel={fieldToLabel(t, link.field)}
			valueLabel={fieldValueToValueLabel(t, sourceLayers, outputLayers, link)}
			value={fieldValueToEditorValue(link)}
			final={isLinkFinal(link)}
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
						value: [],
					},
					link
				)
			}}
			onFocus={onFocus}
			onClose={onClose}
			onInsertNext={onInsertNext}
			onRemove={onRemove}
		/>
	)
}
