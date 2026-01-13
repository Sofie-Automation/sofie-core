import * as React from 'react'
import * as CoreIcon from '@nrk/core-icons/jsx'
import ClassNames from 'classnames'
import { motion, AnimatePresence, HTMLMotionProps } from 'motion/react'
import { translateWithTracker, Translated, useTracker } from '../ReactMeteorData/ReactMeteorData.js'
import { NotificationCenter, Notification, NoticeLevel, NotificationAction } from './notifications.js'
import { ContextMenuTrigger, ContextMenu, MenuItem } from '@jstarpl/react-contextmenu'
import { translateMessage, isTranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { CriticalIcon, WarningIcon, CollapseChevrons, InformationIcon } from '../ui/icons/notifications.js'
import update from 'immutability-helper'
import { i18nTranslator } from '../../ui/i18n.js'
import { RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTranslation } from 'react-i18next'
import { PopUpPanel } from '../../ui/RundownView/PopUpPanel.js'
import classNames from 'classnames'

interface IPopUpProps {
	id?: string
	item: Notification
	showDismiss?: boolean
	isHighlighted?: boolean
	onDismiss?: (e: any) => void
	className?: string
	style?: React.CSSProperties
}

/**
 * The component that is used for both elements within the Notification Center as well as the Notification pop-ups as well
 * @class NotificationPopUp
 * @extends React.Component<IPopUpProps>
 */
class NotificationPopUp extends React.Component<IPopUpProps> {
	triggerEvent = (action: NotificationAction, e: React.SyntheticEvent) => {
		if (action.action) {
			action.action(e)
		} else if (this.props.item.actions?.find((i) => i.type === action.type)) {
			this.props.item.action(action.type, e)
		}
	}

	render(): JSX.Element {
		const { item } = this.props

		const allActions: NotificationAction[] = item.actions || []
		const defaultActions: NotificationAction[] = allActions.filter((action) => action.type === 'default')

		const defaultAction: NotificationAction | undefined =
			defaultActions.length === 1 && allActions.length === 1 ? defaultActions[0] : undefined

		const message = isTranslatableMessage(item.message) ? translateMessage(item.message, i18nTranslator) : item.message

		return (
			<NotificationCenterElement
				id={this.props.id}
				className={ClassNames(
					'notification-pop-up',
					{
						critical: item.status === NoticeLevel.CRITICAL,
						notice: item.status === NoticeLevel.NOTIFICATION,
						warning: item.status === NoticeLevel.WARNING,
						tip: item.status === NoticeLevel.TIP,
						persistent: item.persistent,

						'is-highlighted': this.props.isHighlighted,
					},
					this.props.className
				)}
				style={this.props.style}
				role={item.status === NoticeLevel.CRITICAL ? 'alert' : 'status'}
			>
				<div className="notification-pop-up__header">
					{item.status === NoticeLevel.CRITICAL ? (
						<CriticalIcon />
					) : item.status === NoticeLevel.WARNING ? (
						<WarningIcon />
					) : (
						<InformationIcon />
					)}
				</div>
				<div className="notification-pop-up__contents">
					{message}
					{defaultAction || allActions.length ? (
						<div className="notification-pop-up__actions">
							{defaultAction ? (
								<div className="notification-pop-up__actions--default">
									<button
										disabled={defaultAction.disabled}
										className="btn btn-default notification-pop-up__actions--button"
										onClick={(e) => this.triggerEvent(defaultAction, e)}
									>
										<CoreIcon.NrkArrowLeft
											className="icon"
											width="1em"
											height="1em"
											style={{ verticalAlign: 'middle', marginTop: '-0.1em', marginRight: '-0.4em' }}
										/>
										<span className="label">{defaultAction.label}</span>
									</button>
								</div>
							) : !defaultAction && allActions.length ? (
								<div className="notification-pop-up__actions--other">
									{allActions.map((action: NotificationAction, i: number) => {
										return (
											<button
												disabled={action.disabled}
												key={i}
												className={ClassNames(
													'btn',
													['default', 'primary'].indexOf(action.type) ? 'btn-primary' : 'btn-default',
													'ms-1'
												)}
												onClick={(e) => this.triggerEvent(action, e)}
											>
												{action.label}
											</button>
										)
									})}
								</div>
							) : null}
						</div>
					) : null}
				</div>
				{this.props.showDismiss && (
					<ContextMenuTrigger id="context-menu-dissmiss-all" attributes={{ className: 'notification-pop-up__dismiss' }}>
						<button
							className={
								'notification-pop-up__dismiss__button ' +
								(this.props.item.persistent ? '' : 'notification-pop-up__dismiss__button--close')
							}
							onClick={(e) => {
								e.stopPropagation()
								if (typeof this.props.onDismiss === 'function') this.props.onDismiss(e)
							}}
							aria-label={i18nTranslator('Dismiss')}
						>
							{this.props.item.persistent ? <CollapseChevrons /> : <CoreIcon.NrkClose id="nrk-close" />}
						</button>
					</ContextMenuTrigger>
				)}
			</NotificationCenterElement>
		)
	}
}

/**
 * NotificationCenterPopUps props.
 */
interface IProps {
	/** Should the elements animate on initial show */
	initialAnimation?: boolean
	/** Should the list show a 'List empty' label, if the notification list is empty? Defaults to false */
	showEmptyListLabel?: boolean
	/** Should snoozed notifications be shown? Defaults to false */
	showSnoozed?: boolean
	/** Limit the amount of shown notifications */
	limitCount?: number

	filter?: NoticeLevel
}

interface IState {
	isVisible: boolean
	dismissing: string[]
	dismissingTransform: string[]
}

interface ITrackedProps {
	notifications: Array<Notification>
	highlightedSource: RundownId | SegmentId | string | undefined
	highlightedLevel: NoticeLevel
}

/**
 * Presentational component that displays a list of notifications from the Notification Center.
 * @class NotificationCenterPopUps
 * @extends React.Component<IProps>
 */
export const NotificationCenterPopUps = translateWithTracker<IProps, IState, ITrackedProps>(() => {
	return {
		notifications: NotificationCenter.getNotifications(),
		highlightedSource: NotificationCenter.getHighlightedSource(),
		highlightedLevel: NotificationCenter.getHighlightedLevel(),
	}
})(
	class NotificationCenterPopUps extends React.Component<Translated<IProps & ITrackedProps>, IState> {
		private readonly DISMISS_ANIMATION_DURATION = 500
		private readonly LEAVE_ANIMATION_DURATION = 150

		constructor(props: Translated<IProps & ITrackedProps>) {
			super(props)

			this.state = {
				isVisible: props.notifications.length > 0,
				dismissing: [],
				dismissingTransform: [],
			}
		}

		private innerDismissNotification(item: Notification) {
			if (item.persistent) {
				item.snooze()
			} else {
				item.drop()
			}
		}

		dismissNotification(item: Notification, key: string) {
			if (!this.state.dismissing.includes(key)) {
				if (item.persistent) {
					this.setState({
						dismissing: update(this.state.dismissing, {
							$push: [key],
						}),
						dismissingTransform: update(this.state.dismissingTransform, {
							$push: [this.createDismissTransform(`notification-pop-up_${key}`) ?? ''],
						}),
					})

					setTimeout(() => {
						this.innerDismissNotification(item)
						setTimeout(() => {
							this.setState({
								dismissing: update(this.state.dismissing, {
									$splice: [[this.state.dismissing.indexOf(key), 1]],
								}),
								dismissingTransform: update(this.state.dismissingTransform, {
									$splice: [[this.state.dismissing.indexOf(key), 1]],
								}),
							})
						}, this.LEAVE_ANIMATION_DURATION + 10)
					}, this.DISMISS_ANIMATION_DURATION)
				} else {
					this.innerDismissNotification(item)
				}
			}
		}

		dismissAll() {
			const notificationsToDismiss: string[] = []

			for (const notification of this.props.notifications) {
				if (notification.persistent) {
					const key = this.notificationKey(notification)
					if (!this.state.dismissing.includes(key)) notificationsToDismiss.push(key)
				} else {
					this.innerDismissNotification(notification)
				}
			}

			this.setState({
				dismissing: update(this.state.dismissing, {
					$push: notificationsToDismiss,
				}),
				dismissingTransform: update(this.state.dismissingTransform, {
					$push: notificationsToDismiss.map((key) => this.createDismissTransform(`notification-pop-up_${key}`) || ''),
				}),
			})

			setTimeout(() => {
				const indexes: [number, number][] = notificationsToDismiss
					.map((value) => this.state.dismissing.indexOf(value))
					.map((index) => [index, 1])

				setTimeout(() => {
					this.setState({
						dismissing: update(this.state.dismissing, {
							$splice: indexes,
						}),
						dismissingTransform: update(this.state.dismissingTransform, {
							$splice: indexes,
						}),
					})
				}, this.LEAVE_ANIMATION_DURATION + 10)

				for (const notification of this.props.notifications) {
					this.innerDismissNotification(notification)
				}
			}, this.DISMISS_ANIMATION_DURATION)
		}

		UNSAFE_componentWillUpdate() {
			Array.from(document.querySelectorAll('.notification-pop-up.is-highlighted')).forEach((element0: Element) => {
				const element = element0 as HTMLElement
				if ('style' in element) {
					element.style.animationName = ''
				}
			})
		}

		componentDidUpdate(prevProps: Readonly<Translated<IProps & ITrackedProps>>, prevState: IState, snapshot: any) {
			if (super.componentDidUpdate) super.componentDidUpdate(prevProps, prevState, snapshot)

			if (
				this.props.highlightedSource &&
				this.props.highlightedLevel &&
				(prevProps.highlightedSource !== this.props.highlightedSource ||
					prevProps.highlightedLevel !== this.props.highlightedLevel)
			) {
				const items: NodeListOf<HTMLElement> = document.querySelectorAll('.notification-pop-up.is-highlighted')
				if (items.length > 0) {
					// scroll to highlighted items
					const currentAnimationName = getComputedStyle(items[0]).getPropertyValue('animation-name')

					const container = document.querySelector('.notification-center-panel .notification-pop-ups')
					if (container) {
						const offsetTop = items[0].offsetTop || 0

						container.scrollTo({
							left: 0,
							top: offsetTop - 10,
							behavior: 'smooth',
						})
					}

					Array.from(items).forEach((item) => {
						item.style.animationName = 'none'
					})

					if (currentAnimationName !== 'none') {
						window.requestAnimationFrame(function () {
							Array.from(items).forEach((item) => {
								item.style.animationName = currentAnimationName
							})
						})
					}
				}
			}

			if (this.props.notifications.length > 0 && this.state.isVisible !== true) {
				this.setState({
					isVisible: true,
				})
			}
		}

		private createDismissTransform = (id: string, toggleButtonRect?: ClientRect) => {
			const notificationEl = document.getElementById(id)
			const toggleButtonEl = toggleButtonRect
				? null
				: document.getElementsByClassName('notifications__toggle-button')[0]

			if (notificationEl && (toggleButtonEl || toggleButtonRect)) {
				const notificationPosition = notificationEl.getClientRects()[0]
				const toggleButtonPosition = toggleButtonRect ?? toggleButtonEl?.getClientRects()?.[0] ?? null
				if (toggleButtonPosition) {
					const style = `translate3d(${toggleButtonPosition.left - notificationPosition.left}px, ${
						toggleButtonPosition.top - notificationPosition.top
					}px, 0) scale(0)`
					return style
				}
			}
			return undefined
		}

		private getNotificationsToDisplay = () => {
			const filter = (i: Notification) =>
				(this.props.showSnoozed || !i.snoozed) &&
				(this.props.filter === undefined || (i.status & this.props.filter) !== 0)
			const sort = (a: Notification, b: Notification) => Notification.compare(a, b)
			if (this.props.limitCount !== undefined) {
				return this.props.notifications.filter(filter).sort(sort).slice(0, this.props.limitCount)
			} else {
				return this.props.notifications.filter(filter).sort(sort)
			}
		}

		private checkKeepDisplaying = () => {
			const notifications = this.getNotificationsToDisplay()
			if (notifications.length === 0) {
				this.setState({
					isVisible: false,
				})
			}
		}

		private notificationKey = (item: Notification) => {
			if (item.id) {
				return item.id
			}

			if (item.message === null) {
				return `${item.created}null`
			}

			if (typeof item.message === 'string') {
				return `${item.created}${item.message}`
			}

			if (isTranslatableMessage(item.message)) {
				return `${item.created}${translateMessage(item.message, this.props.t)}`
			}

			return `${item.created}$jsx_${btoa(JSON.stringify(item.message))}`
		}

		render(): JSX.Element | null {
			const { t, highlightedSource, highlightedLevel } = this.props

			const notifications = this.getNotificationsToDisplay()

			const displayList = notifications.map((item) => {
				const key = this.notificationKey(item)
				const index = this.state.dismissing.indexOf(key)
				return (
					<NotificationPopUp
						id={`notification-pop-up_${key}`}
						key={key}
						item={item}
						onDismiss={() => this.dismissNotification(item, key)}
						className={index >= 0 ? 'notification-pop-up--dismiss' : undefined}
						showDismiss={!item.persistent || !this.props.showSnoozed}
						isHighlighted={item.source === highlightedSource && item.status === highlightedLevel}
						style={index >= 0 ? { transform: this.state.dismissingTransform[index], opacity: 0 } : undefined}
					/>
				)
			})

			return this.state.isVisible ? (
				<div
					className={ClassNames('notification-pop-ups', {
						'notification-pop-ups--empty': displayList.length === 0,
					})}
				>
					<AnimatePresence initial={this.props.initialAnimation ?? true} onExitComplete={this.checkKeepDisplaying}>
						{displayList}
						{this.props.showEmptyListLabel && displayList.length === 0 && (
							<NotificationCenterElement className="notification-pop-ups__empty-list">
								{t('No notifications')}
							</NotificationCenterElement>
						)}
					</AnimatePresence>

					<ContextMenu id="context-menu-dissmiss-all">
						<MenuItem onClick={() => this.dismissAll()}>{t('Dismiss all notifications')}</MenuItem>
					</ContextMenu>
				</div>
			) : null
		}
	}
)

function NotificationCenterElement(props: HTMLMotionProps<'div'>) {
	return (
		<motion.div
			{...props}
			initial={{
				translateX: '150%',
				translateZ: 0,
				opacity: 0,
			}}
			animate={{
				translateX: '0%',
				opacity: 1,
				transition: { ease: 'easeOut', duration: 0.3 },
			}}
			exit={{
				opacity: 0,
				transition: { ease: 'easeIn', duration: 0.15 },
			}}
			style={{
				display: 'flex',
			}}
		>
			{props.children}
		</motion.div>
	)
}

/**
 * Presentational component that displays a panel containing the NotificationCenterPopUps list containing
 * the snoozed items and an 'Empty' label if no notifications are present.
 */
export const NotificationCenterPanel = (props: {
	limitCount?: number
	filter?: NoticeLevel
	hideRundownHeader?: boolean
}): JSX.Element => (
	<PopUpPanel
		className={classNames('notification-center-panel', {
			'notification-center-panel--no-rundown-header': props.hideRundownHeader,
		})}
	>
		<NotificationCenterPopUps
			initialAnimation={false}
			showEmptyListLabel={true}
			showSnoozed={true}
			limitCount={props.limitCount}
			filter={props.filter}
		/>
	</PopUpPanel>
)

/**
 * NotificationCenterPanelToggle props
 * @interface IToggleProps
 */
interface IToggleProps {
	/** Click event handler */
	onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
	/** Use 'open' class for the button to signify that the notification center is open */
	isOpen?: boolean
	filter?: NoticeLevel
	className?: string
	title?: string
}

/**
 * A button for with a count of notifications in the Notification Center
 */
export function NotificationCenterPanelToggle({
	className,
	filter,
	isOpen,
	title,
	onClick,
}: IToggleProps): JSX.Element | null {
	const count = useTracker(() => NotificationCenter.count(filter), [filter], 0)
	const { t } = useTranslation()

	return (
		<button
			className={ClassNames(
				'status-bar__controls__button',
				'notifications__toggle-button',
				{
					'status-bar__controls__button--open': isOpen,
					'has-items': count > 0,
				},
				className
			)}
			role="button"
			aria-pressed={isOpen ? 'true' : 'false'}
			onClick={onClick}
			tabIndex={0}
			aria-label={title}
		>
			<AnimatePresence initial={false}>
				{isOpen ? (
					<motion.div
						key="collapse"
						className="notifications__toggle-button__icon notifications__toggle-button__icon--collapse"
						initial={{
							translateX: '3em',
							opacity: 0,
						}}
						animate={{
							translateX: 0,
							opacity: 1,
						}}
						exit={{
							translateX: '3em',
							opacity: 0,
						}}
						transition={{
							duration: 0.5,
						}}
					>
						<CollapseChevrons />
					</motion.div>
				) : (
					<motion.div
						key="default"
						className="notifications__toggle-button__icon notifications__toggle-button__icon--default"
						initial={{
							translateX: '-3em',
							opacity: 0,
						}}
						animate={{
							translateX: 0,
							opacity: 1,
						}}
						exit={{
							translateX: '-3em',
							opacity: 0,
						}}
						transition={{
							duration: 0.5,
						}}
					>
						{((filter || 0) & NoticeLevel.CRITICAL) !== 0 ? (
							<CriticalIcon />
						) : ((filter || 0) & NoticeLevel.CRITICAL) !== 0 ? (
							<WarningIcon />
						) : ((filter || 0) & (NoticeLevel.NOTIFICATION | NoticeLevel.TIP)) !== 0 ? (
							<InformationIcon />
						) : (
							<WarningIcon />
						)}
						{count > 0 && (
							<span className="notifications__toggle-button__count" aria-label={t('{{count}} items', { count })}>
								{count > 99 ? '99+' : count}
							</span>
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</button>
	)
}
