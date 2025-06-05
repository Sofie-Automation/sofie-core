import classNames from 'classnames'
import React, { useState, useEffect, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { SorensenContext } from '../../../../../lib/SorensenContext'
import { codesToKeyLabels } from '../../../../../lib/triggers/codesToKeyLabels'

export const HotkeyTrigger = ({
	keys,
	up,
	innerRef,
	selected,
	deleted,
	onClick,
}: {
	keys: string
	up: boolean
	innerRef?: React.Ref<HTMLDivElement>
	selected?: boolean
	deleted?: boolean
	onClick?: () => void
}): JSX.Element => {
	const [_updatedKeyboardMap, setUpdatedKeyboardMap] = useState(Symbol())
	const Sorensen = useContext(SorensenContext)
	const { t } = useTranslation()

	function handleLayoutChange() {
		setUpdatedKeyboardMap(Symbol())
	}

	useEffect(() => {
		Sorensen?.addEventListener('layoutchange', handleLayoutChange)

		return () => {
			Sorensen?.removeEventListener('layoutchange', handleLayoutChange)
		}
	}, [Sorensen])

	if (Sorensen) {
		keys = codesToKeyLabels(keys, Sorensen)
	}

	return (
		<div
			ref={innerRef}
			className={classNames('triggered-action-entry__hotkey clickable', {
				selected: selected,
				deleted: deleted,
			})}
			onClick={onClick}
			tabIndex={0}
			role="button"
		>
			{keys ? keys : <i className="subtle">{t('Empty')}</i>}
			{up ? '\u00A0↥' : ''}
		</div>
	)
}
