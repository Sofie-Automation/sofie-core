import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { TFunction } from 'i18next'
import { IRundownPlaylistFilterLink } from '@sofie-automation/blueprints-integration'
import { assertNever } from '../../../../../../lib/tempLib.js'
import classNames from 'classnames'

interface IProps {
	link: IRundownPlaylistFilterLink
	final?: boolean
}

function fieldToLabel(t: TFunction, field: IRundownPlaylistFilterLink['field']): string {
	switch (field) {
		case 'activationId':
			return t('Now active rundown')
		case 'name':
			return t('Name')
		case 'studioId':
			return t('Studio')
		default:
			assertNever(field)
			return field
	}
}

export const RundownPlaylistFilter: React.FC<IProps> = function RundownPlaylistFilter({ link, final }: IProps) {
	const { t } = useTranslation()

	return (
		<dl
			className={classNames('triggered-action-entry__action__filter', {
				final: final,
			})}
		>
			<dt>{fieldToLabel(t, link.field)}</dt>
			<dd>{link.value}</dd>
		</dl>
	)
}
