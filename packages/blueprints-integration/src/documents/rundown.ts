import type { UserEditingDefinition } from '../userEditing.js'
import type { RundownPlaylistTiming } from './playlistTiming.js'

/** The Rundown generated from Blueprint */

export interface IBlueprintRundown<TPrivateData = unknown, TPublicData = unknown> {
	externalId: string
	/** Rundown slug - user-presentable name */
	name: string

	/** Rundown description: Longer user-presentable description of the rundown */
	description?: string

	/** Rundown timing information */
	timing: RundownPlaylistTiming

	/** Arbitraty data storage for internal use in the blueprints */
	privateData?: TPrivateData
	/** Arbitraty data relevant for other systems, made available to them through APIs */
	publicData?: TPublicData

	/** A hint to the Core that the Rundown should be a part of a playlist */
	playlistExternalId?: string

	/**
	 * Whether the end of the rundown marks a break in the show.
	 * Allows the Next Break timer in the Rundown Header to time to the end of this rundown when looking for the next break.
	 */
	endOfRundownIsShowBreak?: boolean

	/**
	 * User editing definitions for this rundown
	 */
	userEditOperations?: UserEditingDefinition[]
}
/** The Rundown sent from Core */

export interface IBlueprintRundownDB<TPrivateData = unknown, TPublicData = unknown>
	extends IBlueprintRundown<TPrivateData, TPublicData>, IBlueprintRundownDBData {}
/** Properties added to a rundown in Core */

export interface IBlueprintRundownDBData {
	_id: string

	/** Id of the showStyle variant used */
	showStyleVariantId: string

	/** RundownPlaylist this rundown is member of */
	playlistId?: string

	/** Air-status, comes from NCS, examples: "READY" | "NOT READY" */
	airStatus?: string
}

export interface IBlueprintSegmentRundown<TPrivateData = unknown, TPublicData = unknown> {
	externalId: string

	/** Arbitraty data storage for internal use in the blueprints */
	privateData?: TPrivateData
	/** Arbitraty data relevant for other systems, made available to them through APIs */
	publicData?: TPublicData
}
