import React, { useEffect, useLayoutEffect, useState } from 'react'
import { ClientActions, PlayoutActions, SomeAction } from '@sofie-automation/blueprints-integration'
import { useTranslation } from 'react-i18next'
import { TFunction } from 'react-i18next'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { sameWidth } from '../../../../../../lib/popperUtils.js'
import { usePopper } from 'react-popper'
import classNames from 'classnames'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAngleRight, faTrash } from '@fortawesome/free-solid-svg-icons'
import { AdLibActionEditor } from './actionEditors/AdLibActionEditor.js'
import { DeviceActions } from '@sofie-automation/shared-lib/dist/core/model/ShowStyle'
import { catchError } from '../../../../../../lib/lib.js'
import { preventOverflow } from '@popperjs/core'
import { ToggleSwitchControl } from '../../../../../../lib/Components/ToggleSwitch.js'
import { DropdownInputControl, DropdownInputOption } from '../../../../../../lib/Components/DropdownInput.js'
import { IntInputControl } from '../../../../../../lib/Components/IntInput.js'
import { SwitchRouteSetEditor } from './actionEditors/SwitchRouteSetEditor.js'
import Button from 'react-bootstrap/esm/Button'

interface IProps {
	action: SomeAction
	opened?: boolean
	onFocus?: () => void
	onChange: (newVal: SomeAction) => void
	onRemove: () => void
	onClose?: () => void
	onSetFilter?: () => void
}

function getArguments(t: TFunction, action: SomeAction): string[] {
	const result: string[] = []
	switch (action.action) {
		case PlayoutActions.activateRundownPlaylist:
			if (action.force) {
				result.push(t('Force'))
			}
			if (action.rehearsal) {
				result.push(t('Rehearsal'))
			}
			break
		case PlayoutActions.adlib:
			if (action.arguments) {
				result.push(t('Mode: {{triggerMode}}', { triggerMode: action.arguments.triggerMode }))
			}
			break
		case PlayoutActions.createSnapshotForDebug:
			break
		case PlayoutActions.deactivateRundownPlaylist:
			break
		case PlayoutActions.activateAdlibTestingMode:
			break
		case PlayoutActions.disableNextPiece:
			if (action.undo) {
				result.push(t('Undo'))
			}
			break
		case PlayoutActions.hold:
			if (action.undo) {
				result.push(t('Undo'))
			}
			break
		case PlayoutActions.moveNext:
			if (action.segments) {
				result.push(t('Segments: {{delta}}', { delta: (action.segments > 0 ? '+' : '') + action.segments }))
			}
			if (action.parts) {
				result.push(t('Parts: {{delta}}', { delta: (action.parts > 0 ? '+' : '') + action.parts }))
			}
			if (action.ignoreQuickLoop) {
				result.push(t('Ignore QuickLoop'))
			}
			break
		case PlayoutActions.reloadRundownPlaylistData:
			break
		case PlayoutActions.resetRundownPlaylist:
			break
		case PlayoutActions.take:
			break
		case PlayoutActions.resyncRundownPlaylist:
			break
		case PlayoutActions.switchRouteSet:
			result.push(t('State "{{state}}"', { state: action.state }))
			break
		case ClientActions.shelf:
			if (action.state === true) {
				result.push(t('Open'))
			} else if (action.state === false) {
				result.push(t('Close'))
			} else if (action.state === 'toggle') {
				result.push(t('Toggle'))
			} else {
				assertNever(action.state)
			}
			break
		case ClientActions.editMode:
			if (action.state === true) {
				result.push(t('Enable'))
			} else if (action.state === false) {
				result.push(t('Disable'))
			} else if (action.state === 'toggle') {
				result.push(t('Toggle'))
			} else {
				assertNever(action.state)
			}
			break
		case ClientActions.goToOnAirLine:
			break
		case ClientActions.rewindSegments:
			break
		case ClientActions.showEntireCurrentSegment:
			if (action.on === true) {
				result.push(t('On'))
			} else {
				result.push(t('Off'))
			}
			break
		case ClientActions.miniShelfQueueAdLib:
			result.push(t('Forward: {{forward}}', { forward: action.forward }))
			break
		case DeviceActions.modifyShiftRegister:
			result.push(`${action.register ?? '?'}: ${action.operation ?? '?'}${action.value ?? '?'}`)
			break
		default:
			assertNever(action)
			return action
	}
	return result
}

