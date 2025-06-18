import type { ITranslatableMessage } from '@sofie-automation/blueprints-integration'
import { isTranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import type { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'

function compareLabels(a: string | ITranslatableMessage, b: string | ITranslatableMessage) {
	const actualA = isTranslatableMessage(a) ? a.key : (a as string)
	const actualB = isTranslatableMessage(b) ? b.key : (b as string)
	// can't use .localeCompare, because this needs to be locale-independent and always return
	// the same sorting order, because that's being relied upon by limit & pick/pickEnd.
	if (actualA > actualB) return 1
	if (actualA < actualB) return -1
	return 0
}

/** Sort a list of adlibs */
export function sortAdlibs<T>(
	adlibs: {
		adlib: T
		label: string | ITranslatableMessage
		adlibRank: number
		adlibId: ProtectedString<any> | string
		partRank: number | null
		segmentRank: number | null
		rundownRank: number | null
	}[]
): T[] {
	adlibs = adlibs.sort((a, b) => {
		// Sort by rundown rank, where applicable:
		a.rundownRank = a.rundownRank ?? Number.POSITIVE_INFINITY
		b.rundownRank = b.rundownRank ?? Number.POSITIVE_INFINITY
		if (a.rundownRank > b.rundownRank) return 1
		if (a.rundownRank < b.rundownRank) return -1

		// Sort by segment rank, where applicable:
		a.segmentRank = a.segmentRank ?? Number.POSITIVE_INFINITY
		b.segmentRank = b.segmentRank ?? Number.POSITIVE_INFINITY
		if (a.segmentRank > b.segmentRank) return 1
		if (a.segmentRank < b.segmentRank) return -1

		// Sort by part rank, where applicable:
		a.partRank = a.partRank ?? Number.POSITIVE_INFINITY
		b.partRank = b.partRank ?? Number.POSITIVE_INFINITY
		if (a.partRank > b.partRank) return 1
		if (a.partRank < b.partRank) return -1

		// Sort by adlib rank
		if (a.adlibRank > b.adlibRank) return 1
		if (a.adlibRank < b.adlibRank) return -1

		// Sort by labels:
		const r = compareLabels(a.label, b.label)
		if (r !== 0) return r

		// As a last resort, sort by ids:
		if (a.adlibId > b.adlibId) return 1
		if (a.adlibId < b.adlibId) return -1

		return 0
	})

	return adlibs.map((a) => a.adlib)
}
