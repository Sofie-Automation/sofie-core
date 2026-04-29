import { Meteor } from 'meteor/meteor'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
	convertSourceLayerItemToPreview,
	type IPreviewPopUpContext,
	type IPreviewPopUpSession,
} from '../../PreviewPopUp/PreviewPopUpContext.js'
import type { ISourceLayer } from '@sofie-automation/blueprints-integration'
import type { IAdLibListItem } from '../AdLibListItem.js'
import type { ReadonlyDeep } from 'type-fest'
import type { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { HOVER_TIMEOUT } from './types'

export function usePreviewPopUpSession(args: {
	previewContext: IPreviewPopUpContext
	layerType: ISourceLayer['type'] | undefined
	piece: IAdLibListItem
	contentStatus: ReadonlyDeep<PieceContentStatusObj> | undefined
}): {
	openPreview: (e: EventTarget, time: number) => void
	closePreview: () => void
	setPointerTime: (time: number) => void
	hasPreview: boolean
} {
	const previewSessionRef = useRef<IPreviewPopUpSession | null>(null)
	const hoverTimeoutRef = useRef<number | null>(null)

	useEffect(() => {
		return () => {
			if (hoverTimeoutRef.current) {
				Meteor.clearTimeout(hoverTimeoutRef.current)
				hoverTimeoutRef.current = null
			}
			if (previewSessionRef.current) {
				previewSessionRef.current.close()
				previewSessionRef.current = null
			}
		}
	}, [])

	const previewRequest = useMemo(() => {
		return convertSourceLayerItemToPreview(args.layerType, args.piece, args.contentStatus)
	}, [args.layerType, args.piece, args.contentStatus])

	const startHoverTimeout = useCallback(() => {
		if (hoverTimeoutRef.current) Meteor.clearTimeout(hoverTimeoutRef.current)
		hoverTimeoutRef.current = Meteor.setTimeout(() => {
			hoverTimeoutRef.current = null
		}, HOVER_TIMEOUT)
	}, [])

	const openPreview = useCallback(
		(e: EventTarget, time: number) => {
			if (!previewRequest.contents.length) return
			previewSessionRef.current?.close()
			previewSessionRef.current = args.previewContext.requestPreview(e as any, previewRequest.contents, {
				...previewRequest.options,
				time,
			})
			startHoverTimeout()
		},
		[args.previewContext, previewRequest, startHoverTimeout]
	)

	const closePreview = useCallback(() => {
		if (hoverTimeoutRef.current) {
			Meteor.clearTimeout(hoverTimeoutRef.current)
			hoverTimeoutRef.current = null
		}
		if (previewSessionRef.current) {
			previewSessionRef.current.close()
			previewSessionRef.current = null
		}
	}, [])

	const setPointerTime = useCallback(
		(time: number) => {
			previewSessionRef.current?.setPointerTime(time)
			if (hoverTimeoutRef.current) {
				Meteor.clearTimeout(hoverTimeoutRef.current)
				startHoverTimeout()
			}
		},
		[startHoverTimeout]
	)

	return {
		openPreview,
		closePreview,
		setPointerTime,
		hasPreview: previewRequest.contents.length > 0,
	}
}