function hasArguments(action: SomeAction): boolean {
	switch (action.action) {
		case PlayoutActions.activateRundownPlaylist:
			return action.force || action.rehearsal
		case PlayoutActions.adlib:
			return !!action.arguments
		case PlayoutActions.createSnapshotForDebug:
			return false
		case PlayoutActions.deactivateRundownPlaylist:
			return false
		case PlayoutActions.activateAdlibTestingMode:
			return false
		case PlayoutActions.disableNextPiece:
			return !!action.undo
		case PlayoutActions.hold:
			return !!action.undo
		case PlayoutActions.moveNext:
			return !!(action.parts || action.segments)
		case PlayoutActions.switchRouteSet:
			return !!action.routeSetId
		case PlayoutActions.reloadRundownPlaylistData:
			return false
		case PlayoutActions.resetRundownPlaylist:
			return false
		case PlayoutActions.take:
			return false
		case PlayoutActions.resyncRundownPlaylist:
			return false
		case ClientActions.shelf:
			return true
		case ClientActions.editMode:
			return true
		case ClientActions.goToOnAirLine:
			return false
		case ClientActions.rewindSegments:
			return false
		case ClientActions.showEntireCurrentSegment:
			return true
		case ClientActions.miniShelfQueueAdLib:
			return true
		case DeviceActions.modifyShiftRegister:
			return true
		default:
			assertNever(action)
			return action
	}
}

function actionToLabel(t: TFunction, action: SomeAction['action']): string {
	switch (action) {
		case PlayoutActions.activateRundownPlaylist:
			return t('Activate Rundown')
		case PlayoutActions.adlib:
			return t('Ad-Lib')
		case PlayoutActions.createSnapshotForDebug:
			return t('Store Snapshot')
		case PlayoutActions.deactivateRundownPlaylist:
			return t('Deactivate Rundown')
		case PlayoutActions.activateAdlibTestingMode:
			return t('AdLib Testing')
		case PlayoutActions.disableNextPiece:
			return t('Disable next Piece')
		case PlayoutActions.hold:
			return t('Hold')
		case PlayoutActions.moveNext:
			return t('Move Next')
		case PlayoutActions.reloadRundownPlaylistData:
			return t('Reload NRCS Data')
		case PlayoutActions.resetRundownPlaylist:
			return t('Reset Rundown')
		case PlayoutActions.take:
			return t('Take')
		case PlayoutActions.resyncRundownPlaylist:
			return t('Resync with NRCS')
		case PlayoutActions.switchRouteSet:
			return t('Switch Route Set')
		case ClientActions.shelf:
			return t('Shelf')
		case ClientActions.editMode:
			return t('Edit Mode')
		case ClientActions.rewindSegments:
			return t('Rewind Segments to start')
		case ClientActions.goToOnAirLine:
			return t('Go to On Air line')
		case ClientActions.showEntireCurrentSegment:
			return t('Show entire On Air Segment')
		case ClientActions.miniShelfQueueAdLib:
			return t('Queue AdLib from Minishelf')
		case DeviceActions.modifyShiftRegister:
			return t('Modify Shift register')
		default:
			assertNever(action)
			return action
	}
}

function getAvailableActions(t: TFunction): DropdownInputOption<string>[] {
	const actionEnums = [PlayoutActions, ClientActions, DeviceActions]

	const allOptions = actionEnums.flatMap((enumList) => Object.values<any>(enumList))

	return allOptions.map((key, i) => ({ value: key, name: actionToLabel(t, key), i }))
}

