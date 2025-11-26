import React, { useCallback, useMemo } from 'react'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { ISourceLayerExtended } from '../../../lib/RundownResolver.js'
import { useSubscription, useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData.js'
import { LinePartIndicator } from './LinePartIndicator.js'
import { useTranslation } from 'react-i18next'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import StudioContext from '../../RundownView/StudioContext.js'
import { AdLibActions, AdLibPieces } from '../../../collections/index.js'
import RundownViewEventBus, { RundownViewEvents } from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'

interface IProps {
	sourceLayers: ISourceLayerExtended[]
	label: string
	partId: PartId
}

export const LinePartAdLibIndicator: React.FC<IProps> = function LinePartAdLibIndicator({ sourceLayers, partId }) {
	const { t } = useTranslation()

	const sourceLayerIds = useMemo(() => sourceLayers.map((sourceLayer) => sourceLayer._id), [sourceLayers])
	const label = useMemo(() => sourceLayers[0]?.name ?? '', [sourceLayers])

	useSubscription(MeteorPubSub.adLibPiecesForPart, partId, sourceLayerIds)
	useSubscription(MeteorPubSub.adLibActionsForPart, partId, sourceLayerIds)

	const adLibPieces = useTracker(
		() =>
			AdLibPieces.find({
				partId,
				sourceLayerId: {
					$in: sourceLayerIds,
				},
			}).fetch(),
		[partId, sourceLayerIds],
		[] as AdLibPiece[]
	)

	const adLibActions = useTracker(
		() =>
			AdLibActions.find({
				partId,
				'display.sourceLayerId': {
					$in: sourceLayerIds,
				},
			}).fetch(),
		[partId, sourceLayerIds],
		[] as AdLibAction[]
	)

	const allAdLibLabels = useMemo(
		() =>
			adLibPieces
				.map((adLibPiece) => adLibPiece.name)
				.concat(adLibActions.map((adLibAction) => translateMessage(adLibAction.display.label, t))),
		[adLibPieces, adLibActions]
	)

	const onClick = useCallback(() => {
		const pieceId = adLibPieces[0]?._id || adLibActions[0]?._id
		RundownViewEventBus.emit(RundownViewEvents.SHELF_STATE, {
			state: true,
		})
		setTimeout(() => {
			RundownViewEventBus.emit(RundownViewEvents.REVEAL_IN_SHELF, {
				pieceId: pieceId,
			})
		}, 100)
	}, [adLibPieces, adLibActions])

	return (
		<StudioContext.Consumer>
			{(studio) => {
				if (!studio) return null

				return (
					<LinePartIndicator
						allSourceLayers={sourceLayers}
						count={allAdLibLabels.length}
						label={label.substring(0, 1)}
						thisSourceLayer={sourceLayers[0]}
						hasOriginInPreceedingPart={false}
						studio={studio}
						piece={adLibPieces[0]}
						onClick={onClick}
					/>
				)
			}}
		</StudioContext.Consumer>
	)
}
