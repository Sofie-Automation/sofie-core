import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import ClassNames from 'classnames'
import {
	RundownLayoutExternalFrame,
	RundownLayoutBase,
	DashboardLayoutExternalFrame,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { dashboardElementStyle } from './DashboardPanel.js'
import { assertNever, getRandomString, literal, protectString } from '../../lib/tempLib.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { parseMosPluginMessageXml, MosPluginMessage } from '../../lib/parsers/mos/mosXml2Js.js'
import {
	createMosAppInfoXmlString,
	UIMetric as MOSUIMetric,
	UIMetricMode as MOSUIMetricMode,
	Events as MOSEvents,
} from '../../lib/data/mos/plugin-support.js'
import { doUserAction, UserAction } from '../../lib/clientUserAction.js'
import { withTranslation } from 'react-i18next'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import {
	DefaultUserOperationImportMOSItem,
	DefaultUserOperationsTypes,
	IngestAdlib,
	UserEditingType,
} from '@sofie-automation/blueprints-integration'
import { MeteorCall } from '../../lib/meteorApi.js'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown.js'
import { Buckets, Rundowns, Segments } from '../../collections/index.js'
import { BucketId, PartInstanceId, RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MOS_DATA_IS_STRICT } from '@sofie-automation/meteor-lib/dist/mos'
import { mosTypes, MOS } from '@sofie-automation/meteor-lib/dist/mos'
import { RundownPlaylistCollectionUtil } from '../../collections/rundownPlaylistUtil.js'
import { logger } from '../../lib/logging.js'
import RundownViewEventBus, {
	ItemDroppedEvent,
	RundownViewEvents,
} from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { UIPartInstances, UIParts } from '../Collections.js'

interface IProps {
	layout: RundownLayoutBase
	panel: RundownLayoutExternalFrame
	visible: boolean
	playlist: DBRundownPlaylist
}

enum SofieExternalMessageType {
	HELLO = 'hello',
	WELCOME = 'welcome',
	ACK = 'ack',
	NAK = 'nak',
	KEYBOARD_EVENT = 'keyboard_event',
	CURRENT_PART_CHANGED = 'current_part_changed',
	NEXT_PART_CHANGED = 'next_part_changed',
	FOCUS_IN = 'focus_in',
}

interface SofieExternalMessage {
	id: string
	replyToId?: string
	type: SofieExternalMessageType
	payload?: any
}

// interface HelloSofieExternalMessage extends SofieExternalMessage {
// 	type: SofieExternalMessageType.HELLO
// 	payload: never
// }

interface WelcomeSofieExternalMessage extends SofieExternalMessage {
	type: SofieExternalMessageType.WELCOME
	payload: {
		host: string
		version: string
		rundownPlaylistId: RundownPlaylistId
	}
}

// interface KeyboardEventSofieExternalMessage extends SofieExternalMessage {
// 	type: SofieExternalMessageType.KEYBOARD_EVENT
// 	payload: KeyboardEvent & {
// 		currentTarget: null
// 		path: null
// 		scrElement: null
// 		target: null
// 		view: null
// 	}
// }

interface CurrentNextPartChangedSofieExternalMessage extends SofieExternalMessage {
	type: SofieExternalMessageType.CURRENT_PART_CHANGED | SofieExternalMessageType.NEXT_PART_CHANGED
	payload: {
		partInstanceId: PartInstanceId | null
		prevPartInstanceId?: PartInstanceId | null
	}
}

export const ExternalFramePanel = withTranslation()(
	class ExternalFramePanel extends React.Component<Translated<IProps>> {
		frame: HTMLIFrameElement | null = null
		mounted = false
		initialized = false
		failedDragTimeout: number | undefined
		failedDropTimeout: number | undefined

		waitForItemLoad: undefined | Promise<any>
		resolveItemLoad: undefined | ((res: any) => void)

		awaitingReply: {
			[key: string]: {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
				resolve: Function
				// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
				reject: Function
			}
		} = {}

		setElement = (frame: HTMLIFrameElement | null) => {
			this.frame = frame
			if (this.frame && !this.mounted) {
				this.registerHandlers()
				this.mounted = true
			} else {
				this.unregisterHandlers()
				this.mounted = false
			}
		}

		onKeyEvent = (e: KeyboardEvent) => {
			this.sendSofieMessage(
				literal<SofieExternalMessage>({
					id: getRandomString(),
					type: SofieExternalMessageType.KEYBOARD_EVENT,
					// Send the event sanitized to prevent sending huge objects
					payload: _.omit(
						_.omit(e, ['currentTarget', 'path', 'srcElement', 'target', 'view', 'sourceCapabilities']),
						(value) => typeof value === 'function'
					),
				})
			)
		}

		onReceiveMessage = (e: MessageEvent) => {
			if ((e.origin === 'null' || e.origin === self.origin) && this.frame && e.source === this.frame.contentWindow) {
				const data = e.data || (e as any)['message']
				if (!data) return
				if (data.type) {
					this.actSofieMessage(data)
				} else {
					this.actMOSMessage(e, data)
				}
			} else if (this.props.panel.dropzoneUrl && e.source === this.frame?.contentWindow) {
				if (e.data.event === 'dragStart' || e.data.event === 'dragEnd') {
					RundownViewEventBus.emit(RundownViewEvents.TOGGLE_SHELF_DROPZONE, {
						id: this.props.panel._id,
						display: e.data.event === 'dragStart',
					})
				}

				if (e.data.event === 'dragStart') {
					// set timeout
					this.failedDropTimeout = Meteor.setTimeout(() => {
						this.failedDropTimeout = undefined
						RundownViewEventBus.emit(RundownViewEvents.TOGGLE_SHELF_DROPZONE, {
							id: this.props.panel._id,
							display: false,
						})
					}, 10000)
				} else {
					// clear timeout
					if (this.failedDropTimeout) Meteor.clearTimeout(this.failedDropTimeout)
				}
			}
		}

		actMOSMessage = (e: any, message: string) => {
			const data: MosPluginMessage | undefined = parseMosPluginMessageXml(message)

			if (data) {
				return this.handleMosMessage(e, data)
			}
		}

		sendMOSAppInfo() {
			let uiMetrics: MOSUIMetric[] | undefined = undefined
			if (this.frame) {
				const size = this.frame.getClientRects().item(0)
				if (size) {
					uiMetrics = [
						literal<MOSUIMetric>({
							startx: size.left,
							starty: size.top,
							endx: size.left + size.width,
							endy: size.top + size.height,
							mode: MOSUIMetricMode.Contained,
						}),
					]
				}
			}
			this.sendMOSMessage(createMosAppInfoXmlString(uiMetrics))
		}

		private findBucketId(el: HTMLElement): BucketId | undefined {
			while (el.dataset.bucketId === undefined && el.parentElement) {
				el = el.parentElement
			}

			if (el) {
				return protectString(el.dataset.bucketId)
			}

			return undefined
		}

		private findPartId(el: HTMLElement): {
			rundownId: RundownId | undefined
			segmentId: string | undefined
			partId: string | undefined
		} {
			while (el.dataset.partId === undefined && el.parentElement) {
				el = el.parentElement
			}
			const partId = el?.dataset.partId

			if (partId) {
				const part = UIParts.findOne(protectString(partId))
				const supportsOp = part?.userEditOperations?.find(
					(op) => op.type === UserEditingType.SOFIE && op.id === DefaultUserOperationsTypes.IMPORT_MOS_ITEM
				)

				if (supportsOp) {
					const segment = Segments.findOne(part?.segmentId)

					return {
						rundownId: part?.rundownId,
						segmentId: segment?.externalId,
						partId: part?.externalId,
					}
				}
			}

			return { rundownId: undefined, partId: undefined, segmentId: undefined }
		}

		private getShowStyleBaseId() {
			const { playlist } = this.props

			let targetRundown: Rundown | undefined
			let currentPart: PartInstance | undefined
			if (playlist.currentPartInfo || playlist.nextPartInfo) {
				if (playlist.currentPartInfo !== null) {
					currentPart = UIPartInstances.findOne(playlist.currentPartInfo.partInstanceId)
				} else if (playlist.nextPartInfo !== null) {
					currentPart = UIPartInstances.findOne(playlist.nextPartInfo.partInstanceId)
				}

				if (!currentPart) {
					throw new Meteor.Error(
						`Selected part could not be found: "${
							playlist.currentPartInfo?.partInstanceId || playlist.nextPartInfo?.partInstanceId
						}"`
					)
				}

				targetRundown = Rundowns.findOne(currentPart.rundownId)
			} else {
				targetRundown = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)[0]
			}

			if (!targetRundown) {
				throw new Meteor.Error('Target rundown could not be determined!')
			}

			return targetRundown.showStyleBaseId
		}

		receiveMOSItem(e: any, mosItem: MOS.IMOSItem) {
			console.log('Object received, passing onto blueprints', mosItem)

			const bucketId = this.findBucketId(e.target)
			if (bucketId) {
				this.receiveMOSItemBucket(e, bucketId, mosItem)
				return
			}

			const { rundownId, segmentId, partId } = this.findPartId(e.target)
			if (rundownId && partId) {
				console.log('pass to part', partId)
				this.receiveMOSItemUserOp(e, rundownId, partId, segmentId, mosItem)
				return
			}
		}

		receiveMOSItemUserOp(
			e: any,
			rundownId: RundownId,
			partId: string,
			segmentId: string | undefined,
			mosItem: MOS.IMOSItem
		) {
			const { t } = this.props

			const operationTarget = { segmentExternalId: segmentId, partExternalId: partId, pieceExternalId: undefined }

			doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
				MeteorCall.userAction.executeUserChangeOperation(
					e,
					ts,
					rundownId,
					operationTarget,
					literal<DefaultUserOperationImportMOSItem>({
						id: DefaultUserOperationsTypes.IMPORT_MOS_ITEM,

						payloadType: 'MOS',
						payload: MOS.stringifyMosObject(mosItem, MOS_DATA_IS_STRICT),
					})
				)
			)
		}

		receiveMOSItemBucket(e: any, bucketId: BucketId, mosItem: MOS.IMOSItem) {
			const { t } = this.props

			const targetBucket = bucketId ? Buckets.findOne(bucketId) : Buckets.findOne()

			const showStyleBaseId = this.getShowStyleBaseId()

			const name = mosItem.Slug
				? mosTypes.mosString128.stringify(mosItem.Slug)
				: mosItem.ObjectSlug
					? mosTypes.mosString128.stringify(mosItem.ObjectSlug)
					: ''

			doUserAction(t, e, UserAction.INGEST_BUCKET_ADLIB, (e, ts) =>
				MeteorCall.userAction.bucketAdlibImport(
					e,
					ts,
					targetBucket ? targetBucket._id : protectString(''),
					showStyleBaseId,
					literal<IngestAdlib>({
						externalId: mosItem.ObjectID ? mosTypes.mosString128.stringify(mosItem.ObjectID) : '',
						name,
						payloadType: 'MOS',
						payload: MOS.stringifyMosObject(mosItem, MOS_DATA_IS_STRICT),
					})
				)
			)
		}

		handleMosMessage = (e: any, mos: MosPluginMessage) => {
			if (mos.ncsReqAppInfo) {
				this.sendMOSAppInfo()
			} else if (mos.item) {
				this.receiveMOSItem(e, mos.item)
			}
		}

		actSofieMessage = (message: SofieExternalMessage) => {
			if (typeof message.id !== 'string') throw new Error('Expected `message.id` to be a string')
			if (typeof message.type !== 'string') throw new Error('Expected `message.type` to be a string')

			if (Object.values<SofieExternalMessageType>(SofieExternalMessageType as any).indexOf(message.type) < 0) {
				logger.error(`ExternalFramePanel: Unknown message type: ${message.type}`)
				return
			}

			if (message.replyToId && this.awaitingReply[message.replyToId]) {
				this.awaitingReply[message.replyToId].resolve(message)
				delete this.awaitingReply[message.replyToId]
				return
			}

			switch (message.type) {
				// perform a three-way handshake: HELLO -> WELCOME -> ACK
				case SofieExternalMessageType.HELLO:
					this.sendSofieMessageAwaitReply(
						literal<WelcomeSofieExternalMessage>({
							id: getRandomString(),
							replyToId: message.id,
							type: SofieExternalMessageType.WELCOME,
							payload: {
								host: 'Sofie Automation System',
								version: __APP_VERSION__,
								rundownPlaylistId: this.props.playlist._id,
							},
						}),
						true
					)
						.then((response) => {
							if (response.type === SofieExternalMessageType.ACK) {
								this.initialized = true
								this.sendSofieCurrentState()
							}
						})
						.catch((e) => console.warn(e))
					break
				case SofieExternalMessageType.FOCUS_IN: {
					this.sendSofieMessage(
						literal<SofieExternalMessage>({
							id: getRandomString(),
							replyToId: message.id,
							type: SofieExternalMessageType.ACK,
						})
					)
					// select a button on the right-hand side bar, as these are fixed in the viewport and won't cause
					// any automatic scroll behavior
					const randomEl = document.querySelector<HTMLButtonElement>('button.status-bar__controls__button')
					if (randomEl) randomEl.focus()
					break
				}
				case SofieExternalMessageType.ACK:
				case SofieExternalMessageType.NAK:
					// noop
					break
				case SofieExternalMessageType.CURRENT_PART_CHANGED:
				case SofieExternalMessageType.NEXT_PART_CHANGED:
				case SofieExternalMessageType.KEYBOARD_EVENT:
				case SofieExternalMessageType.WELCOME:
					console.warn('Sofie ExternalFramePanel API Message received in unusual direction', message)
					break
				default:
					assertNever(message.type)
					break
			}
		}

		sendSofieMessageAwaitReply = (
			message: SofieExternalMessage,
			uninitialized?: boolean
		): Promise<SofieExternalMessage> => {
			return new Promise((resolve, reject) => {
				if (this.initialized || uninitialized) {
					this.awaitingReply[message.id] = { resolve, reject }
					this.sendSofieMessage(message, uninitialized)
				} else {
					reject(new Error('ExternalFramePanel guest not initialized'))
				}
			})
		}

		sendSofieMessage = (data: SofieExternalMessage, uninitialized?: boolean) => {
			if (this.frame && this.frame.contentWindow && (this.initialized || uninitialized)) {
				const url = new URL(this.props.panel.url)
				this.frame.contentWindow.postMessage(data, `${url.protocol}//${url.host}`) // host already contains the port number, if specified
			}
		}

		sendMOSMessage = (data: string) => {
			if (this.frame && this.frame.contentWindow) {
				const url = new URL(this.props.panel.url)
				this.frame.contentWindow.postMessage(data, `${url.protocol}//${url.host}`) // host already contains the port number, if specified
			}
		}

		sendSofieCurrentState() {
			this.sendSofieMessage(
				literal<CurrentNextPartChangedSofieExternalMessage>({
					id: getRandomString(),
					type: SofieExternalMessageType.CURRENT_PART_CHANGED,
					payload: {
						partInstanceId: this.props.playlist.currentPartInfo?.partInstanceId ?? null,
					},
				})
			)
			this.sendSofieMessage(
				literal<CurrentNextPartChangedSofieExternalMessage>({
					id: getRandomString(),
					type: SofieExternalMessageType.NEXT_PART_CHANGED,
					payload: {
						partInstanceId: this.props.playlist.nextPartInfo?.partInstanceId ?? null,
					},
				})
			)
		}

		onDragOver = (e: DragEvent) => {
			if (this.failedDragTimeout) {
				Meteor.clearTimeout(this.failedDragTimeout)
			}

			let dragAllowed = false
			if (e.dataTransfer) {
				if (e.dataTransfer.getData('Text').trim().endsWith('</mos>')) {
					// this is quite probably a MOS object
					dragAllowed = true
				} else if (
					e.dataTransfer.items.length > 0 &&
					e.dataTransfer.types.indexOf('text/plain') >= 0 &&
					e.dataTransfer.files.length === 0
				) {
					// it might be a MOS object, but we can't know
					dragAllowed = true
				}
				// else if (
				// 	e.dataTransfer.items.length === 0 &&
				// 	e.dataTransfer.types.length === 0 &&
				// 	e.dataTransfer.files.length === 0
				// ) {
				// 	// it might be a MOS object, but we can't know
				// 	dragAllowed = true
				// 	console.log(e.dataTransfer)
				// }

				if (dragAllowed) {
					e.dataTransfer.dropEffect = 'copy'
					e.dataTransfer.effectAllowed = 'copy'

					const event = new CustomEvent<{}>(MOSEvents.dragenter, {
						cancelable: false,
					})
					window.dispatchEvent(event)
				} else {
					e.dataTransfer.dropEffect = 'none'
					e.dataTransfer.effectAllowed = 'none'
				}
			}

			e.preventDefault()

			this.failedDragTimeout = Meteor.setTimeout(this.onDragLeave, 150)
		}

		onDragEnter = (e: DragEvent) => {
			e.preventDefault()
		}

		onDragLeave = (_e: Event) => {
			this.failedDragTimeout = undefined
			const event = new CustomEvent<{}>(MOSEvents.dragleave, {
				cancelable: false,
			})
			window.dispatchEvent(event)
		}

		onDrop = (e: DragEvent) => {
			if (e.dataTransfer) {
				if (e.dataTransfer.getData('Text').trim().endsWith('</mos>')) {
					// this is quite probably a MOS object, let's try and ingest it
					this.actMOSMessage(e, e.dataTransfer.getData('Text'))
				} else if (
					e.dataTransfer.items.length > 0 &&
					e.dataTransfer.types.indexOf('text/plain') >= 0 &&
					e.dataTransfer.files.length === 0
				) {
					for (const dataTransferItem of e.dataTransfer.items) {
						// skip, if not of text/plain type
						if (dataTransferItem.type !== 'text/plain') continue
						dataTransferItem.getAsString((text: string) => {
							if (text.trim().endsWith('</mos>')) {
								this.actMOSMessage(e, text)
							}
						})
					}
				}
			}
			// else if (
			// 	e.dataTransfer.items.length === 0 &&
			// 	e.dataTransfer.types.length === 0 &&
			// 	e.dataTransfer.files.length === 0
			// ) {
			// 	// there are no items, no data types and no files, this is probably a cross-frame drag-and-drop
			// 	// let's try and ask the plugin for some content maybe?
			// 	console.log('Requesting an object because of a dubious drop event')
			// 	this.sendMOSMessage(createMosItemRequest())
			// }

			const event = new CustomEvent<{}>(MOSEvents.dragleave, {
				cancelable: false,
			})
			window.dispatchEvent(event)

			// When dragging from an iframe, the focus stays within the iframe.
			// This can cause confusion among users, since Sofie-keyboard shortcuts doesn't work, until they click somewhere in Sofie.
			// To solve this, we simply reset the focus so that the iframe doesn't have the focus anymore.
			const activeElement = document.activeElement as HTMLElement | undefined
			if (activeElement?.tagName === 'IFRAME') {
				activeElement.blur?.()
			}
		}

		registerHandlers = () => {
			document.addEventListener('keydown', this.onKeyEvent)
			document.addEventListener('keyup', this.onKeyEvent)

			document.addEventListener('dragover', this.onDragOver)
			document.addEventListener('dragenter', this.onDragEnter)
			document.addEventListener('dragexit', this.onDragLeave)
			document.addEventListener('drop', this.onDrop)
		}

		unregisterHandlers = () => {
			document.removeEventListener('keydown', this.onKeyEvent)
			document.removeEventListener('keydown', this.onKeyEvent)

			document.removeEventListener('dragover', this.onDragOver)
			document.removeEventListener('dragenter', this.onDragEnter)
			document.removeEventListener('dragleave', this.onDragLeave)
			document.removeEventListener('dragexit', this.onDragLeave)
			document.removeEventListener('drop', this.onDrop)
		}

		componentDidUpdate(prevProps: IProps) {
			if (prevProps.playlist.currentPartInfo?.partInstanceId !== this.props.playlist.currentPartInfo?.partInstanceId) {
				this.sendSofieMessage(
					literal<CurrentNextPartChangedSofieExternalMessage>({
						id: getRandomString(),
						type: SofieExternalMessageType.CURRENT_PART_CHANGED,
						payload: {
							partInstanceId: this.props.playlist.currentPartInfo?.partInstanceId ?? null,
							prevPartInstanceId: prevProps.playlist.currentPartInfo?.partInstanceId ?? null,
						},
					})
				)
			}

			if (prevProps.playlist.nextPartInfo?.partInstanceId !== this.props.playlist.nextPartInfo?.partInstanceId) {
				this.sendSofieMessage(
					literal<CurrentNextPartChangedSofieExternalMessage>({
						id: getRandomString(),
						type: SofieExternalMessageType.NEXT_PART_CHANGED,
						payload: {
							partInstanceId: this.props.playlist.nextPartInfo?.partInstanceId ?? null,
							prevPartInstanceId: prevProps.playlist.nextPartInfo?.partInstanceId ?? null,
						},
					})
				)
			}
		}

		private onDropZoneDropped = (e: ItemDroppedEvent) => {
			if (e.id !== this.props.panel._id) return

			if (!e.message && !e.error) {
				// start user action
				this.waitForItemLoad = new Promise((resolve) => (this.resolveItemLoad = resolve))

				const { t } = this.props
				const bucketId = e.bucketId
				const targetBucket = bucketId ? Buckets.findOne(bucketId) : Buckets.findOne()

				const showStyleBaseId = this.getShowStyleBaseId()

				console.log('start transfer from ext panel')

				doUserAction(t, e, UserAction.INGEST_BUCKET_ADLIB, async (e, ts) => {
					const message = await this.waitForItemLoad

					if (!message || !message.item) throw new Error(message.error ?? 'No MOS item found')
					const mosItem = message.item

					console.log('Object received, passing onto blueprints', mosItem)

					const name = mosItem.Slug
						? mosTypes.mosString128.stringify(mosItem.Slug)
						: mosItem.ObjectSlug
							? mosTypes.mosString128.stringify(mosItem.ObjectSlug)
							: ''

					return MeteorCall.userAction.bucketAdlibImport(
						e,
						ts,
						targetBucket ? targetBucket._id : protectString(''),
						showStyleBaseId,
						literal<IngestAdlib>({
							externalId: mosItem.ObjectID ? mosTypes.mosString128.stringify(mosItem.ObjectID) : '',
							name,
							payloadType: 'MOS',
							payload: MOS.stringifyMosObject(mosItem, MOS_DATA_IS_STRICT),
						})
					)
				})
			} else if (this.resolveItemLoad) {
				if (e.error) {
					this.resolveItemLoad(e.error ? { error: e.error } : e.message)
				} else if (e.message) {
					const message = parseMosPluginMessageXml(e.message)
					this.resolveItemLoad(message)
				}
			} else if (e.message) {
				this.actMOSMessage(e.ev, e.message)
			}
		}

		componentDidMount(): void {
			window.addEventListener('message', this.onReceiveMessage)

			RundownViewEventBus.addListener(RundownViewEvents.ITEM_DROPPED, this.onDropZoneDropped)
		}

		componentWillUnmount(): void {
			// reject all outstanding promises for replies
			_.each(this.awaitingReply, (promise) => promise.reject(new Error('ExternalFramePanel unmounting')))
			this.unregisterHandlers()
			window.removeEventListener('message', this.onReceiveMessage)
			RundownViewEventBus.removeListener(RundownViewEvents.ITEM_DROPPED, this.onDropZoneDropped)
		}

		render(): JSX.Element {
			const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
			const scale = isDashboardLayout ? (this.props.panel as DashboardLayoutExternalFrame).scale || 1 : 1
			const frameStyle = {
				transform: `scale(${scale})`,
				width: `calc(100% / ${scale})`,
				height: `calc(100% / ${scale})`,
			}
			return (
				<div
					className={ClassNames(
						'external-frame-panel',
						RundownLayoutsAPI.isDashboardLayout(this.props.layout)
							? (this.props.panel as DashboardLayoutExternalFrame).customClasses
							: undefined
					)}
					style={{
						visibility: this.props.visible ? 'visible' : 'hidden',
						...(RundownLayoutsAPI.isDashboardLayout(this.props.layout)
							? dashboardElementStyle(this.props.panel as DashboardLayoutExternalFrame)
							: {}),
					}}
				>
					<iframe
						ref={this.setElement}
						className="external-frame-panel__iframe"
						src={this.props.panel.url}
						sandbox="allow-forms allow-popups allow-scripts allow-same-origin"
						style={frameStyle}
					></iframe>
					{this.props.panel.disableFocus && <div className="external-frame-panel__overlay" style={frameStyle}></div>}
				</div>
			)
		}
	}
)