function getActionParametersEditor(
	t: TFunction,
	action: SomeAction,
	onChange: (newVal: Partial<typeof action>) => void
): React.ReactElement | null {
	switch (action.action) {
		case PlayoutActions.activateRundownPlaylist:
			return (
				<div className="mt-2">
					<ToggleSwitchControl
						classNames="mb-2"
						value={action.rehearsal}
						label={t('Rehearsal')}
						handleUpdate={(newVal) => {
							onChange({
								...action,
								rehearsal: newVal,
							})
						}}
					/>

					<ToggleSwitchControl
						classNames="mb-2"
						value={!!action.force}
						label={t('Force (deactivate others)')}
						handleUpdate={(newVal) => {
							onChange({
								...action,
								force: newVal,
							})
						}}
					/>
				</div>
			)
		case PlayoutActions.adlib:
			return <AdLibActionEditor action={action} onChange={onChange} />
		case PlayoutActions.createSnapshotForDebug:
			return null
		case PlayoutActions.deactivateRundownPlaylist:
			return null
		case PlayoutActions.activateAdlibTestingMode:
			return null
		case PlayoutActions.switchRouteSet:
			return <SwitchRouteSetEditor action={action} onChange={onChange} />
		case PlayoutActions.disableNextPiece:
			return (
				<div className="mt-2">
					<ToggleSwitchControl
						classNames="mb-2"
						value={!!action.undo}
						label={t('Undo')}
						handleUpdate={(newVal) => {
							onChange({
								...action,
								undo: newVal,
							})
						}}
					/>
				</div>
			)
		case PlayoutActions.hold:
			return (
				<div className="mt-2">
					<ToggleSwitchControl
						classNames="mb-2"
						value={!!action.undo}
						label={t('Undo')}
						handleUpdate={(newVal) => {
							onChange({
								...action,
								undo: newVal,
							})
						}}
					/>
				</div>
			)
		case PlayoutActions.moveNext:
			return (
				<div className="mt-2">
					<label className="block">{t('Move Segments')}</label>
					<IntInputControl
						classNames="mb-2"
						value={action.segments}
						placeholder={t('By Segments')}
						handleUpdate={(newVal) =>
							onChange({
								...action,
								segments: newVal,
							})
						}
					/>
					<label className="block">{t('Move Parts')}</label>
					<IntInputControl
						classNames="mb-2"
						value={action.parts}
						placeholder={t('By Parts')}
						handleUpdate={(newVal) =>
							onChange({
								...action,
								parts: newVal,
							})
						}
					/>

					<ToggleSwitchControl
						classNames="mb-2"
						value={!!action.ignoreQuickLoop}
						label={t('Ignore QuickLoop')}
						handleUpdate={(newVal) => {
							onChange({
								...action,
								ignoreQuickLoop: newVal,
							})
						}}
					/>
				</div>
			)
		case PlayoutActions.reloadRundownPlaylistData:
			return null
		case PlayoutActions.resetRundownPlaylist:
			return null
		case PlayoutActions.take:
			return null
		case PlayoutActions.resyncRundownPlaylist:
			return null
		case ClientActions.shelf:
			return (
				<div className="mt-2">
					<label className="block">{t('State')}</label>
					<DropdownInputControl<typeof action.state>
						classNames="mb-2"
						value={action.state}
						// placholder={t('State')}
						options={[
							{
								name: t('Open'),
								value: true,
								i: 0,
							},
							{
								name: t('Close'),
								value: false,
								i: 1,
							},
							{
								name: t('Toggle'),
								value: 'toggle',
								i: 2,
							},
						]}
						handleUpdate={(newVal) => {
							onChange({
								...action,
								state: newVal,
							})
						}}
					/>
				</div>
			)
		case ClientActions.editMode:
			return (
				<div className="mts">
					<label className="block">{t('State')}</label>
					<DropdownInputControl<typeof action.state>
						classNames="input text-input input-m"
						value={action.state}
						// placholder={t('State')}
						options={[
							{
								name: t('Enable'),
								value: true,
								i: 0,
							},
							{
								name: t('Disable'),
								value: false,
								i: 1,
							},
							{
								name: t('Toggle'),
								value: 'toggle',
								i: 2,
							},
						]}
						handleUpdate={(newVal) => {
							onChange({
								...action,
								state: newVal,
							})
						}}
					/>
				</div>
			)
		case ClientActions.goToOnAirLine:
			return null
		case ClientActions.rewindSegments:
			return null
		case ClientActions.showEntireCurrentSegment:
			return (
				<div className="mt-2">
					<ToggleSwitchControl
						classNames="mb-2"
						value={!!action.on}
						label={t('On')}
						handleUpdate={(newVal) => {
							onChange({
								...action,
								on: newVal,
							})
						}}
					/>
				</div>
			)
		case ClientActions.miniShelfQueueAdLib:
			return (
				<div className="mt-2">
					<ToggleSwitchControl
						classNames="mb-2"
						value={!!action.forward}
						label={t('Forward')}
						handleUpdate={(newVal) => {
							onChange({
								...action,
								forward: newVal,
							})
						}}
					/>
				</div>
			)
		case DeviceActions.modifyShiftRegister:
			return (
				<div className="mt-2">
					<label className="block">{t('Register ID')}</label>
					<IntInputControl
						classNames="mb-2"
						value={action.register}
						handleUpdate={(newVal) =>
							onChange({
								...action,
								register: Math.max(0, Number(newVal)),
							})
						}
					/>

					<label className="block">{t('Operation')}</label>
					<DropdownInputControl<typeof action.operation>
						classNames="mb-2"
						value={action.operation}
						options={[
							{
								name: t('Set'),
								value: '=',
								i: 0,
							},
							{
								name: t('Add'),
								value: '+',
								i: 1,
							},
							{
								name: t('Subtract'),
								value: '-',
								i: 2,
							},
						]}
						handleUpdate={(newVal) => {
							onChange({
								...action,
								operation: newVal,
							})
						}}
					/>

					<label className="block">{t('Value')}</label>
					<IntInputControl
						classNames="mb-2"
						value={action.value}
						handleUpdate={(newVal) =>
							onChange({
								...action,
								value: newVal,
							})
						}
					/>
					<label className="block">{t('Minimum register limit')}</label>
					<IntInputControl
						classNames="mb-2"
						value={action.limitMin}
						handleUpdate={(newVal) =>
							onChange({
								...action,
								limitMin: newVal,
							})
						}
					/>
					<label className="block">{t('Maximum register limit')}</label>
					<IntInputControl
						classNames="mb-2"
						value={action.limitMax}
						handleUpdate={(newVal) =>
							onChange({
								...action,
								limitMax: newVal,
							})
						}
					/>
				</div>
			)
		default:
			assertNever(action)
			return action
	}
}

