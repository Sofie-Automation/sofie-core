import { JSONBlobParse, NoraContent } from '@sofie-automation/blueprints-integration'
import { PieceGeneric } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { objectToXML } from '../util/object-to-xml.js'
import { ReadonlyDeep } from 'type-fest'

export { createMosObjectXmlStringNoraBluePrintPiece }

function createMosObjectXmlStringNoraBluePrintPiece(
	piece: ReadonlyDeep<Pick<PieceGeneric, 'content' | 'externalId'>>
): string {
	const noraContent = piece.content as NoraContent | undefined
	const noraPayload = noraContent?.previewPayload ? JSONBlobParse(noraContent.previewPayload) : undefined
	if (!noraContent || !noraPayload) {
		throw new Error('Not a Nora blueprint piece')
	}

	const doc = objectToXML(
		{
			ncsItem: {
				item: {
					itemSlug: null,
					objID: piece.externalId,
					mosExternalMetadata: [
						{
							mosSchema: 'http://nora.core.mesosint.nrk.no/mos/content',
							mosPayload: {
								metadata: {
									selection: {
										design: {
											id: noraPayload.manifest,
										},
										type: {
											id: noraPayload.template.layer,
										},
										mal: {
											id: noraPayload.template.name,
										},
									},
									type: noraPayload.template.layer,
									userContext: {},
								},
								template: noraPayload.template,
								content: noraPayload.content,
							},
						},
						{
							mosSchema: 'http://nora.core.mesosint.nrk.no/mos/timing',
							mosPayload: {
								timeIn: 0,
								duration: noraContent.sourceDuration,
							},
						},
					],
				},
			},
		},
		'mos'
	)

	return new XMLSerializer().serializeToString(doc)
}
