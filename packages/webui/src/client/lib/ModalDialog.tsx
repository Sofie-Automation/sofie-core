import React, { useLayoutEffect, useRef } from 'react'
import * as CoreIcons from '@nrk/core-icons/jsx'
import Escape from './Escape'
// @ts-expect-error type linking issue
import FocusBounder from 'react-focus-bounder'
import { useTranslation } from 'react-i18next'

import ClassNames from 'classnames'
import { motion } from 'motion/react'
import { logger } from './logging'
import * as _ from 'underscore'
import { withTranslation } from 'react-i18next'
import { Translated } from './ReactMeteorData/ReactMeteorData'
import { EditAttribute, EditAttributeType, IEditAttributeBaseProps } from './EditAttribute'
import { Settings } from '../lib/Settings'

interface IModalDialogAttributes {
	show?: boolean
	title: string
	secondaryText?: string
	acceptText: string
	onAccept?: (e: SomeEvent, inputResult: ModalInputResult) => void
	onSecondary?: (e: SomeEvent, inputResult: ModalInputResult) => void
	onDiscard?: (e: SomeEvent, inputResult: ModalInputResult) => void
	inputs?: { [attribute: string]: ModalInput }
	warning?: boolean
	actions?: ModalAction[]
	className?: string
	discardAsPrimary?: boolean
}
interface ModalInput {
	type: EditAttributeType
	label?: string
	options?: any
	text?: string
	defaultValue?: any
}
interface ModalAction {
	label: string
	on: OnAction
	classNames?: string
}
type OnAction = (e: SomeEvent, inputResult: ModalInputResult) => void
export type ModalInputResult = { [attribute: string]: any }
export type SomeEvent = Event | React.SyntheticEvent<object>
export function ModalDialog({
	show,
	className,
	warning,
	acceptText,
	title,
	actions,
	children,
	inputs,
	onAccept,
	onDiscard,
	onSecondary,
	secondaryText,
	discardAsPrimary,
}: React.PropsWithChildren<IModalDialogAttributes>): JSX.Element | null {
	const { t } = useTranslation()
	const inputResult = useRef<ModalInputResult>(
		inputs ? Object.entries<ModalInput>(inputs).map(([key, value]) => [key, value.defaultValue]) : {}
	)

	function preventClickOnEnter(e: React.KeyboardEvent) {
		if (!isAcceptKey(e.code)) return
		e.preventDefault()
		e.stopPropagation()
	}

	function handleAccept(e: SomeEvent) {
		onAccept?.(e, inputResult.current)
	}

	function handleDiscard(e: SomeEvent) {
		if (onDiscard) {
			onDiscard(e, inputResult.current)
			return
		}
		handleSecondary(e)
	}

	function handleSecondary(e: SomeEvent) {
		onSecondary?.(e, inputResult.current)
	}

	function handleAction(e: SomeEvent, callback: OnAction) {
		callback(e, inputResult.current)
	}

	function updateInput(editProps: IEditAttributeBaseProps, newValue: any) {
		inputResult.current[editProps.attribute || ''] = newValue
	}

	function emulateClick(e: React.KeyboardEvent<HTMLButtonElement>) {
		if (!isAcceptKey(e.code)) return
		e.preventDefault()
		e.stopPropagation()
		e.currentTarget.click()
	}

	function onDialogKeyDown(e: React.KeyboardEvent<HTMLDialogElement>) {
		if (!(e.target instanceof HTMLDialogElement)) return
		if (!isAcceptKey(e.code) && !isDismissKey(e.code)) return

		e.preventDefault()
		e.stopPropagation()
	}

	function onDialogKeyUp(e: React.KeyboardEvent<HTMLDialogElement>) {
		if (!(e.target instanceof HTMLDialogElement)) return
		if (!isAcceptKey(e.code) && !isDismissKey(e.code)) return
		e.preventDefault()
		e.stopPropagation()

		if (isAcceptKey(e.code)) {
			discardAsPrimary ? handleDiscard(e) : handleAccept(e)
		} else if (isDismissKey(e.code)) {
			handleDiscard(e)
		}
	}

	useLayoutEffect(() => {
		if (!show) return

		const timeout = setTimeout(() => {
			const el = document.querySelector<HTMLDialogElement>('dialog')
			if (!el) return

			el.focus()
		}, 251)

		return () => {
			clearTimeout(timeout)
		}
	}, [show])

	if (!show) return null

	return (
		<Escape to="viewport">
			<motion.div
				className="glass-pane"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ ease: 'easeOut', duration: 0.25 }}
			>
				<FocusBounder>
					<div className="glass-pane-content">
						<motion.dialog
							open={true}
							className={'border-box overlay-m ' + (className || '')}
							role="alertdialog"
							onKeyUp={onDialogKeyUp}
							onKeyDown={onDialogKeyDown}
							initial={{ translateY: 100, opacity: 0 }}
							animate={{ translateY: 0, opacity: 1 }}
							transition={{ type: 'spring', bounce: 0.25, duration: 0.25 }}
						>
							<div className={'flex-row ' + (warning ? 'warn' : 'info') + ' vertical-align-stretch tight-s'}>
								<div className="flex-col c12">
									<h2>{title}</h2>
								</div>
								<div className="flex-col horizontal-align-right vertical-align-middle">
									<p>
										<button
											className="action-btn"
											onClick={handleDiscard}
											onKeyDown={preventClickOnEnter}
											onKeyUp={emulateClick}
											aria-label={t('Dismiss')}
										>
											<CoreIcons.NrkClose />
										</button>
									</p>
								</div>
							</div>
							<div className="title-box-content">{children}</div>
							{inputs ? (
								<div className="title-box-inputs">
									{_.map(inputs, (input: ModalInput, attribute: string) => {
										return (
											<div className="title-box-input" key={attribute}>
												{input.text}
												<EditAttribute
													type={input.type}
													label={input.label}
													options={input.options}
													overrideDisplayValue={input.defaultValue}
													attribute={attribute}
													updateFunction={updateInput}
												/>
											</div>
										)
									})}
								</div>
							) : null}
							<div
								className={ClassNames(
									'mod',
									{
										alright: !secondaryText,
									},
									'modal-dialog-actions'
								)}
							>
								{secondaryText && (
									<button
										className={ClassNames('btn', discardAsPrimary ? 'btn-primary' : 'btn-secondary', 'discard-btn', {
											'btn-warn': discardAsPrimary && warning,
										})}
										autoFocus={discardAsPrimary}
										onClick={handleSecondary}
										onKeyDown={preventClickOnEnter}
										onKeyUp={emulateClick}
									>
										{secondaryText}
									</button>
								)}
								{_.compact(
									_.map(actions || [], (action: ModalAction, i) => {
										if (!action) return null
										return (
											<button
												key={i}
												className={ClassNames(
													'btn right mrs',
													{
														'btn-secondary': !(action.classNames || '').match(/btn-/),
													},
													action.classNames
												)}
												onClick={(e) => handleAction(e, action.on)}
												onKeyDown={preventClickOnEnter}
												onKeyUp={emulateClick}
											>
												{action.label}
											</button>
										)
									})
								)}
								<button
									className={ClassNames('btn', !discardAsPrimary ? 'btn-primary' : 'btn-secondary', {
										right: secondaryText !== undefined,
										'btn-warn': !discardAsPrimary && warning,
									})}
									autoFocus={!discardAsPrimary}
									onClick={handleAccept}
									onKeyDown={preventClickOnEnter}
									onKeyUp={emulateClick}
								>
									{acceptText}
								</button>
							</div>
						</motion.dialog>
					</div>
				</FocusBounder>
			</motion.div>
		</Escape>
	)
}

