import React, { useEffect, useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IGUIContextFilterLink } from '@sofie-automation/blueprints-integration'
import classNames from 'classnames'
import { usePopper } from 'react-popper'
import { sameWidth } from '../../../../../../lib/popperUtils.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAngleRight, faCheck, faTrash } from '@fortawesome/free-solid-svg-icons'
import { catchError } from '../../../../../../lib/lib.js'
import Button from 'react-bootstrap/Button'

interface IProps {
	index: number
	link: IGUIContextFilterLink
	final?: boolean
	opened: boolean
	readonly?: boolean
	onClose: (index: number) => void
	onFocus: (index: number) => void
	onInsertNext: (index: number) => void
	onRemove: (index: number) => void
}

export const ViewFilter: React.FC<IProps> = function ViewFilter({
	index,
	link,
	readonly,
	final,
	opened,
	onClose,
	onFocus,
	onInsertNext,
	onRemove,
}: IProps) {
	const { t } = useTranslation()
	const [referenceElement, setReferenceElement] = useState<HTMLDListElement | null>(null)
	const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
	const { styles, attributes, update } = usePopper(referenceElement, popperElement, {
		modifiers: [
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
				!composedPath.includes(popperElement) &&
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
		update?.().catch(catchError('ViewFilter update'))
	}, [link])

	return (
		<>
			<dl
				className={classNames('triggered-action-entry__action__filter', {
					final: final,
					focused: opened,
					clickable: !readonly,
				})}
				ref={setReferenceElement}
				onClick={() => onFocus(index)}
				tabIndex={0}
				role="button"
			>
				<dt>{t('View')}</dt>
			</dl>
			{opened ? (
				<div
					className="expco expco-expanded expco-popper  expco-popper-rounded triggered-action-entry__action__filter-editor"
					ref={setPopperElement}
					style={styles.popper}
					{...attributes.popper}
				>
					<p className="m-0">{t('Executes within the currently open Rundown, requires a Client-side trigger.')}</p>

					<div className="grid-buttons-right">
						<div>
							<Button variant="outline-secondary" size="sm" onClick={() => onRemove(index)}>
								<FontAwesomeIcon icon={faTrash} />
							</Button>
						</div>
						<div>
							{!final ? (
								<Button variant="primary" size="sm" onClick={() => onInsertNext(index)}>
									<FontAwesomeIcon icon={faAngleRight} />
								</Button>
							) : (
								<Button variant="primary" size="sm" onClick={() => onClose(index)}>
									<FontAwesomeIcon icon={faCheck} />
								</Button>
							)}
						</div>
					</div>
				</div>
			) : null}
		</>
	)
}
