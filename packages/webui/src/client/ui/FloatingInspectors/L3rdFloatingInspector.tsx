import React, { useMemo, useRef } from 'react'
import * as _ from 'underscore'

import { GraphicsContent, JSONBlobParse, NoraContent } from '@sofie-automation/blueprints-integration'

import { NoraFloatingInspector } from './NoraFloatingInspector'
import { FloatingInspector } from '../FloatingInspector'
import { Time } from '../../lib/tempLib'
import { PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { FloatingInspectorTimeInformationRow } from './FloatingInspectorHelpers/FloatingInspectorTimeInformationRow'
import { IFloatingInspectorPosition, useInspectorPosition } from './IFloatingInspectorPosition'
import { ReadonlyDeep } from 'type-fest'

interface IProps {
	piece: ReadonlyDeep<Omit<PieceInstancePiece, 'timelineObjectsString'>>
	pieceRenderedDuration: number | null
	pieceRenderedIn: number | null
	showMiniInspector: boolean
	itemElement: HTMLDivElement | null
	content: GraphicsContent | NoraContent | undefined
	position: IFloatingInspectorPosition
	typeClass?: string
	displayOn?: 'document' | 'viewport'
}

type KeyValue = { key: string; value: string }

export const L3rdFloatingInspector: React.FunctionComponent<IProps> = ({
	content,
	position,
	showMiniInspector,
	piece,
	pieceRenderedIn,
	pieceRenderedDuration,
	typeClass,
}) => {
	const noraContent = (content as NoraContent)?.previewPayload ? (content as NoraContent | undefined) : undefined

	const properties: Array<KeyValue> = useMemo(() => {
		if (!noraContent?.previewPayload) return []
		const payload = JSONBlobParse(noraContent.previewPayload)
		if (!payload?.content) return []
		return _.compact(
			_.map(
				payload.content,
				(
					value,
					key: string
				):
					| {
							key: string
							value: string
					  }
					| undefined => {
					let str: string
					if (key.startsWith('_') || key.startsWith('@') || value === '') {
						return undefined
					} else {
						if (_.isObject(value)) {
							str = JSON.stringify(value, undefined, 2)
						} else {
							str = value + ''
						}
						return {
							key: key,
							value: str,
						}
					}
				}
			)
		) as Array<KeyValue>
	}, [noraContent?.previewPayload])

	const changed: Time | undefined = noraContent?.changed ?? undefined

	const graphicContent = (content as GraphicsContent)?.fileName ? (content as GraphicsContent | undefined) : undefined

	const templateName = noraContent?.templateInfo?.name ?? piece.name
	const templateVariant =
		noraContent?.templateInfo?.variant ??
		(piece.name !== graphicContent?.fileName ? graphicContent?.fileName : undefined)

	const ref = useRef<HTMLDivElement>(null)

	const { style: floatingInspectorStyle } = useInspectorPosition(position, ref, showMiniInspector)

	const hasValidPreviewPayload =
		noraContent?.previewPayload && noraContent?.previewPayload && noraContent.previewPayload.toString() !== '{}'

	return hasValidPreviewPayload && noraContent.previewRenderer ? (
		showMiniInspector ? (
			<NoraFloatingInspector ref={ref} noraContent={noraContent} style={floatingInspectorStyle} />
		) : null
	) : (
		<FloatingInspector shown={showMiniInspector} displayOn="viewport">
			<div className={'segment-timeline__mini-inspector ' + typeClass} style={floatingInspectorStyle} ref={ref}>
				{templateName && (
					<div className="mini-inspector__header">
						<span>{templateName}</span>
						{templateVariant && (
							<>
								{'\u2002' /* en-space for rythm */}
								<span className="mini-inspector__sub-header">{templateVariant}</span>
							</>
						)}
					</div>
				)}
				<table>
					<tbody>
						{properties.map((item) => (
							<tr key={item.key}>
								<td className="mini-inspector__label">{item.key}</td>
								<td className="mini-inspector__value">{item.value}</td>
							</tr>
						))}
						<FloatingInspectorTimeInformationRow
							piece={piece}
							pieceRenderedDuration={pieceRenderedDuration}
							pieceRenderedIn={pieceRenderedIn}
							changed={changed}
						/>
					</tbody>
				</table>
			</div>
		</FloatingInspector>
	)
}
