import type { TFunction } from 'i18next'
import type { PieceLifespanInfo } from '@sofie-automation/blueprints-integration'
import { PieceLifespan } from '@sofie-automation/corelib/dist/playout/pieceLifespan'

/** Describes until when a piece with the given lifespan will be on air */
// TODO: Simplify this function, less repetition.
export function getPieceLifespanText(t: TFunction, lifespanInfo: PieceLifespanInfo): string {
	const lifespan = PieceLifespan.from(lifespanInfo)

	if (lifespan.tracksPlayhead) {
		switch (lifespan.scope) {
			case 'part':
				return t('Until next take')
			case 'segment':
				return t('Until next segment')
			case 'rundown':
				return t('Until next rundown')
			case 'showstyle':
				return t('Until next showstyle')
			case 'playlist':
				return t('Until end of playlist')
		}
	} else {
		switch (lifespan.scope) {
			case 'part':
				return t('Until next take')
			case 'segment':
				return t('Until end of segment')
			case 'rundown':
				return t('Until end of rundown')
			case 'showstyle':
				return t('Until end of showstyle')
			case 'playlist':
				return t('Until end of playlist')
		}
	}
}
