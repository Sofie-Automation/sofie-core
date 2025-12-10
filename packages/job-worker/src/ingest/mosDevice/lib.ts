import { MOS } from '@sofie-automation/corelib'
import { IngestRundown, IngestSegment } from '@sofie-automation/blueprints-integration'
import _ from 'underscore'

export function fixIllegalObject(o: unknown): void {
	if (_.isArray(o)) {
		_.each(o, (val, _key) => {
			fixIllegalObject(val)
		})
	} else if (_.isObject(o)) {
		_.each(_.keys(o), (key: string) => {
			const val = o[key]
			if ((key + '').match(/^\$/)) {
				const newKey = key.replace(/^\$/, '@')
				o[newKey] = val
				delete o[key]
				key = newKey
			}
			fixIllegalObject(val)
		})
	}
}

const mosTypes = MOS.getMosTypes(false)
export function parseMosString(str: MOS.IMOSString128): string {
	if (!str) throw new Error('parseMosString: str parameter missing!')
	if (mosTypes.mosString128.is(str)) return mosTypes.mosString128.stringify(str)
	return (str as any).toString()
}

export function getMosIngestSegmentExternalId(partExternalId: string): string {
	return `segment-${partExternalId}`
}

export function updateRanksBasedOnOrder(ingestRundown: IngestRundown): void {
	ingestRundown.segments.forEach((segment, i) => {
		segment.rank = i

		segment.parts.forEach((part, j) => {
			part.rank = j
		})
	})
}

export function mosStoryToIngestSegment(mosStory: MOS.IMOSStory, undefinedPayload: boolean): IngestSegment {
	const partExternalId = parseMosString(mosStory.ID)

	const name = mosStory.Slug ? parseMosString(mosStory.Slug) : ''
	return {
		externalId: getMosIngestSegmentExternalId(partExternalId),
		name: name,
		rank: 0, // Set later
		parts: [
			{
				externalId: partExternalId,
				name: name,
				rank: 0,
				payload: undefinedPayload ? undefined : {},
			},
		],
		payload: undefined,
	}
}
