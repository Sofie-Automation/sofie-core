import { RundownPlaylistTiming, Time } from '@sofie-automation/blueprints-integration'
import {
	RundownId,
	OrganizationId,
	StudioId,
	ShowStyleBaseId,
	PeripheralDeviceId,
	RundownPlaylistId,
	ShowStyleVariantId,
} from './Ids.js'
import { RundownNote } from './Notes.js'
import { ReadonlyDeep } from 'type-fest'
import { CoreUserEditingDefinition } from './UserEditingDefinitions.js'

export enum RundownOrphanedReason {
	/** Rundown is deleted from the source but we still need it */
	DELETED = 'deleted',
	/** Rundown was unsynced by the user */
	MANUAL = 'manual',
}

export interface RundownImportVersions {
	studio: string
	showStyleBase: string
	showStyleVariant: string
	blueprint: string

	core: string
}

export interface Rundown {
	_id: RundownId
	/** ID of the organization that owns the rundown */
	organizationId: OrganizationId | null
	/** The id of the Studio this rundown is in */
	studioId: StudioId

	/** The ShowStyleBase this Rundown uses (its the parent of the showStyleVariant) */
	showStyleBaseId: ShowStyleBaseId
	showStyleVariantId: ShowStyleVariantId
	/** A description og where the Rundown originated from */
	source: RundownSource
	created: Time
	modified: Time

	/** Revisions/Versions of various docs that when changed require the user to reimport the rundown */
	importVersions: RundownImportVersions

	status?: string

	/** Air-status, comes from NCS, examples: "READY" | "NOT READY" */
	airStatus?: string

	/**
	 * Is the rundown in an unsynced state?
	 * This can be because the rundown was deleted from the source, or because the user manually unsynced it
	 */
	orphaned?: RundownOrphanedReason

	/** Last sent storyStatus to ingestDevice (MOS) */
	notifiedCurrentPlayingPartExternalId?: string

	/** Holds notes (warnings / errors) thrown by the blueprints during creation */
	notes?: Array<RundownNote>

	externalId: string
	/** Rundown slug - user-presentable name */
	name: string

	/** Rundown description: Longer user-presentable description of the rundown */
	description?: string

	/** Rundown timing information */
	timing: RundownPlaylistTiming

	/** Arbitraty data storage for internal use in the blueprints */
	privateData?: unknown
	/** Arbitraty data relevant for other systems, made available to them through APIs */
	publicData?: unknown

	/** External id of the Rundown Playlist to put this rundown in */
	playlistExternalId?: string
	/** Whether the end of the rundown marks a commercial break */
	endOfRundownIsShowBreak?: boolean
	/** The id of the Rundown Playlist this rundown is in */
	playlistId: RundownPlaylistId
	/** If the playlistId has ben set manually by a user in Sofie */
	playlistIdIsSetInSofie?: boolean
	/**
	 * User editing definitions for this rundown
	 */
	userEditOperations?: CoreUserEditingDefinition[]
}

/** A description of where a Rundown originated from */
export type RundownSource =
	| RundownSourceNrcs
	| RundownSourceSnapshot
	| RundownSourceHttp
	| RundownSourceTesting
	| RundownSourceRestApi

/** A description of the external NRCS source of a Rundown */
export interface RundownSourceNrcs {
	type: 'nrcs'
	/** The peripheral device the rundown originates from */
	peripheralDeviceId: PeripheralDeviceId
	/** Name (user-facing) of the external NRCS this rundown came from, if known */
	nrcsName: string | undefined
}
/** A description of the source of a Rundown which was restored from a snapshot */
export interface RundownSourceSnapshot {
	type: 'snapshot'
	/** Original id of the rundown the snapshot was created from */
	rundownId: RundownId
}
/** A description of the source of a Rundown which was through the HTTP ingest API */
export interface RundownSourceHttp {
	type: 'http'
}
/** A description of the Adlib Testing source of a Rundown */
export interface RundownSourceTesting {
	type: 'testing'
	/** The ShowStyleVariant the Rundown is created for */
	showStyleVariantId: ShowStyleVariantId
}
/** A description of the source of a Rundown which was through the new HTTP ingest API */
export interface RundownSourceRestApi {
	type: 'restApi'
	resyncUrl: string
}

export function getRundownNrcsName(rundown: ReadonlyDeep<Pick<DBRundown, 'source'>> | undefined): string {
	if (rundown?.source?.type === 'nrcs' && rundown.source.nrcsName) {
		return rundown.source.nrcsName
	} else {
		return 'NRCS'
	}
}

/** Note: Use Rundown instead */
export type DBRundown = Rundown
