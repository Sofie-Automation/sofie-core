/*
This file contains various short-hand functions intended to be used for "light" fetches from collections.
Like instead of fetching a full Blueprint or Studio it's enough to just fetch a small part of it.
(Because this reduces the load and amount of data transferred)
*/

import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Blueprints } from './collections'

export async function fetchBlueprintLight(blueprintId: BlueprintId): Promise<BlueprintLight | undefined> {
	return Blueprints.findOneAsync(blueprintId, {
		projection: {
			code: 0,
		},
	})
}
export type BlueprintLight = Omit<Blueprint, 'code'>