export interface ModalDialogQueueItem {
	/** The title of the dialog box  */
	title: string
	/** The message / body of the dialog box */
	message: string | JSX.Element | Array<JSX.Element>
	/** Label of the Yes/Accept button */
	yes?: string
	/** Label of the NO/Cancel button */
	no?: string
	/** Set to true if there's only one option/button */
	acceptOnly?: boolean
	/** Callback when user clicks Yes/Accept */
	onAccept: (e: SomeEvent, inputResult: ModalInputResult) => void
	/** Callback when user clicks No/Cancel */
	onDiscard?: (e: SomeEvent, inputResult: ModalInputResult) => void
	/** Callback when user does secondary action (for example hits escape) */
	onSecondary?: (e: SomeEvent, inputResult: ModalInputResult) => void
	/** Customomize input fields */
	inputs?: { [attribute: string]: ModalInput }
	actions?: ModalAction[]
	/** Is a critical decition/information */
	warning?: boolean
	/** Discard as primary */
	discardAsPrimary?: boolean
}
interface IModalDialogGlobalContainerProps {}
interface IModalDialogGlobalContainerState {
	queue: Array<ModalDialogQueueItem>
}

class ModalDialogGlobalContainer0 extends React.Component<
	Translated<IModalDialogGlobalContainerProps>,
	IModalDialogGlobalContainerState
