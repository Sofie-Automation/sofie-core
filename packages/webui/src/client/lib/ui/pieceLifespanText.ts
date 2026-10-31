import type { TFunction } from 'i18next'
import type { PieceLifespanInfo } from '@sofie-automation/blueprints-integration'
import type { PieceLifespanScope } from '@sofie-automation/shared-lib/dist/core/model/Rundown'
import { PieceLifespan } from '@sofie-automation/corelib/dist/playout/pieceLifespan'

/** Scope names as used inside the lifespan texts. The `lifespan` context keeps them apart from the generic UI labels. */
function getScopeNames(t: TFunction): Record<Exclude<PieceLifespanScope, 'part'>, string> {
	const context = 'lifespan'
	return {
		segment: t('Segment', { context }),
		rundown: t('Rundown', { context }),
		showstyle: t('Showstyle', { context }),
		playlist: t('Playlist', { context }),
	}
}

/** Describes until when a piece with the given lifespan will be on air */
export function getPieceLifespanText(t: TFunction, lifespanInfo: PieceLifespanInfo): string {
	const lifespan = PieceLifespan.from(lifespanInfo)
	if (lifespan.scope === 'part') return t('Ends at Take')

	const scope = getScopeNames(t)[lifespan.scope]
	const end = lifespan.followsPlayhead
		? t('Ends outside {{scope}}', { scope })
		: t('Ends at {{scope}} End', { scope })

	return lifespan.persistsInShadow ? t('{{end}} (resumes)', { end }) : end
}
