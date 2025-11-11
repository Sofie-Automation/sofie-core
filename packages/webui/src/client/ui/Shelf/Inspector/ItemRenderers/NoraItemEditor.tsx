import * as React from 'react'
import { createMosObjectXmlStringNoraBluePrintPiece } from '../../../../lib/data/nora/browser-plugin-data.js'
import { parseMosPluginMessageXml, MosPluginMessage } from '../../../../lib/parsers/mos/mosXml2Js.js'
import { PieceGeneric } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { createMosAppInfoXmlString } from '../../../../lib/data/mos/plugin-support.js'
import { logger } from '../../../../lib/logging.js'
import { ReadonlyDeep } from 'type-fest'

//TODO: figure out what the origin should be
const LOCAL_ORIGIN = `${window.location.protocol}//${window.location.host}`
const MODULE_BROWSER_URL = new URL(`https://nora.nrk.no/module/browser?origin=${LOCAL_ORIGIN}&logging=true&dev=true`)
export const MODULE_BROWSER_ORIGIN = `${MODULE_BROWSER_URL.protocol}//${MODULE_BROWSER_URL.host}`

export { NoraItemEditor }

interface INoraEditorProps {
	piece: ReadonlyDeep<Omit<PieceGeneric, 'timelineObjectsString'>>
}

class NoraItemEditor extends React.Component<INoraEditorProps> {
	iframe: HTMLIFrameElement | null = null

	componentDidMount(): void {
		this.setUpEventListeners(window)
	}

	componentDidUpdate(_prevProps: INoraEditorProps): void {
		if (this.iframe && this.iframe.contentWindow) {
			this.setUpEventListeners(this.iframe.contentWindow)
		}
		this.setUpEventListeners(window)

		// if (JSON.stringify(prevProps.payload) !== JSON.stringify(this.props.payload)) {
		// 	this.postIframePayload()
		// }
	}

	shouldComponentUpdate(): boolean {
		return false
	}

	private postPayload(target: Window | null) {
		if (target) {
			const payloadXmlString = createMosObjectXmlStringNoraBluePrintPiece(this.props.piece)
			target.postMessage(payloadXmlString, MODULE_BROWSER_ORIGIN)
		}
	}

	private setUpEventListeners(target: Window) {
		target.addEventListener('message', (event) => {
			this.handleMessage(event)
		})
	}

	private handleMessage(event: MessageEvent) {
		if (event.origin !== MODULE_BROWSER_ORIGIN) {
			console.warn(`Origin rejected (wanted ${MODULE_BROWSER_ORIGIN}, got ${event.origin})`)
			return
		}

		const data = event.data && parseMosPluginMessageXml(event.data)

		if (data) {
			return this.handleMosMessage(data)
		} else {
			logger.error(`NoraItemEditor: unknown message: ${JSON.stringify(data)}`)
		}
	}

	private handleMosMessage(mos: MosPluginMessage) {
		if (mos.ncsReqAppInfo && this.iframe) {
			this.sendAppInfo(this.iframe.contentWindow)

			// delay to send in order
			setTimeout(() => {
				if (this.iframe) this.postPayload(this.iframe.contentWindow)
			}, 1)
		}
	}

	private sendAppInfo(target: Window | null) {
		if (target) {
			// let uiMetrics: MOSUIMetric[] | undefined = undefined
			// if (this.iframe) {
			// 	const size = this.iframe.getClientRects().item(0)
			// 	if (size) {
			// 		uiMetrics = [
			// 			literal<MOSUIMetric>({
			// 				startx: size.left,
			// 				starty: size.top,
			// 				endx: size.left + size.width,
			// 				endy: size.top + size.height,
			// 				mode: MOSUIMetricMode.ModalDialog,
			// 				canClose: true,
			// 			}),
			// 		]
			// 	}
			// }

			const payloadXmlString = createMosAppInfoXmlString()
			target.postMessage(payloadXmlString, MODULE_BROWSER_ORIGIN)
		}
	}

	render(): JSX.Element {
		return React.createElement('iframe', {
			ref: (element: HTMLIFrameElement) => {
				this.iframe = element
			},
			src: MODULE_BROWSER_URL.href,
			style: {
				border: 0,
				height: 720,
				width: 1280,
			},
		})
	}
}
