import * as XMLBuilder from 'xmlbuilder'
import { MOS_DATA_IS_STRICT, MOS } from '@sofie-automation/meteor-lib/dist/mos'

/**
 * Client side MOS XML to JavaScript object conversion. Not exhaustive, might cut
 * corners to fit specific use cases.
 * Originally developed for use by the Nora editor in the shelf inspector.
 */

export interface MosPluginMessage {
	ncsReqAppInfo?: boolean
	item?: MOS.IMOSItem
}

export function parseMosPluginMessageXml(xmlString: string): MosPluginMessage | undefined {
	const doc: any = MOS.xml2js(xmlString)

	if (doc && doc.mos) {
		const res: MosPluginMessage = {}
		if (doc.mos.ncsReqAppInfo) {
			res.ncsReqAppInfo = true
		}

		if (doc.mos.ncsItem && doc.mos.ncsItem.item) {
			res.item = MOS.MosModel.XMLMosItem.fromXML('ncsItem.item', doc.mos.ncsItem.item, MOS_DATA_IS_STRICT)
		}

		return res
	} else {
		return undefined
	}
}

export function generateMosPluginItemXml(item: MOS.IMOSItem): string {
	const builder = XMLBuilder.create('ncsItem')
	MOS.MosModel.XMLMosItem.toXML(builder, item, MOS_DATA_IS_STRICT)
	return `<mos>${builder.toString()}</mos>`
}
