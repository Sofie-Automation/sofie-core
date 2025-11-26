import { objectToXML } from '../util/object-to-xml.js'

export enum AckStatus {
	ACK = 'ACK',
	Error = 'ERROR',
}

export enum UIMetricMode {
	Contained = 'CONTAINED',
	NonModal = 'NONMODAL',
	Toolbar = 'TOOLBAR',
	ModalDialog = 'MODALDIALOG',
}

export enum Events {
	/** Event is emitted every now-and-then, generally to be used for simple displays */
	'dragenter' = 'sofie:dragEnter',
	/** event is emitted with a very high frequency (60 Hz), to be used sparingly as
	 * hooking up Components to it will cause a lot of renders
	 */
	'dragleave' = 'sofie:dragLeave',
}

export interface UIMetric {
	startx: number
	starty: number
	endx: number
	endy: number
	mode: UIMetricMode
	canClose?: boolean
}

export function createMosItemRequest(): string {
	const doc = objectToXML(
		{
			ncsItemRequest: {},
		},
		'mos'
	)

	return new XMLSerializer().serializeToString(doc)
}

export function createMosAckString(status?: AckStatus, statusDescription?: string): string {
	const doc = objectToXML(
		{
			ncsAck: {
				status,
				statusDescription,
			},
		},
		'mos'
	)

	return new XMLSerializer().serializeToString(doc)
}

export function createMosAppInfoXmlString(uiMetrics?: UIMetric[]): string {
	const doc = objectToXML(
		{
			ncsID: 'sofie-core',
			ncsAppInfo: {
				ncsInformation: {
					userID: 'sofie system',
					runContext: 'BROWSE',
					software: {
						manufacturer: 'Sofie Project',
						product: 'Sofie TV Automation',
						version: __APP_VERSION__ || 'UNSTABLE',
					},
					uiMetric: uiMetrics
						? uiMetrics.map((metric, index) => {
								return Object.assign({}, metric, {
									_attributes: {
										num: index.toString(),
									},
								})
							})
						: undefined,
				},
			},
		},
		'mos'
	)

	return new XMLSerializer().serializeToString(doc)
}
