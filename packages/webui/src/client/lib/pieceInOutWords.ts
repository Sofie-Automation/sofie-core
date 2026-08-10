export interface PieceInOutWords {
	begin: string
	end: string
}

export interface PieceInOutWordsSource {
	name: string
	content?: unknown
}

/**
 * Resolve first/last (in/out) words for timeline and related UI labels.
 *
 * Prefers `content.firstWords` / `content.lastWords` when present on the piece content
 * (e.g. ScriptContent, VTContent). Falls back to the legacy `piece.name` format where
 * first and last words are separated by `||`.
 */
export function getPieceInOutWords(piece: PieceInOutWordsSource): PieceInOutWords {
	const content = piece.content
	if (content !== null && typeof content === 'object') {
		if ('firstWords' in content || 'lastWords' in content) {
			const { firstWords, lastWords } = content as { firstWords?: string; lastWords?: string }
			return {
				begin: firstWords ?? '',
				end: lastWords ?? '',
			}
		}
	}

	const labelItems = (piece.name || '').split('||')
	return {
		begin: labelItems[0] || '',
		end: labelItems[1] || '',
	}
}