> {
	constructor(props: Translated<IModalDialogGlobalContainerProps>) {
		super(props)
		if (modalDialogGlobalContainerSingleton) {
			logger.warn('modalDialogGlobalContainerSingleton called more than once!')
		}
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		modalDialogGlobalContainerSingleton = this
		this.state = {
			queue: [],
		}
	}
	public addQueue(q: ModalDialogQueueItem) {
		const queue = this.state.queue
		queue.push(q)
		this.setState({
			queue,
		})
	}
	public queueHasItems(): boolean {
		return this.state.queue.length > 0
	}
	onAccept = (e: SomeEvent, inputResult: ModalInputResult) => {
		const queue = this.state.queue
		const onQueue = queue.pop()
		if (onQueue) {
			this.setState({ queue })
			onQueue.onAccept(e, inputResult)
		}
	}
	onDiscard = (e: SomeEvent, inputResult: ModalInputResult) => {
		const queue = this.state.queue
		const onQueue = queue.pop()
		if (onQueue) {
			this.setState({ queue })
			if (onQueue.onDiscard) {
				onQueue.onDiscard(e, inputResult)
			}
		}
	}
	onSecondary = (e: SomeEvent, inputResult: ModalInputResult) => {
		const queue = this.state.queue
		const onQueue = queue.pop()
		if (onQueue) {
			this.setState({ queue })
			if (onQueue.onSecondary) {
				onQueue.onSecondary(e, inputResult)
			}
		}
	}
	onAction = (e: SomeEvent, inputResult: ModalInputResult, on: OnAction) => {
		const queue = this.state.queue
		const onQueue = queue.pop()
		if (onQueue) {
			this.setState({ queue })
			on(e, inputResult)
		}
	}
	renderString = (str: string) => {
		const lines = (str || '').split('\n')

		return _.map(lines, (line: string, i) => {
			return <p key={i}>{line.trim()}</p>
		})
	}
	render(): JSX.Element | null {
		const { t } = this.props
		const onQueue = _.first(this.state.queue)

		if (onQueue) {
			const actions: ModalAction[] = _.map(onQueue.actions || [], (action: ModalAction) => {
				return {
					...action,
					on: (e: SomeEvent, inputResult: ModalInputResult) => this.onAction(e, inputResult, action.on),
				}
			})
			return (
				<ModalDialog
					key={this.state.queue.length}
					title={onQueue.title}
					acceptText={onQueue.yes || t('Yes')}
					secondaryText={onQueue.no || (!onQueue.acceptOnly ? t('No') : undefined)}
					onAccept={this.onAccept}
					onDiscard={this.onDiscard}
					onSecondary={this.onSecondary}
					inputs={onQueue.inputs}
					actions={actions}
					show={true}
					warning={onQueue.warning}
					discardAsPrimary={onQueue.discardAsPrimary}
				>
					{_.isString(onQueue.message) ? this.renderString(onQueue.message) : onQueue.message}
				</ModalDialog>
			)
		} else return null
	}
}
export const ModalDialogGlobalContainer = withTranslation()(ModalDialogGlobalContainer0)
let modalDialogGlobalContainerSingleton: ModalDialogGlobalContainer0
/**
 * Display a ModalDialog, callback on user input
 * @param q ModalDialogQueueItem
 * Example:
 * 	doModalDialog({
 * 		title: t('Order 66?'),
 * 		message: t('Do you want to do this?'),
 * 		onAccept: (event: any) => {
 * 		// Execute order 66
 * 		},
 * 	})
 */
export function doModalDialog(q: ModalDialogQueueItem): void {
	if (modalDialogGlobalContainerSingleton) {
		modalDialogGlobalContainerSingleton.addQueue(q)
	} else {
		logger.error('modalDialogGlobalContainerSingleton not set!')
	}
}
/**
 * Return true if there's any modal currently showing
 */
export function isModalShowing(): boolean {
	if (modalDialogGlobalContainerSingleton) {
		return modalDialogGlobalContainerSingleton.queueHasItems()
	}
	return false
}

function isAcceptKey(code: string): boolean {
	const acceptCodes = Settings.confirmKeyCode === 'AnyEnter' ? ['NumpadEnter', 'Enter'] : ['Enter']
	if (acceptCodes.includes(code)) return true

	return false
}

function isDismissKey(code: string): boolean {
	if (code === 'Escape') return true

	return false
}
