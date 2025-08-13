import { ProtectedString } from '../../lib/protectedString.js'

/** A string, identifying a Studio */
export type StudioId = ProtectedString<'StudioId'>

/** A string, identifying a PeripheralDevice */
export type PeripheralDeviceId = ProtectedString<'PeripheralDeviceId'>

/** A string, identifying a PeripheralDeviceCommand */
export type PeripheralDeviceCommandId = ProtectedString<'PeripheralDeviceCommandId'>

export type TimelineHash = ProtectedString<'TimelineHash'>

/** A string, identifying a PieceInstance */
export type PieceInstanceId = ProtectedString<'PieceInstanceId'>

/** A string, identifying a PartInstance */
export type PartInstanceId = ProtectedString<'PartInstanceId'>

/** A string, identifying a Rundown */
export type RundownId = ProtectedString<'RundownId'>

/** A string, identifying a RundownPlaylist */
export type RundownPlaylistId = ProtectedString<'RundownPlaylistId'>

/** A string, identifying a MediaObj */
export type MediaObjId = ProtectedString<'MediaObjId'>

export type ExpectedPackageId = ProtectedString<'ExpectedPackageId'>

export type ExpectedPackageWorkStatusId = ProtectedString<'ExpectedPackageStatusId'>

/** A string, identifying a TimelineDatastore entry */
export type TimelineDatastoreEntryId = ProtectedString<'TimelineDatastoreEntryId'>

/** A string, identifying a Part */
export type PartId = ProtectedString<'PartId'>

/** A string, identifying a ShowStyleBase */
export type ShowStyleBaseId = ProtectedString<'ShowStyleBaseId'>

/** A string identifying a triggered action */
export type TriggeredActionId = ProtectedString<'TriggeredActionId'>

/** A string identifying a particular set of Mappings currently set in a Studio */
export type MappingsHash = ProtectedString<'MappingsHash'>

/** A Timeline JSON Blob */
export type TimelineBlob = ProtectedString<'TimelineBlob'>
