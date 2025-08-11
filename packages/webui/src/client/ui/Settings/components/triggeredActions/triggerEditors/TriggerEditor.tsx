import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { TFunction } from 'i18next'
import { SomeBlueprintTrigger, TriggerType } from '@sofie-automation/blueprints-integration'
import { DBBlueprintTrigger } from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import { HotkeyTrigger } from './HotkeyTrigger.js'
import { usePopper } from 'react-popper'
import { sameWidth } from '../../../../../lib/popperUtils.js'
import { useTranslation } from 'react-i18next'
import { HotkeyEditor } from './HotkeyEditor.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { isDeviceTrigger, isHotkeyTrigger } from '@sofie-automation/meteor-lib/dist/triggers/triggerTypeSelectors'
import { DeviceTrigger } from './DeviceTrigger.js'
import { DeviceEditor } from './DeviceEditor.js'
import { faCheck, faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
import { DropdownInputControl, DropdownInputOption } from '../../../../../lib/Components/DropdownInput.js'
import { catchError } from '../../../../../lib/lib.js'
import { preventOverflow } from '@popperjs/core'
import Button from 'react-bootstrap/esm/Button'

interface IProps {
	id: string
	trigger: DBBlueprintTrigger
	opened?: boolean
	canReset: boolean
	isDeleted: boolean
	onChangeTrigger: (id: string, newVal: DBBlueprintTrigger) => void
	onResetTrigger: (id: string) => void
	onRemove: (id: string) => void
	onFocus: (id: string) => void
	onClose: (id: string) => void
}

function getTriggerTypes(t: TFunction): DropdownInputOption<TriggerType>[] {
	return [
		{
			name: t('Hotkey'),
			value: TriggerType.hotkey,
			i: 0,
		},
		{
			name: t('Device'),
			value: TriggerType.device,
			i: 1,
		},
	]
}

export const TriggerEditor = function TriggerEditor({
	opened,
	canReset,
	isDeleted,
	trigger,
	id,
	...props
}: IProps): JSX.Element {
	const { t } = useTranslation()
	const [localTrigger, setLocalTrigger] = useState<DBBlueprintTrigger>({ ...trigger })
	const [referenceElement, setReferenceElement] = useState<HTMLDivElement | null>(null)
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

	const onFocus = useCallback(() => props.onFocus(id), [id])
	const onRemove = useCallback(() => props.onRemove(id), [id])
	const onChangeTrigger = useCallback(
		(changeLocalTrigger: DBBlueprintTrigger) => props.onChangeTrigger(id, changeLocalTrigger),
		[id]
	)
	const onResetTrigger = useCallback(() => props.onResetTrigger(id), [id])

	useEffect(() => {
		function closeHandler(e: MouseEvent) {
			const composedPath = e.composedPath()
			if (
				popperElement &&
				referenceElement &&
				!composedPath.includes(popperElement) &&
				!composedPath.includes(referenceElement)
			) {
				props.onClose(id)
			}
		}

		if (opened) {
			document.body.addEventListener('click', closeHandler)
		}

		return () => {
			document.body.removeEventListener('click', closeHandler)
		}
	}, [popperElement, referenceElement, opened, trigger])

	const triggerPreview = isHotkeyTrigger(trigger) ? (
		<HotkeyTrigger
			innerRef={setReferenceElement}
			keys={trigger.keys || ''}
			up={trigger.up || false}
			onClick={onFocus}
			selected={opened}
			deleted={isDeleted}
		/>
	) : isDeviceTrigger(trigger) ? (
		<DeviceTrigger
			innerRef={setReferenceElement}
			deviceId={trigger.deviceId || ''}
			trigger={trigger.triggerId || ''}
			onClick={onFocus}
			selected={opened}
			deleted={isDeleted}
		/>
	) : (
		// @ts-expect-error trigger.type is `never`, but runtime it can be something else
		<div ref={setReferenceElement}>Unknown trigger type: {trigger.type}</div>
	)

	const triggerEditor = isHotkeyTrigger(localTrigger) ? (
		<HotkeyEditor
			trigger={localTrigger}
			onChange={(newVal) => setLocalTrigger(newVal)}
			modified={!isHotkeyTrigger(trigger) || trigger.keys !== localTrigger.keys}
			readonly={isDeleted}
		/>
	) : isDeviceTrigger(localTrigger) ? (
		<DeviceEditor
			trigger={localTrigger}
			onChange={(newVal) => setLocalTrigger(newVal)}
			modified={
				!isDeviceTrigger(trigger) ||
				trigger.deviceId !== localTrigger.deviceId ||
				trigger.triggerId !== localTrigger.triggerId ||
				JSON.stringify(trigger.values) !== JSON.stringify(localTrigger.values)
			}
			readonly={isDeleted}
		/>
	) : null

	useLayoutEffect(() => {
		update?.().catch(catchError('TriggerEditor update'))
	}, [trigger])

	useEffect(() => {
		setLocalTrigger(trigger)
	}, [opened])

	function onChangeType(newValue: string) {
		if (!(newValue in TriggerType)) {
			return
		}

		setLocalTrigger({
			type: newValue as TriggerType,
		} as SomeBlueprintTrigger)
	}

	function onConfirm() {
		onChangeTrigger(localTrigger)
	}

	return (
		<>
			{triggerPreview}
			{opened ? (
				<div
					className="expco expco-expanded expco-popper expco-popper-rounded triggered-action-entry__trigger-editor"
					ref={setPopperElement}
					style={styles.popper}
					{...attributes.popper}
				>
					<DropdownInputControl
						classNames="mb-2"
						value={localTrigger.type}
						options={getTriggerTypes(t)}
						handleUpdate={onChangeType}
						disabled={isDeleted}
					/>

					{triggerEditor}
					<div className="mt-2">
						{isDeleted ? (
							<>
								<Button variant="outline-secondary" size="sm" onClick={onResetTrigger}>
									<FontAwesomeIcon icon={faSync} />
								</Button>
							</>
						) : (
							<div className="grid-buttons-right">
								<div>
									<Button variant="outline-secondary" size="sm" onClick={onRemove}>
										<FontAwesomeIcon icon={faTrash} />
									</Button>
									{canReset && (
										<Button variant="outline-secondary" size="sm" onClick={onResetTrigger}>
											<FontAwesomeIcon icon={faSync} />
										</Button>
									)}
								</div>
								<div>
									<Button variant="primary" size="sm" onClick={onConfirm}>
										<FontAwesomeIcon icon={faCheck} />
									</Button>
								</div>
							</div>
						)}
					</div>
				</div>
			) : null}
		</>
	)
}