export const ActionSelector = function ActionSelector({
	action,
	opened,
	onFocus,
	onClose,
	onRemove,
	onSetFilter,
	onChange,
}: IProps): JSX.Element {
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

	useEffect(() => {
		function closeHandler(e: MouseEvent) {
			const composedPath = e.composedPath()
			if (
				popperElement &&
				referenceElement &&
				!composedPath.includes(popperElement) &&
				!composedPath.includes(referenceElement)
			) {
				onClose?.()
			}
		}

		if (opened) {
			document.body.addEventListener('click', closeHandler)
		}

		return () => {
			document.body.removeEventListener('click', closeHandler)
		}
	}, [popperElement, referenceElement, opened])

	useLayoutEffect(() => {
		update?.().catch(catchError('ActionSelector update'))
	}, [action])

	const { t } = useTranslation()

	const actionArguments = getArguments(t, action)

	return (
		<>
			<div
				ref={setReferenceElement}
				className={classNames('triggered-action-entry__action__type clickable', {
					focused: opened,
					'has-arguments': hasArguments(action),
				})}
				tabIndex={0}
				role="button"
				onClick={onFocus}
			>
				{actionToLabel(t, action.action)}
				{actionArguments.length > 0 ? <span className="arguments">{actionArguments.join(', ')}</span> : null}
			</div>
			{opened ? (
				<div
					className="expco expco-expanded expco-popper expco-popper-rounded triggered-action-entry__action-editor"
					ref={setPopperElement}
					style={styles.popper}
					{...attributes.popper}
				>
					<DropdownInputControl
						classNames="mb-2"
						value={action.action}
						options={getAvailableActions(t)}
						// placeholder={t('Action')}
						handleUpdate={(newVal) =>
							onChange({
								...action,
								action: newVal as any,
							})
						}
					/>

					{getActionParametersEditor(t, action, (newVal: Partial<typeof action>) => {
						onChange({
							...action,
							// typescript doesn't seem to recognize that if action and newVal are of equal type, they must inherently be compatible
							...(newVal as any),
						})
					})}

					<div className="grid-buttons-right">
						<div>
							<Button variant="outline-secondary" size="sm" onClick={onRemove}>
								<FontAwesomeIcon icon={faTrash} />
							</Button>
						</div>
						<div>
							<Button
								variant="primary"
								size="sm"
								onClick={() => {
									onClose?.()
									onSetFilter?.()
								}}
							>
								<FontAwesomeIcon icon={faAngleRight} />
							</Button>
						</div>
					</div>
				</div>
			) : null}
		</>
	)
}
